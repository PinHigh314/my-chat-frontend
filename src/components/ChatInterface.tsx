"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  SendHorizonal,
  Loader2,
  StopCircle,
  Pause,
  Play,
  VolumeX,
} from "lucide-react";

interface Message {
  id: string;
  text: string;
  sender: "user" | "agent";
}

interface HistoryMessage {
  sender: "user" | "agent";
  text: string;
}

const N8N_WEBHOOK_URL =
  "https://n8n-production-f196.up.railway.app/webhook-test/n8n";
const MIC_TIMEOUT_DURATION = 10000; // 10 seconds

interface CustomSpeechRecognition extends SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition | typeof CustomSpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition | typeof CustomSpeechRecognition;
  }
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMicManuallyPaused, setIsMicManuallyPaused] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [micTimeoutProgress, setMicTimeoutProgress] = useState(0);

  const recognitionRef = useRef<CustomSpeechRecognition | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const agentAudioRef = useRef<HTMLAudioElement | null>(null);
  const micTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const micOnSoundRef = useRef<HTMLAudioElement | null>(null);
  const micOffSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize placeholder audio elements for mic on/off sounds
    // User should replace '/sounds/mic-on.wav' and '/sounds/mic-off.wav' with actual paths to their sound files
    if (typeof Audio !== "undefined") {
      micOnSoundRef.current = new Audio("/sounds/mic-on.wav"); // Placeholder path
      micOffSoundRef.current = new Audio("/sounds/mic-off.wav"); // Placeholder path
      // Preload can be attempted, but browsers might restrict it
      // micOnSoundRef.current.preload = "auto";
      // micOffSoundRef.current.preload = "auto";
    }
  }, []);

  const playMicOnSound = () => {
    micOnSoundRef.current?.play().catch(e => console.warn("Mic on sound play failed:", e));
  };

  const playMicOffSound = () => {
    micOffSoundRef.current?.play().catch(e => console.warn("Mic off sound play failed:", e));
  };

  const stopAgentAudio = () => {
    if (agentAudioRef.current) {
      agentAudioRef.current.pause();
      agentAudioRef.current.currentTime = 0;
    }
    window.speechSynthesis.cancel();
    setIsAgentSpeaking(false);
  };

  const speakText = (text: string, audioData?: string) => {
    stopAgentAudio(); // Stop any previous agent audio

    if (audioData) {
      try {
        const audioSrc = `data:audio/mp3;base64,${audioData}`;
        if (!agentAudioRef.current) {
          agentAudioRef.current = new Audio();
        }
        agentAudioRef.current.src = audioSrc;
        setIsAgentSpeaking(true);
        agentAudioRef.current.play().catch((e) => {
          console.error("Error playing agent audio:", e);
          setIsAgentSpeaking(false);
          // Fallback to browser synthesis if direct play fails for some reason
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.onstart = () => setIsAgentSpeaking(true);
          utterance.onend = () => setIsAgentSpeaking(false);
          utterance.onerror = () => setIsAgentSpeaking(false);
          window.speechSynthesis.speak(utterance);
        });
        agentAudioRef.current.onended = () => setIsAgentSpeaking(false);
        agentAudioRef.current.onerror = () => setIsAgentSpeaking(false);
      } catch (e) {
        console.error("Error setting up agent audio from data:", e);
        setIsAgentSpeaking(false);
      }
    } else if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onstart = () => setIsAgentSpeaking(true);
      utterance.onend = () => setIsAgentSpeaking(false);
      utterance.onerror = () => setIsAgentSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } else {
      console.warn("Speech Synthesis API not supported in this browser.");
    }
  };

  const clearMicTimeout = () => {
    if (micTimeoutIdRef.current) {
      clearInterval(micTimeoutIdRef.current);
      micTimeoutIdRef.current = null;
    }
    setMicTimeoutProgress(0);
  };

  const sendTextMessage = async (textToSend: string) => {
    if (textToSend.trim() === "" || isLoading) return;
    clearMicTimeout();

    const newUserMessage: Message = {
      id: Date.now().toString(),
      text: textToSend,
      sender: "user",
    };

    const currentHistory: HistoryMessage[] = messages.map((msg) => ({
      sender: msg.sender,
      text: msg.text,
    }));

    setMessages((prevMessages) => [...prevMessages, newUserMessage]);
    setIsLoading(true);

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: textToSend, history: currentHistory }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `Network response was not ok: ${response.status} ${response.statusText}. Details: ${errorData}`
        );
      }

      const data = await response.json();

      if (data && (data.reply || data.audioData)) {
        const agentResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: data.reply || "", // Use empty string if only audioData is present
          sender: "agent",
        };
        setMessages((prevMessages) => [...prevMessages, agentResponse]);
        speakText(data.reply || "Playing audio...", data.audioData);
      } else {
        console.error("Agent response format is incorrect:", data);
        const errorText =
          "Sorry, I received an unexpected response from the agent.";
        setMessages((prevMessages) => [
          ...prevMessages,
          { id: (Date.now() + 1).toString(), text: errorText, sender: "agent" },
        ]);
        speakText(errorText);
      }
    } catch (error) {
      console.error("Error sending message to agent:", error);
      const errorText =
        "Sorry, I had trouble connecting to the agent. Please try again.";
      setMessages((prevMessages) => [
        ...prevMessages,
        { id: (Date.now() + 1).toString(), text: errorText, sender: "agent" },
      ]);
      speakText(errorText);
    }
    setIsLoading(false);
  };

  const handleSendMessage = async () => {
    if (inputValue.trim() === "") return;
    sendTextMessage(inputValue);
    setInputValue("");
  };

  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      recognitionRef.current = new SpeechRecognitionAPI() as CustomSpeechRecognition;
      const recognition = recognitionRef.current;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        clearMicTimeout();
        const transcript = event.results[0][0].transcript;
        sendTextMessage(transcript);
        setIsListening(false);
        playMicOffSound();
      };

      recognition.onerror = (event) => {
        clearMicTimeout();
        console.error("Speech recognition error:", event.error);
        let errorMessageText = "Speech recognition error. Please try again.";
        if (event.error === "no-speech") {
          errorMessageText = "No speech detected. Please try again.";
        } else if (event.error === "audio-capture") {
          errorMessageText = "Microphone error. Please check your microphone.";
        } else if (event.error === "not-allowed") {
          errorMessageText =
            "Microphone access denied. Please allow microphone access.";
        }
        setMessages((prevMessages) => [
          ...prevMessages,
          { id: (Date.now() + 1).toString(), text: errorMessageText, sender: "agent" },
        ]);
        speakText(errorMessageText);
        setIsListening(false);
        setIsMicManuallyPaused(false);
        playMicOffSound();
      };

      recognition.onend = () => {
        // This onend can be triggered by stop() or naturally.
        // If it wasn't a manual pause, ensure listening state is false.
        if (!isMicManuallyPaused) {
            setIsListening(false);
        }
        // Don't clear timeout here if it was due to timeout itself.
        // playMicOffSound(); // Already called in onresult and onerror
      };
    } else {
      console.warn("Speech Recognition API not supported in this browser.");
    }

    return () => {
      clearMicTimeout();
      if (recognitionRef.current && (isListening || isMicManuallyPaused)) {
        recognitionRef.current.stop();
      }
      stopAgentAudio();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // isMicManuallyPaused removed from deps to avoid re-init on pause

  const startListening = () => {
    if (!recognitionRef.current) return;
    stopAgentAudio(); // Interrupt agent if speaking
    setInputValue("");
    recognitionRef.current.start();
    setIsListening(true);
    setIsMicManuallyPaused(false);
    playMicOnSound();
    clearMicTimeout();

    let progress = 0;
    setMicTimeoutProgress(0);
    micTimeoutIdRef.current = setInterval(() => {
      progress += 100; // Update every 100ms
      const percentage = (progress / MIC_TIMEOUT_DURATION) * 100;
      setMicTimeoutProgress(percentage);
      if (progress >= MIC_TIMEOUT_DURATION) {
        clearMicTimeout();
        if (recognitionRef.current && isListening && !isMicManuallyPaused) {
          console.log("Mic timeout, stopping recognition.");
          recognitionRef.current.stop(); // This will trigger onresult or onerror
          // Note: onresult will handle sending the message
        }
        setIsListening(false); // Ensure listening is set to false
        playMicOffSound();
      }
    }, 100);
  };

  const stopListening = (manualStop: boolean = true) => {
    clearMicTimeout();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    if (manualStop) {
        playMicOffSound();
    }
  };

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      const noSupportText = "Sorry, voice input is not supported in your browser.";
      setMessages((prevMessages) => [
        ...prevMessages,
        { id: (Date.now() + 1).toString(), text: noSupportText, sender: "agent" },
      ]);
      speakText(noSupportText);
      return;
    }

    if (isListening && !isMicManuallyPaused) { // Currently listening, about to pause
      setIsMicManuallyPaused(true);
      clearMicTimeout(); // Pause the timer
      if (recognitionRef.current) {
        recognitionRef.current.stop(); // Stop current recognition to pause
      }
      // Don't play mic off sound for manual pause, as it's not truly off
    } else { // Not listening OR manually paused, about to start/resume
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(() => {
          startListening();
        })
        .catch((err) => {
          console.error("Error accessing microphone:", err);
          let errorText = "Could not access microphone. Please check permissions.";
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            errorText =
              "Microphone access denied. Please allow microphone access.";
          }
          setMessages((prevMessages) => [
            ...prevMessages,
            { id: (Date.now() + 1).toString(), text: errorText, sender: "agent" },
          ]);
          speakText(errorText);
          setIsListening(false);
          setIsMicManuallyPaused(false);
        });
    }
  };
  
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4 bg-white shadow-xl rounded-lg">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
        Chat with RAG Agent
      </h1>
      <div className="relative">
        {isAgentSpeaking && (
            <button 
                onClick={stopAgentAudio}
                className="absolute top-0 right-0 mt-1 mr-1 z-10 p-2 bg-gray-300 hover:bg-gray-400 rounded-full text-gray-700"
                title="Stop agent audio"
            >
                <VolumeX size={20} />
            </button>
        )}
        <div
            ref={chatContainerRef}
            className="h-[60vh] border border-gray-300 rounded-lg p-4 mb-4 overflow-y-auto bg-gray-50 space-y-4"
        >
            {messages.map((msg) => (
            <div
                key={msg.id}
                className={`flex ${
                msg.sender === "user" ? "justify-end" : "justify-start"
                }`}
            >
                <div
                className={`p-3 rounded-xl max-w-[70%] shadow ${
                    msg.sender === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-800"
                }`}
                >
                {msg.text}
                </div>
            </div>
            ))}
            {isLoading && !isListening && (
            <div className="flex justify-start">
                <div className="p-3 rounded-xl max-w-[70%] shadow bg-gray-200 text-gray-800">
                <Loader2 className="animate-spin h-5 w-5" />
                </div>
            </div>
            )}
        </div>
      </div>
      
      {isListening && !isMicManuallyPaused && (
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2 dark:bg-gray-700">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-100 ease-linear"
            style={{ width: `${micTimeoutProgress}%` }}
          ></div>
        </div>
      )}

      <div className="flex items-center border-t border-gray-200 pt-4">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && !isLoading && !isListening && handleSendMessage()}
          placeholder={isListening && !isMicManuallyPaused ? "Listening... (10s)" : (isMicManuallyPaused ? "Mic paused. Click to resume." : "Type your message...")}
          className="flex-grow border border-gray-300 rounded-l-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
          disabled={isLoading || (isListening && !isMicManuallyPaused)}
        />
        <button
          onClick={handleMicClick}
          className={`p-3 border-y border-l border-gray-300 transition-colors duration-150 ease-in-out disabled:opacity-50 ${
            isListening && !isMicManuallyPaused
              ? "bg-red-500 hover:bg-red-600 text-white" // Listening active -> show StopCircle (to stop and send)
              : isMicManuallyPaused 
              ? "bg-yellow-500 hover:bg-yellow-600 text-white" // Manually Paused -> show Play (to resume)
              : "bg-gray-200 hover:bg-gray-300 text-gray-600" // Idle -> show Mic (to start)
          }`}
          title={
            isListening && !isMicManuallyPaused
              ? "Pause listening"
              : isMicManuallyPaused
              ? "Resume listening"
              : "Start voice input"
          }
          disabled={isLoading}
        >
          {isListening && !isMicManuallyPaused ? (
            <Pause size={24} />
          ) : isMicManuallyPaused ? (
            <Play size={24} />
          ) : (
            <Mic size={24} />
          )}
        </button>
        <button
          onClick={handleSendMessage}
          className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-r-md font-semibold transition-colors duration-150 ease-in-out disabled:opacity-50"
          disabled={isLoading || inputValue.trim() === "" || isListening || isMicManuallyPaused}
        >
          {isLoading && !isListening ? (
            <Loader2 className="animate-spin h-5 w-5" />
          ) : (
            <SendHorizonal size={24} />
          )}
        </button>
      </div>
    </div>
  );
}


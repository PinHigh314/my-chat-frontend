"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, SendHorizonal, Loader2, StopCircle } from "lucide-react";

interface Message {
  id: string;
  text: string;
  sender: "user" | "agent";
}

const N8N_WEBHOOK_URL =
  "https://n8n-production-f196.up.railway.app/webhook-test/n8n";

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
  const recognitionRef = useRef<CustomSpeechRecognition | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null); // Ref for chat container

  // Function to speak text using Web Speech API
  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      // Stop any ongoing speech before starting new one
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      // Optional: Configure voice, rate, pitch (can be added later)
      // utterance.voice = window.speechSynthesis.getVoices()[0]; // Example: use the first available voice
      // utterance.pitch = 1;
      // utterance.rate = 1;
      window.speechSynthesis.speak(utterance);
    } else {
      console.warn("Speech Synthesis API not supported in this browser.");
    }
  };

  const sendTextMessage = async (textToSend: string) => {
    if (textToSend.trim() === "" || isLoading) return;

    const newUserMessage: Message = {
      id: Date.now().toString(),
      text: textToSend,
      sender: "user",
    };
    setMessages((prevMessages) => [...prevMessages, newUserMessage]);
    setIsLoading(true);

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: textToSend }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `Network response was not ok: ${response.status} ${response.statusText}. Details: ${errorData}`
        );
      }

      const data = await response.json();

      if (data && data.reply) {
        const agentResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: data.reply,
          sender: "agent",
        };
        setMessages((prevMessages) => [...prevMessages, agentResponse]);
        speakText(data.reply); // Speak the agent's reply
      } else {
        console.error("Agent response format is incorrect:", data);
        const errorText = "Sorry, I received an unexpected response from the agent.";
        const errorResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: errorText,
          sender: "agent",
        };
        setMessages((prevMessages) => [...prevMessages, errorResponse]);
        speakText(errorText);
      }
    } catch (error) {
      console.error("Error sending message to agent:", error);
      const errorText = "Sorry, I had trouble connecting to the agent. Please try again.";
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: errorText,
        sender: "agent",
      };
      setMessages((prevMessages) => [...prevMessages, errorResponse]);
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
        const transcript = event.results[0][0].transcript;
        // setInputValue(transcript); // Don't set input value, just send
        sendTextMessage(transcript);
        setIsListening(false);
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        let errorMessageText = "Speech recognition error. Please try again.";
        if (event.error === "no-speech") {
          errorMessageText = "No speech detected. Please try again.";
        } else if (event.error === "audio-capture") {
          errorMessageText = "Microphone error. Please check your microphone.";
        } else if (event.error === "not-allowed") {
          errorMessageText =
            "Microphone access denied. Please allow microphone access in your browser settings.";
        }
        const errorResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: errorMessageText,
          sender: "agent",
        };
        setMessages((prevMessages) => [...prevMessages, errorResponse]);
        speakText(errorMessageText);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };
    } else {
      console.warn("Speech Recognition API not supported in this browser.");
    }

    return () => {
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
      }
      window.speechSynthesis.cancel(); // Cancel any speech on unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      const noSupportText = "Sorry, voice input is not supported in your browser.";
      const noSupportMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: noSupportText,
        sender: "agent",
      };
      setMessages((prevMessages) => [...prevMessages, noSupportMessage]);
      speakText(noSupportText);
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(() => {
          setInputValue(""); 
          recognitionRef.current?.start();
          setIsListening(true);
        })
        .catch((err) => {
          console.error("Error accessing microphone:", err);
          let errorText = "Could not access microphone. Please check permissions.";
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            errorText =
              "Microphone access denied. Please allow microphone access in your browser settings.";
          }
          const errorResponse: Message = {
            id: (Date.now() + 1).toString(),
            text: errorText,
            sender: "agent",
          };
          setMessages((prevMessages) => [...prevMessages, errorResponse]);
          speakText(errorText);
          setIsListening(false);
        });
    }
  };

  // Scroll to bottom when messages change
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
      <div
        ref={chatContainerRef}
        className="flex-grow border border-gray-300 rounded-lg p-4 mb-4 overflow-y-auto bg-gray-50 space-y-4"
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
        {isLoading && (
          <div className="flex justify-start">
            <div className="p-3 rounded-xl max-w-[70%] shadow bg-gray-200 text-gray-800">
              <Loader2 className="animate-spin h-5 w-5" />
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center border-t border-gray-200 pt-4">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
          placeholder={isListening ? "Listening..." : "Type your message..."}
          className="flex-grow border border-gray-300 rounded-l-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
          disabled={isLoading || isListening}
        />
        <button
          onClick={handleMicClick}
          className={`p-3 border-y border-gray-300 transition-colors duration-150 ease-in-out disabled:opacity-50 ${
            isListening
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-gray-200 hover:bg-gray-300 text-gray-600"
          }`}
          title={isListening ? "Stop listening" : "Start voice input"}
          disabled={isLoading}
        >
          {isListening ? <StopCircle size={24} /> : <Mic size={24} />}
        </button>
        <button
          onClick={handleSendMessage}
          className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-r-md font-semibold transition-colors duration-150 ease-in-out disabled:opacity-50"
          disabled={isLoading || inputValue.trim() === "" || isListening}
        >
          {isLoading ? (
            <Loader2 className="animate-spin h-5 w-5" />
          ) : (
            <SendHorizonal size={24} />
          )}
        </button>
      </div>
    </div>
  );
}


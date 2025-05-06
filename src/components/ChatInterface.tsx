"use client";

import React, { useState } from 'react';
import { Mic, SendHorizonal, Loader2 } from 'lucide-react'; // Import SendHorizonal and Loader2

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'agent';
}

const N8N_WEBHOOK_URL = "https://n8n-production-f196.up.railway.app/workflow/nzCuf9XpvJ4QRi6P";

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    if (inputValue.trim() === '' || isLoading) return;

    const newUserMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
    };
    setMessages((prevMessages) => [...prevMessages, newUserMessage]);
    const currentInput = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: currentInput }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Network response was not ok: ${response.status} ${response.statusText}. Details: ${errorData}`);
      }

      const data = await response.json();
      
      if (data && data.reply) {
        const agentResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: data.reply,
          sender: 'agent',
        };
        setMessages((prevMessages) => [...prevMessages, agentResponse]);
      } else {
        console.error('Agent response format is incorrect:', data);
        const errorResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: 'Sorry, I received an unexpected response from the agent.',
          sender: 'agent',
        };
        setMessages((prevMessages) => [...prevMessages, errorResponse]);
      }
    } catch (error) {
      console.error('Error sending message to agent:', error);
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I had trouble connecting to the agent. Please try again.',
        sender: 'agent',
      };
      setMessages((prevMessages) => [...prevMessages, errorResponse]);
    }
    setIsLoading(false);
  };

  const handleMicClick = () => {
    // Placeholder for future voice input functionality
    console.log('Microphone clicked - voice input not implemented yet.');
    // For now, let's add a placeholder message
     const micPlaceholderMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: '[Voice input not implemented yet]',
      sender: 'agent',
    };
    setMessages((prevMessages) => [...prevMessages, micPlaceholderMessage]);
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4 bg-white shadow-xl rounded-lg">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Chat with RAG Agent</h1>
      <div className="flex-grow border border-gray-300 rounded-lg p-4 mb-4 overflow-y-auto bg-gray-50 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`p-3 rounded-xl max-w-[70%] shadow ${ 
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-800'
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
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type your message..."
          className="flex-grow border border-gray-300 rounded-l-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
          disabled={isLoading}
        />
        <button
          onClick={handleMicClick}
          className="bg-gray-200 hover:bg-gray-300 text-gray-600 p-3 border-y border-gray-300 transition-colors duration-150 ease-in-out disabled:opacity-50"
          title="Voice input (not implemented)"
          disabled={isLoading}
        >
          <Mic size={24} />
        </button>
        <button
          onClick={handleSendMessage}
          className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-r-md font-semibold transition-colors duration-150 ease-in-out disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <SendHorizonal size={24} />}
        </button>
      </div>
    </div>
  );
}


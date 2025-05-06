import React, { useState } from 'react';
import { Mic } from 'lucide-react'; // Import the Mic icon

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'agent';
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');

  const handleSendMessage = () => {
    if (inputValue.trim() === '') return;

    const newUserMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
    };
    setMessages((prevMessages) => [...prevMessages, newUserMessage]);
    setInputValue('');

    // Simulate agent response
    setTimeout(() => {
      const agentResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: `Agent responding to: ${newUserMessage.text}`,
        sender: 'agent',
      };
      setMessages((prevMessages) => [...prevMessages, agentResponse]);
    }, 1000);
  };

  const handleMicClick = () => {
    // Placeholder for future voice input functionality
    console.log('Microphone clicked - voice input not implemented yet.');
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
      </div>
      <div className="flex items-center border-t border-gray-200 pt-4">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type your message..."
          className="flex-grow border border-gray-300 rounded-l-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
        />
        {/* Microphone Button */}
        <button
          onClick={handleMicClick}
          className="bg-gray-200 hover:bg-gray-300 text-gray-600 p-3 border-y border-gray-300 transition-colors duration-150 ease-in-out"
          title="Voice input (not implemented)"
        >
          <Mic size={24} />
        </button>
        {/* Send Button */}
        <button
          onClick={handleSendMessage}
          className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-r-md font-semibold transition-colors duration-150 ease-in-out"
        >
          Send
        </button>
      </div>
    </div>
  );
}


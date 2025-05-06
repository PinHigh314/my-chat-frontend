"use client";

import ChatInterface from "@/components/ChatInterface";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 text-white">
      <ChatInterface />
    </main>
  );
}


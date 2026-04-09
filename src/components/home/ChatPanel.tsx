/**
 * ChatPanel – Contextual chat for the Home dashboard.
 * Supports language/channel tabs with message list and quick input.
 */
import React, { useState, useRef, useEffect } from "react";
import { Send, MessageSquare } from "lucide-react";

interface ChatMessage {
  id: number;
  userId: string;
  username: string;
  message: string;
  createdAt: number;
  channel?: string;
}

interface ChatPanelProps {
  currentUser: { id: string; username: string; regionId: string };
}

/** Time-ago formatter */
const timeAgo = (ts: number): string => {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'ora';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m fa`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h fa`;
  return `${Math.floor(diff / 86400000)}g fa`;
};

export default function ChatPanel({ currentUser }: ChatPanelProps) {
  const [channel, setChannel] = useState<'global' | 'local'>('global');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  useEffect(() => {
    let active = true;
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/chat?channel=${encodeURIComponent(channel)}`);
        if (res.ok && active) {
          const data = await res.json();
          setMessages(Array.isArray(data) ? data : []);
        }
      } catch { /* silently fail for mock */ }
    };
    fetchMessages();
    const iv = setInterval(fetchMessages, 15000);
    return () => { active = false; clearInterval(iv); };
  }, [channel]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input.trim(), channel }),
      });
      setInput('');
    } catch { /* ignore */ }
    setLoading(false);
  };

  const channels = [
    { id: 'global' as const, label: '🌍 Globale' },
    { id: 'local' as const, label: '📍 Locale' },
  ];

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">💬 Chat</h3>

      {/* Channel Tabs */}
      <div className="flex gap-1.5 px-1">
        {channels.map((ch) => (
          <button
            key={ch.id}
            onClick={() => setChannel(ch.id)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
              channel === ch.id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800/50 text-gray-400 hover:text-gray-300'
            }`}
          >
            {ch.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-3 h-40 overflow-y-auto space-y-2 scrollbar-hide"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <MessageSquare className="w-5 h-5 text-gray-600 mb-1" />
            <p className="text-[10px] text-gray-500">Nessun messaggio</p>
          </div>
        ) : (
          messages.slice(-30).map((msg) => (
            <div key={msg.id} className="text-xs">
              <span className="font-bold text-indigo-400">{msg.username}</span>
              <span className="text-gray-500 mx-1">·</span>
              <span className="text-[9px] text-gray-600">{timeAgo(typeof msg.createdAt === 'number' ? msg.createdAt : new Date(msg.createdAt).getTime())}</span>
              <p className="text-gray-300 mt-0.5 leading-relaxed">{msg.message}</p>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Scrivi un messaggio..."
          className="flex-1 bg-gray-800/60 border border-gray-700/40 rounded-xl px-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
          maxLength={500}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl px-3 py-2 active:scale-95 transition-all"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}

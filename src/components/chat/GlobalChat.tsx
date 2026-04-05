import React, { useState, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";

interface ChatMessage {
  id: number;
  userId: string;
  username: string;
  regionId: string;
  channel?: string;
  message: string;
  createdAt: number;
}

const GlobalChat = ({ currentUser }: { currentUser: any }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<'global' | 'local'>('global');
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/chat?channel=${channel}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (_) { }
  };

  useEffect(() => {
    fetchMessages();
    const iv = setInterval(fetchMessages, 4000);
    return () => clearInterval(iv);
  }, [channel]);

  // Auto-scroll to bottom only inside the container
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input.trim(), channel }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setInput("");
        await fetchMessages();
      }
    } catch (_) {
      setError("Errore di connessione");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
      {/* Header with channel toggle */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-50">
        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        <div className="flex gap-2">
          <button
            onClick={() => setChannel('global')}
            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all ${channel === 'global' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
          >
            🌍 Globale
          </button>
          <button
            onClick={() => setChannel('local')}
            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all ${channel === 'local' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
          >
            🏠 {currentUser.originalNation || 'IT'}
          </button>
        </div>
        <span className="ml-auto text-[10px] font-black text-slate-300 uppercase">{messages.length} messaggi</span>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        className="h-72 overflow-y-auto px-4 py-3 space-y-2"
        style={{ scrollbarWidth: "thin" }}
      >
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-300 text-sm font-bold">Nessun messaggio ancora. Sii il primo!</p>
          </div>
        )}
        {messages.map((msg) => {
          const isOwn = msg.userId === currentUser.id;
          return (
            <div key={msg.id} className={`flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"} items-end`}>
              {/* Avatar */}
              {!isOwn && (
                <div className="w-7 h-7 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0 text-[10px] font-black text-indigo-600">
                  {msg.username.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                {!isOwn && (
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="text-[10px] font-black text-slate-600">{msg.username}</span>
                    <span className="text-[9px] font-bold text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded-md">{msg.regionId}</span>
                  </div>
                )}
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed ${isOwn
                    ? "bg-indigo-600 text-white rounded-br-md"
                    : "bg-slate-50 text-slate-700 rounded-bl-md"
                    }`}
                >
                  {msg.message}
                </div>
                <span className="text-[9px] text-slate-300 font-bold px-1">{formatTime(msg.createdAt)}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-slate-50">
        {error && (
          <p className="text-[10px] font-bold text-rose-500 mb-2 px-1">{error}</p>
        )}
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(null); }}
            placeholder="Scrivi un messaggio..."
            maxLength={280}
            className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default GlobalChat;

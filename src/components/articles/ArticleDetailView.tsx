import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { User as UserIcon, BookOpen, ChevronRight, ChevronLeft, ThumbsUp, ThumbsDown, Loader2, Edit2, Trash2, Send, MessageSquare } from "lucide-react";
import { Article } from "../../types";
import { ArticleBlockRenderer } from "../ArticleBlockRenderer";

const ArticleDetailView = ({ articles, user, fetchData }: { articles: Article[], user: any, fetchData: () => void }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [voteScore, setVoteScore] = useState(0);
  const [allArticles, setAllArticles] = useState<Article[]>([]);

  // Fetch all articles for prev/next navigation
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const res = await fetch('/api/articles?section=global');
        if (res.ok) setAllArticles(await res.json());
      } catch { }
    };
    fetchAll();
  }, []);

  const article = articles.find(a => a.id === id) || allArticles.find(a => a.id === id);

  // Fetch comments and vote status
  useEffect(() => {
    if (!id) return;
    const fetchComments = async () => {
      try {
        const res = await fetch(`/api/articles/${id}/comments`);
        if (res.ok) setComments(await res.json());
      } catch { }
    };
    const fetchVote = async () => {
      try {
        const res = await fetch(`/api/articles/${id}/vote`);
        if (res.ok) {
          const data = await res.json();
          setUserVote(data.vote || null);
          setVoteScore(data.score || 0);
        }
      } catch { }
    };
    fetchComments();
    fetchVote();
  }, [id]);

  // Find prev/next articles
  const articlesList = allArticles.length > 0 ? allArticles : articles;
  const currentIdx = articlesList.findIndex(a => a.id === id);
  const prevArticle = currentIdx > 0 ? articlesList[currentIdx - 1] : null;
  const nextArticle = currentIdx < articlesList.length - 1 ? articlesList[currentIdx + 1] : null;

  const handleVote = async (direction: 'up' | 'down') => {
    try {
      const res = await fetch(`/api/articles/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote: userVote === direction ? null : direction })
      });
      if (res.ok) {
        const data = await res.json();
        setUserVote(data.vote || null);
        setVoteScore(data.score || 0);
      }
    } catch { }
  };

  const handleComment = async () => {
    if (!newComment.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/articles/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment })
      });
      if (res.ok) {
        const data = await res.json();
        setComments(prev => [...prev, data]);
        setNewComment('');
      }
    } catch { }
    setActionLoading(false);
  };

  if (!article) return (
    <div className="bg-white p-12 rounded-[2.5rem] text-center border border-slate-100">
      <p className="text-slate-400 font-bold">Articolo non trovato</p>
      <button onClick={() => navigate("/articles")} className="mt-4 text-indigo-600 font-black text-sm">← Torna al Feed</button>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      <button
        onClick={() => navigate("/articles")}
        className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1"
      >
        ← Torna al Feed
      </button>
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 leading-tight">{article.title}</h2>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center shadow-sm">
                <UserIcon className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Autore</p>
                <p className="text-sm font-black text-slate-900">{article.authorName}</p>
              </div>
            </div>
            {article.newspaperId && (
              <button 
                onClick={() => navigate(`/newspapers/${article.newspaperId}`)}
                className="flex items-center gap-3 pl-4 border-l border-slate-100 hover:opacity-80 transition-opacity"
              >
                <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 overflow-hidden">
                  {article.newspaperLogo ? (
                    <img src={article.newspaperLogo} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-indigo-500 uppercase tracking-widest">Giornale</p>
                  <p className="text-sm font-black text-slate-900">{article.newspaperName || 'Giornale'}</p>
                </div>
              </button>
            )}
          </div>
        </div>
        <div className="text-slate-700 leading-loose font-medium whitespace-pre-wrap">
          {article.blocks && article.blocks.length > 0 ? (
            <ArticleBlockRenderer blocks={article.blocks} />
          ) : (
            article.content
          )}
        </div>

        {/* Vote section */}
        <div className="flex items-center gap-4 pt-4 border-t border-slate-50">
          <button
            onClick={() => handleVote('up')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border transition-all ${userVote === 'up' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-400 hover:text-emerald-500 hover:border-emerald-200'}`}
          >
            <ThumbsUp className="w-4 h-4" />
            <span className="text-xs font-black">Mi piace</span>
          </button>
          <span className="text-lg font-black text-slate-900">{voteScore || article.likeCount || 0}</span>
          <button
            onClick={() => handleVote('down')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border transition-all ${userVote === 'down' ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200'}`}
          >
            <ThumbsDown className="w-4 h-4" />
            <span className="text-xs font-black">Non mi piace</span>
          </button>
        </div>

        {/* Prev/Next navigation */}
        <div className="flex justify-between pt-4 border-t border-slate-50">
          {prevArticle ? (
            <button onClick={() => navigate(`/articles/${prevArticle.id}`)} className="text-xs font-black text-indigo-600 flex items-center gap-1 hover:underline">
              <ChevronLeft className="w-4 h-4" /> Articolo precedente
            </button>
          ) : <div />}
          {nextArticle ? (
            <button onClick={() => navigate(`/articles/${nextArticle.id}`)} className="text-xs font-black text-indigo-600 flex items-center gap-1 hover:underline">
              Prossimo articolo <ChevronRight className="w-4 h-4" />
            </button>
          ) : <div />}
        </div>

        {article.authorId === user.id && (
          <div className="pt-6 border-t border-slate-50 flex gap-3">
             <button
              onClick={() => navigate(`/articles/edit/${id}`)}
              className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-indigo-50 text-indigo-600 font-black text-sm hover:bg-indigo-100 transition-all"
            >
              <Edit2 className="w-4 h-4" /> Modifica
            </button>
            <button
              onClick={async () => {
                if (!confirm("Sei sicuro di voler eliminare questo articolo?")) return;
                setActionLoading(true);
                try {
                  const res = await fetch(`/api/articles/${id}`, { method: "DELETE" });
                  if (res.ok) {
                    fetchData();
                    navigate("/articles");
                  }
                } catch (err) {
                  alert("Errore di eliminazione");
                } finally {
                  setActionLoading(false);
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-rose-50 text-rose-600 font-black text-sm hover:bg-rose-100 transition-all"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Elimina
            </button>
          </div>
        )}
      </div>

      {/* Comments Section */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
        <h3 className="font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-500" />
          Commenti ({comments.length})
        </h3>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {comments.map((c: any, i: number) => (
            <div key={c.id || i} className="bg-slate-50 p-4 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
                  <UserIcon className="w-3 h-3 text-indigo-600" />
                </div>
                <span className="text-xs font-black text-slate-700">{c.authorName || 'Utente'}</span>
                <span className="text-[9px] font-bold text-slate-400">{c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}</span>
              </div>
              <p className="text-sm text-slate-600 font-medium">{c.content}</p>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-center text-slate-400 text-sm font-medium py-4">Nessun commento. Sii il primo!</p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleComment(); }}
            placeholder="Lascia un commento…"
            className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <button
            onClick={handleComment}
            disabled={actionLoading || !newComment.trim()}
            className="px-4 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs disabled:opacity-50 hover:bg-indigo-700 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export { ArticleDetailView };

import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Loader2, Check, Send, ChevronDown } from "lucide-react";
import { ArticleBlock } from "../../types";
import { ArticleEditor } from "../ArticleEditor";

const NewArticleView = ({ actionLoading, fetchData }: { actionLoading: boolean, fetchData: () => void }) => {
  const { editId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const initialSection = params.get('section') === 'local' ? 'local' : 'global';
  const [articleSection, setArticleSection] = useState<'global' | 'local'>(initialSection);
  const [blocks, setBlocks] = useState<ArticleBlock[]>([{ id: '1', type: 'text', content: '' }]);
  const [title, setTitle] = useState('');
  const [newspapers, setNewspapers] = useState<any[]>([]);
  const [selectedNewspaperId, setSelectedNewspaperId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(!!editId);

  useEffect(() => {
    const fetchMyNewspapers = async () => {
      try {
        const res = await fetch("/api/my-newspapers");
        if (res.ok) setNewspapers(await res.json());
      } catch {}
    };

    const fetchEditData = async () => {
      if (!editId) return;
      try {
        const res = await fetch(`/api/articles/${editId}`);
        if (res.ok) {
          const data = await res.json();
          setTitle(data.title);
          setBlocks(data.blocks || []);
          setArticleSection(data.section || 'global');
          setSelectedNewspaperId(data.newspaperId);
        }
      } catch {}
      setLoading(false);
    };

    fetchMyNewspapers();
    if (editId) fetchEditData();
  }, [editId]);

  const handlePublish = async () => {
    if (!title.trim() || blocks.every(b => !b.content.trim())) {
      return alert("Titolo e contenuto necessari");
    }

    setIsSubmitting(true);
    try {
      const url = editId ? `/api/articles/${editId}` : "/api/articles";
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          blocks,
          section: articleSection,
          newspaperId: selectedNewspaperId
        }),
      });
      if (res.ok) {
        fetchData();
        navigate("/articles");
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (err) {
      alert("Errore di connessione");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-400 m-auto" /></div>;

  return (
    <motion.div
      key="article-new"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/articles")}
          className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1 bg-gray-800/50 px-4 py-2 rounded-xl border border-gray-700/40"
        >
          ← Annulla
        </button>
        <button
          onClick={handlePublish}
          disabled={actionLoading || isSubmitting}
          className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2"
        >
          {(actionLoading || isSubmitting) ? <Loader2 className="w-3 h-3 animate-spin" /> : editId ? <Check className="w-3 h-3" /> : <Send className="w-3 h-3" />}
          {editId ? 'Salva Modifiche' : 'Pubblica'}
        </button>
      </div>

      <div className="bg-gray-900/60 p-8 rounded-2xl border border-gray-800 space-y-8">
        <div className="space-y-6">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Scrivi un titolo d'impatto..."
            className="w-full bg-transparent border-none text-3xl font-black text-gray-100 placeholder:text-gray-600 outline-none p-0 focus:ring-0"
          />

          <div className="h-px bg-gray-800" />

          {/* Publishing controls */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Sezione Pubblicazione</label>
              <div className="bg-gray-800/50 p-1.5 rounded-xl flex gap-1 border border-gray-700/40">
                <button onClick={() => setArticleSection('global')} className={`flex-1 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${articleSection === 'global' ? "bg-indigo-600 text-white" : "text-gray-400 hover:bg-gray-700/50"}`}>
                  🌍 Globale
                </button>
                <button onClick={() => setArticleSection('local')} className={`flex-1 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${articleSection === 'local' ? "bg-indigo-600 text-white" : "text-gray-400 hover:bg-gray-700/50"}`}>
                  🏠 Locale
                </button>
              </div>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Firma come</label>
              <div className="relative">
                <select
                  value={selectedNewspaperId || ''}
                  onChange={e => setSelectedNewspaperId(e.target.value || null)}
                  className="w-full pl-4 pr-10 py-3 rounded-xl bg-gray-800/60 border border-gray-700/40 text-xs font-black text-gray-200 appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500/30 outline-none"
                >
                  <option value="">👤 Pubblica come Me</option>
                  {newspapers.map(n => (
                    <option key={n.id} value={n.id}>📰 {n.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        <div className="h-px bg-gray-800" />

        {/* The Editor */}
        <div className="min-h-[300px]">
          <ArticleEditor blocks={blocks} setBlocks={setBlocks} />
        </div>
      </div>
    </motion.div>
  );
};

export { NewArticleView };

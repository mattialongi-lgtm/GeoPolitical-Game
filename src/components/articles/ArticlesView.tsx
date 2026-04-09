import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Search, Loader2, BookOpen, ChevronRight, ThumbsUp, User as UserIcon } from "lucide-react";
import { Article } from "../../types";
import { usePollingTask } from "../../hooks/usePollingTask";

const ArticlesView = ({
  articles: _articles,
  setSelectedArticleId,
  actionLoading,
  fetchData,
  refreshArticles,
}: {
  articles: Article[],
  setSelectedArticleId: (id: string) => void,
  actionLoading: boolean,
  fetchData: () => void,
  refreshArticles: () => Promise<void>,
}) => {
  const navigate = useNavigate();
  const [section, setSection] = useState<'global' | 'local'>('global');
  const [category, setCategory] = useState<'all' | 'best' | 'guides' | 'newspapers'>('all');
  const [localArticles, setLocalArticles] = useState<Article[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const fetchSectionArticles = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/articles?section=${section}`);
      if (res.ok) setLocalArticles(await res.json());
    } catch { }
    setLoadingArticles(false);
  }, [section]);

  const displayArticles = useMemo(() => {
    let result = localArticles;

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(q) || a.authorName.toLowerCase().includes(q)
      );
    }

    // Filter by category
    if (category === 'best') {
      result = [...result].sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
    } else if (category === 'guides') {
      result = result.filter(a => a.title.toLowerCase().includes('guida') || a.title.toLowerCase().includes('guide') || a.title.toLowerCase().includes('tutorial'));
    }

    return result;
  }, [localArticles, searchQuery, category]);

  const categories = [
    { id: 'all' as const, label: 'Tutti' },
    { id: 'best' as const, label: 'Migliori' },
    { id: 'guides' as const, label: 'Guide' },
    { id: 'newspapers' as const, label: 'Giornali' },
  ];

  const [showCreateNewspaper, setShowCreateNewspaper] = useState(false);
  const [newspapers, setNewspapers] = useState<any[]>([]);
  const [loadingNewspapers, setLoadingNewspapers] = useState(false);
  const [npName, setNpName] = useState('');
  const [npDesc, setNpDesc] = useState('');
  const [npLogo, setNpLogo] = useState('');

  const fetchNewspapers = React.useCallback(async () => {
    try {
      const res = await fetch("/api/newspapers");
      if (res.ok) setNewspapers(await res.json());
    } catch {}
    setLoadingNewspapers(false);
  }, []);

  useEffect(() => {
    if (category !== 'newspapers') {
      setLoadingArticles(true);
    }
  }, [category, section]);

  useEffect(() => {
    if (category === 'newspapers') {
      setLoadingNewspapers(true);
    }
  }, [category]);

  usePollingTask(fetchSectionArticles, {
    enabled: category !== 'newspapers',
    intervalMs: 120_000,
    refreshOnVisible: true,
    refreshOnFocus: true,
  });

  usePollingTask(fetchNewspapers, {
    enabled: category === 'newspapers',
    intervalMs: 120_000,
    refreshOnVisible: true,
    refreshOnFocus: true,
  });

  const handleCreateNewspaper = async () => {
    if (!npName.trim()) return alert("Nome richiesto");
    try {
      const res = await fetch("/api/newspapers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: npName, description: npDesc, logoUrl: npLogo })
      });
      if (res.ok) {
        setShowCreateNewspaper(false);
        await Promise.all([
          fetchNewspapers(),
          fetchData(),
          refreshArticles(),
        ]);
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch {
      alert("Errore di connessione");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-white tracking-tight uppercase">Articoli</h2>
        <div className="flex items-center gap-2">
          {category === 'newspapers' && (
            <button
              onClick={() => setShowCreateNewspaper(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 flex items-center gap-2"
            >
              <Plus className="w-3 h-3" /> Crea Giornale
            </button>
          )}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-3 rounded-2xl bg-gray-800/60 border border-gray-700/40 hover:bg-gray-700/50 transition-all"
          >
            <Search className="w-5 h-5 text-gray-400" />
          </button>
          <button
            onClick={() => navigate(`/articles/new?section=${section}`)}
            className="bg-emerald-600 text-white p-3 rounded-2xl shadow-lg shadow-emerald-100 hover:scale-105 transition-all"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cerca per titolo o autore..."
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-gray-900/60 border border-gray-700/40 focus:ring-2 focus:ring-indigo-500/40 outline-none text-sm font-bold text-gray-100"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section tabs (global/local) */}
      <div className="bg-gray-900/60 rounded-2xl p-2 flex gap-2 border border-gray-800">
        <button onClick={() => setSection('global')} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${section === 'global' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/30" : "text-gray-400 hover:bg-gray-700/50"}`}>
          🌍 Globale
        </button>
        <button onClick={() => setSection('local')} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${section === 'local' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/30" : "text-gray-400 hover:bg-gray-700/50"}`}>
          🏠 Locale
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${category === cat.id ? "bg-indigo-600 text-white shadow-md" : "bg-gray-800/50 text-gray-400 border border-gray-700/40 hover:bg-gray-700/50"}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loadingArticles || loadingNewspapers ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
      ) : category === 'newspapers' ? (
        <div className="grid gap-4">
          {newspapers.map(np => (
            <button
              key={np.id}
              onClick={() => navigate(`/newspapers/${np.id}`)}
              className="w-full bg-gray-900/60 p-6 rounded-2xl border border-gray-800 text-left hover:border-indigo-500/50 transition-all group flex items-center gap-6"
            >
              <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 group-hover:bg-indigo-600 transition-colors">
                 {np.logoUrl ? (
                   <img src={np.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                 ) : (
                   <BookOpen className="w-8 h-8 text-indigo-400 group-hover:text-white" />
                 )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{np.name}</h3>
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Fondato da {np.authorName || 'un player'}</p>
                <p className="text-gray-500 text-sm mt-2 line-clamp-1 font-medium">{np.description || "Nessuna descrizione."}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-indigo-400" />
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {displayArticles.map(article => (
            <button
              key={article.id}
              onClick={() => { navigate(`/articles/${article.id}`); }}
              className="w-full bg-gray-900/60 p-6 rounded-2xl border border-gray-800 text-left hover:border-indigo-500/50 transition-all group"
            >
              {article.newspaperId && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded-lg overflow-hidden bg-gray-700/60 border border-gray-600/40 shrink-0">
                    {article.newspaperLogo ? (
                      <img src={article.newspaperLogo} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="w-3 h-3 text-indigo-400 m-auto mt-1" />
                    )}
                  </div>
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{article.newspaperName || 'Giornale'}</span>
                </div>
              )}
              <h3 className="text-lg font-black text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{article.title}</h3>
              <p className="text-gray-400 text-sm mt-2 line-clamp-2 leading-relaxed font-medium">{article.content}</p>
              <div className="flex justify-between items-center mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gray-700/60 rounded-full flex items-center justify-center">
                    <UserIcon className="w-3 h-3 text-gray-400" />
                  </div>
                  <span className="text-[10px] font-black text-gray-400 uppercase">{article.authorName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-lg">
                    <ThumbsUp className="w-3 h-3" /> {article.likeCount || 0}
                  </span>
                  <span className="text-[10px] font-bold text-gray-500 uppercase">{new Date(article.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </button>
          ))}
          {displayArticles.length === 0 && (
            <div className="bg-gray-900/60 p-12 rounded-2xl text-center text-gray-400 font-medium border border-dashed border-gray-700/50">
              {searchQuery ? 'Nessun risultato trovato.' : section === 'local' ? 'Nessun articolo locale pubblicato. Sii il primo!' : 'Nessun articolo pubblicato. Sii il primo!'}
            </div>
          )}
        </div>
      )}

      {/* Create Newspaper Modal */}
      <AnimatePresence>
        {showCreateNewspaper && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateNewspaper(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl relative z-10 overflow-hidden border border-gray-700/50">
                <div className="bg-indigo-600 p-8 text-white relative">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                   <h3 className="text-2xl font-black uppercase tracking-tight relative z-10">Crea il tuo Giornale</h3>
                   <p className="text-indigo-100 text-xs font-bold mt-1 opacity-80 uppercase tracking-widest relative z-10">Diventa un magnate dell'informazione</p>
                </div>
                <div className="p-8 space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Nome della Testata</label>
                      <input value={npName} onChange={e => setNpName(e.target.value)} placeholder="es. The Daily Globe" className="w-full px-6 py-4 rounded-2xl bg-gray-800/60 border border-gray-700/40 focus:ring-2 focus:ring-indigo-500/40 outline-none transition-all font-black text-gray-100" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Descrizione / Linea Editoriale</label>
                      <textarea value={npDesc} onChange={e => setNpDesc(e.target.value)} placeholder="Di cosa parlerà il tuo giornale?" rows={3} className="w-full px-6 py-4 rounded-2xl bg-gray-800/60 border border-gray-700/40 focus:ring-2 focus:ring-indigo-500/40 outline-none transition-all font-medium text-gray-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">URL Logo (opzionale)</label>
                      <input value={npLogo} onChange={e => setNpLogo(e.target.value)} placeholder="https://..." className="w-full px-6 py-4 rounded-2xl bg-gray-800/60 border border-gray-700/40 focus:ring-2 focus:ring-indigo-500/40 outline-none transition-all font-medium text-gray-300" />
                    </div>
                  </div>

                  <div className="bg-indigo-500/10 p-6 rounded-2xl border border-indigo-500/20">
                    <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest">
                       <span className="text-gray-400">Costo di Fondazione</span>
                       <span className="text-indigo-400">$10,000</span>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowCreateNewspaper(false)} className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-gray-400 bg-gray-800/50 hover:bg-gray-700/50 transition-all">Annulla</button>
                    <button disabled={actionLoading} onClick={handleCreateNewspaper} className="flex-[2] py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-indigo-600 shadow-xl shadow-indigo-900/30 hover:bg-indigo-700 transition-all disabled:opacity-50">Fonda Giornale</button>
                  </div>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export { ArticlesView };

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Plus, Edit2, BookOpen, ChevronRight, ThumbsUp } from "lucide-react";

const NewspaperDetailView = ({ user }: { user: any }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [newspaper, setNewspaper] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'editor' | 'writer'>('writer');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchNewspaper = async () => {
    try {
      const res = await fetch(`/api/newspapers/${id}`);
      if (res.ok) {
        const data = await res.json();
        setNewspaper(data);
        setEditName(data.name);
        setEditDescription(data.description || '');
        setEditLogoUrl(data.logoUrl || '');
      }
    } catch { }
    setLoading(false);
  };

  const handleUpdateNewspaper = async () => {
    if (!editName.trim()) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/newspapers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, description: editDescription, logoUrl: editLogoUrl })
      });
      if (res.ok) {
        setShowEdit(false);
        fetchNewspaper();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch {
      alert("Errore nell'aggiornamento");
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    fetchNewspaper();
  }, [id]);

  const handleAddMember = async () => {
    if (!newMemberId.trim()) return;
    try {
      const res = await fetch(`/api/newspapers/${id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: newMemberId, role: newMemberRole })
      });
      if (res.ok) {
        setShowAddMember(false);
        setNewMemberId('');
        fetchNewspaper();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch {
      alert("Errore di connessione");
    }
  };

  const myMembership = newspaper?.members?.find((m: any) => m.userId === user?.id);
  const isOwner = myMembership && myMembership.role === 'owner';
  const canManage = myMembership && (myMembership.role === 'owner' || myMembership.role === 'editor');

  if (loading) return (
    <div className="p-12 text-center flex flex-col items-center gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      <p className="text-gray-400 font-bold">Caricamento Redazione...</p>
    </div>
  );
  if (!newspaper) return (
    <div className="p-12 text-center bg-gray-900/60 rounded-2xl border border-gray-800">
      <p className="text-gray-400 font-bold">Giornale non trovato</p>
      <button onClick={() => navigate("/articles")} className="mt-4 text-indigo-400 font-black text-sm">← Torna agli Articoli</button>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="bg-gray-900/60 p-8 rounded-2xl border border-gray-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
          <div className="w-32 h-32 bg-indigo-600 rounded-2xl flex items-center justify-center overflow-hidden shrink-0">
            {newspaper.logoUrl ? (
              <img src={newspaper.logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <BookOpen className="w-12 h-12 text-white" />
            )}
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-4xl font-black text-gray-100 tracking-tight leading-tight uppercase">{newspaper.name}</h2>
            <p className="text-gray-400 font-medium mt-3 text-lg leading-relaxed max-w-xl">{newspaper.description || 'Nessuna descrizione disponibile.'}</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-6">
              <div className="bg-indigo-500/10 px-4 py-2 rounded-xl border border-indigo-500/20 flex flex-col items-center min-w-[80px]">
                <span className="text-sm font-black text-indigo-400">{newspaper.members?.length || 0}</span>
                <span className="text-[10px] font-black text-indigo-400/70 uppercase tracking-widest">Membri</span>
              </div>
              <div className="bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20 flex flex-col items-center min-w-[80px]">
                <span className="text-sm font-black text-emerald-400">{newspaper.articles?.length || 0}</span>
                <span className="text-[10px] font-black text-emerald-400/70 uppercase tracking-widest">Articoli</span>
              </div>
              {canManage && (
                <button
                  onClick={() => setShowAddMember(!showAddMember)}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2 self-center"
                >
                  <Plus className="w-3 h-3" /> Gestione Membri
                </button>
              )}
              {isOwner && (
                <button
                  onClick={() => setShowEdit(true)}
                  className="bg-gray-700 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-600 transition-all flex items-center gap-2 self-center"
                >
                  <Edit2 className="w-3 h-3" /> Modifica
                </button>
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showAddMember && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-8 pt-8 border-t border-gray-800 overflow-hidden">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Aggiungi Collaboratore</h4>
              <div className="grid md:grid-cols-3 gap-3">
                <input value={newMemberId} onChange={e => setNewMemberId(e.target.value)} placeholder="User ID (es. 1234)" className="px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/40 text-xs font-bold text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/30 placeholder:text-gray-500" />
                <select value={newMemberRole} onChange={e => setNewMemberRole(e.target.value as any)} className="px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/40 text-xs font-bold uppercase tracking-widest text-gray-200 outline-none">
                  <option value="writer">Scrittore</option>
                  <option value="editor">Editor</option>
                </select>
                <button onClick={handleAddMember} className="bg-emerald-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all">Invita</button>
              </div>
              <div className="mt-6 space-y-2">
                {newspaper.members?.map((m: any) => (
                  <div key={m.userId} className="flex justify-between items-center bg-gray-800/50 p-3 rounded-xl border border-gray-700/40">
                    <span className="text-xs font-black text-gray-200">{m.username || m.userId}</span>
                    <span className="text-[8px] font-black uppercase tracking-widest bg-gray-700/50 px-2 py-1 rounded-lg border border-gray-600/40 text-indigo-400">{m.role}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Newspaper Modal */}
        <AnimatePresence>
          {showEdit && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-8 pt-8 border-t border-gray-800 overflow-hidden">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Modifica Giornale</h4>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 block">Nome della Testata</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome del giornale" className="w-full px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/40 text-sm font-bold text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/30 placeholder:text-gray-500" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 block">Descrizione</label>
                  <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Descrizione / Linea editoriale" className="w-full px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/40 text-sm font-medium text-gray-200 resize-none outline-none focus:ring-2 focus:ring-indigo-500/30 placeholder:text-gray-500" rows={3} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 block">URL Logo</label>
                  <input value={editLogoUrl} onChange={e => setEditLogoUrl(e.target.value)} placeholder="https://..." className="w-full px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/40 text-sm font-bold text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/30 placeholder:text-gray-500" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowEdit(false)} className="flex-1 py-3 bg-gray-700/50 text-gray-300 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-700 transition-all">Annulla</button>
                  <button onClick={handleUpdateNewspaper} disabled={updating || !editName.trim()} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50">
                    {updating ? 'Salvataggio...' : 'Salva Modifiche'}
                  </button>
                </div>
              </div>
              {/* Delete Newspaper */}
              <div className="mt-6 pt-6 border-t border-rose-500/20">
                <button
                  onClick={async () => {
                    if (!window.confirm('Sei sicuro di voler cancellare questo giornale? Questa azione è irreversibile. Gli articoli non verranno eliminati ma scollegati.')) return;
                    try {
                      const res = await fetch(`/api/newspapers/${id}`, { method: "DELETE" });
                      if (res.ok) {
                        alert("Giornale cancellato.");
                        navigate("/articles");
                      } else {
                        const data = await res.json();
                        alert(data.error || "Errore nella cancellazione.");
                      }
                    } catch { alert("Errore di connessione."); }
                  }}
                  className="w-full py-3 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                >
                  🗑️ Cancella Giornale
                </button>
                <p className="text-[9px] text-rose-400 font-bold mt-2 text-center">Questa azione è irreversibile. Gli articoli verranno scollegati.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Archivio Notizie</h3>
          <div className="h-px bg-gray-800 flex-1 mx-4" />
        </div>

        <div className="grid gap-4">
          {newspaper.articles?.length === 0 ? (
            <div className="bg-gray-900/60 p-12 rounded-2xl text-center text-gray-400 font-bold border border-dashed border-gray-700/50">
              Nessun articolo pubblicato da questa redazione.
            </div>
          ) : (
            newspaper.articles.map((article: any) => (
              <button
                key={article.id}
                onClick={() => navigate(`/articles/${article.id}`)}
                className="w-full bg-gray-900/60 p-6 rounded-2xl border border-gray-800 text-left hover:border-indigo-500/40 transition-all group flex items-start gap-4"
              >
                <div className="flex-1">
                  <h3 className="text-xl font-black text-gray-100 group-hover:text-indigo-400 transition-colors uppercase tracking-tight leading-tight">{article.title}</h3>
                  <p className="text-gray-400 text-sm mt-2 line-clamp-2 leading-relaxed font-medium">{article.content}</p>
                  <div className="flex items-center gap-3 mt-4">
                    <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-lg">
                      <ThumbsUp className="w-3 h-3" /> {article.likeCount || 0}
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">{new Date(article.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-600 mt-2 group-hover:text-indigo-400 transition-colors" />
              </button>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
};

export { NewspaperDetailView };

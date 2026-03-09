import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Loader2, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";

export const BlocCreate = ({ currentUser, regions }: { currentUser: any, regions: any[] }) => {
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [logo, setLogo] = useState("🌍");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const userRegions = regions.filter(r => r.ownerUserId === currentUser.id);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError("Il nome del blocco è obbligatorio.");
            return;
        }
        if (userRegions.length === 0) {
            setError("Devi governare almeno uno stato per fondare un Blocco.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/blocs/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name, description, logo, stateId: userRegions[0].id
                })
            });
            const data = await res.json();
            if (data.success) {
                navigate(`/blocs/${data.blocId}`);
            } else {
                setError(data.error || "Errore durante la creazione.");
            }
        } catch (err: any) {
            setError("Errore di connessione.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 pb-24"
        >
            <button
                onClick={() => navigate("/blocs")}
                className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all"
            >
                <ArrowLeft className="w-4 h-4" /> Torna ai Blocchi
            </button>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                        <Shield className="w-7 h-7" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Fonda Blocco</h2>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Alleanza Geopolitica</p>
                    </div>
                </div>

                {userRegions.length === 0 ? (
                    <div className="text-center p-6 border-2 border-dashed border-rose-100 rounded-[2rem] bg-rose-50/50">
                        <p className="text-sm font-bold text-rose-600">
                            Devi essere Governatore di almeno uno Stato per fondare un Blocco.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleCreate} className="space-y-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Nome Blocco</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Es. Patto di Varsavia"
                                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-black text-slate-900 placeholder:text-slate-300"
                                maxLength={50}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Descrizione</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Obiettivi, ideali, requisiti..."
                                rows={4}
                                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-medium text-slate-700 leading-relaxed placeholder:text-slate-300"
                                maxLength={500}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Logo (Emoji o URL Immagine)</label>
                            <input
                                type="text"
                                value={logo}
                                onChange={e => setLogo(e.target.value)}
                                placeholder="🌍 o url immagine"
                                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-black text-slate-900 placeholder:text-slate-300"
                                maxLength={250}
                            />
                        </div>

                        {error && <p className="text-xs font-bold text-rose-500 ml-1">{error}</p>}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex justify-center items-center gap-2"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Fonda Alleanza"}
                        </button>
                    </form>
                )}
            </div>
        </motion.div>
    );
};

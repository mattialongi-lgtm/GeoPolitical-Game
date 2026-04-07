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
                className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all"
            >
                <ArrowLeft className="w-4 h-4" /> Torna ai Blocchi
            </button>

            <div className="bg-gray-900/60 p-8 rounded-2xl border border-gray-800">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                        <Shield className="w-7 h-7" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Fonda Blocco</h2>
                        <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">Alleanza Geopolitica</p>
                    </div>
                </div>

                {userRegions.length === 0 ? (
                    <div className="text-center p-6 border-2 border-dashed border-rose-400/30 rounded-2xl bg-rose-500/15">
                        <p className="text-sm font-bold text-rose-400">
                            Devi essere Governatore di almeno uno Stato per fondare un Blocco.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleCreate} className="space-y-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1">Nome Blocco</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Es. Patto di Varsavia"
                                className="w-full px-4 py-3 rounded-2xl bg-gray-800/60 border border-gray-700/40 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all font-black text-white placeholder:text-gray-500"
                                maxLength={50}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1">Descrizione</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Obiettivi, ideali, requisiti..."
                                rows={4}
                                className="w-full px-4 py-3 rounded-2xl bg-gray-800/60 border border-gray-700/40 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all font-medium text-gray-200 leading-relaxed placeholder:text-gray-500"
                                maxLength={500}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1">Logo (Emoji o URL Immagine)</label>
                            <input
                                type="text"
                                value={logo}
                                onChange={e => setLogo(e.target.value)}
                                placeholder="🌍 o url immagine"
                                className="w-full px-4 py-3 rounded-2xl bg-gray-800/60 border border-gray-700/40 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all font-black text-white placeholder:text-gray-500"
                                maxLength={250}
                            />
                        </div>

                        {error && <p className="text-xs font-bold text-rose-400 ml-1">{error}</p>}

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

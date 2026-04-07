import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Plus, Users, Search, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { Bloc } from "../types";

export const BlocsList = () => {
    const navigate = useNavigate();
    const [blocs, setBlocs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const fetchBlocs = async () => {
        try {
            const res = await fetch("/api/blocs");
            if (res.ok) {
                const data = await res.json();
                setBlocs(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBlocs();
    }, []);

    const filtered = blocs.filter(b => b.name.toLowerCase().includes(search.toLowerCase()) || (b.ownerStateName && b.ownerStateName.toLowerCase().includes(search.toLowerCase())));

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 pb-24"
        >
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tight uppercase flex items-center gap-2">
                        <Shield className="w-6 h-6 text-indigo-400" />
                        Blocchi Geopolitici
                    </h2>
                    <p className="text-sm font-bold text-gray-400 mt-1">Alleanze e patti globali</p>
                </div>
                <button
                    onClick={() => navigate("/blocs/create")}
                    className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-100 hover:scale-105 transition-all text-sm font-black flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    <span className="hidden sm:inline">Crea Blocco</span>
                </button>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Cerca un blocco..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-800/60 border border-gray-700/40 text-gray-100 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all font-medium placeholder:text-gray-500"
                />
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-12">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filtered.map(bloc => (
                        <button
                            key={bloc.id}
                            onClick={() => navigate(`/blocs/${bloc.id}`)}
                            className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 text-left hover:border-indigo-500/50 hover:shadow-md transition-all group flex flex-col h-full"
                        >
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-2xl shrink-0 border border-indigo-500/20 overflow-hidden">
                                    {(bloc.logo || "").startsWith('http') ? <img src={bloc.logo} alt="logo" className="w-full h-full object-cover" /> : (bloc.logo || "🌍")}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-xl font-black text-white truncate group-hover:text-indigo-400 transition-colors">
                                        {bloc.name}
                                    </h3>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1 truncate">
                                        Fondatore: {bloc.ownerName}
                                    </p>
                                </div>
                            </div>
                            <p className="text-sm text-gray-300 font-medium line-clamp-2 leading-relaxed flex-1">
                                {bloc.description || "Nessuna descrizione fornita."}
                            </p>
                            <div className="flex items-center gap-4 mt-6 pt-4 border-t border-gray-700/40">
                                <div className="flex items-center gap-1.5 text-gray-400 bg-gray-800/50 px-3 py-1.5 rounded-xl">
                                    <Users className="w-4 h-4" />
                                    <span className="text-xs font-black">{bloc.memberCount} Stati</span>
                                </div>
                                <span className="text-[10px] font-bold text-gray-500 ml-auto bg-gray-800/50 px-2 py-1 rounded-lg">
                                    Nato il {new Date(bloc.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        </button>
                    ))}
                    {filtered.length === 0 && (
                        <div className="col-span-1 bg-gray-900/60 rounded-2xl border border-dashed border-gray-700/50 p-8 text-center">
                            <Shield className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                            <p className="text-sm font-bold text-gray-400">Nessun blocco trovato.</p>
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    );
};

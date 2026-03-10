import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Briefcase,
    ShieldAlert,
    Globe,
    User,
    Trash2,
    Check,
    X,
    TrendingUp,
    DollarSign,
    Lock,
    Unlock,
    Info,
    ChevronRight,
    Search,
    Loader2,
    AlertCircle,
    Activity
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';

interface Minister {
    userId: string;
    username: string;
    role: 'economics' | 'foreign';
    title: string;
    assignedAt: number;
    wage: number;
}

interface Region {
    id: string;
    name: string;
    governmentForm: string;
    leaderUserId: string | null;
    ownerUserId: string | null;
    sanctionsActive: number;
    sanctionsScope: string; // JSON
    economicAdviserId: string | null;
    foreignMinisterId: string | null;
}

interface Application {
    id: string;
    userId: string;
    username: string;
    type: string;
    status: string;
    createdAt: number;
}

export const MinistersView: React.FC<{ user: any }> = ({ user }) => {
    const { iso2 } = useParams();
    
    // Robust stateId resolution: URL param > Region > Residence
    const stateId = (iso2 || user?.regionId || user?.residenceId || "").toUpperCase();
    
    const navigate = useNavigate();
    const [region, setRegion] = useState<Region | null>(null);
    const [ministers, setMinisters] = useState<Minister[]>([]);
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [targetUserId, setTargetUserId] = useState("");
    const [selectedRole, setSelectedRole] = useState<'economics' | 'foreign'>('economics');
    const [activeSanctions, setActiveSanctions] = useState<any[]>([]);
    const [targetSanctionStateId, setTargetSanctionStateId] = useState("");

    const fetchData = async () => {
        if (!stateId) {
            setLoading(false);
            setRegion(null);
            return;
        }

        // Normalize stateId to ensure consistency with backend
        const normalizedStateId = stateId.toUpperCase().replace('NATION_', '').replace('NATION_', '').replace('nation_', '');

        const token = localStorage.getItem('token');
        const authHeader = token ? { 'Authorization': `Bearer ${token}` } : {};

        try {
            console.log(`[DEBUG] MinistersView fetching data for: ${stateId} (normalized: ${normalizedStateId})`);
            
            // Helper to fetch and set sanctions for a given regionId
            const fetchAndSetSanctions = async (regionId: string) => {
                const res = await fetch(`/api/countries/${regionId}/sanctions`);
                if (res.ok) {
                    const data = await res.json();
                    console.log(`[DEBUG] Received ${data.length} sanctions for ${regionId}`, data);
                    setActiveSanctions(Array.isArray(data) ? data : []);
                    return true;
                }
                return false;
            };

            // Execute all fetches in parallel
            const [rRes, mRes, aRes, sRes] = await Promise.all([
                fetch(`/api/regions/${normalizedStateId}`, { headers: authHeader }),
                fetch(`/api/ministers/${normalizedStateId}`, { headers: authHeader }),
                fetch(`/api/actions/applications?regionId=${normalizedStateId}`, { headers: authHeader }),
                fetch(`/api/countries/${normalizedStateId}/sanctions`)
            ]);

            // Handle results individually to be robust
            let confirmedRegionId = normalizedStateId;
            if (rRes.ok) {
                const rData = await rRes.json();
                console.log(`[DEBUG] Region data:`, rData);
                setRegion(rData);
                // Update confirmed region ID from database (ground truth)
                if (typeof rData.id === 'string' && rData.id.length > 0) {
                    confirmedRegionId = rData.id;
                }
            }
            
            if (mRes.ok) {
                const mData = await mRes.json();
                setMinisters(mData.ministers || []);
            }
            
            if (aRes.ok) setApplications(await aRes.json());
            
            // Use initial sanctions response if successful, otherwise retry with confirmed region ID
            if (sRes.ok) {
                const sData = await sRes.json();
                console.log(`[DEBUG] Received ${sData.length} sanctions for ${stateId}`, sData);
                setActiveSanctions(Array.isArray(sData) ? sData : []);
            } else if (confirmedRegionId !== normalizedStateId) {
                // Retry with confirmed region ID if it differs from the initial stateId
                console.warn(`[DEBUG] Sanctions fetch failed (${sRes.status}), retrying with confirmed region ID: ${confirmedRegionId}`);
                try {
                    await fetchAndSetSanctions(confirmedRegionId);
                } catch (retryErr) {
                    console.error(`[DEBUG] Sanctions retry also failed:`, retryErr);
                }
            } else {
                console.error(`[DEBUG] Sanctions fetch failed: ${sRes.status}`);
            }

        } catch (err) {
            console.error("Error fetching ministers data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [stateId]);

    // Check authority using multiple possible field names (robustness)
    const isLeader = region?.leaderUserId === user?.id || region?.ownerUserId === user?.id;
    const isEconMinister = ministers.some((m: any) => m.role?.toLowerCase() === 'economics' && m.userId === user?.id);
    const isForeignMinister = ministers.some((m: any) => m.role?.toLowerCase() === 'foreign' && m.userId === user?.id);

    const handleAssign = async () => {
        if (!targetUserId || !selectedRole) return;
        setActionLoading(true);
        const token = localStorage.getItem('token');
        const authHeader = token ? { 'Authorization': `Bearer ${token}` } : {};
        try {
            const res = await fetch('/api/ministers/assign', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...authHeader 
                },
                body: JSON.stringify({ iso2: stateId, userId: targetUserId, role: selectedRole })
            });
            const data = await res.json();
            if (data.error) alert(data.error);
            else {
                setTargetUserId("");
                fetchData();
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleRevoke = async (role: 'economics' | 'foreign') => {
        if (!window.confirm("Sei sicuro di voler revocare questo incarico ministeriale?")) return;
        setActionLoading(true);
        const token = localStorage.getItem('token');
        const authHeader = token ? { 'Authorization': `Bearer ${token}` } : {};
        try {
            const res = await fetch('/api/ministers/revoke', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...authHeader 
                },
                body: JSON.stringify({ iso2: stateId, role })
            });
            if (res.ok) fetchData();
            else {
                const data = await res.json();
                alert(data.error || "Errore nella revoca.");
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleApplySanction = async () => {
        const targetId = targetSanctionStateId.toUpperCase().trim();
        if (!targetId) return;
        setActionLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/sanctions/apply', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ 
                    targetStateId: targetId,
                    fromStateId: stateId
                })
            });
            const data = await res.json();
            if (data.error) alert(data.error);
            else {
                setTargetSanctionStateId("");
                fetchData();
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleRevokeSanction = async (sanctionId: string) => {
        if (!window.confirm("Sei sicuro di voler revocare questa sanzione?")) return;
        setActionLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/sanctions/revoke', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ sanctionId })
            });
            if (res.ok) fetchData();
            else {
                const data = await res.json();
                alert(data.error || "Errore nella revoca.");
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleResolveApp = async (appId: string, action: 'accept' | 'reject') => {
        setActionLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/actions/resolve-application`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ applicationId: appId, action })
            });
            if (res.ok) fetchData();
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div className="p-12 text-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />Caricamento...</div>;
    
    if (!region) return (
        <div className="p-12 text-center text-red-400 space-y-3">
            <p>Stato non trovato per ID: {stateId}</p>
            {user?.regionId && (
                <button
                    onClick={() => navigate(`/ministers/${user.regionId}`)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase"
                >
                    Vai al tuo Stato ({user.regionId})
                </button>
            )}
        </div>
    );

    const econMin = ministers.find(m => m.role === 'economics');
    const foreignMin = ministers.find(m => m.role === 'foreign');

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-8 pb-24">
            <header className="relative space-y-2">
                <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-4">
                    ← Indietro
                </button>
                <div className="bg-slate-800/40 p-8 rounded-[2.5rem] border border-slate-700/50 backdrop-blur-md flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-6">
                        <div className="p-5 bg-indigo-500/20 rounded-3xl border border-indigo-500/20 shadow-xl shadow-indigo-500/10">
                            <Briefcase className="w-10 h-10 text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tight">
                                Ministri di {region.nation?.name || region.name}
                            </h1>
                            <p className="text-slate-400 font-bold mt-1">Gestione delle cariche e poteri esecutivi di {region.name === (region.nation?.name) ? region.id : region.name}</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Ministerial Roles List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Economic Minister Card */}
                        <div className="bg-slate-800/40 rounded-[2rem] border border-slate-700/50 overflow-hidden group">
                            <div className="p-6 border-b border-slate-700/50 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-500/10 rounded-xl">
                                        <DollarSign className="w-5 h-5 text-amber-400" />
                                    </div>
                                    <h3 className="font-black text-white uppercase tracking-wider text-sm">
                                        {region.governmentForm === 'DICTATORSHIP' ? 'Consigliere Economico' : 'Ministro Economia'}
                                    </h3>
                                </div>
                                {isLeader && econMin && (
                                    <button onClick={() => handleRevoke('economics')} className="text-rose-400 hover:text-rose-300 transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                            <div className="p-8 text-center space-y-4">
                                {econMin ? (
                                    <>
                                        <div className="w-20 h-20 bg-slate-700 rounded-full mx-auto flex items-center justify-center text-slate-400 border-4 border-slate-800 shadow-xl">
                                            <User className="w-10 h-10" />
                                        </div>
                                        <div>
                                            <p className="text-xl font-black text-white">{econMin.username}</p>
                                            <p className="text-xs text-slate-500 font-bold uppercase mt-1">In carica dal {new Date(econMin.assignedAt).toLocaleDateString()}</p>
                                        </div>
                                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 text-xs font-black">
                                            Salario: 🏅 {econMin.wage} Gold / giorno
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-8 opacity-40 italic text-slate-500">Posizione Vacante</div>
                                )}
                            </div>
                        </div>

                        {/* Foreign Minister Card */}
                        <div className="bg-slate-800/40 rounded-[2rem] border border-slate-700/50 overflow-hidden group">
                            <div className="p-6 border-b border-slate-700/50 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-xl">
                                        <Globe className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <h3 className="font-black text-white uppercase tracking-wider text-sm">Ministro degli Esteri</h3>
                                </div>
                                {isLeader && foreignMin && (
                                    <button onClick={() => handleRevoke('foreign')} className="text-rose-400 hover:text-rose-300 transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                            <div className="p-8 text-center space-y-4">
                                {['DICTATORSHIP', 'ONE_PARTY_SYSTEM'].includes(region.governmentForm) ? (
                                    <div className="py-8 text-rose-400/60 font-bold text-sm">Carica non disponibile in questo regime.</div>
                                ) : foreignMin ? (
                                    <>
                                        <div className="w-20 h-20 bg-slate-700 rounded-full mx-auto flex items-center justify-center text-slate-400 border-4 border-slate-800 shadow-xl">
                                            <User className="w-10 h-10" />
                                        </div>
                                        <div>
                                            <p className="text-xl font-black text-white">{foreignMin.username}</p>
                                            <p className="text-xs text-slate-500 font-bold uppercase mt-1">In carica dal {new Date(foreignMin.assignedAt).toLocaleDateString()}</p>
                                        </div>
                                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 text-xs font-black">
                                            Salario: 🏅 {foreignMin.wage} Gold / giorno
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-8 opacity-40 italic text-slate-500">Posizione Vacante</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Powers & Tools for Ministers/Leaders */}
                    <div className="space-y-6">
                        <h2 className="text-xl font-black text-white flex items-center gap-3 pt-4">
                            <ShieldAlert className="w-6 h-6 text-indigo-400" />
                            Poteri Esecutivi
                        </h2>

                        {/* Sanctions Panel */}
                        {(isLeader || isEconMinister) && (
                            <div className="bg-slate-800/40 p-8 rounded-[3rem] border border-slate-700/50 space-y-8 shadow-2xl shadow-rose-900/10 backdrop-blur-sm">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-black text-rose-50 flex items-center gap-3">
                                            <div className="p-2 bg-rose-500/20 rounded-xl">
                                                <ShieldAlert className="w-5 h-5 text-rose-500" />
                                            </div>
                                            Sanzioni Commerciali
                                        </h3>
                                        <p className="text-sm text-slate-400 font-bold max-w-md">Vieta la vendita di prodotti provenienti da Stati specifici nel tuo mercato nazionale.</p>
                                    </div>
                                </div>

                                <div className="flex flex-col lg:flex-row gap-8 items-stretch">
                                    {/* Create Sanction Form */}
                                    <div className="flex-1 bg-slate-900/60 p-8 rounded-3xl border border-slate-700/50 space-y-6 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Globe className="w-20 h-20 text-rose-500" />
                                        </div>
                                        
                                        <div className="relative space-y-4">
                                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Applica Nuova Sanzione</h4>
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <div className="flex-1 relative">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-black text-xs">ISO</div>
                                                    <input
                                                        type="text"
                                                        value={targetSanctionStateId}
                                                        onChange={e => setTargetSanctionStateId(e.target.value)}
                                                        placeholder="es. RU"
                                                        className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-12 pr-4 py-4 text-sm font-black text-white focus:outline-none focus:border-rose-500 transition-all uppercase placeholder:text-slate-700 shadow-inner"
                                                    />
                                                </div>
                                                <button
                                                    onClick={handleApplySanction}
                                                    disabled={actionLoading || !targetSanctionStateId}
                                                    className="px-8 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-500 disabled:opacity-30 shadow-lg shadow-rose-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 group/btn"
                                                >
                                                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                                        <>
                                                            Applica
                                                            <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                            
                                            <div className="bg-rose-500/10 p-4 rounded-xl border border-rose-500/20 flex gap-3">
                                                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                                                <p className="text-[10px] text-rose-200/70 font-bold leading-relaxed">
                                                    <span className="text-rose-400">ATTENZIONE:</span> L'applicazione di una sanzione cancellerà <span className="text-rose-400">ISTANTANEAMENTE</span> tutte le offerte esistenti provenienti dallo Stato target nel tuo mercato nazionale.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Active Sanctions List - Public View */}
                        <div className="bg-slate-800/40 p-8 rounded-[3rem] border border-slate-700/50 space-y-6 shadow-xl backdrop-blur-sm">
                            <div className="flex justify-between items-center px-2">
                                <div className="space-y-1">
                                    <h4 className="text-lg font-black text-rose-50 flex items-center gap-3">
                                        <div className="p-2 bg-rose-500/20 rounded-xl">
                                            <ShieldAlert className="w-5 h-5 text-rose-500" />
                                        </div>
                                        Sanzioni Attive
                                    </h4>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Stati attualmente soggetti a restrizioni commerciali</p>
                                </div>
                                <span className="text-[10px] font-black bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full border border-rose-500/20">{activeSanctions.length} Stati</span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-3 custom-scrollbar">
                                <AnimatePresence mode="popLayout">
                                    {activeSanctions.map(s => (
                                        <motion.div 
                                            key={s.id} 
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            className="flex items-center justify-between p-5 bg-slate-900/60 rounded-3xl border border-slate-700/50 hover:border-rose-500/30 transition-all group/item shadow-sm"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="p-2.5 bg-rose-500/5 rounded-2xl border border-rose-500/10 group-hover/item:bg-rose-500/10 transition-colors">
                                                    <Activity className="w-5 h-5 text-rose-500" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-white leading-none mb-1.5">{s.targetStateName || s.targetStateId}</p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] text-slate-500 font-black uppercase bg-slate-800 px-1.5 py-0.5 rounded shadow-sm">{s.targetStateId}</span>
                                                        <span className="text-[9px] text-rose-400 font-bold uppercase tracking-wider">Mercato Bloccato</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {(isLeader || isEconMinister) && (
                                                <button
                                                    onClick={() => handleRevokeSanction(s.id)}
                                                    className="p-3 opacity-0 group-hover/item:opacity-100 bg-rose-500/10 text-rose-400 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-lg"
                                                    title="Revoca Sanzione"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                                
                                {activeSanctions.length === 0 && (
                                    <div className="col-span-full py-16 text-center space-y-4 bg-slate-900/20 rounded-[3rem] border-2 border-dashed border-slate-800/50">
                                        <div className="p-4 bg-slate-800/50 rounded-full w-fit mx-auto">
                                            <Unlock className="w-6 h-6 text-slate-700" />
                                        </div>
                                        <p className="text-slate-600 font-bold text-xs uppercase tracking-widest">Nessuna sanzione attiva nel sistema</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Foreign Minister / Residency Panel */}
                        {(isLeader || isForeignMinister) && (
                            <div className="bg-slate-800/40 rounded-[2.5rem] border border-slate-700/50 overflow-hidden">
                                <div className="p-6 border-b border-slate-700/50">
                                    <h3 className="text-lg font-black text-white">Richieste di Residenza / Lavoro</h3>
                                    <p className="text-xs text-slate-500 font-bold mt-1">Approva o rifiuta le richieste di ingresso nello Stato.</p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-900/30 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                                                <th className="px-8 py-4">Giocatore</th>
                                                <th className="px-8 py-4">Tipo</th>
                                                <th className="px-8 py-4 text-right">Azioni</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/30">
                                            {applications.filter(a => a.status === 'pending').map(app => (
                                                <tr key={app.id} className="hover:bg-slate-700/10 transition-colors group">
                                                    <td className="px-8 py-4 text-white font-black">{app.username} <span className="text-[10px] text-slate-500 ml-2">ID: {app.userId}</span></td>
                                                    <td className="px-8 py-4 text-slate-400 text-xs font-black uppercase">{app.type === 'residence' ? 'Residenza' : 'Lavoro'}</td>
                                                    <td className="px-8 py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => handleResolveApp(app.id, 'accept')} className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500 hover:text-white transition-all">
                                                                <Check className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => handleResolveApp(app.id, 'reject')} className="p-2 bg-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500 hover:text-white transition-all">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {applications.filter(a => a.status === 'pending').length === 0 && (
                                                <tr>
                                                    <td colSpan={3} className="px-8 py-12 text-center text-slate-600 italic text-sm">Nessuna richiesta in attesa.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar: Assignment & Info */}
                <div className="space-y-6">
                    {isLeader && (
                        <div className="bg-slate-800/40 p-8 rounded-[2.5rem] border border-slate-700/50 space-y-6">
                            <h3 className="text-lg font-black text-white">Nomina Ministro</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1 mb-2 block">ID Giocatore</label>
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                        <input
                                            type="text"
                                            value={targetUserId}
                                            onChange={e => setTargetUserId(e.target.value)}
                                            placeholder="Cerca per ID..."
                                            className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl pl-12 pr-4 py-3 text-sm font-black text-white focus:outline-none focus:border-indigo-500 transition-all"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1 mb-2 block">Incarico</label>
                                    <select
                                        value={selectedRole}
                                        onChange={e => setSelectedRole(e.target.value as any)}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl px-4 py-3 text-sm font-black text-white focus:outline-none focus:border-indigo-500 appearance-none transition-all"
                                    >
                                        <option value="economics">Economia / Consigliere</option>
                                        <option value="foreign">Esteri</option>
                                    </select>
                                </div>
                                <button
                                    onClick={handleAssign}
                                    disabled={actionLoading || !targetUserId}
                                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 disabled:opacity-40 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                                >
                                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Assegna Carica'}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm space-y-4">
                        <div className="flex items-center gap-3">
                            <Info className="w-5 h-5 text-slate-400" />
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Informazioni</h3>
                        </div>
                        <ul className="text-xs text-slate-500 space-y-3 font-bold leading-relaxed">
                            <li className="flex gap-2">
                                <span className="text-indigo-500">•</span>
                                Un cittadino può essere ministro in un solo Stato alla volta.
                            </li>
                            <li className="flex gap-2">
                                <span className="text-indigo-500">•</span>
                                Tutte le cariche decadono automaticamente al termine del mandato del Leader.
                            </li>
                            <li className="flex gap-2">
                                <span className="text-indigo-500">•</span>
                                I ministri possono "passare" leggi istantaneamente se rientrano nella loro competenza (es. Economia per tasse e costruzioni).
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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

    const fetchData = async () => {
        if (!stateId) {
            setLoading(false);
            setRegion(null);
            return;
        }

        // Normalize stateId to ensure consistency with backend
        const normalizedStateId = stateId.toUpperCase().replace('NATION_', '').replace('NATION_', '').replace('nation_', '');

        try {
            console.log(`[DEBUG] MinistersView fetching data for: ${stateId} (normalized: ${normalizedStateId})`);
            

            // Execute all fetches in parallel
            const [rRes, mRes, aRes] = await Promise.all([
                fetch(`/api/regions/${normalizedStateId}`),
                fetch(`/api/ministers/${normalizedStateId}`),
                fetch(`/api/applications/${normalizedStateId}`)
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
        try {
            const res = await fetch('/api/ministers/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
        try {
            const res = await fetch('/api/ministers/revoke', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

    const handleResolveApp = async (appId: string, action: 'accept' | 'reject') => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/actions/resolve-application`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                <div className="flex items-center gap-4 mb-4">
                    <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                        ← Indietro
                    </button>
                    <button onClick={() => navigate('/map')} className="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                        <Globe className="w-4 h-4" /> Vista Mappa
                    </button>
                </div>
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

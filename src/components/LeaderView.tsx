import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    User,
    Crown,
    Settings,
    Users,
    FileText,
    Check,
    X,
    Palette,
    Music,
    Megaphone,
    Briefcase,
    Globe,
    Plus,
    Home
} from 'lucide-react';

interface Order {
    id: string;
    title: string;
    body: string;
    audience: string;
    createdAt: number;
}

interface Region {
    id: string;
    name: string;
    governmentForm: string;
    leaderUserId: string | null;
    leaderName: string | null;
    leaderLevel: number | null;
    leaderTitle: string;
    stateColor: string;
    stateHymn: string;
    nextLeaderElectionAt: number | null;
    economicAdviserId: string | null;
    foreignMinisterId: string | null;
    nation: {
        id: string;
        name: string;
        logo: string;
        leaderUserId: string;
    } | null;
    memberRegions: { id: string, name: string, population: number }[];
}

interface Application {
    id: string;
    userId: string;
    username: string;
    type: string;
    status: string;
    createdAt: number;
}

export const LeaderView: React.FC<{ regionId?: string; user: any }> = ({ regionId: propRegionId, user }) => {
    const { iso2 } = useParams();
    const navigate = useNavigate();
    const routeStateId = (propRegionId || iso2 || '').toUpperCase();
    const fallbackStateId = (user?.residenceId || user?.regionId || '').toUpperCase();
    const regionId = /^[A-Z]{2}$/.test(routeStateId) ? routeStateId : fallbackStateId;
    const [region, setRegion] = useState<Region | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'info' | 'ministers' | 'residence' | 'orders' | 'elections' | 'branding'>('info');

    // Form states
    const [newOrder, setNewOrder] = useState({ title: '', body: '', audience: 'ALL' });
    const [branding, setBranding] = useState({ stateColor: '', stateHymn: '', nationName: '', nationLogo: '' });

    const fetchData = async () => {
        if (!regionId) return;
        try {
            const [rRes, oRes, aRes] = await Promise.all([
                fetch(`/api/regions/${regionId}`),
                fetch(`/api/leader/orders/${regionId}`),
                fetch(`/api/applications/${regionId}`)
            ]);

            const rData = rRes.ok ? await rRes.json() : { error: "Failed to fetch region" };
            const oData = oRes.ok ? await oRes.json() : [];
            const aData = aRes.ok ? await aRes.json() : [];

            if (rData.error) {
                setRegion(null);
            } else {
                setRegion(rData);
                setBranding({
                    stateColor: rData.stateColor,
                    stateHymn: rData.stateHymn || '',
                    nationName: rData.nation?.name || '',
                    nationLogo: rData.nation?.logo || '🏛️'
                });
            }
            setOrders(Array.isArray(oData) ? oData : []);
            setApplications(Array.isArray(aData) ? aData : []);
        } catch (err) {
            console.error("Error fetching leader data:", err);
            setRegion(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [regionId]);

    const isLeader = region?.leaderUserId === user?.id;

    const handleUpdateBranding = async () => {
        const promises = [
            fetch('/api/leader/update-state-ui', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ regionId, stateColor: branding.stateColor, stateHymn: branding.stateHymn })
            })
        ];

        if (region?.nation && isLeader) {
            promises.push(
                fetch('/api/leader/nation/branding', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nationId: region.nation.id, name: branding.nationName, logo: branding.nationLogo })
                })
            );
        }

        await Promise.all(promises);
        fetchData();
    };

    const handlePostOrder = async () => {
        const res = await fetch('/api/ministers/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ regionId, title: newOrder.title, content: newOrder.body })
        });
        if (res.ok) {
            setNewOrder({ title: '', body: '', audience: 'ALL' });
            fetchData();
        }
    };

    const handleResolveApp = async (appId: string, action: 'accept' | 'reject') => {
        const res = await fetch(`/api/actions/resolve-application`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationId: appId, action })
        });
        if (res.ok) fetchData();
    };

    const handleAssignMinister = async (role: string, ministerId: string | null) => {
        const res = await fetch('/api/government/assign-minister', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ regionId, role, ministerId })
        });
        if (res.ok) fetchData();
    };

    if (loading) return <div className="p-8 text-center text-slate-400">Caricamento...</div>;
    if (!region) return (
        <div className="p-8 text-center text-red-400 space-y-3">
            <p>Regione non trovata.</p>
            {fallbackStateId && (
                <button
                    onClick={() => navigate(`/leader/${fallbackStateId}`)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase"
                >
                    Vai al tuo Stato ({fallbackStateId})
                </button>
            )}
        </div>
    );

    return (
        <div className="flex min-h-screen bg-[#0f172a] text-slate-200">
            {/* Sidebar Navigation */}
            <aside className="w-64 border-r border-slate-800/60 bg-slate-900/50 backdrop-blur-xl flex flex-col sticky top-0 h-screen">
                <div className="p-6 border-b border-slate-800/60 flex items-center gap-3">
                    <div className="text-2xl">
                        {region.nation?.logo || '🏛️'}
                    </div>
                    <div>
                        <h2 className="font-bold text-white tracking-tight leading-tight">{region.nation?.name || region.name}</h2>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{region.leaderTitle}</p>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {[
                        { id: 'info', icon: Globe, label: 'Dashboard' },
                        { id: 'orders', icon: Megaphone, label: 'Ordini Militari' },
                        { id: 'ministers', icon: Briefcase, label: 'Governo' },
                        { id: 'residence', icon: Users, label: 'Immigrazione', count: applications.filter(a => a.status === 'pending').length },
                        { id: 'branding', icon: Palette, label: 'Identità Visiva' },
                        { id: 'elections', icon: Check, label: 'Sistema Elettorale' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${activeTab === tab.id
                                ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_20px_rgba(79,70,229,0.1)]'
                                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white border border-transparent'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <tab.icon className={`w-5 h-5 transition-colors ${activeTab === tab.id ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                                <span className="text-sm font-semibold tracking-wide">{tab.label}</span>
                            </div>
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full font-black border border-indigo-500/30">
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-800/60 space-y-3 font-medium">
                    <button
                        onClick={() => navigate(`/countries/${regionId}`)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all text-sm"
                    >
                        <Globe className="w-5 h-5" />
                        Vista Mappa
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all text-sm"
                    >
                        <Home className="w-5 h-5" />
                        Torna alla Home
                    </button>
                    <div className="px-4 py-2 bg-slate-800/30 rounded-xl border border-slate-700/30">
                        <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Status Sistema</p>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] text-emerald-400 font-bold uppercase">Online</span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <header className="h-20 border-b border-slate-800/40 bg-slate-900/30 backdrop-blur-md flex items-center justify-between px-8 shrink-0">
                    <div>
                        <h1 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                            {activeTab === 'info' && "Dashboard Generale"}
                            {activeTab === 'orders' && "Ordini di Stato"}
                            {activeTab === 'ministers' && "Gestione Ministeriale"}
                            {activeTab === 'residence' && "Richieste di Residenza"}
                            {activeTab === 'branding' && "Personalizzazione Stato"}
                            {activeTab === 'elections' && "Elezioni Federali"}
                        </h1>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-black">Area Administrativa • {regionId}</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex flex-col items-end">
                            <p className="text-xs text-slate-400 font-bold">{user?.username}</p>
                            <p className="text-[10px] text-indigo-400 font-black uppercase">Livello {user?.level || 1}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 overflow-hidden">
                            {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : <User />}
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <AnimatePresence mode="wait">
                        {activeTab === 'info' && (
                            <motion.div
                                key="info"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.02 }}
                                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                            >
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/60 p-8 rounded-3xl border border-slate-700/50 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <Globe className="w-32 h-32" />
                                        </div>
                                        <div className="relative">
                                            <h3 className="text-2xl font-black text-white mb-2 tracking-tight">Benvenuto nel Comando di Stato</h3>
                                            <p className="text-slate-400 max-w-md leading-relaxed text-sm">
                                                In qualità di {region.leaderTitle}, hai piena autorità sulle direttive nazionali,
                                                la gestione dei ministri e l'accoglienza dei nuovi cittadini.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="bg-slate-800/30 p-6 rounded-2xl border border-slate-700/30 hover:bg-slate-800/50 transition-all">
                                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Forma di Governo</p>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-amber-500/20 rounded-lg text-amber-500">
                                                    <Crown className="w-4 h-4" />
                                                </div>
                                                <p className="text-lg font-black text-white uppercase tracking-tighter">{region.governmentForm.replace('_', ' ')}</p>
                                            </div>
                                        </div>
                                        <div className="bg-slate-800/30 p-6 rounded-2xl border border-slate-700/30 hover:bg-slate-800/50 transition-all">
                                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Leader Attuale</p>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-500">
                                                    <User className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-lg font-black text-white uppercase tracking-tighter">{region.leaderName || 'VACANTE'}</p>
                                                    <p className="text-[9px] text-slate-500 font-mono">ID: {region.leaderUserId || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/30">
                                        <div className="flex items-center gap-3 mb-6">
                                            <Music className="w-5 h-5 text-indigo-400" />
                                            <h4 className="font-black text-white uppercase tracking-tight">Inno Nazionale</h4>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500/30 rounded-full" />
                                            <p className="pl-6 italic text-slate-300 leading-relaxed text-sm bg-slate-900/20 py-4 rounded-r-2xl">
                                                "{region.stateHymn || "Le campane del silenzio risuonano in questa nazione. Definisci il tuo inno nella sezione Design."}"
                                            </p>
                                        </div>
                                    </div>

                                    {/* Nation Regions List */}
                                    <div className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/30 mt-6">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-3">
                                                <Globe className="w-5 h-5 text-indigo-400" />
                                                <h4 className="font-black text-white uppercase tracking-tight">Regioni della Nazione</h4>
                                            </div>
                                            <span className="text-[10px] font-black bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded border border-indigo-500/20">
                                                {region.memberRegions.length} REGIONI
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {region.memberRegions.map(mr => (
                                                <div
                                                    key={mr.id}
                                                    onClick={() => navigate(`/leader/${mr.id}`)}
                                                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${mr.id === regionId ? 'bg-indigo-600/10 border-indigo-500/30' : 'bg-slate-900/40 border-slate-800 hover:border-slate-600'}`}
                                                >
                                                    <div>
                                                        <p className="font-black text-white text-sm uppercase tracking-tight">{mr.name}</p>
                                                        <p className="text-[9px] text-slate-500 font-bold">POP. {mr.population.toLocaleString()}</p>
                                                    </div>
                                                    <div className={`w-2 h-2 rounded-full ${mr.id === regionId ? 'bg-indigo-400' : 'bg-slate-700 group-hover:bg-slate-500'}`} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="bg-indigo-600 p-8 rounded-3xl shadow-xl shadow-indigo-600/10 relative overflow-hidden">
                                        <div className="absolute -bottom-4 -right-4 bg-white/10 w-24 h-24 rounded-full blur-2xl" />
                                        <p className="text-[10px] text-indigo-100/60 font-black uppercase tracking-widest mb-4">Prossima Sessione Elettorale</p>
                                        <div className="text-2xl font-black text-white tracking-tighter mb-2">
                                            {region.nextLeaderElectionAt ? new Date(region.nextLeaderElectionAt).toLocaleDateString() : 'DISATTIVATA'}
                                        </div>
                                        <p className="text-xs text-indigo-100 font-medium">Il sistema elettorale è subordinato alla forma di governo corrente.</p>
                                    </div>

                                    <div className="bg-slate-800/30 p-6 rounded-2xl border border-slate-700/30 space-y-4">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Azioni Rapide</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => setActiveTab('orders')}
                                                className="p-4 bg-slate-900/50 rounded-xl border border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800 transition-all text-center"
                                            >
                                                <Megaphone className="w-6 h-6 text-indigo-400 mx-auto mb-2" />
                                                <span className="text-[10px] font-black text-white uppercase">Ordini</span>
                                            </button>
                                            <button
                                                onClick={() => setActiveTab('branding')}
                                                className="p-4 bg-slate-900/50 rounded-xl border border-slate-700 hover:border-pink-500/50 hover:bg-slate-800 transition-all text-center"
                                            >
                                                <Palette className="w-6 h-6 text-pink-400 mx-auto mb-2" />
                                                <span className="text-[10px] font-black text-white uppercase">Design</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'orders' && (
                            <motion.div
                                key="orders"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="max-w-4xl space-y-8"
                            >
                                {isLeader && (
                                    <div className="bg-slate-800/40 p-8 rounded-3xl border border-slate-700/50 shadow-2xl">
                                        <h3 className="text-xl font-black text-white uppercase tracking-tight mb-6 flex items-center gap-3">
                                            <Plus className="w-6 h-6 text-indigo-400" />
                                            Nuova Ordinanza di Stato
                                        </h3>
                                        <div className="space-y-4">
                                            <input
                                                type="text"
                                                placeholder="Soggetto dell'ordine..."
                                                value={newOrder.title}
                                                onChange={e => setNewOrder({ ...newOrder, title: e.target.value })}
                                                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold"
                                            />
                                            <textarea
                                                placeholder="Dettagli ed esecuzioni..."
                                                rows={5}
                                                value={newOrder.body}
                                                onChange={e => setNewOrder({ ...newOrder, body: e.target.value })}
                                                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[120px]"
                                            />
                                            <div className="flex items-center justify-between gap-4 pt-4">
                                                <div className="flex items-center gap-3 bg-slate-900/60 p-2 rounded-xl border border-slate-700/50">
                                                    <Globe className="w-4 h-4 text-slate-500 ml-2" />
                                                    <select
                                                        value={newOrder.audience}
                                                        onChange={e => setNewOrder({ ...newOrder, audience: e.target.value })}
                                                        className="bg-transparent border-none text-slate-300 font-bold text-xs focus:ring-0 cursor-pointer pr-8"
                                                    >
                                                        <option value="ALL">Canale Unificato (Tutti)</option>
                                                        <option value="CITIZENS">Solo Cittadini Registrati</option>
                                                        <option value="NEW_PLAYERS">Direttive Nuovi Giocatori</option>
                                                    </select>
                                                </div>
                                                <button
                                                    onClick={handlePostOrder}
                                                    disabled={!newOrder.title || !newOrder.body}
                                                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20 transform hover:-translate-y-1"
                                                >
                                                    Emetti Ordinanza
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-6">
                                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-4 ml-2">Registro Provvedimenti</h4>
                                    {orders.map(order => (
                                        <div key={order.id} className="bg-slate-800/20 p-8 rounded-3xl border border-slate-700/40 relative group hover:border-slate-500/30 transition-all">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h4 className="text-xl font-black text-white uppercase tracking-tight">{order.title}</h4>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">EMESSO IL {new Date(order.createdAt).toLocaleString()}</p>
                                                </div>
                                                <span className="text-[9px] bg-slate-700/50 text-slate-300 px-3 py-1.5 rounded-full font-black border border-slate-600/50 tracking-tighter uppercase">
                                                    {order.audience}
                                                </span>
                                            </div>
                                            <div className="p-5 bg-slate-900/40 border border-slate-800/50 rounded-2xl">
                                                <p className="text-slate-400 whitespace-pre-wrap leading-relaxed text-sm font-medium">{order.body}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {orders.length === 0 && (
                                        <div className="bg-slate-800/20 border-2 border-dashed border-slate-800/50 rounded-3xl p-16 text-center">
                                            <Megaphone className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                                            <p className="text-slate-500 font-bold text-sm">Nessun ordine attivo nel registro di stato.</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'ministers' && (
                            <motion.div
                                key="ministers"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="space-y-8"
                            >
                                <div className="bg-gradient-to-tr from-indigo-900/40 to-slate-800/40 p-12 rounded-[2rem] border border-indigo-500/20 text-center relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="relative">
                                        <Briefcase className="w-16 h-16 text-indigo-400 mx-auto mb-6" />
                                        <h3 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tighter mb-4">Gabinetto di Governo</h3>
                                        <p className="text-slate-400 max-w-xl mx-auto text-sm font-medium leading-relaxed mb-8">
                                            I ministri estendono il tuo potere esecutivo. Ogni incaricato ha l'autorità di approvare
                                            leggi senza votazione parlamentare e gestire i bilanci di settore.
                                        </p>
                                        <button
                                            onClick={() => navigate(`/ministers/${regionId}`)}
                                            className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 transition-all hover:scale-105"
                                        >
                                            Inizia sessione ministeriale
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {[
                                        { label: 'Economia e Sviluppo', role: 'economics', current: region.economicAdviserId, desc: 'Gestione budget, tasse e produzioni.' },
                                        { label: 'Geopolitica e Esteri', role: 'foreign', current: region.foreignMinisterId, desc: 'Gestione confini, visti e alleanze.' }
                                    ].map(m => (
                                        <div key={m.role} className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/30 hover:bg-slate-800/50 transition-all items-start flex flex-col gap-6">
                                            <div className="w-full flex justify-between items-center">
                                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">{m.label}</h3>
                                                <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md border ${m.current ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                                                    {m.current ? 'ATTIVO' : 'VACANTE'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 w-full p-6 bg-slate-900/60 rounded-2xl border border-slate-800/50">
                                                <div className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center text-slate-500 border border-slate-700 shadow-inner">
                                                    <User className="w-6 h-6" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-base font-black text-white uppercase tracking-tight">{m.current || "Non Incaricato"}</p>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5 tracking-tighter">{m.desc}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'residence' && (
                            <motion.div
                                key="residence"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-slate-900/40 rounded-3xl border border-slate-800/60 overflow-hidden shadow-2xl"
                            >
                                <div className="p-8 border-b border-slate-800 space-y-1">
                                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Candidature in Attesa</h3>
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">Gestione flussi migratori e permessi di lavoro</p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-900/80 text-slate-400 text-[10px] uppercase font-black tracking-widest">
                                                <th className="px-8 py-5 border-b border-slate-800">Candidato</th>
                                                <th className="px-8 py-5 border-b border-slate-800">Tipologia Istanza</th>
                                                <th className="px-8 py-5 border-b border-slate-800">Ricevuto</th>
                                                {isLeader && <th className="px-8 py-5 border-b border-slate-800 text-right">Determinazione</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/10">
                                            {applications.filter(a => a.status === 'pending').map(app => (
                                                <tr key={app.id} className="hover:bg-indigo-500/[0.02] transition-colors group">
                                                    <td className="px-8 py-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 text-xs font-bold border border-slate-700">
                                                                {app.username[0].toUpperCase()}
                                                            </div>
                                                            <span className="text-white font-bold tracking-tight">{app.username}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-md border ${app.type === 'residence'
                                                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                            }`}>
                                                            {app.type === 'residence' ? 'Cittadinanza' : 'Visto Lavorativo'}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-6 text-slate-500 text-xs font-bold">{new Date(app.createdAt).toLocaleDateString()}</td>
                                                    {isLeader && (
                                                        <td className="px-8 py-6 text-right">
                                                            <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => handleResolveApp(app.id, 'accept')}
                                                                    className="bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600 hover:text-white p-2.5 rounded-xl transition-all border border-emerald-500/20"
                                                                >
                                                                    <Check className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleResolveApp(app.id, 'reject')}
                                                                    className="bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white p-2.5 rounded-xl transition-all border border-red-500/20"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                            {applications.filter(a => a.status === 'pending').length === 0 && (
                                                <tr>
                                                    <td colSpan={isLeader ? 4 : 3} className="px-8 py-20 text-center">
                                                        <Users className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                                                        <p className="text-slate-600 font-bold text-sm tracking-tight uppercase">Nessuna candidatura pendente nel database cittadino.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'branding' && (
                            <motion.div
                                key="branding"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8"
                            >
                                <div className="space-y-6">
                                    <div className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/30 relative group">
                                        <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Settings className="w-6 h-6 text-slate-600" />
                                        </div>
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] block mb-6 px-1">Identità della Nazione</label>
                                        <div className="space-y-4">
                                            <div className="flex gap-4">
                                                <input
                                                    type="text"
                                                    value={branding.nationLogo}
                                                    onChange={e => setBranding({ ...branding, nationLogo: e.target.value })}
                                                    className="w-16 bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-center text-xl focus:outline-none focus:border-indigo-500"
                                                    placeholder="🏛️"
                                                    disabled={!isLeader}
                                                />
                                                <input
                                                    type="text"
                                                    value={branding.nationName}
                                                    onChange={e => setBranding({ ...branding, nationName: e.target.value })}
                                                    className="flex-1 bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-white font-bold placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                                                    placeholder="Nome della Federazione/Stato..."
                                                    disabled={!isLeader}
                                                />
                                            </div>
                                        </div>

                                        <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] block mt-8 mb-6 px-1">Colometria Regionale</label>
                                        <div className="flex gap-6 items-center bg-slate-900/60 p-6 rounded-2xl border border-slate-800/60">
                                            <div className="relative">
                                                <input
                                                    type="color"
                                                    value={branding.stateColor}
                                                    onChange={e => setBranding({ ...branding, stateColor: e.target.value })}
                                                    className="w-20 h-20 rounded-2xl bg-slate-900 border-4 border-slate-800 cursor-pointer shadow-2xl"
                                                    disabled={!isLeader}
                                                />
                                                <div className="absolute -bottom-2 -right-2 bg-slate-950 p-1 rounded-full border border-slate-700">
                                                    <Palette className="w-3 h-3 text-slate-400" />
                                                </div>
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <p className="text-[10px] text-slate-500 font-black uppercase">Codice Esadecimale</p>
                                                <input
                                                    type="text"
                                                    value={branding.stateColor}
                                                    onChange={e => setBranding({ ...branding, stateColor: e.target.value })}
                                                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-mono text-sm tracking-widest uppercase"
                                                    placeholder="#000000"
                                                    disabled={!isLeader}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {isLeader && (
                                        <button
                                            onClick={handleUpdateBranding}
                                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white p-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20 active:scale-[0.98]"
                                        >
                                            Aggiorna Registri Identità
                                        </button>
                                    )}
                                </div>

                                <div className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/30">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] block mb-6 px-1">Componimento Inno</label>
                                    <div className="space-y-4">
                                        <div className="bg-slate-900/60 rounded-2xl border border-slate-800/60 p-2 focus-within:ring-2 focus-within:ring-indigo-500/40 transition-all">
                                            <textarea
                                                value={branding.stateHymn}
                                                onChange={e => setBranding({ ...branding, stateHymn: e.target.value })}
                                                rows={10}
                                                className="w-full bg-transparent border-none rounded-xl p-4 text-slate-300 placeholder:text-slate-700 focus:outline-none focus:ring-0 text-sm leading-relaxed italic"
                                                placeholder="Scrivi qui i versi che risuoneranno nel cuore dei tuoi cittadini..."
                                                disabled={!isLeader}
                                            />
                                        </div>
                                        <p className="text-[9px] text-slate-600 font-bold uppercase text-center tracking-tighter">I testi sono visibili a tutti i visitatori della scheda nazione.</p>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'elections' && (
                            <motion.div
                                key="elections"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="max-w-3xl mx-auto py-12"
                            >
                                <div className="bg-gradient-to-b from-slate-800/40 to-indigo-900/20 p-16 rounded-[3rem] border border-slate-700/50 text-center relative overflow-hidden">
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/10 blur-[80px] -z-1" />
                                    <Check className="w-20 h-20 text-indigo-400 mx-auto mb-8 animate-pulse" />
                                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">Ufficio Elettorale</h2>
                                    <p className="text-slate-400 mb-10 max-w-sm mx-auto font-medium text-sm leading-relaxed">
                                        Le sessioni di voto federali vengono aperte automaticamente dal sistema ogni 5 giorni (120 ore)
                                        per le nazioni democratiche.
                                    </p>
                                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                                        <div className="bg-slate-900/60 px-8 py-5 rounded-2xl border border-slate-800/80">
                                            <p className="text-[10px] text-slate-500 font-black uppercase mb-1 tracking-widest">Stato del seggio</p>
                                            <p className="text-sm font-black text-amber-500 uppercase tracking-tight">CHIUSO / STAGIONE DI PACE</p>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-600 mt-12 font-bold uppercase tracking-widest">Controllo integrità sistema elettorale v2.4</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
};

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
    Plus
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
    leaderTitle: string;
    stateColor: string;
    stateHymn: string;
    nextLeaderElectionAt: number | null;
    economicMinisterUserId: string | null;
    foreignMinisterUserId: string | null;
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
    const regionId = (propRegionId || iso2 || '').toUpperCase();
    const [region, setRegion] = useState<Region | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'info' | 'ministers' | 'residence' | 'orders' | 'elections' | 'branding'>('info');

    // Form states
    const [newOrder, setNewOrder] = useState({ title: '', body: '', audience: 'ALL' });
    const [branding, setBranding] = useState({ stateColor: '', stateHymn: '' });

    const fetchData = async () => {
        if (!regionId) return;
        const authHeader = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
        try {
            const [rRes, oRes, aRes] = await Promise.all([
                fetch(`/api/regions/${regionId}`, { headers: authHeader }),
                fetch(`/api/leader/orders/${regionId}`, { headers: authHeader }),
                fetch(`/api/actions/applications?regionId=${regionId}`, { headers: authHeader })
            ]);
            const rData = await rRes.json();
            const oData = await oRes.json();
            const aData = await aRes.json();

            setRegion(rData);
            setOrders(oData);
            setApplications(aData);
            setBranding({ stateColor: rData.stateColor, stateHymn: rData.stateHymn || '' });
        } catch (err) {
            console.error("Error fetching leader data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [regionId]);

    const isLeader = region?.leaderUserId === user?.id;

    const handleUpdateBranding = async () => {
        const res = await fetch('/api/leader/update-state-ui', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ regionId, ...branding })
        });
        if (res.ok) fetchData();
    };

    const handlePostOrder = async () => {
        const res = await fetch('/api/leader/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ regionId, ...newOrder })
        });
        if (res.ok) {
            setNewOrder({ title: '', body: '', audience: 'ALL' });
            fetchData();
        }
    };

    const handleResolveApp = async (appId: string, action: 'accept' | 'reject') => {
        const res = await fetch(`/api/actions/resolve-application`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ applicationId: appId, action })
        });
        if (res.ok) fetchData();
    };

    const handleAssignMinister = async (role: string, ministerId: string | null) => {
        const res = await fetch('/api/government/assign-minister', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ regionId, role, ministerId })
        });
        if (res.ok) fetchData();
    };

    if (loading) return <div className="p-8 text-center text-slate-400">Caricamento...</div>;
    if (!region) return <div className="p-8 text-center text-red-400">Regione non trovata.</div>;

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-6">
            <header className="flex items-center justify-between bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/20 rounded-xl">
                        <Crown className="w-8 h-8 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">{region.leaderTitle} - {region.name}</h1>
                        <p className="text-slate-400">Gestione dello Stato e delle Istituzioni</p>
                    </div>
                </div>
                <div className="flex bg-slate-900/50 p-1 rounded-lg border border-slate-700">
                    {[
                        { id: 'info', icon: Globe, label: 'Info' },
                        { id: 'orders', icon: Megaphone, label: 'Ordini' },
                        { id: 'ministers', icon: Briefcase, label: 'Ministri' },
                        { id: 'residence', icon: Users, label: 'Residenza' },
                        { id: 'branding', icon: Palette, label: 'Design' },
                        { id: 'elections', icon: Check, label: 'Elezioni' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${activeTab === tab.id
                                ? 'bg-indigo-600 text-white shadow-lg'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            <span className="text-sm font-medium">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </header>

            <main>
                <AnimatePresence mode="wait">
                    {activeTab === 'info' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-6"
                        >
                            <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <User className="w-5 h-5 text-indigo-400" />
                                    Stato Attuale
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between p-3 bg-slate-900/40 rounded-lg">
                                        <span className="text-slate-400">Forma di Governo</span>
                                        <span className="text-indigo-300 font-medium">{region.governmentForm.replace('_', ' ')}</span>
                                    </div>
                                    <div className="flex justify-between p-3 bg-slate-900/40 rounded-lg">
                                        <span className="text-slate-400">Leader Attuale</span>
                                        <span className="text-white font-medium">{region.leaderUserId ? `ID: ${region.leaderUserId}` : 'Nessuno'}</span>
                                    </div>
                                    <div className="flex justify-between p-3 bg-slate-900/40 rounded-lg">
                                        <span className="text-slate-400">Prossime Elezioni</span>
                                        <span className="text-white font-medium">
                                            {region.nextLeaderElectionAt ? new Date(region.nextLeaderElectionAt).toLocaleDateString() : 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Music className="w-5 h-5 text-indigo-400" />
                                    Inno dello Stato
                                </h3>
                                <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-700 italic text-slate-300 leading-relaxed">
                                    {region.stateHymn || "Nessun inno impostato per questo Stato."}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'orders' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-6"
                        >
                            {isLeader && (
                                <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50">
                                    <h3 className="text-lg font-semibold text-white mb-4">Emetti Nuovo Ordine</h3>
                                    <div className="space-y-4">
                                        <input
                                            type="text"
                                            placeholder="Titolo dell'ordine..."
                                            value={newOrder.title}
                                            onChange={e => setNewOrder({ ...newOrder, title: e.target.value })}
                                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <textarea
                                            placeholder="Contenuto dell'ordine..."
                                            rows={4}
                                            value={newOrder.body}
                                            onChange={e => setNewOrder({ ...newOrder, body: e.target.value })}
                                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <div className="flex items-center justify-between">
                                            <select
                                                value={newOrder.audience}
                                                onChange={e => setNewOrder({ ...newOrder, audience: e.target.value })}
                                                className="bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-slate-300"
                                            >
                                                <option value="ALL">Tutti</option>
                                                <option value="CITIZENS">Solo Cittadini</option>
                                                <option value="NEW_PLAYERS">Nuovi Giocatori</option>
                                            </select>
                                            <button
                                                onClick={handlePostOrder}
                                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-medium transition-all transform hover:scale-105"
                                            >
                                                Pubblica Ordine
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                {orders.map(order => (
                                    <div key={order.id} className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 flex flex-col gap-2">
                                        <div className="flex justify-between items-start">
                                            <h4 className="text-xl font-bold text-white">{order.title}</h4>
                                            <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded uppercase tracking-wider font-bold">
                                                {order.audience}
                                            </span>
                                        </div>
                                        <p className="text-slate-300 whitespace-pre-wrap">{order.body}</p>
                                        <span className="text-xs text-slate-500 mt-2">
                                            Emesso il {new Date(order.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                ))}
                                {orders.length === 0 && (
                                    <div className="text-center py-12 text-slate-500 italic">Nessun ordine presente.</div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'ministers' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-6"
                        >
                            <div className="bg-indigo-900/40 p-8 rounded-3xl border border-indigo-500/30 text-center">
                                <Briefcase className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
                                <h3 className="text-2xl font-black text-white uppercase tracking-tight">Gestione Ministri</h3>
                                <p className="text-slate-400 font-medium mb-6">Nomina i tuoi ministri per gestire l'economia e la politica estera. I ministri possono approvare leggi istantaneamente.</p>
                                <button
                                    onClick={() => window.location.href = `/ministers/${regionId}`}
                                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all transform hover:scale-105"
                                >
                                    Apri Gestione Ministri
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[
                                    { label: 'Ministro dell\'Economia', role: 'economicMinisterUserId', current: region.economicMinisterUserId },
                                    { label: 'Ministro degli Esteri', role: 'foreignMinisterUserId', current: region.foreignMinisterUserId }
                                ].map(m => (
                                    <div key={m.role} className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50">
                                        <h3 className="text-lg font-semibold text-white mb-4">{m.label}</h3>
                                        <div className="flex items-center gap-4 p-4 bg-slate-900/40 rounded-xl">
                                            <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-slate-400">
                                                <User />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-white font-medium">{m.current || "Posizione Vacante"}</p>
                                                <p className="text-xs text-slate-500">{m.current ? 'In carica' : 'Nessun incaricato'}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'residence' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-slate-800/40 rounded-2xl border border-slate-700/50 overflow-hidden"
                        >
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                                        <th className="px-6 py-4 font-bold">Utente</th>
                                        <th className="px-6 py-4 font-bold">Tipo</th>
                                        <th className="px-6 py-4 font-bold">Data</th>
                                        {isLeader && <th className="px-6 py-4 text-right">Azioni</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {applications.filter(a => a.status === 'pending').map(app => (
                                        <tr key={app.id} className="hover:bg-slate-700/20 transition-colors">
                                            <td className="px-6 py-4 text-white font-medium">{app.username}</td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                                                    {app.type === 'residence' ? 'Residenza' : 'Permesso Lavoro'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 text-sm">{new Date(app.createdAt).toLocaleDateString()}</td>
                                            {isLeader && (
                                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleResolveApp(app.id, 'accept')}
                                                        className="bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white p-2 rounded-lg transition-all"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleResolveApp(app.id, 'reject')}
                                                        className="bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white p-2 rounded-lg transition-all"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {applications.filter(a => a.status === 'pending').length === 0 && (
                                        <tr>
                                            <td colSpan={isLeader ? 4 : 3} className="px-6 py-12 text-center text-slate-500 italic">
                                                Nessuna richiesta in attesa.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </motion.div>
                    )}

                    {activeTab === 'branding' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="max-w-xl mx-auto space-y-8 bg-slate-800/40 p-8 rounded-2xl border border-slate-700/50"
                        >
                            <div className="space-y-4">
                                <label className="text-slate-400 text-sm font-medium flex items-center gap-2">
                                    <Palette className="w-4 h-4" />
                                    Colore della Nazione sulla Mappa
                                </label>
                                <div className="flex gap-4 items-center">
                                    <input
                                        type="color"
                                        value={branding.stateColor}
                                        onChange={e => setBranding({ ...branding, stateColor: e.target.value })}
                                        className="w-16 h-16 rounded-lg bg-slate-900 border border-slate-700 cursor-pointer"
                                        disabled={!isLeader}
                                    />
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={branding.stateColor}
                                            onChange={e => setBranding({ ...branding, stateColor: e.target.value })}
                                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:outline-none"
                                            placeholder="#HEX"
                                            disabled={!isLeader}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-slate-400 text-sm font-medium flex items-center gap-2">
                                    <Music className="w-4 h-4" />
                                    Testo dell'Inno Nazionale
                                </label>
                                <textarea
                                    value={branding.stateHymn}
                                    onChange={e => setBranding({ ...branding, stateHymn: e.target.value })}
                                    rows={6}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Inserisci qui il testo dell'inno..."
                                    disabled={!isLeader}
                                />
                            </div>

                            {isLeader && (
                                <button
                                    onClick={handleUpdateBranding}
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-indigo-500/20"
                                >
                                    Salva Modifiche Design
                                </button>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'elections' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-12"
                        >
                            <div className="bg-indigo-500/10 p-12 rounded-3xl border border-indigo-500/20">
                                <Crown className="w-16 h-16 text-indigo-400 mx-auto mb-6" />
                                <h2 className="text-2xl font-bold text-white mb-2">Sezione Elettorale</h2>
                                <p className="text-slate-400 mb-8 max-w-md mx-auto">
                                    Qui potrai presto candidarti e votare per il prossimo Leader dello Stato.
                                    Il sistema a 5 giorni è attivo nei sistemi Presidenziali e a Partito Dominante.
                                </p>
                                <div className="flex justify-center gap-4">
                                    <button className="bg-indigo-600/50 text-indigo-200 px-6 py-2 rounded-lg font-medium cursor-not-allowed border border-indigo-500/30">
                                        Candidati (A Breve)
                                    </button>
                                    <button className="bg-slate-700 text-slate-300 px-6 py-2 rounded-lg font-medium cursor-not-allowed border border-slate-600">
                                        Vota (A Breve)
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

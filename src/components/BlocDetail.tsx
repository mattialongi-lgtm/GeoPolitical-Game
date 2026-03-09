import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Shield, Users, Loader2, ArrowLeft, Check, X, Scale } from "lucide-react";
import { motion } from "motion/react";
import { Bloc, BlocMembership, BlocApplication, BlocRegulationProposal } from "../types";

export const BlocDetail = ({ currentUser, regions }: { currentUser: any, regions: any[] }) => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editDesc, setEditDesc] = useState("");
    const [editLogo, setEditLogo] = useState("");

    const fetchBloc = async () => {
        try {
            const res = await fetch(`/api/blocs/${id}`);
            if (res.ok) {
                const d = await res.json();
                setData(d);
            } else {
                const err = await res.json();
                setError(err.error || "Errore di caricamento.");
            }
        } catch {
            setError("Errore di rete.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBloc();
    }, [id]);

    useEffect(() => {
        if (data?.bloc) {
            setEditName(data.bloc.name);
            setEditDesc(data.bloc.description);
            setEditLogo(data.bloc.logo);
        }
    }, [data]);

    const userRegions = regions.filter(r => r.ownerUserId === currentUser.id);
    const isLeaderStr = userRegions.length > 0;

    const handleApply = async () => {
        if (!isLeaderStr) return;
        setActionLoading(true);
        try {
            const res = await fetch(`/api/blocs/${id}/apply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stateId: userRegions[0].id })
            });
            if (res.ok) {
                alert("Candidatura inviata!");
                fetchBloc();
            } else {
                const err = await res.json();
                alert(err.error);
            }
        } catch {
            alert("Errore di rete.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleVoteApp = async (appId: string, choice: boolean) => {
        setActionLoading(true);
        try {
            // Find which of user's regions is in the bloc
            const myStateId = data.members.find((m: any) => m.ownerUserId === currentUser.id)?.stateId;
            if (!myStateId) {
                alert("Non sei leader di uno stato membro.");
                setActionLoading(false);
                return;
            }
            const res = await fetch(`/api/blocs/applications/${appId}/vote`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ voterStateId: myStateId, choice })
            });
            if (res.ok) {
                fetchBloc();
            } else {
                const err = await res.json();
                alert(err.error);
            }
        } catch {
            alert("Errore di rete.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleVoteReg = async (propId: string, choice: boolean) => {
        setActionLoading(true);
        try {
            const myStateId = data.members.find((m: any) => m.ownerUserId === currentUser.id)?.stateId;
            if (!myStateId) {
                alert("Non sei leader membro.");
                setActionLoading(false);
                return;
            }
            const res = await fetch(`/api/blocs/regulations/proposals/${propId}/vote`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ voterStateId: myStateId, choice })
            });
            if (res.ok) fetchBloc();
            else alert((await res.json()).error);
        } catch { alert("Errore rete"); }
        finally { setActionLoading(false); }
    };

    const handleUpdate = async () => {
        if (!editName.trim()) return;
        setActionLoading(true);
        try {
            const res = await fetch(`/api/blocs/${id}/update`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editName, description: editDesc, logo: editLogo })
            });
            if (res.ok) {
                setIsEditing(false);
                fetchBloc();
            } else {
                alert((await res.json()).error);
            }
        } catch { alert("Errore rete"); }
        finally { setActionLoading(false); }
    };

    const handleProposeReg = async (type: string, proposedValue: number) => {
        setActionLoading(true);
        try {
            const myStateId = data.members.find((m: any) => m.ownerUserId === currentUser.id)?.stateId;
            if (!myStateId) return;
            const res = await fetch(`/api/blocs/${id}/regulations/propose`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ proposerStateId: myStateId, type, proposedValue })
            });
            if (res.ok) fetchBloc();
            else alert((await res.json()).error);
        } catch { alert("Errore rete"); }
        finally { setActionLoading(false); }
    };

    if (loading) return <div className="p-12 text-center transition-all animate-pulse"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" /></div>;
    if (error || !data) return <div className="p-12 text-center text-rose-500 font-bold">{error}</div>;

    const { bloc, members, regulations, applications, proposals, isMemberLeader } = data;
    const isMember = members.some((m: any) => m.ownerUserId === currentUser.id);

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-24">
            <button onClick={() => navigate("/blocs")} className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Torna alla Lista
            </button>

            {/* Header */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                {!isEditing ? (
                    <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-3xl shrink-0 overflow-hidden shadow-inner">
                                {(bloc.logo || "").startsWith('http') ? <img src={bloc.logo} alt="logo" className="w-full h-full object-cover" /> : (bloc.logo || "🌍")}
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight">{bloc.name}</h2>
                                <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">Fondatore: {bloc.ownerName}</p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            {bloc.ownerStateId === userRegions[0]?.id && (
                                <button onClick={() => setIsEditing(true)} className="bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all">
                                    Modifica
                                </button>
                            )}
                            {isLeaderStr && !isMember && (
                                <button
                                    disabled={actionLoading}
                                    onClick={handleApply}
                                    className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
                                >
                                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Candidati"}
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Nome</label>
                                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white outline-none transition-all font-bold" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Logo (Emoji o URL)</label>
                                <input type="text" value={editLogo} onChange={e => setEditLogo(e.target.value)} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white outline-none transition-all font-bold" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Descrizione</label>
                            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white outline-none transition-all font-medium" />
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setIsEditing(false)} className="px-6 py-2 rounded-xl font-bold text-slate-400 hover:text-slate-600">Annulla</button>
                            <button onClick={handleUpdate} disabled={actionLoading} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black shadow-lg shadow-indigo-100 flex items-center gap-2">
                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salva"}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Info & Regolamenti */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                        <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-indigo-500" /> Info</h3>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed">{bloc.description || "Nessuna descrizione."}</p>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                        <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2"><Scale className="w-5 h-5 text-indigo-500" /> Regolamenti</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                                <span className="text-sm font-bold text-slate-700">Frontiere Aperte</span>
                                <span className={`text-xs font-black uppercase px-2 py-1 rounded-md ${regulations.openBorders ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                    {regulations.openBorders ? 'Attivo' : 'Inattivo'}
                                </span>
                            </div>
                            {isMemberLeader && (
                                <button onClick={() => handleProposeReg('openBorders', regulations.openBorders ? 0 : 1)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 w-full text-right">
                                    Proponi Cambio
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Membri */}
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                    <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-500" /> Stati Membri</h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                        {members.map((m: any) => (
                            <div key={m.stateId} className="flex justify-between items-center p-3 border border-slate-100 rounded-xl">
                                <div>
                                    <p className="text-sm font-black text-slate-900">{m.stateName}</p>
                                    <p className="text-[10px] font-bold text-slate-400">Leader: {m.leaderName}</p>
                                </div>
                                {m.stateId === bloc.ownerStateId && <span className="text-[9px] font-black uppercase bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md">Fondatore</span>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {isMemberLeader && (applications.length > 0 || proposals.length > 0) && (
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                    <h3 className="text-lg font-black text-slate-900 mb-4">Votazioni in Corso</h3>

                    <div className="space-y-4">
                        {applications.map((app: any) => {
                            const myStateId = data.members.find((m: any) => m.ownerUserId === currentUser.id)?.stateId;
                            const hasVoted = app.votes.some((v: any) => v.voterStateId === myStateId);
                            const yes = app.votes.filter((v: any) => v.choice === 1).length;
                            const no = app.votes.filter((v: any) => v.choice === 0).length;

                            return (
                                <div key={app.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">Candidatura: <span className="font-black text-indigo-600">{app.stateName}</span></p>
                                        <p className="text-[10px] text-slate-400 mt-1">Leader: {app.leaderName} • Voti: {yes} Sì / {no} No</p>
                                    </div>
                                    {!hasVoted && (
                                        <div className="flex gap-2">
                                            <button onClick={() => handleVoteApp(app.id, true)} disabled={actionLoading} className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200"><Check className="w-4 h-4" /></button>
                                            <button onClick={() => handleVoteApp(app.id, false)} disabled={actionLoading} className="p-2 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-200"><X className="w-4 h-4" /></button>
                                        </div>
                                    )}
                                    {hasVoted && <span className="text-xs font-bold text-slate-400">Hai votato</span>}
                                </div>
                            );
                        })}

                        {proposals.map((prop: any) => {
                            const myStateId = data.members.find((m: any) => m.ownerUserId === currentUser.id)?.stateId;
                            const hasVoted = prop.votes.some((v: any) => v.voterStateId === myStateId);
                            const yes = prop.votes.filter((v: any) => v.choice === 1).length;
                            const no = prop.votes.filter((v: any) => v.choice === 0).length;
                            const label = prop.type === 'openBorders' ? 'Frontiere Aperte' : 'Accordo Militare';

                            return (
                                <div key={prop.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">Proposta: Imposta <span className="font-black text-indigo-600">{label}</span> a {prop.proposedValue ? 'Attivo' : 'Inattivo'}</p>
                                        <p className="text-[10px] text-slate-400 mt-1">Voti: {yes} Sì / {no} No</p>
                                    </div>
                                    {!hasVoted && (
                                        <div className="flex gap-2">
                                            <button onClick={() => handleVoteReg(prop.id, true)} disabled={actionLoading} className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200"><Check className="w-4 h-4" /></button>
                                            <button onClick={() => handleVoteReg(prop.id, false)} disabled={actionLoading} className="p-2 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-200"><X className="w-4 h-4" /></button>
                                        </div>
                                    )}
                                    {hasVoted && <span className="text-xs font-bold text-slate-400">Hai votato</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </motion.div>
    );
};

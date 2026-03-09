import React, { useState } from 'react';
import { Shield, Crown, Building2, UserCog, User, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { Region, User as UserType } from '../types';

interface GovernmentViewProps {
    region: Region;
    currentUser: UserType | null;
    onUpdate: () => void;
}

const GOVERNMENT_INFO: Record<string, { title: string, description: string, icon: React.ReactNode, color: string }> = {
    PARLIAMENTARY_REPUBLIC: {
        title: "Repubblica Parlamentare",
        description: "La forma di democrazia predefinita. Le leggi passano tramite voto in Parlamento a maggioranza semplice.",
        icon: <Building2 className="w-8 h-8" />,
        color: "bg-blue-500/10 text-blue-400 border-blue-500/20"
    },
    PRESIDENTIAL_REPUBLIC: {
        title: "Repubblica Presidenziale",
        description: "Il Leader e i Ministri ricevono doppio stipendio. Le leggi del Leader passano istantaneamente con il 50%+1 dei voti.",
        icon: <UserCog className="w-8 h-8" />,
        color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
    },
    DOMINANT_PARTY: {
        title: "Partito Dominante",
        description: "Solo il partito del Leader siede in Parlamento. Le elezioni avvengono comunque.",
        icon: <Building2 className="w-8 h-8" />,
        color: "bg-purple-500/10 text-purple-400 border-purple-500/20"
    },
    DICTATORSHIP: {
        title: "Dittatura",
        description: "Nessun Parlamento o Ministro degli Esteri. Il Leader ha poteri assoluti e le leggi passano all'istante.",
        icon: <Crown className="w-8 h-8" />,
        color: "bg-red-500/10 text-red-400 border-red-500/20"
    },
    ONE_PARTY_SYSTEM: {
        title: "Sistema a Partito Unico",
        description: "Nessun Ministro degli Esteri. Nuove leggi possono essere introdotte solo dal dittatore.",
        icon: <Shield className="w-8 h-8" />,
        color: "bg-orange-500/10 text-orange-400 border-orange-500/20"
    },
    EXECUTIVE_MONARCHY: {
        title: "Monarchia Esecutiva",
        description: "Il Parlamento propone e vota le leggi, ma richiedono la Sanzione (approvazione) del Leader o del Consigliere Economico per entrare in vigore.",
        icon: <Crown className="w-8 h-8" />,
        color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
    }
};

export const GovernmentView = ({ region, currentUser, onUpdate }: GovernmentViewProps) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const formInfo = GOVERNMENT_INFO[region.governmentForm || 'PARLIAMENTARY_REPUBLIC'];
    const isLeader = currentUser?.id === region.ownerUserId;

    const handleAssignMinister = async (role: 'economicAdviserId' | 'foreignMinisterId', userIdStr: string | null) => {
        if (!isLeader) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/government/assign-minister', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    regionId: region.id,
                    role,
                    ministerId: userIdStr
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            onUpdate();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleTransition = async (targetForm: string) => {
        if (!window.confirm(`Sei sicuro di voler passare alla forma di governo: ${targetForm}?`)) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/government/transition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    regionId: region.id,
                    targetForm
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            onUpdate();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const autocracies = ["DICTATORSHIP", "ONE_PARTY_SYSTEM", "EXECUTIVE_MONARCHY"];
    const isAutocracy = autocracies.includes(region.governmentForm);

    return (
        <div className="space-y-6">
            {error && (
                <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {/* Current Government Banner */}
            <div className={`p-6 rounded-xl border ${formInfo.color} flex flex-col items-center text-center`}>
                <div className="mb-4">{formInfo.icon}</div>
                <h2 className="text-2xl font-bold mb-2">{formInfo.title}</h2>
                <p className="opacity-80 max-w-2xl">{formInfo.description}</p>
            </div>

            {/* Government Roles */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h3 className="text-xl font-bold text-slate-100 mb-6 flexItems-center gap-2">
                    <UserCog className="w-5 h-5 text-emerald-400" />
                    Struttura di Governo
                </h3>

                <div className="space-y-4">
                    {/* Leader */}
                    <div className="p-4 bg-slate-900/50 rounded-lg flex items-center justify-between border border-emerald-500/20">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <Crown className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <p className="font-medium text-emerald-400">
                                    {isAutocracy ? 'Dittatore / Sovrano' : 'Leader dello Stato'}
                                </p>
                                <p className="text-sm text-slate-300">
                                    {region.ownerName || 'Nessuno'}
                                </p>
                            </div>
                        </div>
                        {isLeader && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">Sei tu</span>}
                    </div>

                    {/* Economic Adviser */}
                    <div className="p-4 bg-slate-900/50 rounded-lg flex items-center justify-between border border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                <User className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="font-medium text-blue-400">Consigliere Economico</p>
                                <p className="text-sm text-slate-300">
                                    {region.economicAdviserId ? `ID Utente: ${region.economicAdviserId}` : 'Nessuno assegnato'}
                                </p>
                            </div>
                        </div>
                        {isLeader && (
                            <button
                                onClick={() => {
                                    const id = prompt("Inserisci l'ID dell'utente da assegnare (LASCIA VUOTO per rimuovere):");
                                    if (id !== null) handleAssignMinister('economicAdviserId', id || null);
                                }}
                                disabled={loading}
                                className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 transition-colors"
                            >
                                Modifica
                            </button>
                        )}
                    </div>

                    {/* Foreign Minister - Hidden in Autocracies */}
                    {!isAutocracy && (
                        <div className="p-4 bg-slate-900/50 rounded-lg flex items-center justify-between border border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                                    <User className="w-5 h-5 text-purple-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-purple-400">Ministro degli Esteri</p>
                                    <p className="text-sm text-slate-300">
                                        {region.foreignMinisterId ? `ID Utente: ${region.foreignMinisterId}` : 'Nessuno assegnato'}
                                    </p>
                                </div>
                            </div>
                            {isLeader && (
                                <button
                                    onClick={() => {
                                        const id = prompt("Inserisci l'ID dell'utente da assegnare (LASCIA VUOTO per rimuovere):");
                                        if (id !== null) handleAssignMinister('foreignMinisterId', id || null);
                                    }}
                                    disabled={loading}
                                    className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 transition-colors"
                                >
                                    Modifica
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Dictator Specific Actions */}
            {isLeader && isAutocracy && (
                <div className="bg-slate-800 rounded-xl border border-red-500/30 p-6">
                    <h3 className="text-xl font-bold text-red-500 mb-4 flex items-center gap-2">
                        <Crown className="w-5 h-5" />
                        Poteri del Dittatore
                    </h3>
                    <p className="text-slate-400 text-sm mb-6">
                        Essendo al comando assoluto, puoi decidere di convertire lo Stato in un Sistema a Partito Unico o in una Monarchia Esecutiva istantaneamente,
                        oppure riconsegnare il potere alla Repubblica passando per le proprie azioni.
                    </p>
                    <div className="flex flex-wrap gap-4">
                        {region.governmentForm === 'DICTATORSHIP' && (
                            <>
                                <button
                                    onClick={() => handleTransition('ONE_PARTY_SYSTEM')}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors"
                                >
                                    <ArrowRightLeft className="w-4 h-4" />
                                    Sistema a Partito Unico
                                </button>
                                <button
                                    onClick={() => handleTransition('EXECUTIVE_MONARCHY')}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-colors"
                                >
                                    <ArrowRightLeft className="w-4 h-4" />
                                    Monarchia Esecutiva
                                </button>
                            </>
                        )}

                        {(region.governmentForm === 'ONE_PARTY_SYSTEM' || region.governmentForm === 'EXECUTIVE_MONARCHY') && (
                            <button
                                onClick={() => handleTransition('DICTATORSHIP')}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                            >
                                <ArrowRightLeft className="w-4 h-4" />
                                Ritorna a Dittatura
                            </button>
                        )}

                        <button
                            onClick={() => handleTransition('PRESIDENTIAL_REPUBLIC')}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 rounded-lg transition-colors"
                        >
                            <ArrowRightLeft className="w-4 h-4" />
                            Ritorna alla Democrazia (Repubblica)
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

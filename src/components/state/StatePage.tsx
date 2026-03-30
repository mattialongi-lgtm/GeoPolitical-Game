/**
 * StatePage – Complete state overview page.
 *
 * A vertical, mobile-first page inspired by geopolitical game UIs.
 * Composed of modular sections: header, identity, political info, stats,
 * treasury, detailed info, regions, agreements, and sanctions.
 *
 * All data currently uses mock data as fallback until Supabase backend is connected.
 * Each section uses CollapsibleSection for clean expand/collapse behavior.
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Wallet,
  Info,
  Star,
  MapPin,
  Swords,
  Plane,
  ShieldAlert,
  Zap,
  ArrowRightLeft,
  Globe2,
  Gem,
  Factory as FactoryIcon,
  BookOpen,
  Heart,
  X,
} from 'lucide-react';

import StateHeader from './StateHeader';
import StateIdentityCard from './StateIdentityCard';
import PoliticalInfoCard from './PoliticalInfoCard';
import StateStatsGrid from './StateStatsGrid';
import CollapsibleSection from './CollapsibleSection';
import DetailRow from './DetailRow';
import RegionListItem from './RegionListItem';
import AgreementListItem from './AgreementListItem';
import { MOCK_STATE_DATA, EMPTY_STATE_DATA } from './mockData';
import type { StateData } from './mockData';
import DepartmentsSection from './DepartmentsSection';

interface StatePageProps {
  user?: any;
}

export default function StatePage({ user }: StatePageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [stateData, setStateData] = useState<StateData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadState = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/state/${id}`);
      if (!res.ok) throw new Error("Failed to fetch state data");
      const data = await res.json();
      setStateData(data);
    } catch (err) {
      console.error("Error loading state:", err);
      setStateData(EMPTY_STATE_DATA);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadState();
  }, [id]);

  const [isDonateModalOpen, setIsDonateModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-gray-500 font-semibold">Caricamento stato...</p>
        </div>
      </div>
    );
  }

  if (!stateData) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-gray-500">Stato non trovato.</p>
      </div>
    );
  }

  const s = stateData;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4 max-w-3xl mx-auto pb-24"
    >
      {/* 1. HEADER */}
      <StateHeader name={s.name} regionCount={s.regionCount} population={s.population} />

      {/* 2. IDENTITY BLOCK */}
      <StateIdentityCard
        flag={s.flag}
        flagUrl={s.flagUrl}
        representativeImage={s.representativeImage}
        stateName={s.name}
        onParliamentClick={() => navigate('/parliament')}
      />

      {/* 3. POLITICAL INFO */}
      <PoliticalInfoCard
        governmentForm={s.governmentForm}
        headOfState={s.headOfState}
        economyMinister={s.economyMinister}
        foreignMinister={s.foreignMinister}
        geopoliticalBloc={s.geopoliticalBloc}
      />

      {/* 4. ACTIONS */}
      <CollapsibleSection title="Azioni" icon={<Zap className="w-4 h-4" />}>
        <div className="p-4 grid grid-cols-2 gap-2">
          {[
            { 
              label: 'Richiedi residenza', 
              icon: BookOpen, 
              action: () => navigate(`/countries/${id}`) 
            },
            { 
              label: 'Visualizza regioni', 
              icon: MapPin, 
              action: () => document.getElementById('regions-section')?.scrollIntoView({ behavior: 'smooth' }) 
            },
            { 
              label: 'Relazioni internazionali', 
              icon: Globe2, 
              action: () => document.getElementById('agreements-section')?.scrollIntoView({ behavior: 'smooth' }) 
            },
            { 
              label: 'Visualizza risorse', 
              icon: Gem, 
              action: () => document.getElementById('treasury-section')?.scrollIntoView({ behavior: 'smooth' }) 
            },
            {
              label: 'Dona',
              icon: Heart,
              action: () => setIsDonateModalOpen(true),
              isSpecial: true
            },
          ].map((a, i) => (
            <button
              key={i}
              onClick={a.action}
              className={`flex items-center gap-2 p-3 rounded-xl border transition-colors ${
                (a as any).isSpecial 
                  ? "bg-emerald-600/20 border-emerald-500/40 hover:bg-emerald-600/30" 
                  : "bg-gray-800/50 border-gray-700/40 hover:border-indigo-500/40"
              }`}
            >
              <a.icon className={`w-4 h-4 shrink-0 ${(a as any).isSpecial ? "text-emerald-400" : "text-indigo-400"}`} />
              <span className={`text-[11px] font-bold ${(a as any).isSpecial ? "text-emerald-300" : "text-gray-300"}`}>{a.label}</span>
            </button>
          ))}
        </div>
      </CollapsibleSection>

      {/* 5. STATS GRID */}
      <StateStatsGrid
        nationId={id!}
        citizens={s.stats.citizens}
        residents={s.stats.residents}
        parties={s.stats.parties}
        factories={s.stats.factories}
      />

      {/* 6. TREASURY */}
      <div id="treasury-section">
        <CollapsibleSection title="Tesoreria" icon={<Wallet className="w-4 h-4" />}>
        <div className="divide-y divide-gray-800/40">
          <DetailRow label="Saldo dello Stato" value={s.treasury.balance} unit="€" highlight />
          <DetailRow label="Entrate giornaliere" value={s.treasury.dailyIncome} unit="€" />
          <DetailRow label="Uscite giornaliere" value={s.treasury.dailyExpenses} unit="€" />
          <DetailRow label="Saldo netto" value={s.treasury.netBalance} unit="€" highlight />
          
          <div className="p-4 bg-gray-900/30">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Gem className="w-3 h-3 text-indigo-400" />
              Patrimonio Statale
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'oil', label: 'Petrolio', icon: '🛢️' },
                { id: 'minerals', label: 'Minerali', icon: '🪨' },
                { id: 'uranium', label: 'Uranio', icon: '☢️' },
                { id: 'diamonds', label: 'Diamanti', icon: '💎' },
                { id: 'liquid_oxygen', label: 'Ossigeno Liq.', icon: '🧊' },
                { id: 'helium3', label: 'Elio-3', icon: '⚗️' },
                { id: 'gold_ore', label: 'Oro', icon: '🪙' },
              ].map((res) => (
                <div key={res.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-800/40 border border-gray-700/30">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{res.icon}</span>
                    <span className="text-[10px] text-gray-400 font-medium">{res.label}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-200">
                    {s.treasury.resources?.[res.id]?.toLocaleString('it-IT') || '0'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </div>

      {/* 7. DETAILED INFO */}
      <CollapsibleSection
        title="Informazioni dettagliate"
        icon={<Info className="w-4 h-4" />}
        defaultOpen
      >
        <div className="divide-y divide-gray-800/40">
          <DetailRow label="Permessi di lavoro:" value={s.details.workPermits} highlight />
          <DetailRow label="Inizio mandato del Capo di Stato:" value={s.details.mandateStart} highlight />
          <DetailRow label="Elezioni del Capo di Stato:" value={s.details.nextElections} highlight />
          <DetailRow label="Autonomie:" value={s.details.autonomies} highlight />
          <DetailRow label="Tassa d'ingresso:" value={s.details.entryTax} unit="€" highlight />
          <DetailRow label="Confini:" value={s.details.borders} highlight />
          <DetailRow label="Residenza per lavorare:" value={s.details.residenceToWork} highlight />
          <DetailRow label="Residenza:" value={s.details.residence} highlight />
          <DetailRow label="Produzione delle centrali energetiche:" value={s.details.energyProduction} unit="MW" highlight />
          <DetailRow label="Consumo energetico:" value={s.details.energyConsumption} unit="MW" highlight />
          <DetailRow label="Data di fondazione:" value={s.details.foundationDate} highlight />
          <DetailRow label="Guerre in corso:" value={s.details.ongoingWars} highlight />
          {/* Resources CTA */}
          <div className="p-4">
            <button
              onClick={() => navigate(`/countries/${s.id}`)}
              className="w-full py-2.5 rounded-xl bg-gray-800 border border-gray-700/50 hover:border-indigo-500/40 transition-colors"
            >
              <span className="text-xs font-bold text-gray-300">Risorse</span>
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* 8. DIPARTIMENTI DI STATO */}
      <DepartmentsSection nationId={id!} user={user} />

      {/* 9. STATE REGIONS */}
      <div id="regions-section">
        <CollapsibleSection
          title="Regioni dello Stato"
          icon={<MapPin className="w-4 h-4" />}
          badge={s.regions.length}
          isEmpty={s.regions.length === 0}
          emptyMessage="Nessuna regione registrata."
        >
        <div>
          {s.regions.map((region) => (
            <RegionListItem
              key={region.id}
              name={region.name}
              population={region.population}
              mainResource={region.mainResource}
              developmentLevel={region.developmentLevel}
              governor={region.governor}
              onClick={() => navigate(`/regions/${region.id}`)}
            />
          ))}
        </div>
      </CollapsibleSection>
    </div>

      {/* 10. MILITARY AGREEMENTS */}
      <div id="agreements-section">
        <CollapsibleSection
          title="Accordi militari"
          icon={<Swords className="w-4 h-4" />}
          badge={s.militaryAgreements.length || undefined}
          isEmpty={s.militaryAgreements.length === 0}
          emptyMessage="Nessun accordo militare in vigore."
        >
        <div>
          {s.militaryAgreements.map((a, i) => (
            <AgreementListItem
              key={i}
              type={a.type}
              partnerName={a.partnerName}
              partnerFlag={a.partnerFlag}
              status={a.status}
              expiresAt={a.expiresAt}
            />
          ))}
        </div>
      </CollapsibleSection>
    </div>

      {/* 11. MIGRATION AGREEMENTS */}
      <CollapsibleSection
        title="Accordi migratori"
        icon={<Plane className="w-4 h-4" />}
        isEmpty={s.migrationAgreements.length === 0}
        emptyMessage="Nessun accordo migratorio."
      >
        <div>
          {s.migrationAgreements.map((a, i) => (
            <AgreementListItem
              key={i}
              type="bilateral"
              partnerName={a.partnerName}
              partnerFlag={a.partnerFlag}
              status={a.status}
            />
          ))}
        </div>
      </CollapsibleSection>

      {/* 12. SANCTIONS */}
      <CollapsibleSection
        title="Sanzioni"
        icon={<ShieldAlert className="w-4 h-4" />}
        isEmpty={s.sanctions.length === 0}
        emptyMessage="Nessuna sanzione presente."
      >
        <div>
          {s.sanctions.map((sanc, i) => (
            <AgreementListItem
              key={i}
              type={sanc.type}
              partnerName={sanc.partnerName}
              partnerFlag={sanc.partnerFlag}
              status={sanc.status}
              expiresAt={sanc.expiresAt}
            />
          ))}
        </div>
      </CollapsibleSection>

      {isDonateModalOpen && (
        <DonateModal 
          stateId={id!} 
          onClose={() => setIsDonateModalOpen(false)} 
          onSuccess={() => {
            setIsDonateModalOpen(false);
            loadState();
          }}
        />
      )}
    </motion.div>
  );
}

// --- DONATE MODAL ---
function DonateModal({ stateId, onClose, onSuccess }: { stateId: string, onClose: () => void, onSuccess: () => void }) {
  const [type, setType] = useState<'money' | 'gold' | string>('money');
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [userResources, setUserResources] = useState<any>({ money: 0, gold: 0, inventory: [] });

  useEffect(() => {
    // Fetch user current balances
    const fetchUserStats = async () => {
      try {
        const res = await fetch('/api/user/stats'); // We assume this exists or use props
        if (res.ok) {
          const data = await res.json();
          setUserResources(data);
        }
      } catch (err) { console.error(err); }
    };
    fetchUserStats();
  }, []);

  const handleDonate = async () => {
    const val = parseInt(amount);
    if (!val || val <= 0) return alert("Inserisci un importo valido");
    
    setLoading(true);
    try {
      const res = await fetch(`/api/state/${stateId}/donate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount: val })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Donazione effettuata!");
        onSuccess();
      } else {
        alert(data.error || "Errore durante la donazione");
      }
    } catch (err) {
      alert("Errore di connessione");
    } finally {
      setLoading(false);
    }
  };

  const getBalance = () => {
    if (type === 'money') return userResources.money || 0;
    if (type === 'gold') return userResources.gold || 0;
    const item = (userResources.inventory || []).find((i: any) => i.itemId === type);
    return item ? item.quantity : 0;
  };

  const resourceOptions = [
    { id: 'money', label: 'Soldi', icon: '💰' },
    { id: 'gold', label: 'Gold', icon: '🪙' },
    { id: 'oil', label: 'Petrolio', icon: '🛢️' },
    { id: 'minerals', label: 'Minerali', icon: '🪨' },
    { id: 'uranium', label: 'Uranio', icon: '☢️' },
    { id: 'diamonds', label: 'Diamanti', icon: '💎' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-[2.5rem] shadow-2xl p-6 overflow-hidden relative"
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 flex items-center justify-center">
              <Heart className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white leading-tight uppercase">Dona allo Stato</h3>
              <p className="text-[10px] font-bold text-gray-500 tracking-wider">CONTRIBUISCI ALLA TESORERIA</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Cosa vuoi donare?</label>
            <div className="grid grid-cols-3 gap-2">
              {resourceOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setType(opt.id)}
                  className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-1 ${
                    type === opt.id 
                      ? "bg-indigo-600/20 border-indigo-500/50" 
                      : "bg-gray-800/40 border-gray-700/30 grayscale hover:grayscale-0"
                  }`}
                >
                  <span className="text-xl">{opt.icon}</span>
                  <span className={`text-[9px] font-black uppercase ${type === opt.id ? "text-indigo-300" : "text-gray-500"}`}>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 bg-gray-950 rounded-3xl border border-gray-800">
            <div className="flex justify-between items-end mb-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Quantità</label>
              <span className="text-[10px] font-bold text-gray-400">Tuo saldo: <span className="text-white">{getBalance().toLocaleString('it-IT')}</span></span>
            </div>
            <input 
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-transparent text-2xl font-black text-white outline-none placeholder:text-gray-800 tabular-nums"
            />
          </div>

          <button
            disabled={loading || !amount}
            onClick={handleDonate}
            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all disabled:opacity-50 active:scale-95"
          >
            {loading ? "Invio in corso..." : "Invia Donazione"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

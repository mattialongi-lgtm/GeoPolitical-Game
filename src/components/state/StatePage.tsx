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
  Eye,
  Globe2,
  Gem,
  Factory as FactoryIcon,
  BookOpen,
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

interface StatePageProps {
  user?: any;
}

export default function StatePage({ user }: StatePageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [stateData, setStateData] = useState<StateData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadState = async () => {
      setLoading(true);
      try {
        // TODO: Replace with real API call: const res = await fetch(`/api/state/${id}`);
        // For now, use mock data
        await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
        if (id) {
          setStateData({ ...MOCK_STATE_DATA, id });
        } else {
          setStateData(MOCK_STATE_DATA);
        }
      } catch {
        setStateData(EMPTY_STATE_DATA);
      } finally {
        setLoading(false);
      }
    };
    loadState();
  }, [id]);

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
      <StateHeader name={s.name} regionCount={s.regionCount} />

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
            { label: 'Trasferisciti', icon: ArrowRightLeft, action: () => {} },
            { label: 'Richiedi residenza', icon: BookOpen, action: () => {} },
            { label: 'Visualizza regioni', icon: MapPin, action: () => {} },
            { label: 'Relazioni internazionali', icon: Globe2, action: () => {} },
            { label: 'Visualizza risorse', icon: Gem, action: () => {} },
            { label: 'Visualizza fabbriche', icon: FactoryIcon, action: () => {} },
          ].map((a, i) => (
            <button
              key={i}
              onClick={a.action}
              className="flex items-center gap-2 p-3 rounded-xl bg-gray-800/50 border border-gray-700/40 hover:border-indigo-500/40 transition-colors"
            >
              <a.icon className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="text-[11px] font-bold text-gray-300">{a.label}</span>
            </button>
          ))}
        </div>
      </CollapsibleSection>

      {/* 5. STATS GRID */}
      <StateStatsGrid
        citizens={s.stats.citizens}
        residents={s.stats.residents}
        parties={s.stats.parties}
        factories={s.stats.factories}
      />

      {/* 6. TREASURY */}
      <CollapsibleSection title="Tesoreria" icon={<Wallet className="w-4 h-4" />}>
        <div className="divide-y divide-gray-800/40">
          <DetailRow label="Saldo dello Stato" value={s.treasury.balance} unit="€" highlight />
          <DetailRow label="Entrate giornaliere" value={s.treasury.dailyIncome} unit="€" />
          <DetailRow label="Uscite giornaliere" value={s.treasury.dailyExpenses} unit="€" />
          <DetailRow label="Saldo netto" value={s.treasury.netBalance} unit="€" highlight />
          <DetailRow label="Riserva aurea" value={s.treasury.goldReserve} unit="oro" />
          <DetailRow label="Fondi speciali" value={s.treasury.specialFunds} unit="€" />
        </div>
      </CollapsibleSection>

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

      {/* 8. BEST DEPARTMENT */}
      <CollapsibleSection
        title={
          s.bestDepartment
            ? `Miglior dipartimento: ${s.bestDepartment.name} (${s.bestDepartment.value.toLocaleString('it-IT')})`
            : 'Miglior dipartimento'
        }
        icon={<Star className="w-4 h-4" />}
        isEmpty={!s.bestDepartment}
        emptyMessage="Nessun dipartimento disponibile."
      >
        {s.bestDepartment && (
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-white capitalize">{s.bestDepartment.name}</span>
              </div>
              <span className="text-sm font-black text-amber-400 tabular-nums">
                {s.bestDepartment.value.toLocaleString('it-IT')}
              </span>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* 9. STATE REGIONS */}
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

      {/* 10. MILITARY AGREEMENTS */}
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
    </motion.div>
  );
}

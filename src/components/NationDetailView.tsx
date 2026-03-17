/**
 * NationDetailView – Detailed State/Nation page inspired by Rival Regions.
 * Shows nation name, region count, tabs, treasury, detailed info,
 * regions list, military agreements, migration agreements, sanctions.
 */
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Globe,
  Users,
  Crown,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  Zap,
  Shield,
  Swords,
  Heart,
  BookOpen,
  TrendingUp,
  Landmark,
  AlertCircle,
  Flag,
} from "lucide-react";
import { getRegionImage } from "../regionImages";

interface NationDetailViewProps {
  user: any;
}

// Inline NationalFlag to avoid circular dependencies
const NationalFlag = ({ iso2, className = "w-[1.2em] h-[0.9em]", style }: { iso2: string; className?: string; style?: React.CSSProperties }) => {
  const [error, setError] = useState(false);
  const upper = (iso2 || '').toUpperCase();
  const countryCode = (upper.includes('-') ? upper.split('-')[0] : upper).toLowerCase();

  if (!countryCode || countryCode === 'st' || countryCode === 'world' || error) {
    return <span className={className} style={{...style, fontSize: '1em', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}>🌍</span>;
  }

  return (
    <img
      src={`https://flagcdn.com/${countryCode}.svg`}
      className={`inline-block object-cover rounded-sm shadow-sm align-middle ${className}`}
      alt={iso2}
      style={style}
      onError={() => setError(true)}
    />
  );
};

/** Collapsible section component */
const CollapsibleSection = ({ title, children, defaultOpen = false, badge }: { title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: React.ReactNode }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-700/50 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 px-1 text-left hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-bold text-gray-300">{title}</span>
          {badge}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pb-4 px-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/** Info row for key-value display */
const InfoRow = ({ label, value, valueColor }: { label: string; value: string | number; valueColor?: string }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-gray-800/40 last:border-b-0">
    <span className="text-xs font-bold text-gray-400">{label}:</span>
    <span className={`text-xs font-black uppercase ${valueColor || "text-white"}`}>{value}</span>
  </div>
);

const formatNumber = (n: number): string => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return n.toLocaleString();
  return String(n);
};

const GOV_FORM_LABELS: Record<string, string> = {
  PARLIAMENTARY_REPUBLIC: "Repubblica Parlamentare",
  PRESIDENTIAL_REPUBLIC: "Repubblica Presidenziale",
  DOMINANT_PARTY: "Partito Dominante",
  DICTATORSHIP: "Dittatura",
  ONE_PARTY_SYSTEM: "Monopartitismo",
  EXECUTIVE_MONARCHY: "Monarchia Esecutiva",
};

export default function NationDetailView({ user }: NationDetailViewProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [nation, setNation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/nations/${id}`)
      .then(r => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then(data => setNation(data))
      .catch(() => setNation(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!nation) {
    return (
      <div className="p-12 text-center">
        <Globe className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h2 className="text-2xl font-black text-white">Stato non trovato</h2>
        <p className="text-gray-400 mt-2">"{id}" non corrisponde a nessuno stato.</p>
        <button onClick={() => navigate("/states")} className="mt-6 text-indigo-400 font-black uppercase text-xs">← Torna alla Lista Stati</button>
      </div>
    );
  }

  const regions: any[] = nation.regions || [];
  const bestDepartment = getBestDepartment(regions);
  const logo = nation.logo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-0 max-w-2xl mx-auto pb-24"
    >
      {/* Header */}
      <div className="bg-gray-900 rounded-t-2xl pt-4 pb-3 px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-white transition-colors">
            ←
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-xl font-black text-white uppercase tracking-wide leading-tight">
              {nation.name || id}
            </h1>
            <p className="text-[11px] font-bold text-gray-400 mt-0.5">
              Stato, regioni: {nation.regionCount || regions.length}
            </p>
          </div>
          <div className="p-2 text-gray-400">
            <Globe className="w-5 h-5" />
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="flex items-center justify-around mt-4 py-3 bg-gray-800/50 rounded-xl">
          <div className="text-center">
            <Users className="w-4 h-4 text-gray-400 mx-auto mb-1" />
            <p className="text-xs font-black text-white">{nation.totalPlayerCount || 0}</p>
            <p className="text-[9px] text-gray-500">Giocatori</p>
          </div>
          <div className="text-center">
            <MapPin className="w-4 h-4 text-gray-400 mx-auto mb-1" />
            <p className="text-xs font-black text-white">{nation.regionCount || regions.length}</p>
            <p className="text-[9px] text-gray-500">Regioni</p>
          </div>
          <div className="text-center">
            <Swords className="w-4 h-4 text-gray-400 mx-auto mb-1" />
            <p className="text-xs font-black text-white">{nation.activeWarsCount || 0}</p>
            <p className="text-[9px] text-gray-500">Guerre</p>
          </div>
          <div className="text-center">
            <Shield className="w-4 h-4 text-gray-400 mx-auto mb-1" />
            <p className="text-xs font-black text-white">{nation.autonomousCount || 0}</p>
            <p className="text-[9px] text-gray-500">Autonomie</p>
          </div>
        </div>
      </div>

      {/* National Logo/Flag */}
      <div className="bg-gray-900/80 px-4 py-3 flex items-center justify-center">
        {logo && logo.startsWith("http") ? (
          <img src={logo} alt={nation.name} className="w-16 h-12 object-contain rounded" />
        ) : (
          <NationalFlag iso2={id || ""} className="w-20 h-14 shadow-md rounded" />
        )}
      </div>

      {/* Main Content */}
      <div className="bg-gray-900/60 rounded-b-2xl px-4 divide-y divide-gray-800/40">

        {/* Tesoro / Treasury */}
        <CollapsibleSection title="💰 Tesoreria" defaultOpen={false}>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-500/10 p-3 rounded-xl text-center border border-emerald-500/20">
              <p className="text-[9px] font-black text-emerald-400 uppercase">Tesoro Totale</p>
              <p className="text-lg font-black text-emerald-300">€{formatNumber(nation.totalTreasury || 0)}</p>
            </div>
            <div className="bg-amber-500/10 p-3 rounded-xl text-center border border-amber-500/20">
              <p className="text-[9px] font-black text-amber-400 uppercase">Popolazione</p>
              <p className="text-lg font-black text-amber-300">{formatNumber(nation.totalPopulation || 0)}</p>
            </div>
          </div>
        </CollapsibleSection>

        {/* Informazioni dettagliate */}
        <CollapsibleSection title="📋 Informazioni dettagliate" defaultOpen={true}>
          <div className="space-y-0">
            <InfoRow label="Capo di Stato" value={nation.leaderName || "— Vacante —"} />
            <InfoRow
              label="Forma di governo"
              value={GOV_FORM_LABELS[nation.governmentForm] || nation.governmentForm}
            />
            {nation.nextLeaderElectionAt && (
              <InfoRow
                label="Elezioni del Capo di Stato"
                value={new Date(nation.nextLeaderElectionAt).toLocaleString("it-IT", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              />
            )}
            <InfoRow label="Autonomie" value={String(nation.autonomousCount || 0)} />
            <InfoRow
              label="Confini"
              value={nation.workRestrictions ? "CHIUSO" : "APERTO"}
              valueColor={nation.workRestrictions ? "text-red-400" : "text-emerald-400"}
            />
            <InfoRow
              label="Residenza per lavorare"
              value={nation.workRestrictions ? "NECESSARIA" : "NON NECESSARIA"}
              valueColor={nation.workRestrictions ? "text-amber-400" : "text-emerald-400"}
            />
            <InfoRow
              label="Residenza"
              value={nation.residencePolicy === 'open' ? "LIBERA" : "CONCESSA DAL CAPO DI STATO"}
              valueColor={nation.residencePolicy === 'open' ? "text-emerald-400" : "text-amber-400"}
            />
            <InfoRow
              label="Produzione centrali energetiche"
              value={`${formatNumber(Math.round(nation.totalEnergyGeneration || 0))} MW`}
            />
            <InfoRow
              label="Consumo energetico"
              value={`${formatNumber(Math.round(nation.totalEnergyConsumption || 0))} MW`}
            />
            {nation.updatedAt && (
              <InfoRow
                label="Ultimo aggiornamento"
                value={new Date(nation.updatedAt).toLocaleString("it-IT")}
              />
            )}
            <InfoRow
              label="Guerre in corso"
              value={String(nation.activeWarsCount || 0)}
              valueColor={nation.activeWarsCount > 0 ? "text-red-400" : "text-gray-400"}
            />
          </div>
        </CollapsibleSection>

        {/* Best Department */}
        {bestDepartment && (
          <CollapsibleSection
            title={`🏆 Miglior dipartimento: ${bestDepartment.label} (${bestDepartment.total})`}
            defaultOpen={false}
          >
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "health", label: "Salute", icon: "❤️", color: "text-red-400" },
                { key: "education", label: "Istruzione", icon: "📚", color: "text-indigo-400" },
                { key: "military", label: "Militare", icon: "🛡️", color: "text-orange-400" },
                { key: "economy", label: "Economia", icon: "💰", color: "text-emerald-400" },
              ].map(dept => {
                const total = regions.reduce((sum, r) => sum + (r[dept.key === "economy" ? "economyLevel" : dept.key] || 0), 0);
                return (
                  <div key={dept.key} className="bg-gray-800/50 p-3 rounded-xl flex items-center gap-2">
                    <span className="text-lg">{dept.icon}</span>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400">{dept.label}</p>
                      <p className={`text-sm font-black ${dept.color}`}>{total}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        )}

        {/* Regioni dello Stato */}
        <CollapsibleSection
          title="🗺️ Regioni dello Stato"
          defaultOpen={false}
          badge={
            <span className="text-[9px] font-bold text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full ml-2">
              {regions.length}
            </span>
          }
        >
          <div className="space-y-2">
            {regions.map((r: any) => {
              const regionImg = getRegionImage(r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => navigate(`/countries/${r.id}`)}
                  className="w-full flex items-center gap-3 p-3 bg-gray-800/40 rounded-xl hover:bg-gray-700/50 transition-colors text-left"
                >
                  {regionImg ? (
                    <img src={regionImg} alt={r.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <NationalFlag iso2={r.id} className="w-10 h-8 rounded shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-white truncate">
                      {r.isCapital && "👑 "}{r.name || r.id}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[9px] text-gray-500">
                        <Users className="w-3 h-3 inline mr-0.5" />{r.playerCount || 0}
                      </span>
                      <span className="text-[9px] text-gray-500">
                        Eco {r.economyLevel || 1}/10
                      </span>
                      {r.isAutonomous && (
                        <span className="text-[9px] text-purple-400 font-bold">🏛️ Autonomia</span>
                      )}
                    </div>
                  </div>
                  <span className="text-gray-600 text-xs">›</span>
                </button>
              );
            })}
            {regions.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-3">Nessuna regione associata.</p>
            )}
          </div>
        </CollapsibleSection>

        {/* Accordi militari / Guerre */}
        <CollapsibleSection
          title="⚔️ Guerre in corso"
          defaultOpen={false}
          badge={nation.activeWarsCount > 0 ? (
            <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full ml-2">
              {nation.activeWarsCount}
            </span>
          ) : undefined}
        >
          {(nation.activeWars || []).length > 0 ? (
            <div className="space-y-2">
              {nation.activeWars.map((w: any) => (
                <div key={w.id} className="bg-gray-800/40 p-3 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <NationalFlag iso2={w.attackerCountryIso2 || ""} className="w-6 h-4" />
                      <span className="text-[10px] font-black text-red-400">VS</span>
                      <NationalFlag iso2={w.defenderCountryIso2 || ""} className="w-6 h-4" />
                    </div>
                    <span className="text-[9px] font-bold text-gray-500">
                      {w.attackerScore || 0} - {w.defenderScore || 0}
                    </span>
                  </div>
                  <p className="text-[9px] text-gray-500 mt-1">
                    {w.attackerCountryIso2} vs {w.defenderCountryIso2}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">Nessuna guerra in corso.</p>
          )}
        </CollapsibleSection>

        {/* Accordi migratori */}
        <CollapsibleSection title="🤝 Accordi migratori" defaultOpen={false}>
          {(nation.migrationAgreements || []).length > 0 ? (
            <div className="space-y-2">
              {nation.migrationAgreements.map((a: any) => (
                <div key={a.id} className="bg-gray-800/40 p-3 rounded-xl flex items-center gap-3">
                  <NationalFlag iso2={a.toStateId || a.fromStateId || ""} className="w-8 h-6" />
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-gray-300">
                      {a.fromStateId} → {a.toStateId}
                    </p>
                    <p className="text-[9px] text-gray-500">
                      Attivo dal {new Date(a.activatedAt).toLocaleDateString("it-IT")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">Nessun accordo migratorio.</p>
          )}
        </CollapsibleSection>

        {/* Sanzioni */}
        <CollapsibleSection title="🚫 Sanzioni" defaultOpen={false}>
          {(nation.sanctions || []).length > 0 ? (
            <div className="space-y-2">
              {nation.sanctions.map((s: any) => (
                <div key={s.id} className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-red-300">
                      {s.fromStateId} → {s.targetStateId}
                    </p>
                    <p className="text-[9px] text-red-400/70">
                      Sanzioni commerciali attive
                    </p>
                  </div>
                  <NationalFlag iso2={s.targetStateId || ""} className="w-6 h-4" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">Nessuna sanzione attiva.</p>
          )}
        </CollapsibleSection>
      </div>
    </motion.div>
  );
}

/** Calculate best department across all regions */
function getBestDepartment(regions: any[]): { label: string; total: number; key: string } | null {
  if (!regions || regions.length === 0) return null;
  const depts = [
    { key: "health", label: "salute", field: "health" },
    { key: "education", label: "istruzione", field: "education" },
    { key: "military", label: "militare", field: "military" },
    { key: "economy", label: "economia", field: "economyLevel" },
  ];

  let best = { key: "", label: "", total: 0 };
  for (const dept of depts) {
    const total = regions.reduce((sum, r) => sum + (r[dept.field] || 0), 0);
    if (total > best.total) {
      best = { key: dept.key, label: dept.label, total };
    }
  }
  return best.total > 0 ? best : null;
}

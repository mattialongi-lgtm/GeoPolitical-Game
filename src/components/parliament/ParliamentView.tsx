import React, { useState, useEffect } from "react";
import {
  Crown,
  Briefcase,
  Loader2,
  Landmark,
} from "lucide-react";
import { motion } from "motion/react";
import { ElectionsTab } from "./ElectionsTab";
import { ParliamentTab } from "./ParliamentTab";
import { LawsTab } from "./LawsTab";

export const ParliamentView = ({ user }: { user: any }) => {
  const [activeTab, setActiveTab] = useState<'elections' | 'parliament' | 'laws' | 'dictatorship'>('elections');
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);

  // Data
  const [electionData, setElectionData] = useState<any>(null);
  const [parliamentData, setParliamentData] = useState<any[]>([]);
  const [lawsData, setLawsData] = useState<any[]>([]);
  const [registry, setRegistry] = useState<any>(null);
  const [regionData, setRegionData] = useState<any>(null);

  const isDictatorship = regionData?.dictatorship === 1;

  const loadData = async (currentTab?: string) => {
    const tab = currentTab || activeTab;
    setLoading(true);
    try {
      // Always fetch region basic info for parliament configs (like dictatorship)
      let rData: any = regionData;
      if (user?.residenceId) {
        const rRes = await fetch(`/api/regions/${user.residenceId}`);
        if (rRes.ok) {
          rData = await rRes.json();
          setRegionData(rData);
        }
      }

      const dictMode = rData?.dictatorship === 1;

      if (!dictMode) {
        const pRes = await fetch("/api/parliament");
        if (pRes.ok) setParliamentData(await pRes.json());
      }

      if (tab === 'elections' && !dictMode) {
        const res = await fetch("/api/elections");
        if (res.ok) setElectionData(await res.json());
      } else if (tab === 'laws') {
        const res = await fetch("/api/parliament/laws");
        if (res.ok) {
          const lData = await res.json();
          setLawsData(lData.laws || []);
          setRegistry(lData.registry || null);
        }
      }
    } catch { }
    setLoading(false);
  };

  // Initial load: fetch region data and set correct initial tab
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        if (user?.residenceId) {
          const rRes = await fetch(`/api/regions/${user.residenceId}`);
          if (rRes.ok) {
            const rData = await rRes.json();
            setRegionData(rData);
            if (rData?.dictatorship === 1) {
              setActiveTab('dictatorship');
            }
          }
        }
      } catch { }
      setInitialLoad(false);
    };
    init();
  }, []);

  // Load data when tab changes (but not on initial load)
  useEffect(() => {
    if (!initialLoad) {
      loadData(activeTab);
    }
  }, [activeTab, initialLoad]);

  // Dictatorship view: only show dictator + economic minister
  const DictatorshipTab = () => (
    <div className="space-y-6">
      <div className="bg-rose-500 text-white p-6 rounded-3xl shadow-xl border border-rose-400 flex items-center gap-4">
        <Crown className="w-12 h-12 text-rose-200 shrink-0" />
        <div>
          <h3 className="text-xl font-black uppercase tracking-widest">Regime Dittatoriale</h3>
          <p className="font-bold text-rose-100 text-sm mt-1">Il parlamento è sospeso. Il Dittatore ha potere esecutivo e legislativo assoluto.</p>
        </div>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-xl font-black text-slate-900">Cariche dello Stato</h3>
        <div className="grid gap-3">
          <div className="flex items-center justify-between p-4 bg-rose-50 rounded-2xl border border-rose-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                <Crown className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <p className="font-black text-slate-900 text-sm">Dittatore</p>
                <p className="text-[10px] font-bold text-rose-500 uppercase mt-0.5">Potere assoluto</p>
              </div>
            </div>
            <span className="text-sm font-black text-slate-700">{regionData?.leaderName || regionData?.leader?.username || '—'}</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-black text-slate-900 text-sm">Ministro Economico</p>
                <p className="text-[10px] font-bold text-amber-500 uppercase mt-0.5">Gestione economica</p>
              </div>
            </div>
            <span className="text-sm font-black text-slate-700">{regionData?.economicAdviserName || '—'}</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 p-6 rounded-3xl border border-dashed border-slate-200 text-center">
        <p className="text-slate-400 font-bold italic text-sm">Le elezioni parlamentari sono sospese durante il regime dittatoriale.</p>
        <p className="text-[10px] text-slate-300 font-bold mt-1">Il Dittatore può emanare editti dalla sezione Leggi.</p>
      </div>
    </div>
  );

  const availableTabs = isDictatorship
    ? [{ id: 'dictatorship', label: 'Regime' }, { id: 'laws', label: 'Editti' }]
    : [{ id: 'elections', label: 'Elezioni' }, { id: 'parliament', label: 'Parlamento' }, { id: 'laws', label: 'Leggi' }];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="bg-white rounded-[2.5rem] p-2 flex gap-2 shadow-sm border border-slate-100 overflow-x-auto hide-scrollbar">
        {availableTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-[120px] py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === tab.id ? (isDictatorship ? "bg-rose-600 text-white shadow-lg shadow-rose-200" : "bg-indigo-600 text-white shadow-lg shadow-indigo-200") : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
      ) : (
        <>
          {activeTab === 'dictatorship' && <DictatorshipTab />}
          {activeTab === 'elections' && !isDictatorship && <ElectionsTab data={electionData} user={user} reload={() => loadData('elections')} />}
          {activeTab === 'parliament' && !isDictatorship && <ParliamentTab members={parliamentData} />}
          {activeTab === 'laws' && <LawsTab laws={lawsData} registry={registry} region={regionData} user={user} reload={() => loadData('laws')} isMp={isDictatorship || parliamentData.some(m => m.userId === user.id)} />}
        </>
      )}
    </motion.div>
  );
};

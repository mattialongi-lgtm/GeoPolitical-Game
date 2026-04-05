/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { User, Region, Article, War } from "./types";
import type { WorldStats } from "./components/home/mockData";
import { DEFAULT_WORLD_STATS } from "./components/home/mockData";
import { supabase } from "./lib/supabase";
import { clearBackendAuthCookie } from "./api/authClient";
import { useAuthBootstrap } from "./hooks/useAuthBootstrap";
import { useAppBootstrapData } from "./hooks/useAppBootstrapData";
import { useDarkMode } from "./hooks/useDarkMode";
import { useEnergyTimer } from "./hooks/useEnergyTimer";
import { useAppActions } from "./hooks/useAppActions";
import { useNavigate } from "react-router-dom";
import { BottomNav } from './components/ui';
import { AppHeader } from './components/ui/AppHeader';
import Auth from './components/auth/Auth';
import { AppRouter } from './router/AppRouter';

// --- Main App ---

export default function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [nations, setNations] = useState<any[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [wars, setWars] = useState<{ active: War[], ended: War[] }>({ active: [], ended: [] });
  const [worldStats, setWorldStats] = useState<WorldStats>(DEFAULT_WORLD_STATS);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { isDarkMode, setIsDarkMode } = useDarkMode();

  const { fetchData } = useAppBootstrapData({
    setUser,
    setRegions,
    setNations,
    setArticles,
    setWars,
    setWorldStats,
    setLoading,
  });

  useAuthBootstrap({
    onSessionReady: fetchData,
    onSignedOut: () => {
      setUser(null);
      setLoading(false);
    }
  });

  const energyTimer = useEnergyTimer(user);

  const {
    actionLoading,
    autoWorkFactoryId, setAutoWorkFactoryId, autoWorkExpiresAt,
    workExpTransferSource, setWorkExpTransferSource,
    workExpTransferTarget, setWorkExpTransferTarget,
    workExpTransferXp, setWorkExpTransferXp,
    workExpTransferBusy, setWorkExpTransferBusy,
    workExpTransferError, setWorkExpTransferError,
    workExpTransferOk, setWorkExpTransferOk,
    handleUseDrink,
    handleAction,
    handleUpgradePerk,
    handleActivateBooster,
  } = useAppActions(fetchData, user, setUser);

  const navigateToCountry = (iso2: string) => {
    if (!iso2 || iso2 === "-99") return alert("Regione non disponibile");
    navigate(`/countries/${iso2}`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearBackendAuthCookie();
    setUser(null);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
    </div>
  );

  if (!user) return <Auth onLogin={fetchData} />;

  const isDashboardRoute =
    location.pathname.startsWith("/leader") ||
    location.pathname.startsWith("/ministers") ||
    location.pathname.startsWith("/inventory/history");

  return (
    <div className={`min-h-screen bg-gray-950 text-gray-100 font-sans pb-24`}>
      <AppHeader
        user={user}
        energyTimer={energyTimer}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        actionLoading={actionLoading}
        handleUseDrink={handleUseDrink}
        handleLogout={handleLogout}
        isDashboardRoute={isDashboardRoute}
      />

      <main className={`${isDashboardRoute ? 'max-w-none p-0' : 'max-w-2xl mx-auto p-6'}`}>
        <AppRouter
          user={user}
          regions={regions}
          nations={nations}
          articles={articles}
          wars={wars}
          worldStats={worldStats}
          navigateToCountry={navigateToCountry}
          fetchData={fetchData}
          actionLoading={actionLoading}
          handleAction={handleAction}
          handleUpgradePerk={handleUpgradePerk}
          handleActivateBooster={handleActivateBooster}
          autoWorkFactoryId={autoWorkFactoryId}
          setAutoWorkFactoryId={setAutoWorkFactoryId}
          autoWorkExpiresAt={autoWorkExpiresAt}
          workExpTransferSource={workExpTransferSource}
          setWorkExpTransferSource={setWorkExpTransferSource}
          workExpTransferTarget={workExpTransferTarget}
          setWorkExpTransferTarget={setWorkExpTransferTarget}
          workExpTransferXp={workExpTransferXp}
          setWorkExpTransferXp={setWorkExpTransferXp}
          workExpTransferBusy={workExpTransferBusy}
          setWorkExpTransferBusy={setWorkExpTransferBusy}
          workExpTransferError={workExpTransferError}
          setWorkExpTransferError={setWorkExpTransferError}
          workExpTransferOk={workExpTransferOk}
          setWorkExpTransferOk={setWorkExpTransferOk}
          selectedArticleId={selectedArticleId}
          setSelectedArticleId={setSelectedArticleId}
        />
      </main>

      <BottomNav />
    </div>
  );
}


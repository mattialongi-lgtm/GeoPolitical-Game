/**
 * HomePage – The main dashboard hub of the geopolitical strategy game.
 *
 * This is a vertical scrollable mobile-first dashboard composed of modular sections:
 * 1. Quick access toolbar
 * 2. World statistics (swipeable)
 * 3. Player's region statistics (swipeable)
 * 4. Player's state statistics (swipeable)
 * 5. Parliament / Laws preview
 * 6. Chat
 * 7. Party / Resources / Soldier of the hour
 * 8. Event history
 *
 * All data is passed as props from the parent App component.
 * Default zero/empty values are shown when no real data is available.
 */
import React from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Region, War, User } from "../../types";

import QuickAccessMenu from "./QuickAccessMenu";
import WorldStatsCarousel from "./WorldStatsCarousel";
import RegionStatsCarousel from "./RegionStatsCarousel";
import StateStatsCarousel from "./StateStatsCarousel";
import ParliamentCard from "./ParliamentCard";
import ChatPanel from "./ChatPanel";
import PartySummaryCard from "./PartySummaryCard";
import EventHistoryCard from "./EventHistoryCard";

import {
  DEFAULT_WORLD_STATS,
  DEFAULT_REGION_STATS,
  DEFAULT_STATE_STATS,
  EMPTY_PENDING_LAWS,
  EMPTY_ACTIVE_WARS,
  EMPTY_PARTY,
  EMPTY_SOLDIER_OF_HOUR,
} from "./mockData";
import type { WorldStats, GameEvent } from "./mockData";

interface HomePageProps {
  user: User & { perks?: Record<string, number>; maxEnergy?: number; [key: string]: any };
  regions: Region[];
  wars: { active: War[]; ended: War[] };
  worldStats?: WorldStats;
  navigateToCountry: (id: string) => void;
}

/** Divider between dashboard sections */
const SectionDivider = () => (
  <div className="h-px bg-gradient-to-r from-transparent via-gray-700/50 to-transparent" />
);

export default function HomePage({ user, regions, wars, worldStats, navigateToCountry }: HomePageProps) {
  const navigate = useNavigate();

  const [dashboardStats, setDashboardStats] = React.useState<any>(null);

  React.useEffect(() => {
    fetch("/api/dashboard-stats")
      .then(r => r.json())
      .then(d => { if (!d.error) setDashboardStats(d); })
      .catch(e => console.error("Error fetching dashboard stats:", e));
  }, []);

  // Build region stats from real data if available
  const playerRegion = regions.find(r => r.id === user.regionId);
  const regionStats = playerRegion
    ? {
        id: playerRegion.id,
        name: playerRegion.name || playerRegion.id,
        population: playerRegion.population || 0,
        parties: dashboardStats?.region?.parties || 0,
        factories: dashboardStats?.region?.factories || playerRegion.factoriesCount || 0,
        pollution: playerRegion.pollution || 0,
        militaryAcademies: 0, // TODO: fetch from API if needed
        onlinePlayers: dashboardStats?.region?.online || 0,
        health: playerRegion.healthIndex || 5,
        stability: playerRegion.stability || 5,
      }
    : { ...DEFAULT_REGION_STATS, id: user.regionId || '', name: user.regionId || 'N/A' };

  // Build state stats from real data if available
  const stateStats = {
    ...DEFAULT_STATE_STATS,
    iso2: user.originalNation || user.regionId || '',
    name: user.originalNation || 'N/A',
    regions: dashboardStats?.state?.regions || 0,
    parties: dashboardStats?.state?.parties || 0,
    factories: dashboardStats?.state?.factories || 0,
    onlinePlayers: dashboardStats?.state?.online || 0,
  };


  // Build war data from real wars if available
  const activeWarsMapped = wars.active.length > 0
    ? wars.active.map(w => ({
        id: w.id,
        attackerName: w.attackerCountryIso2 || 'Attaccante',
        attackerIso2: w.attackerCountryIso2 || '',
        defenderName: w.defenderCountryIso2 || 'Difensore',
        defenderIso2: w.defenderCountryIso2 || '',
        attackerDisplayName: w.attackerDisplayName || w.attackerCountryIso2 || 'Attaccante',
        attackerDisplayIcon: w.attackerDisplayIcon || null,
        attackerDisplayIconType: w.attackerDisplayIconType,
        defenderDisplayName: w.defenderDisplayName || w.defenderCountryIso2 || 'Difensore',
        defenderDisplayIcon: w.defenderDisplayIcon || null,
        defenderDisplayIconType: w.defenderDisplayIconType,
        attackerDamage: w.attackerScore || 0,
        defenderDamage: w.defenderScore || 0,
        endsAt: typeof w.endsAt === 'number' ? w.endsAt : new Date(w.endsAt).getTime(),
        regionName: w.attackerCountryIso2 || 'Regione',
      }))
    : EMPTY_ACTIVE_WARS;

  // Build resources from user data
  const playerResources = {
    gold: user.gold || 0,
    oil: user.oil || 0,
    minerals: user.minerals || 0,
    uranium: user.uranium || 0,
    diamonds: user.diamonds || 0,
    energyDrinks: user.energyDrinks || 0,
    liquidOxygen: user.liquidOxygen || 0,
    helium3: user.helium3 || 0,
  };

  // World stats from API (real data)
  const resolvedWorldStats = worldStats || DEFAULT_WORLD_STATS;

  // Build game events from wars data
  const gameEvents: GameEvent[] = React.useMemo(() => {
    const events: GameEvent[] = [];
    wars.active.forEach(w => {
      events.push({
        id: `war-active-${w.id}`,
        type: 'war_started',
        title: `Guerra: ${w.attackerCountryIso2} vs ${w.defenderCountryIso2}`,
        description: `Attacco in corso – Danno: ${(w.attackerScore || 0).toLocaleString()} vs ${(w.defenderScore || 0).toLocaleString()}`,
        icon: '⚔️',
        targetId: w.id,
        timestamp: typeof w.startedAt === 'number' ? w.startedAt : new Date(w.startedAt).getTime(),
      });
    });
    wars.ended.forEach(w => {
      const winner = (w.attackerScore || 0) > (w.defenderScore || 0) ? w.attackerCountryIso2 : w.defenderCountryIso2;
      const endTs = typeof w.endsAt === 'number' ? w.endsAt : new Date(w.endsAt).getTime();
      events.push({
        id: `war-ended-${w.id}`,
        type: 'war_ended',
        title: `Guerra terminata: ${w.attackerCountryIso2} vs ${w.defenderCountryIso2}`,
        description: `Vincitore: ${winner}`,
        icon: '🏁',
        targetId: w.id,
        timestamp: endTs > Date.now() ? Date.now() : endTs,
      });
    });
    events.sort((a, b) => b.timestamp - a.timestamp);
    return events;
  }, [wars]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-5"
    >
      {/* Quick Access Toolbar */}
      <QuickAccessMenu />

      <SectionDivider />

      {/* World Statistics */}
      <WorldStatsCarousel stats={resolvedWorldStats} />

      <SectionDivider />

      {/* Region Statistics */}
      <RegionStatsCarousel
        stats={regionStats}
        userRegionId={user.regionId}
        navigateToCountry={navigateToCountry}
      />

      <SectionDivider />

      {/* State Statistics */}
      <StateStatsCarousel
        stats={stateStats}
        navigateToCountry={navigateToCountry}
      />

      <SectionDivider />

      {/* Parliament / Laws */}
      <ParliamentCard
        laws={EMPTY_PENDING_LAWS}
        governmentForm={playerRegion?.governmentForm}
      />

      <SectionDivider />

      {/* Chat */}
      <ChatPanel currentUser={{ id: user.id, username: user.username, regionId: user.regionId }} />

      <SectionDivider />

      {/* Party / Resources / Soldier */}
      <PartySummaryCard
        party={EMPTY_PARTY}
        resources={playerResources}
        soldier={EMPTY_SOLDIER_OF_HOUR}
      />

      <SectionDivider />

      {/* Event History */}
      <EventHistoryCard events={gameEvents} />
    </motion.div>
  );
}

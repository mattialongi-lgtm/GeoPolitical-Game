/**
 * HomePage – The main dashboard hub of the geopolitical strategy game.
 *
 * This is a vertical scrollable mobile-first dashboard composed of modular sections:
 * 1. Quick access toolbar
 * 2. World statistics (swipeable)
 * 3. Player's region statistics (swipeable)
 * 4. Player's state statistics (swipeable)
 * 5. Parliament / Laws preview
 * 6. War quick panel
 * 7. Chat
 * 8. Party / Resources / Soldier of the hour / Hot war
 * 9. Event history
 *
 * All data is passed as props from the parent App component.
 * Mock data is used as fallback where the backend is not ready.
 */
import React from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Region, War } from "../../types";

import QuickAccessMenu from "./QuickAccessMenu";
import WorldStatsCarousel from "./WorldStatsCarousel";
import RegionStatsCarousel from "./RegionStatsCarousel";
import StateStatsCarousel from "./StateStatsCarousel";
import ParliamentCard from "./ParliamentCard";
import WarQuickPanel from "./WarQuickPanel";
import ChatPanel from "./ChatPanel";
import PartySummaryCard from "./PartySummaryCard";
import EventHistoryCard from "./EventHistoryCard";

import {
  MOCK_WORLD_STATS,
  MOCK_REGION_STATS,
  MOCK_STATE_STATS,
  MOCK_PENDING_LAWS,
  MOCK_ACTIVE_WARS,
  MOCK_PARTY,
  MOCK_RESOURCES,
  MOCK_SOLDIER_OF_HOUR,
  MOCK_EVENTS,
} from "./mockData";

interface HomePageProps {
  user: any;
  regions: Region[];
  wars: { active: War[]; ended: War[] };
  navigateToCountry: (id: string) => void;
}

/** Divider between dashboard sections */
const SectionDivider = () => (
  <div className="h-px bg-gradient-to-r from-transparent via-gray-700/50 to-transparent" />
);

export default function HomePage({ user, regions, wars, navigateToCountry }: HomePageProps) {
  const navigate = useNavigate();

  // Build region stats from real data if available
  const playerRegion = regions.find(r => r.id === user.regionId);
  const regionStats = playerRegion
    ? {
        id: playerRegion.id,
        name: playerRegion.name || playerRegion.id,
        population: playerRegion.population || 0,
        parties: 0, // TODO: fetch from API
        factories: playerRegion.factoriesCount || 0,
        pollution: playerRegion.pollution || 0,
        militaryAcademies: 0, // TODO: fetch from API
        onlinePlayers: 0, // TODO: fetch from API
        health: playerRegion.health || 5,
        stability: playerRegion.stability || 5,
      }
    : MOCK_REGION_STATS;

  // Build state stats from real data if available
  const stateStats = {
    ...MOCK_STATE_STATS,
    iso2: user.originalNation || user.regionId,
    name: user.originalNation || 'N/A',
  };

  // Build war data from real wars if available
  const activeWarsMapped = wars.active.length > 0
    ? wars.active.map(w => ({
        id: w.id,
        attackerName: w.attackerCountryIso2 || 'Attaccante',
        attackerIso2: w.attackerCountryIso2 || '',
        defenderName: w.defenderCountryIso2 || 'Difensore',
        defenderIso2: w.defenderCountryIso2 || '',
        attackerDamage: w.attackerScore || 0,
        defenderDamage: w.defenderScore || 0,
        endsAt: typeof w.endsAt === 'number' ? w.endsAt : new Date(w.endsAt).getTime(),
        regionName: w.attackerCountryIso2 || 'Regione',
      }))
    : MOCK_ACTIVE_WARS;

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

  // World stats from regions if available
  const worldStats = {
    ...MOCK_WORLD_STATS,
    totalRegions: regions.length > 0 ? regions.length : MOCK_WORLD_STATS.totalRegions,
  };

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
      <WorldStatsCarousel stats={worldStats} />

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
        laws={MOCK_PENDING_LAWS}
        governmentForm={playerRegion?.governmentForm}
      />

      <SectionDivider />

      {/* War Quick Panel */}
      <WarQuickPanel wars={activeWarsMapped} />

      <SectionDivider />

      {/* Chat */}
      <ChatPanel currentUser={{ id: user.id, username: user.username, regionId: user.regionId }} />

      <SectionDivider />

      {/* Party / Resources / Soldier / Hot War */}
      <PartySummaryCard
        party={MOCK_PARTY}
        resources={playerResources}
        soldier={MOCK_SOLDIER_OF_HOUR}
        hotWar={activeWarsMapped[0] || null}
      />

      <SectionDivider />

      {/* Event History */}
      <EventHistoryCard events={MOCK_EVENTS} />
    </motion.div>
  );
}

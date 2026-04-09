import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { HomePage } from "../components/home";
import { DailyTasksPage } from "../components/daily";
import WorldMap from "../components/WorldMap";
import { MarketView } from "../components/market/MarketView";
import StorageView from "../components/storage/StorageView";
import ResourceHistoryView from "../components/ResourceHistoryView";
import TotalDamageView from "../components/TotalDamageView";
import { ProduceView } from "../components/produce/ProduceView";
import NationsList from "../components/NationsList";
import { StatePage } from "../components/state";
import PlayersList from "../components/PlayersList";
import PartiesList from "../components/PartiesList";
import WorldFactoriesList from "../components/WorldFactoriesList";
import IndependentRegionsList from "../components/IndependentRegionsList";
import { ArticlesView } from "../components/articles/ArticlesView";
import { ArticleDetailView } from "../components/articles/ArticleDetailView";
import { NewspaperDetailView } from "../components/articles/NewspaperDetailView";
import { NewArticleView } from "../components/articles/NewArticleView";
import { WorkView } from "../components/work/WorkView";
import { WarsView } from "../components/wars/WarsView";
import { WarStatsView } from "../components/wars/WarStatsView";
import { PartyHub } from "../components/party";
import { ProfileView } from "../components/profile/ProfileView";
import { PublicProfileView } from "../components/profile/PublicProfileView";
import ShopPage from "../components/ShopPage";
import FactoryDetail from "../components/FactoryDetail";
import FactoryMarket from "../components/FactoryMarket";
import ExtractionDashboard from "../components/ExtractionDashboard";
import { CountryDetailView } from "../components/country/CountryDetailView";
import { LeaderView } from "../components/LeaderView";
import { MinistersView } from "../components/MinistersView";
import { NationView } from "../components/nation/NationView";
import { ParliamentView } from "../components/parliament";
import { BlocsList } from "../components/BlocsList";
import { BlocCreate } from "../components/BlocCreate";
import { BlocDetail } from "../components/BlocDetail";
import { BudgetView } from "../components/budget/BudgetView";

export function AppRouter(props: any) {
  const {
    user, regions, nations, articles, wars, worldStats,
    navigateToCountry, fetchData,
    actionLoading, handleAction, handleUpgradePerk, handleActivateBooster,
    autoWorkFactoryId, autoWorkFactoryName, autoWorkResourceType, autoWorkRegionId, setAutoWorkFactoryId, setAutoWorkResource, autoWorkExpiresAt,
    workExpTransferSource, setWorkExpTransferSource,
    workExpTransferTarget, setWorkExpTransferTarget,
    workExpTransferXp, setWorkExpTransferXp,
    workExpTransferBusy, setWorkExpTransferBusy,
    workExpTransferError, setWorkExpTransferError,
    workExpTransferOk, setWorkExpTransferOk,
    selectedArticleId, setSelectedArticleId,
  } = props;

  return (
    <Routes>
      <Route path="/" element={<HomePage user={user} regions={regions} wars={wars} worldStats={worldStats} navigateToCountry={navigateToCountry} handleAction={handleAction} />} />
      <Route path="/daily" element={<DailyTasksPage user={user} regions={regions} />} />
      <Route path="/map" element={<WorldMap onRegionClick={navigateToCountry} regions={regions} />} />
      <Route path="/market" element={<MarketView user={user} fetchData={fetchData} />} />
      <Route path="/storage" element={<StorageView user={user} />} />
      <Route path="/inventory/history/:itemId" element={<ResourceHistoryView fetchData={fetchData} />} />
      <Route path="/profile/total-damage" element={user ? <TotalDamageView /> : <Navigate to="/" />} />
      <Route path="/produce" element={<ProduceView user={user} />} />
      <Route path="/states" element={<NationsList />} />
      <Route path="/state/:id" element={<StatePage user={user} />} />
      <Route path="/players" element={<PlayersList />} />
      <Route path="/parties" element={<PartiesList />} />
      <Route path="/world-factories" element={<WorldFactoriesList />} />
      <Route path="/independent-regions" element={<IndependentRegionsList />} />
      <Route path="/articles" element={<ArticlesView articles={articles} setSelectedArticleId={setSelectedArticleId} actionLoading={actionLoading} fetchData={fetchData} />} />
      <Route path="/articles/:id" element={<ArticleDetailView articles={articles} user={user} fetchData={fetchData} />} />
      <Route path="/articles/new" element={<NewArticleView actionLoading={actionLoading} fetchData={fetchData} />} />
      <Route path="/articles/edit/:editId" element={<NewArticleView actionLoading={actionLoading} fetchData={fetchData} />} />
      <Route path="/newspapers/:id" element={<NewspaperDetailView user={user} />} />
      <Route path="/work" element={
        user ? (
          <WorkView
            user={user}
            fetchData={fetchData}
            autoWorkFactoryId={autoWorkFactoryId}
            autoWorkFactoryName={autoWorkFactoryName}
            setAutoWorkFactoryId={setAutoWorkFactoryId}
            autoWorkResourceType={autoWorkResourceType}
            autoWorkRegionId={autoWorkRegionId}
            setAutoWorkResource={setAutoWorkResource}
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
          />
        ) : <Navigate to="/" />
      } />
      <Route path="/wars" element={<WarsView wars={wars} user={user} nations={nations} fetchData={fetchData} actionLoading={actionLoading} autoWorkFactoryId={autoWorkFactoryId} setAutoWorkFactoryId={setAutoWorkFactoryId} />} />
      <Route path="/wars/:warId" element={<WarsView wars={wars} user={user} nations={nations} fetchData={fetchData} actionLoading={actionLoading} autoWorkFactoryId={autoWorkFactoryId} setAutoWorkFactoryId={setAutoWorkFactoryId} />} />
      <Route path="/war/:warId/summary" element={<WarStatsView user={user} nations={nations} />} />
      <Route path="/party" element={<PartyHub user={user} fetchData={fetchData} />} />
      <Route path="/profile" element={<ProfileView user={user} regions={regions} nations={nations} handleUpgradePerk={handleUpgradePerk} handleActivateBooster={handleActivateBooster} actionLoading={actionLoading} fetchData={fetchData} />} />
      <Route path="/profile/:userId" element={<PublicProfileView regions={regions} nations={nations} />} />
      <Route path="/shop" element={user ? <ShopPage user={user} /> : <Navigate to="/" />} />
      <Route path="/factory/:id" element={user ? <FactoryDetail user={user} fetchData={fetchData} /> : <Navigate to="/" />} />
      <Route path="/factory-market" element={user ? <FactoryMarket user={user} fetchData={fetchData} /> : <Navigate to="/" />} />
      <Route path="/extraction/:id" element={user ? <ExtractionDashboard user={user} /> : <Navigate to="/" />} />
      <Route path="/countries/:iso2" element={<CountryDetailView user={user} handleAction={handleAction} actionLoading={actionLoading} fetchData={fetchData} />} />
      <Route path="/regions/:iso2" element={<CountryDetailView user={user} handleAction={handleAction} actionLoading={actionLoading} fetchData={fetchData} />} />
      <Route path="/leader" element={<LeaderView user={user} regionId={user?.residenceId || user?.regionId} fetchData={fetchData} />} />
      <Route path="/leader/:iso2" element={<LeaderView user={user} fetchData={fetchData} />} />
      <Route path="/ministers" element={<MinistersView user={user} fetchData={fetchData} />} />
      <Route path="/ministers/:iso2" element={<MinistersView user={user} fetchData={fetchData} />} />
      <Route path="/nation" element={<NationView user={user} fetchData={fetchData} />} />
      <Route path="/parliament" element={<ParliamentView user={user} />} />
      <Route path="/blocs" element={<BlocsList />} />
      <Route path="/blocs/create" element={<BlocCreate currentUser={user} regions={regions} />} />
      <Route path="/blocs/:id" element={<BlocDetail currentUser={user} regions={regions} />} />
    </Routes>
  );
}

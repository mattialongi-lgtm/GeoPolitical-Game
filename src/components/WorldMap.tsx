/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { ChevronRight, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import type { Region } from "../types";
import worldTopoJson from "../assets/maps/world_adm1.topo.json";

const MAP_COUNTRIES = [
  { iso2: "AF", name: "Afghanistan", flag: "🇦🇫" }, { iso2: "DZ", name: "Algeria", flag: "🇩🇿" },
  { iso2: "AR", name: "Argentina", flag: "🇦🇷" }, { iso2: "AU", name: "Australia", flag: "🇦🇺" },
  { iso2: "AT", name: "Austria", flag: "🇦🇹" }, { iso2: "BE", name: "Belgium", flag: "🇧🇪" },
  { iso2: "BR", name: "Brazil", flag: "🇧🇷" }, { iso2: "CA", name: "Canada", flag: "🇨🇦" },
  { iso2: "CL", name: "Chile", flag: "🇨🇱" }, { iso2: "CN", name: "China", flag: "🇨🇳" },
  { iso2: "CO", name: "Colombia", flag: "🇨🇴" }, { iso2: "CZ", name: "Czech Republic", flag: "🇨🇿" },
  { iso2: "DK", name: "Denmark", flag: "🇩🇰" }, { iso2: "EG", name: "Egypt", flag: "🇪🇬" },
  { iso2: "ET", name: "Ethiopia", flag: "🇪🇹" }, { iso2: "FI", name: "Finland", flag: "🇫🇮" },
  { iso2: "FR", name: "France", flag: "🇫🇷" }, { iso2: "DE", name: "Germany", flag: "🇩🇪" },
  { iso2: "GH", name: "Ghana", flag: "🇬🇭" }, { iso2: "GR", name: "Greece", flag: "🇬🇷" },
  { iso2: "HU", name: "Hungary", flag: "🇭🇺" }, { iso2: "IN", name: "India", flag: "🇮🇳" },
  { iso2: "ID", name: "Indonesia", flag: "🇮🇩" }, { iso2: "IR", name: "Iran", flag: "🇮🇷" },
  { iso2: "IQ", name: "Iraq", flag: "🇮🇶" }, { iso2: "IE", name: "Ireland", flag: "🇮🇪" },
  { iso2: "IL", name: "Israel", flag: "🇮🇱" }, { iso2: "IT", name: "Italy", flag: "🇮🇹" },
  { iso2: "JP", name: "Japan", flag: "🇯🇵" }, { iso2: "KE", name: "Kenya", flag: "🇰🇪" },
  { iso2: "KR", name: "South Korea", flag: "🇰🇷" }, { iso2: "MA", name: "Morocco", flag: "🇲🇦" },
  { iso2: "MX", name: "Mexico", flag: "🇲🇽" }, { iso2: "MY", name: "Malaysia", flag: "🇲🇾" },
  { iso2: "NL", name: "Netherlands", flag: "🇳🇱" }, { iso2: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { iso2: "NG", name: "Nigeria", flag: "🇳🇬" }, { iso2: "NO", name: "Norway", flag: "🇳🇴" },
  { iso2: "PK", name: "Pakistan", flag: "🇵🇰" }, { iso2: "PE", name: "Peru", flag: "🇵🇪" },
  { iso2: "PH", name: "Philippines", flag: "🇵🇭" }, { iso2: "PL", name: "Poland", flag: "🇵🇱" },
  { iso2: "PT", name: "Portugal", flag: "🇵🇹" }, { iso2: "RO", name: "Romania", flag: "🇷🇴" },
  { iso2: "RU", name: "Russia", flag: "🇷🇺" }, { iso2: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
  { iso2: "SG", name: "Singapore", flag: "🇸🇬" }, { iso2: "ZA", name: "South Africa", flag: "🇿🇦" },
  { iso2: "ES", name: "Spain", flag: "🇪🇸" }, { iso2: "SE", name: "Sweden", flag: "🇸🇪" },
  { iso2: "CH", name: "Switzerland", flag: "🇨🇭" }, { iso2: "TZ", name: "Tanzania", flag: "🇹🇿" },
  { iso2: "TH", name: "Thailand", flag: "🇹🇭" }, { iso2: "TR", name: "Turkey", flag: "🇹🇷" },
  { iso2: "UA", name: "Ukraine", flag: "🇺🇦" }, { iso2: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { iso2: "US", name: "United States", flag: "🇺🇸" }, { iso2: "VN", name: "Vietnam", flag: "🇻🇳" },
];

const OWNER_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#d946ef", "#f43f5e",
];

const GOV_COLORS: Record<string, string> = {
  PARLIAMENTARY_REPUBLIC: "#3b82f6",
  PRESIDENTIAL_REPUBLIC: "#06b6d4",
  DOMINANT_PARTY: "#8b5cf6",
  DICTATORSHIP: "#ef4444",
  ONE_PARTY_SYSTEM: "#f97316",
  EXECUTIVE_MONARCHY: "#f59e0b",
};

const DEFAULT_FILL = "#334155";

function hashColor(id: string): string {
  const hash = Array.from(id).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return OWNER_COLORS[hash % OWNER_COLORS.length];
}

interface TooltipInfo {
  name: string;
  iso2: string;
  ownerName?: string | null;
  x: number;
  y: number;
}

interface WorldMapProps {
  onRegionClick: (id: string) => void;
  regions: Region[];
}

const MemoGeography = React.memo(
  ({
    geo,
    fillColor,
    onClick,
    onMouseEnter,
    onMouseLeave,
  }: {
    geo: any;
    fillColor: string;
    onClick: () => void;
    onMouseEnter: (e: React.MouseEvent) => void;
    onMouseLeave: () => void;
  }) => (
    <Geography
      geography={geo}
      style={{
        default: { fill: fillColor, outline: "none", stroke: "#1e293b", strokeWidth: 0.3 },
        hover: { fill: fillColor, outline: "none", stroke: "#e2e8f0", strokeWidth: 0.8, cursor: "pointer" },
        pressed: { fill: fillColor, outline: "none", stroke: "#e2e8f0", strokeWidth: 0.8 },
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  )
);
MemoGeography.displayName = "MemoGeography";

const WorldMap: React.FC<WorldMapProps> = ({ onRegionClick, regions }) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [mapMode, setMapMode] = useState<"political" | "blocs" | "government">("political");
  const [blocMap, setBlocMap] = useState<Record<string, { blocId: string; blocName: string; logo?: string }>>({});
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([0, 20]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mapMode === "blocs") {
      fetch("/api/blocs-map")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            const map: Record<string, { blocId: string; blocName: string; logo?: string }> = {};
            data.forEach((m: any) => {
              map[m.stateId] = m;
            });
            setBlocMap(map);
          }
        })
        .catch(console.error);
    }
  }, [mapMode]);

  // Pre-compute color map: iso2 -> fill color
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    const regionByIso = new Map<string, Region>();
    regions.forEach((r) => regionByIso.set(r.id, r));

    regionByIso.forEach((region, iso2) => {
      if (mapMode === "political") {
        if (region.ownerUserId) {
          map.set(iso2, region.stateColor || hashColor(String(region.ownerUserId)));
        } else {
          map.set(iso2, DEFAULT_FILL);
        }
      } else if (mapMode === "blocs") {
        const blocData = blocMap[iso2];
        if (blocData) {
          map.set(iso2, hashColor(blocData.blocId));
        } else {
          map.set(iso2, DEFAULT_FILL);
        }
      } else if (mapMode === "government") {
        const form = region.governmentForm || "PARLIAMENTARY_REPUBLIC";
        map.set(iso2, GOV_COLORS[form] || DEFAULT_FILL);
      }
    });

    return map;
  }, [regions, mapMode, blocMap]);

  // Region lookup by iso2
  const regionByIso = useMemo(() => {
    const map = new Map<string, Region>();
    regions.forEach((r) => map.set(r.id, r));
    return map;
  }, [regions]);

  const filtered = useMemo(
    () =>
      search.length >= 1
        ? MAP_COUNTRIES.filter(
            (c) =>
              c.name.toLowerCase().includes(search.toLowerCase()) ||
              c.iso2.toLowerCase().startsWith(search.toLowerCase())
          ).slice(0, 6)
        : [],
    [search]
  );

  const pick = useCallback(
    (iso2: string) => {
      setSearch("");
      setOpen(false);
      onRegionClick(iso2);
    },
    [onRegionClick]
  );

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z * 1.5, 8)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z / 1.5, 1)), []);
  const handleReset = useCallback(() => {
    setZoom(1);
    setCenter([0, 20]);
  }, []);

  const handleMoveEnd = useCallback((position: { coordinates: [number, number]; zoom: number }) => {
    setCenter(position.coordinates);
    setZoom(position.zoom);
  }, []);

  const handleMouseEnter = useCallback(
    (geo: any, e: React.MouseEvent) => {
      const iso2 = (geo.properties.ISO_A2 || "").trim().toUpperCase();
      const name = geo.properties.name || "";
      const region = regionByIso.get(iso2);
      setTooltip({
        name,
        iso2,
        ownerName: region?.ownerName || null,
        x: e.clientX,
        y: e.clientY,
      });
    },
    [regionByIso]
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  return (
    <div className="bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-xl border border-slate-800 relative">
      {/* Mode Selector */}
      <div className="absolute top-4 left-4 z-40">
        <select
          value={mapMode}
          onChange={(e) => setMapMode(e.target.value as typeof mapMode)}
          className="bg-slate-800 text-white text-[10px] font-black uppercase px-3 py-2 rounded-xl border border-slate-700 outline-none shadow-lg cursor-pointer"
        >
          <option value="political">Mappa Politica</option>
          <option value="blocs">Mappa Blocchi</option>
          <option value="government">Mappa Governi</option>
        </select>
      </div>

      {/* Legend */}
      <div className="absolute top-16 left-4 z-40 bg-slate-800/90 backdrop-blur-md p-3 rounded-2xl border border-slate-700 shadow-xl max-w-[180px] max-h-[60vh] overflow-y-auto">
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Legenda</p>
        <div className="space-y-1.5">
          {mapMode === "political" && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span className="text-[9px] font-bold text-slate-200">Occupato</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                <span className="text-[9px] font-bold text-slate-200">Neutrale</span>
              </div>
            </>
          )}
          {mapMode === "blocs" && (
            <>
              {(() => {
                const uniqueBlocs = new Map<string, { blocId: string; blocName: string; logo?: string }>();
                Object.values(blocMap).forEach((b) => {
                  if (!uniqueBlocs.has(b.blocId)) uniqueBlocs.set(b.blocId, b);
                });
                const blocEntries = Array.from(uniqueBlocs.values());
                if (blocEntries.length === 0) {
                  return (
                    <div className="text-[8px] text-slate-400 font-bold italic">Nessun blocco attivo</div>
                  );
                }
                return blocEntries.map((bloc) => (
                  <div key={bloc.blocId} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: hashColor(bloc.blocId) }} />
                    <span className="text-[8px] font-bold text-slate-200 truncate">{bloc.logo || ''} {bloc.blocName || 'Blocco'}</span>
                  </div>
                ));
              })()}
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700 flex-shrink-0" />
                <span className="text-[8px] font-bold text-slate-200">Nessun Blocco</span>
              </div>
            </>
          )}
          {mapMode === "government" && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#3b82f6]" />
                <span className="text-[8px] font-bold text-slate-200">Rep. Parlamentare</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#06b6d4]" />
                <span className="text-[8px] font-bold text-slate-200">Rep. Presidenziale</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#8b5cf6]" />
                <span className="text-[8px] font-bold text-slate-200">Partito Dominante</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#ef4444]" />
                <span className="text-[8px] font-bold text-slate-200">Dittatura</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#f97316]" />
                <span className="text-[8px] font-bold text-slate-200">Partito Unico</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b]" />
                <span className="text-[8px] font-bold text-slate-200">Monarchia Esec.</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-40 flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="bg-slate-800/90 backdrop-blur-md p-2 rounded-xl border border-slate-700 text-white hover:bg-slate-700 transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="bg-slate-800/90 backdrop-blur-md p-2 rounded-xl border border-slate-700 text-white hover:bg-slate-700 transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleReset}
          className="bg-slate-800/90 backdrop-blur-md p-2 rounded-xl border border-slate-700 text-white hover:bg-slate-700 transition-colors"
          title="Reset zoom"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-slate-800 text-white text-xs px-3 py-2 rounded-xl shadow-xl border border-slate-600"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <p className="font-black">{tooltip.name}</p>
          {tooltip.iso2 && (
            <p className="text-[10px] text-slate-400 uppercase">{tooltip.iso2}</p>
          )}
          {tooltip.ownerName && (
            <p className="text-[10px] text-indigo-400">👑 {tooltip.ownerName}</p>
          )}
        </div>
      )}

      {/* Map */}
      <ComposableMap
        projectionConfig={{ scale: 140 }}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <ZoomableGroup
          zoom={zoom}
          center={center}
          minZoom={1}
          maxZoom={8}
          onMoveEnd={handleMoveEnd}
        >
          <Geographies geography={worldTopoJson}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const iso2 = (geo.properties.ISO_A2 || "").trim().toUpperCase();
                const fillColor = colorMap.get(iso2) || DEFAULT_FILL;

                return (
                  <MemoGeography
                    key={geo.rsmKey}
                    geo={geo}
                    fillColor={fillColor}
                    onClick={() => {
                      if (iso2) onRegionClick(iso2);
                    }}
                    onMouseEnter={(e) => handleMouseEnter(geo, e)}
                    onMouseLeave={handleMouseLeave}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Search overlay */}
      <div className="p-4 pt-0 relative">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="🔍  Cerca e clicca un paese..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="w-full bg-slate-800 text-white placeholder:text-slate-500 border border-slate-700 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
          {open && filtered.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50">
              {filtered.map((c) => {
                const regionData = regionByIso.get(c.iso2);
                const isOwned = regionData?.ownerUserId;
                const blocData = blocMap[c.iso2];
                let subText = isOwned ? " • 🟣 Occupato" : " • Neutrale";
                if (mapMode === "blocs" && blocData)
                  subText = ` • 🛡️ ${blocData.blocName}`;
                return (
                  <button
                    key={c.iso2}
                    onMouseDown={() => pick(c.iso2)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
                  >
                    <span className="text-xl shrink-0">{c.flag}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-white truncate">{c.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        {c.iso2}
                        {subText}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-2 opacity-60">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-indigo-500 rounded-full" />
            <span className="text-[8px] font-bold text-slate-500 uppercase">Abitato</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-slate-700 rounded-full" />
            <span className="text-[8px] font-bold text-slate-500 uppercase">Disabitato</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(WorldMap);

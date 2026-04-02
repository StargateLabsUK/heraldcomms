import { useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CommandReport } from '@/hooks/useHeraldCommand';
import { PRIORITY_COLORS, SERVICE_LABELS } from '@/lib/herald-types';

interface Props {
  reports: CommandReport[];
  onSelectReport: (id: string) => void;
}

export interface MapTabHandle {
  flyToReport: (report: CommandReport) => void;
}

function getReportPriority(r: CommandReport) {
  return String(r.assessment?.priority ?? r.priority ?? 'P3');
}

export const MapTab = forwardRef<MapTabHandle, Props>(({ reports, onSelectReport }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const fittedRef = useRef(false);

  const geoReports = useMemo(
    () => reports.filter((r) => r.lat != null && r.lng != null),
    [reports]
  );

  useImperativeHandle(ref, () => ({
    flyToReport: (report: CommandReport) => {
      try {
        const map = mapRef.current;
        if (!map || report.lat == null || report.lng == null) return;
        map.flyTo([report.lat, report.lng], 14, { duration: 1.2 });
        const marker = markersRef.current.get(report.id);
        if (marker) marker.openPopup();
      } catch {
        // silent
      }
    },
  }));

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView([53.5, -1.5], 6);

    // Dark themed tiles from CartoDB
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapRef.current = map;

    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      fittedRef.current = false;
    };
  }, []);

  // Update markers when reports change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    geoReports.forEach((r) => {
      const p = getReportPriority(r);
      const color = PRIORITY_COLORS[p] ?? '#34C759';
      const radius = p === 'P1' ? 12 : p === 'P2' ? 10 : 8;
      const label = SERVICE_LABELS[String(r.assessment?.service ?? r.service ?? 'unknown')] ?? 'UNK';
      const headline = String(r.assessment?.headline ?? r.headline ?? 'No headline');
      const ts = new Date(r.created_at ?? r.timestamp);
      const timeStr = ts.getUTCHours().toString().padStart(2, '0') + ':' + ts.getUTCMinutes().toString().padStart(2, '0') + 'Z';

      const marker = L.circleMarker([r.lat!, r.lng!], {
        radius,
        color,
        fillColor: color,
        fillOpacity: 0.85,
        weight: 2,
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: monospace; min-width: 180px;">
          <div style="font-weight: 700; margin-bottom: 4px;">${p} · ${label}</div>
          <div style="margin-bottom: 4px;">${headline}</div>
          <div style="opacity: 0.7; font-size: 11px;">${timeStr}</div>
        </div>
      `);

      marker.on('click', () => onSelectReport(r.id));
      markersRef.current.set(r.id, marker);
    });

    if (!fittedRef.current && geoReports.length > 0) {
      fittedRef.current = true;
      const bounds = L.latLngBounds(geoReports.map((r) => [r.lat!, r.lng!] as [number, number]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    }
  }, [geoReports, onSelectReport]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0 z-0" />
      {geoReports.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="rounded-lg px-4 py-3 border border-muted bg-card/80">
            <p className="text-lg text-foreground opacity-60 tracking-wider font-semibold">
              AWAITING GEO DATA
            </p>
          </div>
        </div>
      )}
      <div className="absolute bottom-4 left-4 rounded-lg px-3 py-2.5 z-10 border border-border bg-card">
        <div className="flex flex-col gap-1.5">
          {[
            { p: 'P1', label: 'IMMEDIATE' },
            { p: 'P2', label: 'URGENT' },
            { p: 'P3', label: 'ROUTINE' },
          ].map(({ p, label }) => (
            <div key={p} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITY_COLORS[p] }} />
              <span className="text-lg text-foreground font-bold tracking-wider">{p}</span>
              <span className="text-lg text-foreground opacity-70">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

MapTab.displayName = 'MapTab';

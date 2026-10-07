import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { geoAzimuthalEquidistant, geoCircle, geoGraticule10, geoPath } from 'd3-geo';
import { merge, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import countriesUrl from 'world-atlas/countries-50m.json?url';
import { EARTH_RADIUS_KM, formatDistance } from '../lib/geo';
import type { Round } from '../lib/generator';

// Natural Earth 1:50m (public domain) via world-atlas, fetched once and cached.
// Country borders are drawn faintly to help orientation on capitals rounds.
interface Geo {
  land: GeoJSON.MultiPolygon;
  borders: GeoJSON.MultiLineString;
}
let geoPromise: Promise<Geo> | null = null;
function loadGeo(): Promise<Geo> {
  geoPromise ??= fetch(countriesUrl)
    .then((r) => r.json() as Promise<Topology<{ countries: GeometryCollection }>>)
    .then((topo) => ({
      land: merge(topo, topo.objects.countries.geometries as never),
      borders: mesh(topo, topo.objects.countries, (a, b) => a !== b),
    }));
  return geoPromise;
}

const FONT = 13;
const LINE = 16;
const KM_PER_DEG = (EARTH_RADIUS_KM * Math.PI) / 180;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

type Side = 'above' | 'below' | 'left' | 'right';

/** Place a label block next to (px, py), trying sides in order, avoiding boxes already placed. */
function placeLabel(px: number, py: number, w: number, h: number, sides: Side[], taken: Box[], W: number, H: number): Box {
  const gap = 12;
  const at = (s: Side): Box => {
    const b =
      s === 'above' ? { x: px - w / 2, y: py - gap - h, w, h }
      : s === 'below' ? { x: px - w / 2, y: py + gap, w, h }
      : s === 'right' ? { x: px + gap, y: py - h / 2, w, h }
      : { x: px - gap - w, y: py - h / 2, w, h };
    b.x = Math.min(W - w - 4, Math.max(4, b.x));
    b.y = Math.min(H - h - 4, Math.max(4, b.y));
    return b;
  };
  for (const s of sides) {
    const b = at(s);
    if (!taken.some((t) => overlaps(t, b))) return b;
  }
  return at(sides[0]);
}

/** Preferred sides for a label: away from `from`. */
function sidesAway(px: number, py: number, fx: number, fy: number): Side[] {
  const dx = px - fx;
  const dy = py - fy;
  const h: Side = dx >= 0 ? 'right' : 'left';
  const v: Side = dy >= 0 ? 'below' : 'above';
  const first = Math.abs(dx) > Math.abs(dy) * 1.3 ? [h, v] : [v, h];
  const opp = (s: Side): Side => ({ above: 'below', below: 'above', left: 'right', right: 'left' })[s] as Side;
  return [...first, opp(first[1]), opp(first[0])];
}

interface Props {
  round: Round;
  unit: 'km' | 'mi';
  /** Option index the player chose, to mark it on the map. */
  picked: 0 | 1;
}

export function MapView({ round, unit, picked }: Props) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(360);

  useEffect(() => {
    let alive = true;
    loadGeo()
      .then((g) => alive && setGeo(g))
      .catch(() => {
        /* the map still works without land shapes */
      });
    return () => {
      alive = false;
    };
  }, []);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setW(Math.round(el.clientWidth) || 360);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width) || 360));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = Math.round(Math.min(400, Math.max(230, W * 0.62)));
  const { anchor, options, distances, closer } = round;

  const view = useMemo(() => {
    // Azimuthal equidistant centred on the anchor: both great-circle lines are straight and
    // their on-screen lengths are true to scale. Fit the two lines plus a margin circle.
    const farDeg = Math.max(...distances) / KM_PER_DEG;
    const projection = geoAzimuthalEquidistant()
      .rotate([-anchor.lon, -anchor.lat])
      .clipAngle(Math.min(179.9, farDeg * 2.4 + 8))
      .precision(0.2);
    const margin = geoCircle()
      .center([anchor.lon, anchor.lat])
      .radius(Math.max(0.25, farDeg * 0.3))();
    const fitTo: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: margin },
        ...options.map((o) => ({
          type: 'Feature' as const,
          properties: {},
          geometry: { type: 'LineString' as const, coordinates: [[anchor.lon, anchor.lat], [o.lon, o.lat]] },
        })),
      ],
    };
    const padX = Math.min(90, W * 0.2);
    projection.fitExtent(
      [
        [padX, 46],
        [W - padX, H - 46],
      ],
      fitTo,
    );
    const path = geoPath(projection);
    const pt = (lon: number, lat: number): [number, number] => projection([lon, lat]) ?? [W / 2, H / 2];
    const a = pt(anchor.lon, anchor.lat);
    const opts = options.map((o) => pt(o.lon, o.lat));
    const lines = options.map((o) => path({ type: 'LineString', coordinates: [[anchor.lon, anchor.lat], [o.lon, o.lat]] }));
    return { path, a, opts, lines, graticule: path(geoGraticule10()), sphere: path({ type: 'Sphere' }) };
  }, [anchor, options, distances, W, H]);

  // Label layout: options first (away from the anchor), then the anchor (away from both).
  const textW = (s: string, size = FONT) => s.length * size * 0.6 + 6;
  const [ax, ay] = view.a;
  const dots: Box[] = [[ax, ay], ...view.opts].map(([x, y]) => ({ x: x - 10, y: y - 10, w: 20, h: 20 }));
  const taken: Box[] = [...dots];
  const optLabels = view.opts.map(([x, y], i) => {
    const o = options[i];
    const w = Math.max(textW(`✓ ${o.name}`), textW(formatDistance(distances[i], unit)));
    const b = placeLabel(x, y, w, LINE * 2, sidesAway(x, y, ax, ay), taken, W, H);
    taken.push(b);
    return b;
  });
  const mx = (view.opts[0][0] + view.opts[1][0]) / 2;
  const my = (view.opts[0][1] + view.opts[1][1]) / 2;
  const anchorLabel = placeLabel(ax, ay, textW(anchor.name, 14), LINE + 2, sidesAway(ax, ay, mx, my), taken, W, H);

  const description =
    `Map centred on ${anchor.name}. ` +
    options.map((o, i) => `${o.name} is ${formatDistance(distances[i], unit)} away${i === closer ? ' (closer)' : ''}.`).join(' ');

  return (
    <div ref={wrapRef} className="map-box">
      <svg className="map" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={description}>
        <rect width={W} height={H} className="map-water" />
        {view.sphere && <path d={view.sphere} className="map-sphere" />}
        {view.graticule && <path d={view.graticule} className="map-graticule" />}
        {geo && (
          <>
            <path d={view.path(geo.land) ?? ''} className="map-land" />
            <path d={view.path(geo.borders) ?? ''} className="map-borders" />
          </>
        )}
        {view.lines.map((d, i) =>
          d ? (
            <path
              key={`line-${round.round}-${i}`}
              d={d}
              pathLength={i === closer ? 1 : undefined}
              className={`map-line ${i === closer ? 'is-closer' : 'is-farther'}`}
            />
          ) : null,
        )}
        {view.opts.map(([x, y], i) => {
          const o = options[i];
          const isCloser = i === closer;
          const b = optLabels[i];
          const cx = b.x + b.w / 2;
          return (
            <g key={`opt-${i}`} className={`map-point ${isCloser ? 'is-closer' : 'is-farther'}`}>
              {picked === i && <circle cx={x} cy={y} r={12} className="map-picked" />}
              <circle cx={x} cy={y} r={isCloser ? 7 : 6} className="map-dot" />
              <text x={cx} y={b.y + FONT} textAnchor="middle" className="map-label">
                <tspan className="map-label-mark">{isCloser ? '✓ ' : '✗ '}</tspan>
                {o.name}
                <tspan x={cx} dy={LINE} className="map-label-sub">
                  {formatDistance(distances[i], unit)}
                </tspan>
              </text>
            </g>
          );
        })}
        <g className="map-anchor">
          <circle cx={ax} cy={ay} r={9} className="map-anchor-ring" />
          <circle cx={ax} cy={ay} r={3.5} className="map-anchor-dot" />
          <text x={anchorLabel.x + anchorLabel.w / 2} y={anchorLabel.y + FONT + 1} textAnchor="middle" className="map-label map-label-anchor">
            {anchor.name}
          </text>
        </g>
      </svg>
    </div>
  );
}

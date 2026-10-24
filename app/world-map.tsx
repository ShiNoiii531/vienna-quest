'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Check, Flag, Home, LockKeyhole, LocateFixed, Minus, Plus, Sparkles, Gift } from 'lucide-react';
import type { Mission } from '@/lib/quest-types';
import { WORLD, coverScale, clampCamera, focusCamera, zoomCamera, type Camera, type Size } from '@/lib/map-camera';

type Props = {
  missions: Mission[]; allMissions: Mission[]; organizer: boolean; selected: Mission | undefined;
  focusKey: number; panelOpen: boolean; celebration: string | null;
  onSelect: (mission: Mission) => void; onHotel: () => void;
  onOptional: () => void; optionalDone: number; optionalTotal: number; optionalOpen: boolean;
};
export default function WorldMap({ missions, allMissions, organizer, selected, focusKey, panelOpen, celebration, onSelect, onHotel, onOptional, optionalDone, optionalTotal, optionalOpen }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const size = useRef<Size>({ width: 1200, height: 800 });
  const cameraRef = useRef<Camera>({ x: 0, y: 0, scale: coverScale(size.current) });
  const [camera, setCamera] = useState(cameraRef.current);
  const [dragging, setDragging] = useState(false);
  const [walking, setWalking] = useState(false);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const selectedRef = useRef<{ x: number; y: number } | undefined>(selected); selectedRef.current = optionalOpen ? { x: 28, y: 52 } : selected;
  const points = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; midpoint: { x: number; y: number }; camera: Camera } | null>(null);
  const commit = useCallback((value: Camera) => { cameraRef.current = value; setCamera(value); }, []);
  const focus = useCallback(() => commit(focusCamera(cameraRef.current, size.current, selectedRef.current || { x: 45, y: 50 })), [commit]);

  useEffect(() => {
    const el = viewport.current; if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = { width: entry.contentRect.width, height: entry.contentRect.height };
      if (!next.width || !next.height) return;
      const previous = size.current;
      const zoom = cameraRef.current.scale / coverScale(previous);
      size.current = next;
      const base = { x: 0, y: 0, scale: coverScale(next) * Math.max(1, zoom) };
      commit(focusCamera(base, next, selectedRef.current || { x: 45, y: 50 }));
      setReady(true);
    });
    observer.observe(el);
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      commit(zoomCamera(cameraRef.current, size.current, Math.exp(-event.deltaY * .0015), { x: event.clientX - rect.left, y: event.clientY - rect.top }));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => { observer.disconnect(); el.removeEventListener('wheel', wheel); };
  }, [commit]);

  useEffect(() => { focus(); }, [focusKey, panelOpen, optionalOpen, focus]);
  useEffect(() => {
    if (!selected) return;
    setWalking(true); const timer = setTimeout(() => setWalking(false), 900);
    return () => clearTimeout(timer);
  }, [selected?.id]);

  function point(event: PointerEvent) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function beginPinch() {
    const [a, b] = [...points.current.values()];
    if (!a || !b) { pinch.current = null; return; }
    pinch.current = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, camera: cameraRef.current };
  }
  function down(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button') || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    points.current.set(event.pointerId, point(event)); setDragging(true); beginPinch();
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const previous = points.current.get(event.pointerId); if (!previous) return;
    const next = point(event); points.current.set(event.pointerId, next);
    if (points.current.size > 1 && pinch.current) {
      const [a, b] = [...points.current.values()]; const base = pinch.current;
      const scaled = zoomCamera(base.camera, size.current, Math.hypot(a.x - b.x, a.y - b.y) / base.distance, base.midpoint);
      commit(clampCamera({ ...scaled, x: scaled.x + (a.x + b.x) / 2 - base.midpoint.x, y: scaled.y + (a.y + b.y) / 2 - base.midpoint.y }, size.current));
    } else commit(clampCamera({ ...cameraRef.current, x: cameraRef.current.x + next.x - previous.x, y: cameraRef.current.y + next.y - previous.y }, size.current));
  }
  function up(event: PointerEvent<HTMLDivElement>) {
    points.current.delete(event.pointerId); beginPinch(); setDragging(points.current.size > 0);
  }
  const position = optionalOpen ? { x: 28, y: 59 } : selected ? { x: selected.x, y: Math.min(94, selected.y + 7) } : { x: 14, y: 32 };
  return <>
    <div ref={viewport} className={'world-viewport ' + (panelOpen ? 'panel-open ' : '') + (dragging ? 'dragging' : '')} role="region" aria-label="Carte de Vienne. Faites glisser pour explorer et pincez pour zoomer." tabIndex={0}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        const offsets: Record<string, [number, number]> = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] };
        const offset = offsets[event.key];
        if (offset) { event.preventDefault(); commit(clampCamera({ ...cameraRef.current, x: cameraRef.current.x + offset[0], y: cameraRef.current.y + offset[1] }, size.current)); }
        else if (event.key === '+' || event.key === '=') { event.preventDefault(); commit(zoomCamera(cameraRef.current, size.current, 1.25)); }
        else if (event.key === '-') { event.preventDefault(); commit(zoomCamera(cameraRef.current, size.current, .8)); }
      }}>
      <div className="world-scene" style={{ width: WORLD.width, height: WORLD.height, transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`, '--inverse-scale': 1 / camera.scale, opacity: ready ? 1 : 0 } as CSSProperties}>
        <img className="world-art" src="/vienna-map.webp" alt="Carte imaginaire de Vienne en pixel art" width={1536} height={1024} fetchPriority="high" draggable={false} onError={() => setMapError(true)}/>
        {!organizer && <svg className="world-fog" viewBox="0 0 1536 1024" aria-hidden="true">
          <defs><radialGradient id="fog-opening"><stop offset="45%" stopColor="black"/><stop offset="100%" stopColor="white"/></radialGradient>
            <mask id="explored-zones"><rect width="1536" height="1024" fill="white"/><circle cx="169" cy="256" r="160" fill="url(#fog-opening)"/>{allMissions.map(m => <circle key={m.id} cx={m.x / 100 * 1536} cy={m.y / 100 * 1024} r={m.revealed ? 190 : 0} fill="url(#fog-opening)"/>)}</mask></defs>
          <rect width="1536" height="1024" fill="#0b262d" fillOpacity=".9" mask="url(#explored-zones)"/>
        </svg>}
        {missions.map((m, index) => <button key={m.id} className={'world-pin ' + (m.completed ? 'finished ' : m.revealed ? 'revealed ' : 'locked ') + (selected?.id === m.id ? 'selected ' : '') + (celebration === m.id ? 'celebrating' : '')}
          style={{ left: m.x + '%', top: m.y + '%' }} aria-label={(m.revealed || organizer ? m.title : `Surprise ${index + 1} : ${m.teaser}`) + (m.completed ? ', terminée' : '')} aria-haspopup="dialog" onClick={() => onSelect(m)}>
          <span className="pin-core">{m.completed ? <Flag size={20}/> : m.revealed || organizer ? <span>{index + 1}</span> : <LockKeyhole size={18}/>}</span>
          <span className="world-pin-label">{m.revealed || organizer ? m.title : `Surprise ${index + 1}`}</span>
          {m.completed && <span className="pin-check"><Check size={12}/></span>}
          {celebration === m.id && <Sparkles className="pin-sparkle" size={36}/>}
        </button>)}
        <button className={'world-pin gift-pin '+(selected?.optional||optionalOpen?'selected ':'')+(optionalDone===optionalTotal?'finished ':'')+(celebration?.startsWith('b')?'celebrating':'')} style={{left:'28%',top:'52%'}} onClick={onOptional} aria-label={`Quêtes optionnelles : ${optionalDone} cadeaux trouvés sur ${optionalTotal}`} aria-haspopup="dialog"><span className="pin-core"><Gift size={21}/></span><span className="world-pin-label">Cadeaux · {optionalDone}/{optionalTotal}</span></button>
        <button className="world-pin home-pin" style={{ left: '11%', top: '25%' }} onClick={onHotel} aria-label="Notre hôtel" aria-haspopup="dialog"><span className="pin-core"><Home size={19}/></span><span className="world-pin-label">Notre hôtel</span></button>
        <div className={'duo-position ' + (walking ? 'walking' : '')} style={{ left: position.x + '%', top: position.y + '%' }} aria-hidden="true"><div className="duo-sprite"><img src="/duo.png" width="1312" height="1199" alt="" draggable={false}/></div></div>
      </div>
    </div>
    <div className="map-tools" aria-label="Vue de la carte">
      <button className="hud-icon" aria-label="Zoomer" onClick={() => commit(zoomCamera(cameraRef.current, size.current, 1.25))} disabled={camera.scale >= coverScale(size.current) * 3 - .001}><Plus size={20}/></button>
      <button className="hud-icon" aria-label="Dézoomer" onClick={() => commit(zoomCamera(cameraRef.current, size.current, .8))} disabled={camera.scale <= coverScale(size.current) + .001}><Minus size={20}/></button>
      <button className="hud-icon" aria-label="Recentrer sur notre étape" onClick={focus}><LocateFixed size={20}/></button>
    </div>
    {mapError && <p className="map-image-error" role="alert">La carte n’a pas chargé. Rechargez la page ; les quêtes restent accessibles en bas.</p>}
  </>;
}

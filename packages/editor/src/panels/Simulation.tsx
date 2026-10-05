/**
 * Panel de **simulación** de la vista actual (BPMN por tokens o máquina de estados), con `@all-draw/sim`. Se carga
 * perezosamente desde `Editor.tsx` (el motor no entra en el paquete inicial). Solo lee el modelo: trabaja sobre una
 * copia (`store.snapshot()`) y pinta el resultado en el lienzo con marcas `ad-sim-*` (nodos, vía `SimMarksController`)
 * y una hoja de estilo propia para las aristas recorridas.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createSimulation, formatDuration, type Simulation, type SimView, type SimEvent, type SimAction, type SimStatus, type Vars } from '@all-draw/sim';
import { useT, tMsg } from '@all-draw/i18n';
import { useEditor } from '../context';
import { useAnyChange } from '../hooks';
import { Icon } from '../icons';
import { HelpLink } from './HelpLink';
import { TabList, tabPanelProps, useTabIds } from '../ui/tabs';
import type { SimMarksController } from '../nodes/env';

export interface SimulationPanelProps {
  viewId: string;
  marks: SimMarksController;
  onClose: () => void;
}

/** Pasos por segundo de "Ejecutar"; `0` = hasta el final de golpe. */
const SPEEDS = [{ id: 'slow', ms: 1000 }, { id: 'normal', ms: 400 }, { id: 'fast', ms: 120 }, { id: 'max', ms: 0 }] as const;
type Speed = (typeof SPEEDS)[number]['id'];
const MAX_STEPS = 2000;
const HISTORY_SHOWN = 400;

/** Texto → valor: `true`/`false`, números, JSON (`[..]`, `{..}`, `"..."`) o el texto tal cual. */
function parseVarValue(raw: string): unknown {
  const s = raw.trim();
  if (s === 'true' || s === 'false') return s === 'true';
  if (s === 'null') return null;
  if (s !== '' && !Number.isNaN(Number(s))) return Number(s);
  if (/^[[{"]/.test(s)) { try { return JSON.parse(s); } catch { /* texto */ } }
  return raw;
}
const varText = (v: unknown) => (typeof v === 'string' ? v : v === undefined ? '' : JSON.stringify(v));

/** Reloj simulado legible: `0 s`, `1 min 15 s`, `2 d 3 h`. */
const clock = (ms: number) => (ms === 0 ? '0 s' : formatDuration(ms));

export default function SimulationPanel({ viewId, marks, onClose }: SimulationPanelProps) {
  const t = useT();
  const { store, select } = useEditor();
  const version = useAnyChange();
  const sim = useRef<Simulation | null>(null);
  const builtAt = useRef(version);
  const [view, setView] = useState<SimView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>('normal');
  const [manualTasks, setManualTasks] = useState(false);
  const [vars, setVars] = useState<Vars>({});
  const [newVar, setNewVar] = useState('');
  const [tab, setTab] = useState<'history' | 'actions'>('history');
  const tabIds = useTabIds();
  const histRef = useRef<HTMLOListElement>(null);
  const viewName = store.get('views', viewId)?.name ?? '';

  /** Plantilla del modelo (sin iniciar) para nombres, tipo y variables sugeridas; se rehace si cambia el modelo. */
  const [probe, probeError] = useMemo((): [Simulation | null, string | null] => {
    try { return [createSimulation(store.snapshot(), viewId), null]; } catch (e) { return [null, e instanceof Error ? e.message : String(e)]; }
  }, [store, viewId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const kind = probe?.kind ?? 'bpmn';
  const stale = !!view && version !== builtAt.current;

  const refresh = useCallback(() => {
    const s = sim.current;
    if (!s) { setView(null); marks.clear(); return; }
    const v = s.view();
    setView(v);
    marks.set(v.nodes);
    setVars(v.variables);
  }, [marks]);

  const start = useCallback(() => {
    try {
      const s = createSimulation(store.snapshot(), viewId, { variables: vars, manualTasks });
      s.start();
      sim.current = s;
      builtAt.current = version;
      setError(null);
      refresh();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [store, viewId, vars, manualTasks, version, refresh]);

  const step = useCallback(() => {
    if (!sim.current) { start(); return; }
    sim.current.step();
    refresh();
  }, [start, refresh]);

  const reset = useCallback(() => { setPlaying(false); sim.current = null; refresh(); }, [refresh]);

  // Ejecutar: un paso cada `ms` mientras haya trabajo; con "máxima", todo de golpe.
  useEffect(() => {
    if (!playing) return;
    const ms = SPEEDS.find(s => s.id === speed)!.ms;
    if (!sim.current) start();
    const s = sim.current;
    if (!s) { setPlaying(false); return; }
    if (ms === 0) { s.run(MAX_STEPS); refresh(); setPlaying(false); return; }
    const id = setInterval(() => {
      const cur = sim.current;
      if (!cur || cur.view().status !== 'running') { setPlaying(false); return; }
      cur.step();
      refresh();
      if (cur.view().status !== 'running') setPlaying(false);
    }, ms);
    return () => clearInterval(id);
  }, [playing, speed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al cerrar el panel (o cambiar de vista) se quitan las marcas del lienzo.
  useEffect(() => () => marks.clear(), [marks]);
  // El historial sigue al último paso.
  useEffect(() => { const el = histRef.current; if (el) el.scrollTop = el.scrollHeight; }, [view?.history.length]);

  const perform = (a: SimAction, options?: string[]) => {
    if (!sim.current) return;
    sim.current.perform(a.id, options);
    refresh();
  };
  const commitVar = (name: string, raw: string) => {
    const value = parseVarValue(raw);
    if (Object.is(vars[name], value)) return;
    const next = { ...vars, [name]: value };
    setVars(next);
    if (sim.current) { sim.current.setVariables({ [name]: value }); refresh(); }
  };
  const removeVar = (name: string) => {
    const next = { ...vars }; delete next[name];
    setVars(next);
    if (sim.current) { sim.current.setVariables(next, true); refresh(); }
  };
  const addVar = () => {
    const name = newVar.trim();
    if (!/^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(name) || name in vars) return;
    commitVar(name, '');
    setNewVar('');
  };

  /** Selecciona en el lienzo los nodos de un elemento (al pulsar una entrada del historial o un elemento activo). */
  const reveal = (element: string | undefined) => {
    if (!element) return;
    const nodes = store.list('nodes').filter(n => n.viewId === viewId && n.elementId === element).map(n => n.id);
    if (nodes.length) select({ nodes, edges: [] });
  };

  const name = (id: string | undefined) => (sim.current ?? probe)?.nameOf(id) ?? id ?? '';
  const statusText: Record<SimStatus, string> = {
    idle: t('Sin iniciar'), running: t('En marcha'), waiting: t('Esperando una acción'), completed: t('Completada'),
    terminated: t('Terminada'), failed: t('Error sin capturar'), deadlock: t('Bloqueada'), loop: t('Bucle sin salida'),
  };
  const status: SimStatus = view?.status ?? 'idle';
  const canRun = status === 'idle' || status === 'running';
  const varNames = useMemo(() => [...new Set([...(probe?.variableNames() ?? []), ...Object.keys(vars)])].sort((a, b) => a.localeCompare(b)), [probe, vars]);
  const edgeCss = useMemo(() => edgeStyles(view), [view]);
  const warnings = (view?.warnings ?? probe?.view().warnings ?? []);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape' && !(e.target as HTMLElement).closest('input, select, textarea')) { e.stopPropagation(); onClose(); }
  };

  return (
    <aside className="ad-sim-panel" aria-label={t('Simulación')} onKeyDown={onKeyDown}>
      {edgeCss && <style>{edgeCss}</style>}
      <header className="ad-sim-panel__head">
        <span className="ad-sim-panel__title">{kind === 'bpmn' ? t('Simular proceso') : t('Simular máquina de estados')}</span>
        <HelpLink slug="simulacion" label={t('Ayuda')} className="ad-help-link--compact" />
        <button className="ad-btn ad-btn--ghost" onClick={onClose} aria-label={t('Cerrar')} title={t('Cerrar')}><Icon name="close" size={14} /></button>
      </header>
      <div className="ad-sim-panel__sub" title={viewName}>{viewName}</div>

      <div className="ad-sim-controls" role="toolbar" aria-label={t('Controles de la simulación')}>
        <button className="ad-btn ad-btn--primary" onClick={start} title={status === 'idle' ? t('Iniciar') : t('Volver a empezar')}><SimIcon name="start" />{status === 'idle' ? t('Iniciar') : t('Reiniciar')}</button>
        <button className="ad-btn" onClick={step} disabled={!canRun || playing} title={kind === 'bpmn' ? t('Un paso') : t('Siguiente temporizador')}><SimIcon name="step" />{t('Paso')}</button>
        {playing
          ? <button className="ad-btn is-on" onClick={() => setPlaying(false)} aria-pressed="true"><SimIcon name="pause" />{t('Pausa')}</button>
          : <button className="ad-btn" onClick={() => setPlaying(true)} disabled={!canRun} title={t('Ejecutar hasta que haga falta una acción')}><SimIcon name="play" />{t('Ejecutar')}</button>}
        <button className="ad-btn ad-btn--ghost" onClick={reset} disabled={!view} title={t('Quitar la simulación del lienzo')}><Icon name="replay" size={14} />{t('Limpiar')}</button>
        <label className="ad-sim-speed">
          <span>{t('Velocidad')}</span>
          <select className="ad-input" value={speed} onChange={e => setSpeed(e.target.value as Speed)}>
            <option value="slow">{t('Lenta')}</option>
            <option value="normal">{t('Normal')}</option>
            <option value="fast">{t('Rápida')}</option>
            <option value="max">{t('Al instante')}</option>
          </select>
        </label>
      </div>

      <div className={`ad-sim-status ad-sim-status--${status}`} role="status" aria-live="polite">
        <span className="ad-sim-status__dot" aria-hidden="true" />
        <strong>{statusText[status]}</strong>
        {view && <span className="ad-sim-status__meta">{t('Paso {n}', { n: view.step })} · {t('t = {time}', { time: clock(view.time) })}</span>}
      </div>
      {(error ?? probeError) && <div className="ad-sim-alert ad-sim-alert--error" role="alert">{error ?? probeError}</div>}
      {stale && <div className="ad-sim-alert"><span>{t('El modelo ha cambiado desde que empezó la simulación.')}</span><button className="ad-btn" onClick={start}>{t('Reiniciar')}</button></div>}
      {status === 'deadlock' && view && (
        <div className="ad-sim-alert ad-sim-alert--error" role="alert">
          <strong>{t('Bloqueo: quedan tokens que no pueden avanzar.')}</strong>
          <ul>{view.blocked.map(b => <li key={b.element}><button className="ad-link" onClick={() => reveal(b.element)}>{b.missing?.length ? t('«{name}» espera a: {list}', { name: b.name, list: b.missing.join(', ') }) : b.reason === 'noTransitions' ? t('«{name}» no tiene transiciones de salida', { name: b.name }) : b.name}</button></li>)}</ul>
        </div>
      )}
      {status === 'loop' && <div className="ad-sim-alert ad-sim-alert--warn" role="alert">{t('El mismo estado se repite sin intervención: es un bucle sin salida. Cambia las variables o elige otra rama.')}</div>}

      <div className="ad-sim-panel__scroll">
        {view && view.actions.length > 0 && (
          <section className="ad-sim-sec" aria-label={kind === 'bpmn' ? t('Acciones disponibles') : t('Eventos disponibles')}>
            <h3>{kind === 'bpmn' ? t('Acciones disponibles') : t('Eventos disponibles')}</h3>
            <div className="ad-sim-actions">{view.actions.map(a => <ActionItem key={a.id} action={a} onPerform={perform} />)}</div>
          </section>
        )}
        {view && view.active.length > 0 && (
          <section className="ad-sim-sec">
            <h3>{kind === 'bpmn' ? t('Tokens') : t('Estado actual')}</h3>
            <ul className="ad-sim-chips">
              {view.active.map(a => <li key={a.element}><button className="ad-sim-chip" onClick={() => reveal(a.element)}>{a.name}{a.count > 1 && <small> ×{a.count}</small>}{a.wait && a.wait !== 'task' && <small className="ad-sim-chip__wait"> · {waitText(t, a.wait)}</small>}</button></li>)}
            </ul>
            {view.timers.length > 0 && <p className="ad-sim-note">{t('Próximo vencimiento: «{name}» en t = {time}', { name: view.timers[0]!.name, time: clock(view.timers[0]!.due) })}</p>}
          </section>
        )}

        <section className="ad-sim-sec">
          <h3>{t('Variables')}</h3>
          {kind === 'bpmn' && <label className="ad-field ad-field--inline ad-sim-check"><input type="checkbox" checked={manualTasks} onChange={e => setManualTasks(e.target.checked)} /><span>{t('Esperar en las tareas de usuario y manuales')}</span></label>}
          {varNames.length === 0 && <p className="ad-sim-note">{t('Las condiciones y guardas del modelo no usan variables.')}</p>}
          <div className="ad-sim-vars">
            {varNames.map(n => (
              <div key={n} className="ad-sim-var">
                <label htmlFor={`sim-var-${n}`}><code>{n}</code></label>
                <input id={`sim-var-${n}`} className="ad-input" defaultValue={varText(vars[n])} key={`${n}=${varText(vars[n])}`} placeholder={t('sin valor')}
                  onBlur={e => commitVar(n, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') commitVar(n, (e.target as HTMLInputElement).value); }} />
                {n in vars && <button className="ad-btn ad-btn--ghost" onClick={() => removeVar(n)} aria-label={t('Quitar {name}', { name: n })} title={t('Quitar {name}', { name: n })}><Icon name="close" size={12} /></button>}
              </div>
            ))}
            <div className="ad-sim-var ad-sim-var--new">
              <input className="ad-input" value={newVar} onChange={e => setNewVar(e.target.value)} placeholder={t('nueva variable')} aria-label={t('Nombre de la variable nueva')} onKeyDown={e => { if (e.key === 'Enter') addVar(); }} />
              <button className="ad-btn" onClick={addVar} disabled={!newVar.trim()}><Icon name="plus" size={12} />{t('Añadir')}</button>
            </div>
          </div>
          <p className="ad-sim-note">{t('Valores: números, true/false, texto o JSON. Las condiciones usan expresiones como importe > 1000 && pais == "ES".')}</p>
        </section>

        <section className="ad-sim-sec ad-sim-sec--grow">
          {kind === 'statechart'
            ? <TabList ids={tabIds} label={t('Registro')} value={tab} onChange={setTab} tabs={[{ id: 'history', label: t('Historial') }, { id: 'actions', label: t('Acciones ejecutadas') }]} />
            : <h3>{t('Historial')}</h3>}
          <div {...(kind === 'statechart' ? tabPanelProps(tabIds, tab) : {})} className="ad-sim-log">
            {tab === 'actions' && kind === 'statechart'
              ? (view?.actionLog.length
                ? <ol className="ad-sim-hist" ref={histRef}>{view.actionLog.slice(-HISTORY_SHOWN).map(a => <li key={a.seq}><time>{clock(a.time)}</time><span><code>{a.action}</code> <small>{a.kind === 'entry' ? t('entrada de «{name}»', { name: name(a.state) }) : a.kind === 'exit' ? t('salida de «{name}»', { name: name(a.state) }) : t('transición {name}', { name: name(a.transition) })}{a.detail ? ` · ${a.detail}` : ''}</small></span></li>)}</ol>
                : <p className="ad-sim-note">{t('Aún no se ha ejecutado ninguna acción.')}</p>)
              : (view?.history.length
                ? <ol className="ad-sim-hist" ref={histRef}>{view.history.slice(-HISTORY_SHOWN).map(h => <li key={h.seq} className={`ad-sim-hist--${h.kind}`}><time>{clock(h.time)}</time><button className="ad-link" onClick={() => reveal(h.element)} disabled={!h.element}>{eventText(t, h, name)}</button></li>)}</ol>
                : <p className="ad-sim-note">{kind === 'bpmn' ? t('Pulsa Iniciar para colocar los tokens en los eventos de inicio.') : t('Pulsa Iniciar para entrar en el estado inicial.')}</p>)}
          </div>
        </section>

        {warnings.length > 0 && (
          <details className="ad-sim-sec ad-sim-warnings">
            <summary>{t('Avisos del modelo ({n})', { n: warnings.length })}</summary>
            <ul>{warnings.map((w, i) => <li key={i}><button className="ad-link" onClick={() => reveal(w.element)}>{tMsg(w.key, w.vars)}</button></li>)}</ul>
          </details>
        )}
      </div>
    </aside>
  );
}

function ActionItem({ action: a, onPerform }: { action: SimAction; onPerform: (a: SimAction, options?: string[]) => void }) {
  const t = useT();
  const [picked, setPicked] = useState<string[]>([]);
  if (a.kind === 'choice') {
    return (
      <div className="ad-sim-choice" role="group" aria-label={t('Elegir rama en «{name}»', { name: a.label })}>
        <div className="ad-sim-choice__title">{a.multi ? t('«{name}»: elige una o varias ramas', { name: a.label }) : t('«{name}»: elige una rama', { name: a.label })}</div>
        {a.multi ? <>
          {a.options!.map(o => <label key={o.id} className="ad-field ad-field--inline"><input type="checkbox" checked={picked.includes(o.id)} onChange={e => setPicked(p => (e.target.checked ? [...p, o.id] : p.filter(x => x !== o.id)))} /><span>{o.label}{o.condition && <code> [{o.condition}]</code>}</span></label>)}
          <button className="ad-btn ad-btn--primary" disabled={!picked.length} onClick={() => onPerform(a, picked)}>{t('Seguir')}</button>
        </> : a.options!.map(o => <button key={o.id} className="ad-btn" onClick={() => onPerform(a, [o.id])}>{o.label}{o.condition && <code> [{o.condition}]</code>}</button>)}
      </div>
    );
  }
  if (a.kind === 'condition') return <div className="ad-sim-wait" title={t('Cambia las variables para que se cumpla')}>{t('«{name}» espera: {condition}', { name: a.label, condition: a.condition ?? '' })}</div>;
  const label = a.kind === 'message' ? t('Mensaje «{name}»', { name: a.label }) : a.kind === 'signal' ? t('Señal «{name}»', { name: a.label }) : a.kind === 'complete' ? t('Completar «{name}»', { name: a.label }) : a.label;
  return <button className="ad-btn ad-sim-ev" disabled={!a.enabled} onClick={() => onPerform(a)} title={a.enabled ? undefined : t('Ninguna guarda se cumple ahora')}>{a.kind === 'message' ? '✉ ' : a.kind === 'signal' ? '△ ' : a.kind === 'complete' ? '✓ ' : '⚡ '}{label}</button>;
}

type T = ReturnType<typeof useT>;
function waitText(t: T, w: string): string {
  switch (w) {
    case 'choice': return t('decisión');
    case 'message': return t('mensaje');
    case 'signal': return t('señal');
    case 'timer': return t('temporizador');
    case 'condition': return t('condición');
    case 'join': return t('unión');
    case 'manual': return t('manual');
    case 'eventGateway': return t('evento');
    case 'subprocess': return t('subproceso');
    default: return w;
  }
}

/** Una línea del historial en el idioma de la interfaz. */
function eventText(t: T, e: SimEvent, nameOf: (id: string | undefined) => string): string {
  const name = nameOf(e.element);
  const d = e.detail ?? '';
  switch (e.kind) {
    case 'start': return t('Inicio de la simulación');
    case 'completed': return t('Simulación completada');
    case 'terminated': return e.element ? t('Terminada por «{name}»', { name }) : t('Terminada');
    case 'deadlock': return t('Bloqueo en: {list}', { list: d });
    case 'loop': return t('Bucle sin salida en: {list}', { list: d });
    case 'variables': return t('Variables: {detail}', { detail: d });
    case 'warning': return e.warning ? tMsg(e.warning.key, e.warning.vars) : d;
    case 'flow': return t('{from} → {to}', { from: name, to: d || nameOf(e.flow) });
    case 'enter': return t('Entra en «{name}»', { name });
    case 'leave': return t('Completa «{name}»', { name });
    case 'wait': return t('«{name}» espera: {what}', { name, what: waitText(t, d === 'event' ? 'eventGateway' : d) });
    case 'decision': return d === 'default' ? t('«{name}» sigue por la rama por defecto', { name }) : d === 'unconditioned' ? t('«{name}» sigue por la rama sin condición', { name }) : t('«{name}» decide: {detail}', { name, detail: d });
    case 'choice': return t('En «{name}» elegiste: {detail}', { name, detail: d });
    case 'fork': return t('«{name}» se divide en {n} ramas', { name, n: d });
    case 'join': return t('«{name}» une {n} ramas', { name, n: d });
    case 'timer': return t('Vence el temporizador de «{name}»', { name });
    case 'message': return e.flow ? t('Mensaje de «{name}» a «{to}»', { name, to: d }) : t('Llega un mensaje a «{name}»', { name });
    case 'signal': return t('Señal en «{name}»', { name });
    case 'condition': return t('Se cumple la condición de «{name}»: {detail}', { name, detail: d });
    case 'boundary': return d === 'interrupting' ? t('Evento de borde «{name}»: interrumpe la actividad', { name }) : t('Evento de borde «{name}»: sin interrumpir', { name });
    case 'subprocess-start': return t('Entra en el subproceso «{name}»', { name });
    case 'subprocess-end': return t('Sale del subproceso «{name}»', { name });
    case 'event-subprocess': return t('Se dispara el subproceso de evento «{name}»', { name });
    case 'end': return d === 'implicit' ? t('Fin implícito tras «{name}»', { name }) : t('Fin en «{name}»', { name });
    case 'error': return d === 'uncaught' ? t('Error sin capturar en «{name}»', { name }) : t('Error lanzado en «{name}»', { name });
    case 'escalation': return t('Escalado desde «{name}»', { name });
    case 'link': return t('Enlace de «{name}» a «{to}»', { name, to: d });
    case 'condition-error': return t('Condición no válida: {detail}', { detail: d });
    case 'event': return t('Evento {name}', { name: d });
    case 'ignored': return t('Nadie atiende el evento {name}', { name: d });
    case 'transition': return d ? t('Transición {name} ({event})', { name: nameOf(e.flow), event: d }) : t('Transición {name}', { name: nameOf(e.flow) });
    case 'exit': return t('Sale de «{name}»', { name });
    case 'entry': return t('Entra en «{name}»', { name });
    case 'action': return t('Acción: {detail}', { detail: d });
    case 'done': return t('«{name}» ha terminado', { name });
  }
}

/** Hoja de estilo de las aristas recorridas (las aristas no tienen marcas propias: se señalan por su `data-id`). */
function edgeStyles(view: SimView | null): string {
  if (!view) return '';
  const esc = (id: string) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/["\\]/g, '\\$&'));
  const sel = (ids: string[], tail: string) => ids.map(id => `.ad-sim-on .react-flow__edge[data-id="${esc(id)}"] ${tail}`).join(',\n');
  const last = Object.keys(view.edges).filter(id => view.edges[id] === 'last');
  const visited = Object.keys(view.edges).filter(id => view.edges[id] === 'visited');
  const out: string[] = [];
  if (visited.length) out.push(`${sel(visited, '.react-flow__edge-path')} { stroke: var(--ad-sim-visited) !important; stroke-width: 2.5px !important; }`);
  if (last.length) out.push(`${sel(last, '.react-flow__edge-path')} { stroke: var(--ad-sim) !important; stroke-width: 3px !important; stroke-dasharray: 8 6 !important; animation: ad-sim-dash .6s linear infinite; }`);
  return out.join('\n');
}

/** Iconos propios de los controles (16 px, trazo como los de `icons.tsx`). */
function SimIcon({ name }: { name: 'start' | 'step' | 'play' | 'pause' }) {
  const d = { start: 'M4 3v10M7 3.5l6 4.5-6 4.5Z', step: 'M3.5 3.5l6 4.5-6 4.5ZM12 3.5v9', play: 'M5 3l8 5-8 5Z', pause: 'M5.5 3.5v9M10.5 3.5v9' }[name];
  return <svg className="ad-icon" width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"><path d={d} /></svg>;
}

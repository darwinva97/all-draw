/**
 * Referencia de notaciones generada desde los packs (`PACKS` + `createRegistry`): categorías, tipos con su figura,
 * relaciones con su línea y cabezas, explorador de la matriz de validez y viewpoints. Como lee los datos de los
 * packs, nunca se desactualiza respecto al editor.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { tIn, useLang, useT, type Lang } from '@all-draw/i18n';
import type { ArrowHead, ElementType, FieldDef, NotationPack, RelationType, Shape } from '@all-draw/core';
import { figureOf, figureParts, iconParts, showsIcon } from '@all-draw/notation-archimate';
import { createRegistry, PACKS } from '../registry';
import { docHref } from './links';
import { Icon } from './icons';

// ---------------------------------------------------------------- Utilidades
function darken(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#475569';
  const n = parseInt(m[1]!, 16);
  const ch = (v: number) => Math.max(0, Math.round(v * (1 - amount))).toString(16).padStart(2, '0');
  return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}
function readable(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#111827';
  const n = parseInt(m[1]!, 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150 ? '#111827' : '#ffffff';
}
/** Los iconos de los packs son glifos cortos (✕, ⛁, 👤); algunos son nombres internos (`deployment-node`): esos no se pintan. */
const glyph = (icon: string | undefined): string | null => (icon && Array.from(icon).length <= 3 && !/^[a-z-]{4,}$/.test(icon) ? icon : null);

/** Documentación de un tipo (texto del pack, traducida si hay entrada): los tramos entre comillas invertidas van como código. */
function localDoc(lang: Lang, doc: string | undefined): ReactNode {
  if (!doc) return null;
  return tIn(lang, doc).split(/(`[^`]+`)/).map((part, i) => (part.startsWith('`') && part.endsWith('`') && part.length > 2 ? <code key={i}>{part.slice(1, -1)}</code> : part));
}

// ---------------------------------------------------------------- Figura de un tipo
export function TypeFigure({ type, w = 64, h = 40 }: { type: ElementType; w?: number; h?: number }) {
  const fill = type.color ?? '#ffffff';
  const stroke = darken(fill === '#ffffff' || fill.toLowerCase() === '#fff' ? '#94a3b8' : fill, 0.4);
  const isArchimate = type.id.startsWith('archimate:');
  let body: ReactNode;
  let icon: ReactNode = null;
  if (isArchimate) {
    const pad = 4, fw = w - pad * 2, fh = h - pad * 2;
    body = <g transform={`translate(${pad} ${pad})`}>{figureParts(figureOf(type.id, 0), fw, fh, fill, stroke).map((p, i) => <path key={i} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeDasharray={p.dash} />)}</g>;
    if (showsIcon(type.id, 0)) icon = <g transform={`translate(${w - pad - 17} ${pad + 2})`}>{iconParts(type.id, stroke).map((p, i) => <path key={i} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} />)}</g>;
  } else {
    body = shapeBody(type.shape ?? 'rect', w, h, fill, stroke);
    const g = glyph(type.icon);
    if (g) {
      const centered = ['circle', 'double-circle', 'diamond', 'ellipse', 'hexagon', 'actor', 'bar', 'label'].includes(type.shape ?? 'rect');
      const color = centered && type.shape !== 'label' ? stroke : readable(fill);
      icon = centered
        ? (type.shape === 'actor' || type.shape === 'bar' ? null : <text x={w / 2} y={h / 2 + 4} textAnchor="middle" fontSize={12} fill={color}>{g}</text>)
        : <text x={w - 7} y={15} textAnchor="end" fontSize={11} fill={color}>{g}</text>;
    }
  }
  return (
    <svg className="docs-fig" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false">
      {body}{icon}
    </svg>
  );
}

function shapeBody(shape: Shape, w: number, h: number, fill: string, stroke: string): ReactNode {
  const c = { fill, stroke, strokeWidth: 1.25 };
  const x = 4, y = 4, W = w - 8, H = h - 8, cx = w / 2, cy = h / 2;
  switch (shape) {
    case 'rounded': return <rect x={x} y={y} width={W} height={H} rx={8} {...c} />;
    case 'ellipse': return <ellipse cx={cx} cy={cy} rx={W / 2} ry={H / 2} {...c} />;
    case 'circle': return <circle cx={cx} cy={cy} r={H / 2} {...c} />;
    case 'double-circle': return <><circle cx={cx} cy={cy} r={H / 2} {...c} /><circle cx={cx} cy={cy} r={H / 2 - 3.5} {...c} /></>;
    case 'diamond': return <polygon points={`${cx},${y} ${cx + H * 0.75},${cy} ${cx},${y + H} ${cx - H * 0.75},${cy}`} {...c} />;
    case 'hexagon': return <polygon points={`${x + 9},${y} ${x + W - 9},${y} ${x + W},${cy} ${x + W - 9},${y + H} ${x + 9},${y + H} ${x},${cy}`} {...c} />;
    case 'parallelogram': return <polygon points={`${x + 9},${y} ${x + W},${y} ${x + W - 9},${y + H} ${x},${y + H}`} {...c} />;
    case 'cylinder': return <><path d={`M${x},${y + 5} v${H - 10} a${W / 2},5 0 0 0 ${W},0 v${-(H - 10)}`} {...c} /><ellipse cx={cx} cy={y + 5} rx={W / 2} ry={5} {...c} /></>;
    case 'note': return <path d={`M${x},${y} h${W - 9} l9,9 v${H - 9} h${-W} z M${x + W - 9},${y} v9 h9`} {...c} />;
    case 'actor': return <g fill="none" stroke={stroke} strokeWidth={1.5}><circle cx={cx} cy={y + 5} r={4.5} fill={fill} /><path d={`M${cx},${y + 9.5} v12 M${cx - 9},${y + 13} h18 M${cx},${y + 21.5} l-7,${H - 22} M${cx},${y + 21.5} l7,${H - 22}`} /></g>;
    case 'bar': return <rect x={cx - 3} y={y} width={6} height={H} rx={1} fill={stroke} />;
    case 'pool': return <><rect x={x} y={y} width={W} height={H} {...c} /><path d={`M${x + 10},${y} v${H}`} stroke={stroke} strokeWidth={1.25} /></>;
    case 'lane': return <><rect x={x} y={y} width={W} height={H} {...c} /><path d={`M${x + 6},${y} v${H}`} stroke={stroke} strokeWidth={1} strokeDasharray="2 2" /></>;
    case 'group': return <rect x={x} y={y} width={W} height={H} rx={4} fill="none" stroke={stroke} strokeWidth={1.25} strokeDasharray="4 3" />;
    case 'label': return <><rect x={x} y={y} width={W} height={H} rx={4} fill={fill} opacity={0.5} /><path d={`M${x + 8},${cy + 1} h${W - 16}`} stroke={stroke} strokeWidth={1.25} strokeLinecap="round" /></>;
    case 'container': return <><rect x={x} y={y} width={W} height={H} rx={3} {...c} /><path d={`M${x},${y + 9} h${W}`} stroke={stroke} strokeWidth={1} /></>;
    default: return <rect x={x} y={y} width={W} height={H} rx={2} {...c} />;
  }
}

// ---------------------------------------------------------------- Muestra de una relación
/** Cabeza con la punta en (0,0) apuntando a +x (mismas formas que los marcadores del lienzo). */
function Head({ head, color }: { head: ArrowHead; color: string }) {
  const hollow = { style: { fill: 'var(--docs-surface)' }, stroke: color, strokeWidth: 1.5 };
  const tr = (rx: number, ry: number) => `translate(${-rx} ${-ry})`;
  const bar = (x: number) => `M${x},2 L${x},14`;
  const FOOT = 'M10,8 L22,2 M10,8 L22,14 M10,8 L22,8';
  const ie = (d: string, circle?: number) => (
    <g transform={tr(22, 8)}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      {circle !== undefined && <circle cx={circle} cy={8} r={4} {...hollow} />}
    </g>
  );
  switch (head) {
    case 'none': return null;
    case 'arrow': return <path transform={tr(12, 7)} d="M1,1 L12,7 L1,13 z" fill={color} stroke={color} />;
    case 'open': return <path transform={tr(12, 7)} d="M1,1 L12,7 L1,13" fill="none" stroke={color} strokeWidth={1.5} />;
    case 'triangle': return <path transform={tr(12, 7)} d="M1,1 L12,7 L1,13 z" {...hollow} />;
    case 'diamond': return <path transform={tr(13, 7)} d="M1,7 L7,1 L13,7 L7,13 z" {...hollow} />;
    case 'filled-diamond': return <path transform={tr(13, 7)} d="M1,7 L7,1 L13,7 L7,13 z" fill={color} stroke={color} />;
    case 'circle': return <circle transform={tr(10, 7)} cx={7} cy={7} r={4} {...hollow} />;
    case 'dot': return <circle transform={tr(10, 7)} cx={7} cy={7} r={4} fill={color} />;
    case 'half': return <path transform={tr(12, 7)} d="M1,1 L12,7 L1,7" fill={color} stroke={color} />;
    case 'one': return ie(bar(14));
    case 'only-one': return ie(`${bar(16)} ${bar(11)}`);
    case 'zero-or-one': return ie(bar(16), 8);
    case 'many': return ie(FOOT);
    case 'one-or-many': return ie(`${FOOT} ${bar(6)}`);
    case 'zero-or-many': return ie(FOOT, 5.5);
  }
}

export function RelationSample({ rel, w = 104 }: { rel: RelationType; w?: number }) {
  const color = rel.color ?? 'currentColor';
  const y = 11, x0 = 6, x1 = w - 6;
  const dash = rel.line === 'dashed' ? '6 4' : rel.line === 'dotted' ? '1.5 3' : undefined;
  return (
    <svg className="docs-rel" width={w} height={22} viewBox={`0 0 ${w} 22`} aria-hidden="true" focusable="false">
      <path d={`M${x0},${y} H${x1}`} stroke={color} strokeWidth={1.5} strokeDasharray={dash} strokeLinecap="round" fill="none" />
      <g transform={`translate(${x0} ${y}) scale(-1 1)`}><Head head={rel.sourceHead ?? 'none'} color={color} /></g>
      <g transform={`translate(${x1} ${y})`}><Head head={rel.targetHead ?? 'arrow'} color={color} /></g>
    </svg>
  );
}

// ---------------------------------------------------------------- Piezas
function Fields({ fields }: { fields: FieldDef[] }) {
  const t = useT();
  const [lang] = useLang();
  if (!fields.length) return null;
  return (
    <details className="docs-ref__fields">
      <summary>{t('Campos ({n})', { n: fields.length })}</summary>
      <table>
        <thead><tr><th scope="col">{t('Campo')}</th><th scope="col">{t('Clave')}</th><th scope="col">{t('Clase de campo')}</th><th scope="col">{t('Valores')}</th></tr></thead>
        <tbody>
          {fields.map(f => (
            <tr key={f.key}>
              <td>{tIn(lang, f.label)}{f.required && <span className="docs-ref__req" title={t('Obligatorio')}> *</span>}{f.doc && <div className="docs-ref__fdoc">{localDoc(lang, f.doc)}</div>}</td>
              <td><code>{f.key}</code></td>
              <td>{f.kind}{(f.port ?? ['json', 'list', 'keyvalue'].includes(f.kind)) && <span className="docs-chip docs-chip--pin">{t('pin')}</span>}</td>
              <td>{f.options ? f.options.split(',').map(o => o.trim()).filter(Boolean).map(o => <code key={o} className="docs-ref__opt">{o}</code>) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function groupTypes(pack: NotationPack): { id: string; name: string; types: ElementType[] }[] {
  const cats = [...pack.categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const used = new Set<string>();
  const out = cats.map(c => {
    const types = pack.elementTypes.filter(e => !used.has(e.id) && (e.category === c.id || e.category === c.name));
    types.forEach(e => used.add(e.id));
    return { id: c.id, name: c.name, types };
  }).filter(g => g.types.length);
  const rest = pack.elementTypes.filter(e => !used.has(e.id));
  if (rest.length) out.push({ id: '_other', name: '', types: rest });
  return out;
}

function MatrixExplorer({ pack, reg }: { pack: NotationPack; reg: ReturnType<typeof createRegistry> }) {
  const t = useT();
  const types = pack.elementTypes.filter(e => !e.abstract);
  const groups = groupTypes({ ...pack, elementTypes: types });
  const firstPair = useMemo(() => {
    for (const s of types) for (const d of types) {
      if (s.id !== d.id && reg.allowedRelations(s.id, d.id).some(r => reg.relationType(r)?.notationId === pack.id)) return [s.id, d.id] as const;
    }
    return [types[0]?.id ?? '', types[1]?.id ?? types[0]?.id ?? ''] as const;
  }, [types, reg, pack.id]);
  const [src, setSrc] = useState<string>(firstPair[0]);
  const [dst, setDst] = useState<string>(firstPair[1]);
  if (types.length === 0) return null;
  const allowed = reg.allowedRelations(src, dst);
  const own = allowed.map(id => reg.relationType(id)).filter((r): r is RelationType => !!r && r.notationId === pack.id);
  const bridge = allowed.map(id => reg.relationType(id)).filter((r): r is RelationType => !!r && r.notationId !== pack.id);
  const nesting = reg.nestingRelations(src, dst).map(id => reg.relationType(id)).filter((r): r is RelationType => !!r);
  const name = (id: string) => reg.elementType(id)?.name ?? id;
  const select = (id: string, value: string, set: (v: string) => void, label: string) => (
    <label className="docs-matrix__pick" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={e => set(e.target.value)}>
        {groups.map(g => <optgroup key={g.id} label={g.name || t('Otros')}>{g.types.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup>)}
      </select>
    </label>
  );
  return (
    <section className="docs-matrix" aria-labelledby={`matrix-${pack.id}`}>
      <h3 id={`matrix-${pack.id}`} className="docs-ref__h">{t('¿Qué puedo conectar?')}</h3>
      <p className="docs-ref__lead">{pack.validity ? t('Elige un origen y un destino: verás las relaciones que permite la matriz de validez de esta notación.') : t('Esta notación no tiene matriz de validez: cualquier relación suya vale entre cualquier par de tipos.')}</p>
      <div className="docs-matrix__row">
        {select(`m-src-${pack.id}`, src, setSrc, t('Origen'))}
        <button type="button" className="docs-matrix__swap" onClick={() => { setSrc(dst); setDst(src); }} aria-label={t('Intercambiar origen y destino')} title={t('Intercambiar origen y destino')}><Icon name="swap" /></button>
        {select(`m-dst-${pack.id}`, dst, setDst, t('Destino'))}
      </div>
      <div className="docs-matrix__result" aria-live="polite">
        {own.length
          ? <ul className="docs-matrix__list">{own.map(r => <li key={r.id}><RelationSample rel={r} w={72} /><span><strong>{r.name}</strong> <code>{r.id}</code></span></li>)}</ul>
          : <p className="docs-matrix__none">{t('Ninguna relación de esta notación va de «{a}» a «{b}». Prueba en el otro sentido o usa una relación puente.', { a: name(src), b: name(dst) })}</p>}
        {bridge.length > 0 && <p className="docs-matrix__bridge">{t('Siempre disponibles (puente entre notaciones):')} {bridge.map(r => <span key={r.id} className="docs-chip">{r.name}</span>)}</p>}
        {nesting.length > 0 && <p className="docs-matrix__bridge">{t('Si metes «{b}» dentro de «{a}», se crea:', { a: name(src), b: name(dst) })} {nesting.map(r => <span key={r.id} className="docs-chip">{r.name}</span>)}</p>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Referencia de un pack
export function NotationRef({ packId }: { packId: string }) {
  const t = useT();
  const [lang] = useLang();
  const reg = useMemo(() => createRegistry(lang), [lang]);
  const pack = reg.pack(packId);
  if (!pack) return <p className="docs-ref__lead">{t('No existe la notación «{id}».', { id: packId })}</p>;
  const groups = groupTypes(pack);
  const relations = pack.relationTypes;
  return (
    <div className="docs-ref" data-pack={pack.id}>
      <p className="docs-ref__stats">
        <span className="docs-ref__swatch" style={{ background: pack.color }} aria-hidden="true" />
        <strong>{pack.name}</strong>
        <span>{t('{n} tipos', { n: pack.elementTypes.length })}</span>
        <span>{t('{n} relaciones', { n: relations.length })}</span>
        <span>{t('{n} viewpoints', { n: pack.viewpoints.length })}</span>
        <span><code>{pack.id}</code></span>
      </p>
      {pack.doc && <p className="docs-ref__lead">{localDoc(lang, pack.doc)}</p>}

      <h3 className="docs-ref__h">{t('Tipos de elemento')}</h3>
      {groups.length === 0 && <p className="docs-ref__lead">{t('Esta notación no tiene tipos propios: coloca en ella elementos de cualquier otra.')}</p>}
      {groups.map(g => (
        <div key={g.id} className="docs-ref__group">
          {g.name && <h4 className="docs-ref__cat">{g.name} <small>{g.types.length}</small></h4>}
          <ul className="docs-ref__types">
            {g.types.map(e => (
              <li key={e.id} className="docs-ref__type" id={`tipo-${e.id.replace(/[^\w-]/g, '-')}`}>
                <TypeFigure type={e} />
                <div className="docs-ref__body">
                  <p className="docs-ref__name"><strong>{e.name}</strong> <code>{e.id}</code>{e.container && <span className="docs-chip">{t('contenedor')}</span>}{e.abstract && <span className="docs-chip">{t('abstracto')}</span>}</p>
                  {e.doc && <p className="docs-ref__doc">{localDoc(lang, e.doc)}</p>}
                  <Fields fields={e.fields} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <h3 className="docs-ref__h">{t('Relaciones')}</h3>
      {relations.length === 0
        ? <p className="docs-ref__lead">{t('Sin relaciones propias: usa las del núcleo (enlace, traza, realiza, refina, flujo de datos).')}</p>
        : <ul className="docs-ref__rels">
            {relations.map(r => (
              <li key={r.id} className="docs-ref__rel">
                <RelationSample rel={r} />
                <div className="docs-ref__body">
                  <p className="docs-ref__name"><strong>{r.name}</strong> <code>{r.id}</code>{r.relationEnds && <span className="docs-chip">{t('une relaciones')}</span>}{pack.defaultRelation === r.id && <span className="docs-chip">{t('por defecto')}</span>}</p>
                  {r.doc && <p className="docs-ref__doc">{localDoc(lang, r.doc)}</p>}
                  <Fields fields={r.fields} />
                </div>
              </li>
            ))}
          </ul>}

      {pack.elementTypes.length > 0 && <MatrixExplorer key={`${pack.id}-${lang}`} pack={pack} reg={reg} />}

      <h3 className="docs-ref__h">{t('Viewpoints')}</h3>
      {pack.viewpoints.length === 0
        ? <p className="docs-ref__lead">{t('Esta notación no define viewpoints.')}</p>
        : <ul className="docs-ref__vps">
            {pack.viewpoints.map(v => (
              <li key={v.id}>
                <details>
                  <summary><strong>{v.name}</strong> <code>{v.id}</code> <small>{v.elementTypes.length ? t('{n} tipos', { n: v.elementTypes.length }) : t('todos los tipos')}</small></summary>
                  {v.doc && <p className="docs-ref__doc">{localDoc(lang, v.doc)}</p>}
                  {v.elementTypes.length > 0 && <p className="docs-ref__chips">{v.elementTypes.map(id => <span key={id} className="docs-chip">{reg.elementType(id)?.name ?? id}</span>)}</p>}
                </details>
              </li>
            ))}
          </ul>}
    </div>
  );
}

// ---------------------------------------------------------------- Índice de notaciones
export function NotationIndex() {
  const t = useT();
  const [lang] = useLang();
  const reg = useMemo(() => createRegistry(lang), [lang]);
  return (
    <ul className="docs-nindex">
      {PACKS.map(p => reg.pack(p.id)).filter((p): p is NotationPack => !!p).map(p => {
        const sample = groupTypes(p).flatMap(g => g.types.slice(0, 2)).slice(0, 3);
        return (
          <li key={p.id}>
            <a className="docs-nindex__item" href={docHref(`notaciones/${p.id}`)}>
              <span className="docs-nindex__figs" aria-hidden="true">
                {sample.length ? sample.map(e => <TypeFigure key={e.id} type={e} w={52} h={34} />) : <span className="docs-nindex__grid" style={{ borderColor: p.color }} />}
              </span>
              <span className="docs-nindex__text">
                <strong><span className="docs-ref__swatch" style={{ background: p.color }} aria-hidden="true" />{p.name}</strong>
                <small>{t('{a} tipos, {b} relaciones', { a: p.elementTypes.length, b: p.relationTypes.length })}</small>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

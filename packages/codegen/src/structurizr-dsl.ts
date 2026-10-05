/**
 * C4 / ArchiMate → Structurizr DSL (`structurizr-dsl`): un fichero `workspace.dsl`.
 *
 * C4:
 * - `person`, `softwareSystem`, `container` (dentro de su sistema) y `component` (dentro de su contenedor). El padre
 *   sale de `features.parentId` o del anidamiento de nodos (primero en la vista pedida, luego en cualquier vista).
 *   Contenedores sin sistema → sistema sintético "Sin sistema" (aviso); componentes sin contenedor, `c4:Code` y
 *   `c4:Boundary` → se omiten (aviso). `technology`, descripción (doc) y etiquetas (`External` si `fields.external`).
 * - Relaciones `c4:Relationship`/`c4:Uses`: `a -> b "descripción" "tecnología"`.
 * - Despliegue: `deploymentEnvironment` (de `props.environment` del nodo o de la vista; `Default`) con los
 *   `deploymentNode` anidados y `containerInstance`/`softwareSystemInstance` de los contenedores/sistemas anidados
 *   en ellos en alguna vista.
 * - Vistas según el viewpoint: `context` → `systemContext`, `container` → `container`, `component` → `component`,
 *   `deployment` → `deployment *`, el resto → `systemLandscape`; todas con `include *` y `autoLayout`.
 *
 * ArchiMate: actores, roles e interesados de negocio → `person`; componentes de aplicación → `softwareSystem`; el
 * resto → `element "<nombre>" "<tipo ArchiMate>"`. Relaciones con el tipo ArchiMate como descripción. Una vista
 * `custom` con `include *` por vista ArchiMate (Structurizr solo admite elementos personalizados en ellas; si hay
 * personas o sistemas se añade además una vista `systemLandscape`).
 *
 * Identificadores DSL: camelCase ASCII, únicos y sin palabras clave; comillas escapadas.
 */
import type { Element, Relation, View, ViewNode, Workspace } from '@all-draw/core';
import type { CodegenOptions, CodegenResult } from './types';
import { W, Warnings } from './warnings';
import { byId, byNameThenId, camelCase, containerOf, generatedBy, resolveElement, slug, str, uniqueName } from './util';

const C4 = {
  person: 'c4:Person', system: 'c4:SoftwareSystem', container: 'c4:Container', component: 'c4:Component',
  code: 'c4:Code', node: 'c4:DeploymentNode', boundary: 'c4:Boundary',
} as const;
const C4_RELS = new Set(['c4:Relationship', 'c4:Uses']);
const ARCHI_PEOPLE = new Set(['archimate:BusinessActor', 'archimate:BusinessRole', 'archimate:Stakeholder']);
const ARCHI_SYSTEMS = new Set(['archimate:ApplicationComponent']);
const KEYWORDS = new Set([
  'workspace', 'model', 'views', 'styles', 'person', 'softwaresystem', 'container', 'component', 'element', 'group', 'enterprise',
  'deploymentenvironment', 'deploymentnode', 'infrastructurenode', 'containerinstance', 'softwaresysteminstance', 'instanceof',
  'properties', 'perspectives', 'tags', 'tag', 'url', 'description', 'technology', 'this', 'include', 'exclude', 'autolayout',
  'theme', 'themes', 'branding', 'terminology', 'configuration', 'users', 'systemlandscape', 'systemcontext', 'deployment',
  'custom', 'dynamic', 'filtered', 'image', 'animation', 'title', 'default', 'docs', 'adrs', 'identifiers', 'impliedrelationships',
]);

const localType = (typeId: string) => typeId.slice(typeId.indexOf(':') + 1);
const q = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s*\n\s*/g, ' ').trim()}"`;
/** Argumentos posicionales: hasta el último no vacío, con `""` para los huecos. */
const args = (...xs: (string | undefined)[]): string => {
  let last = xs.length - 1;
  while (last >= 0 && !xs[last]) last--;
  return xs.slice(0, last + 1).map(x => q(x ?? '')).join(' ');
};

type Kind = 'person' | 'system' | 'container' | 'component' | 'element' | 'node';

export function generateStructurizrDsl(ws: Workspace, opts: CodegenOptions = {}): CodegenResult {
  const warnings = new Warnings();
  const accept = (el: Element) => el.typeId.startsWith('c4:') || el.typeId.startsWith('archimate:');
  let view: View | undefined;
  const allNodes = Object.values(ws.nodes).sort(byId);
  let elements: Element[];
  let relations: Relation[];
  if (opts.viewId) {
    view = ws.views[opts.viewId];
    if (!view) { warnings.add(W.viewMissing, { view: opts.viewId }); return { files: [], warnings: warnings.list }; }
    const vnodes = allNodes.filter(n => n.viewId === view!.id);
    const ids = new Set(vnodes.map(n => n.elementId).filter((x): x is string => !!x && !!ws.elements[x] && accept(ws.elements[x]!)));
    elements = [...ids].map(id => resolveElement(ws, ws.elements[id]!));
    relations = Object.values(ws.edges).filter(e => e.viewId === view!.id && e.relationId).map(e => ws.relations[e.relationId!]).filter((r): r is Relation => !!r);
  } else {
    elements = Object.values(ws.elements).filter(e => !e.template && accept(e)).map(e => resolveElement(ws, e));
    relations = Object.values(ws.relations);
  }
  relations = [...new Map(relations.filter(r => C4_RELS.has(r.typeId) || r.typeId.startsWith('archimate:')).map(r => [r.id, r] as const)).values()].sort(byId);
  // nodos: primero los de la vista pedida (su anidamiento manda), luego el resto
  const nodes: ViewNode[] = view ? [...allNodes.filter(n => n.viewId === view!.id), ...allNodes.filter(n => n.viewId !== view!.id)] : allNodes;
  const parentOf = (id: string, type: string) => containerOf(ws, nodes, id, e => e.typeId === type);

  // ---- ámbito: añade padres implícitos (sistema de un contenedor, contenedor de un componente, nodos de despliegue)
  const inScope = new Map(elements.map(e => [e.id, e] as const));
  const addParents = (el: Element) => {
    const t = el.typeId === C4.container ? C4.system : el.typeId === C4.component ? C4.container : el.typeId === C4.node ? C4.node : '';
    if (!t) return;
    const p = parentOf(el.id, t);
    if (p && !inScope.has(p.id)) { const r = resolveElement(ws, p); inScope.set(p.id, r); addParents(r); }
  };
  for (const el of [...inScope.values()]) addParents(el);
  const scopeEls = [...inScope.values()].sort(byNameThenId);
  if (!scopeEls.length) { warnings.add(W.nothing, { scope: view ? view.name || view.id : ws.meta.name || 'Sin nombre' }); return { files: [], warnings: warnings.list }; }

  // ---- clasificación e identificadores
  const kindOf = new Map<string, Kind>();
  for (const el of scopeEls) {
    const t = el.typeId;
    const k: Kind | null = t === C4.person || ARCHI_PEOPLE.has(t) ? 'person' : t === C4.system || ARCHI_SYSTEMS.has(t) ? 'system'
      : t === C4.container ? 'container' : t === C4.component ? 'component' : t === C4.node ? 'node'
      : t.startsWith('archimate:') ? 'element' : null;
    if (!k) { warnings.add(W.notExported, { name: el.name || el.id, type: t }); continue; }
    kindOf.set(el.id, k);
  }
  const usedIds = new Set<string>();
  const ident = new Map<string, string>();
  const identFor = (id: string, name: string) => {
    let base = camelCase(name) || 'elemento';
    if (/^[0-9]/.test(base)) base = 'e' + base;
    if (KEYWORDS.has(base.toLowerCase())) base += 'El';
    const v = uniqueName(base, usedIds);
    ident.set(id, v);
    return v;
  };
  const of = (k: Kind) => scopeEls.filter(e => kindOf.get(e.id) === k);
  const containersOf = new Map<string, Element[]>();
  const componentsOf = new Map<string, Element[]>();
  const SYNTH = '\u0000sin-sistema';
  for (const c of of('container')) {
    const sys = parentOf(c.id, C4.system);
    const key = sys && kindOf.get(sys.id) === 'system' ? sys.id : SYNTH;
    if (key === SYNTH) warnings.add(W.containerWithoutSystem, { name: c.name || c.id });
    (containersOf.get(key) ?? containersOf.set(key, []).get(key)!).push(c);
  }
  for (const k of of('component')) {
    const cont = parentOf(k.id, C4.container);
    if (!cont || kindOf.get(cont.id) !== 'container') { warnings.add(W.componentWithoutContainer, { name: k.name || k.id }); kindOf.delete(k.id); continue; }
    (componentsOf.get(cont.id) ?? componentsOf.set(cont.id, []).get(cont.id)!).push(k);
  }
  // identificadores en orden de declaración (estable)
  for (const p of of('person')) identFor(p.id, p.name || p.id);
  const systems = of('system');
  for (const s of systems) {
    identFor(s.id, s.name || s.id);
    for (const c of containersOf.get(s.id) ?? []) { identFor(c.id, c.name || c.id); for (const k of componentsOf.get(c.id) ?? []) identFor(k.id, k.name || k.id); }
  }
  if (containersOf.has(SYNTH)) {
    identFor(SYNTH, 'Sin sistema');
    for (const c of containersOf.get(SYNTH)!) { identFor(c.id, c.name || c.id); for (const k of componentsOf.get(c.id) ?? []) identFor(k.id, k.name || k.id); }
  }
  for (const e of of('element')) identFor(e.id, e.name || e.id);
  for (const n of of('node')) identFor(n.id, n.name || n.id);

  // ---- modelo
  const tagsOf = (el: Element): string => [...el.tags, ...(el.fields.external === true ? ['External'] : [])].filter((t, i, a) => a.indexOf(t) === i).join(',');
  const tech = (el: Element) => str(el.fields.technology).trim();
  const M: string[] = [];
  const I = (n: number) => '    '.repeat(n);
  for (const p of of('person')) M.push(`${I(2)}${ident.get(p.id)} = person ${args(p.name || p.id, p.doc.trim(), tagsOf(p))}`);
  const emitContainers = (sysKey: string) => {
    for (const c of (containersOf.get(sysKey) ?? []).sort(byNameThenId)) {
      const comps = (componentsOf.get(c.id) ?? []).sort(byNameThenId);
      const kindTag = str(c.fields.kind) && !c.tags.includes(str(c.fields.kind)) ? str(c.fields.kind) : '';
      const tags = [tagsOf(c), kindTag].filter(Boolean).join(',');
      const head = `${I(3)}${ident.get(c.id)} = container ${args(c.name || c.id, c.doc.trim(), tech(c), tags)}`;
      if (!comps.length) { M.push(head); continue; }
      M.push(`${head} {`);
      for (const k of comps) M.push(`${I(4)}${ident.get(k.id)} = component ${args(k.name || k.id, k.doc.trim(), tech(k), tagsOf(k))}`);
      M.push(`${I(3)}}`);
    }
  };
  for (const s of systems) {
    const head = `${I(2)}${ident.get(s.id)} = softwareSystem ${args(s.name || s.id, s.doc.trim(), tagsOf(s))}`;
    if (!containersOf.get(s.id)?.length) { M.push(head); continue; }
    M.push(`${head} {`);
    emitContainers(s.id);
    M.push(`${I(2)}}`);
  }
  if (containersOf.has(SYNTH)) {
    M.push(`${I(2)}${ident.get(SYNTH)} = softwareSystem ${args('Sin sistema', 'Contenedores que no están dentro de ningún sistema.')} {`);
    emitContainers(SYNTH);
    M.push(`${I(2)}}`);
  }
  for (const e of of('element')) M.push(`${I(2)}${ident.get(e.id)} = element ${args(e.name || e.id, localType(e.typeId), e.doc.trim(), e.tags.join(','))}`);

  // ---- relaciones
  const R: string[] = [];
  for (const r of relations) {
    const a = r.from.elementId, b = r.to.elementId;
    const ka = a ? kindOf.get(a) : undefined, kb = b ? kindOf.get(b) : undefined;
    if (!a || !b || !ka || !kb || ka === 'node' || kb === 'node' || !ident.has(a) || !ident.has(b)) {
      if (view || (a && b && inScope.has(a) && inScope.has(b))) warnings.add(W.relationSkipped, { id: r.id });
      continue;
    }
    if (r.typeId.startsWith('archimate:')) {
      const t = localType(r.typeId);
      R.push(`${I(2)}${ident.get(a)} -> ${ident.get(b)} ${args(r.name ? `${t}: ${r.name}` : t)}`);
    } else {
      R.push(`${I(2)}${ident.get(a)} -> ${ident.get(b)} ${args(r.name || str(r.fields.description).trim(), str(r.fields.technology).trim(), str(r.props.tags))}`);
    }
  }
  if (R.length) M.push('', ...R);

  // ---- despliegue
  const deploymentViews = Object.values(ws.views).filter(v => v.notationId === 'c4' && v.viewpointId === 'deployment');
  const envOf = (n: Element): string => {
    if (n.props.environment) return n.props.environment;
    const v = deploymentViews.find(dv => nodes.some(x => x.viewId === dv.id && x.elementId === n.id));
    return v?.props.environment || 'Default';
  };
  const dnodes = of('node');
  if (dnodes.length) {
    const byNode = new Map(nodes.map(n => [n.id, n] as const));
    const instances = new Map<string, { kind: 'containerInstance' | 'softwareSystemInstance'; id: string }[]>();
    for (const n of nodes) {
      if (!n.elementId || !n.parentNodeId) continue;
      const k = kindOf.get(n.elementId);
      if (k !== 'container' && k !== 'system') continue;
      const pe = byNode.get(n.parentNodeId)?.elementId;
      if (!pe || kindOf.get(pe) !== 'node') continue;
      const list = instances.get(pe) ?? instances.set(pe, []).get(pe)!;
      const kind = k === 'container' ? 'containerInstance' : 'softwareSystemInstance';
      if (!list.some(x => x.id === n.elementId)) list.push({ kind, id: n.elementId });
    }
    const children = new Map<string, Element[]>();
    const roots: Element[] = [];
    for (const n of dnodes) {
      const p = parentOf(n.id, C4.node);
      if (p && kindOf.get(p.id) === 'node' && p.id !== n.id) (children.get(p.id) ?? children.set(p.id, []).get(p.id)!).push(n);
      else roots.push(n);
    }
    const envs = new Map<string, Element[]>();
    for (const r of roots) (envs.get(envOf(r)) ?? envs.set(envOf(r), []).get(envOf(r))!).push(r);
    const emitNode = (n: Element, depth: number, seen: Set<string>) => {
      if (seen.has(n.id)) return;
      seen.add(n.id);
      const inst = Number(n.fields.instances);
      const parts = [n.name || n.id, n.doc.trim(), tech(n), tagsOf(n)];
      const head = `${I(depth)}${ident.get(n.id)} = deploymentNode ${Number.isFinite(inst) && inst > 1 ? `${parts.map(q).join(' ')} ${inst}` : args(...parts)}`;
      const kids = (children.get(n.id) ?? []).sort(byNameThenId);
      const insts = (instances.get(n.id) ?? []).sort((x, y) => (ident.get(x.id)! < ident.get(y.id)! ? -1 : 1));
      if (!kids.length && !insts.length) { M.push(head); return; }
      M.push(`${head} {`);
      for (const k of kids) emitNode(k, depth + 1, seen);
      for (const i of insts) M.push(`${I(depth + 1)}${i.kind} ${ident.get(i.id)}`);
      M.push(`${I(depth)}}`);
    };
    for (const [env, list] of [...envs.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      M.push('', `${I(2)}deploymentEnvironment ${q(env)} {`);
      const seen = new Set<string>();
      for (const r of list.sort(byNameThenId)) emitNode(r, 3, seen);
      M.push(`${I(2)}}`);
    }
  }

  // ---- vistas
  const V: string[] = [];
  const usedKeys = new Set<string>();
  const block = (head: string) => { V.push(`${I(2)}${head} {`, `${I(3)}include *`, `${I(3)}autoLayout`, `${I(2)}}`); };
  const keyFor = (base: string) => uniqueName(slug(base) || 'vista', usedKeys, '-');
  const inView = (v: View, k: Kind) => scopeEls.filter(e => kindOf.get(e.id) === k && nodes.some(n => n.viewId === v.id && n.elementId === e.id));
  const pick = (v: View, k: Kind, fromChildren?: { kind: Kind; parentType: string }): Element | undefined => {
    const root = v.rootElementId ? inScope.get(v.rootElementId) : undefined;
    if (root && kindOf.get(root.id) === k) return root;
    if (fromChildren) {
      for (const c of inView(v, fromChildren.kind)) { const p = parentOf(c.id, fromChildren.parentType); if (p && kindOf.get(p.id) === k) return inScope.get(p.id); }
    }
    const list = inView(v, k);
    return list.find(e => e.fields.external !== true) ?? list[0];
  };
  const views = view ? [view] : Object.values(ws.views).filter(v => v.notationId === 'c4' || v.notationId === 'archimate').sort((a, b) => byNameThenId({ name: a.name, id: a.id }, { name: b.name, id: b.id }));
  const landscape = (v: View | undefined) => block(`systemLandscape ${args(keyFor(v ? v.name || v.id : 'paisaje'), v?.name)}`);
  for (const v of views) {
    const title = v.name || v.id;
    if (v.notationId === 'archimate') {
      V.push(`${I(2)}custom ${args(keyFor(title), title)} {`, `${I(3)}include *`, `${I(3)}autoLayout`, `${I(2)}}`);
      if (inView(v, 'person').length || inView(v, 'system').length) landscape({ ...v, name: `${title} (personas y sistemas)` });
      continue;
    }
    switch (v.viewpointId) {
      case 'context': {
        const s = pick(v, 'system');
        if (s) block(`systemContext ${ident.get(s.id)} ${args(keyFor(title), title)}`);
        else { warnings.add(W.viewWithoutScope, { view: title, kind: 'sistema de software' }); landscape(v); }
        break;
      }
      case 'container': {
        const s = pick(v, 'system', { kind: 'container', parentType: C4.system });
        if (s) block(`container ${ident.get(s.id)} ${args(keyFor(title), title)}`);
        else { warnings.add(W.viewWithoutScope, { view: title, kind: 'sistema de software' }); landscape(v); }
        break;
      }
      case 'component': {
        const c = pick(v, 'container', { kind: 'component', parentType: C4.container });
        if (c) block(`component ${ident.get(c.id)} ${args(keyFor(title), title)}`);
        else { warnings.add(W.viewWithoutScope, { view: title, kind: 'contenedor' }); landscape(v); }
        break;
      }
      case 'deployment': {
        const n = inView(v, 'node')[0];
        const env = v.props.environment || (n ? envOf(n) : 'Default');
        block(`deployment * ${args(env, keyFor(title), title)}`);
        break;
      }
      default: landscape(v);
    }
  }
  if (!views.length) {
    if (scopeEls.some(e => e.typeId.startsWith('c4:') || ['person', 'system'].includes(kindOf.get(e.id) ?? ''))) landscape(undefined);
    if (of('element').length) V.push(`${I(2)}custom ${args(keyFor('archimate'), 'ArchiMate')} {`, `${I(3)}include *`, `${I(3)}autoLayout`, `${I(2)}}`);
  }
  const styles = [
    `${I(2)}styles {`,
    `${I(3)}element "Person" {`, `${I(4)}shape Person`, `${I(4)}background #08427b`, `${I(4)}color #ffffff`, `${I(3)}}`,
    `${I(3)}element "Software System" {`, `${I(4)}background #1168bd`, `${I(4)}color #ffffff`, `${I(3)}}`,
    `${I(3)}element "Container" {`, `${I(4)}background #438dd5`, `${I(4)}color #ffffff`, `${I(3)}}`,
    `${I(3)}element "Component" {`, `${I(4)}background #85bbf0`, `${I(4)}color #000000`, `${I(3)}}`,
    `${I(3)}element "External" {`, `${I(4)}background #999999`, `${I(4)}color #ffffff`, `${I(3)}}`,
    `${I(2)}}`,
  ];
  const content = [
    `// ${generatedBy(view ? view.name || view.id : ws.meta.name || 'Sin nombre')}`,
    `workspace ${args(ws.meta.name || 'Sin nombre', ws.meta.description.trim())} {`,
    '',
    `${I(1)}model {`,
    ...M,
    `${I(1)}}`,
    '',
    `${I(1)}views {`,
    ...V,
    ...(V.length ? [''] : []),
    ...styles,
    `${I(1)}}`,
    '}',
  ].join('\n') + '\n';
  return { files: [{ path: 'workspace.dsl', content, language: 'text' }], warnings: warnings.list };
}

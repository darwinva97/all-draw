/**
 * Espacio de ejemplo: "Alta de cliente" modelado en tres dimensiones (ArchiMate, BPMN, estados)
 * más una vista C4 y una rejilla capas×etapas; el mismo elemento aparece en varias.
 */
import { emptyWorkspace, makeElement, makeView, makeNode, makeRelation, makeEdge, type Workspace, type Element, type View } from '@all-draw/core';

export function demoWorkspace(): Workspace {
  const ws = emptyWorkspace('Demo · Alta de cliente');
  const el = (e: Element) => { ws.elements[e.id] = e; return e; };
  const vw = (v: View) => { ws.views[v.id] = v; return v; };
  const node = (viewId: string, e: Element | undefined, x: number, y: number, w = 160, h = 56, extra = {}) => { const n = makeNode(viewId, e?.id, { x, y, w, h }, extra); ws.nodes[n.id] = n; return n; };
  const rel = (typeId: string, a: Element, b: Element, name = '') => { const r = makeRelation(typeId, { elementId: a.id }, { elementId: b.id }, { name }); ws.relations[r.id] = r; return r; };
  const edge = (viewId: string, r: ReturnType<typeof rel>, a: ReturnType<typeof node>, b: ReturnType<typeof node>) => { const e = makeEdge(viewId, r.id, a.id, b.id); ws.edges[e.id] = e; return e; };

  // Modelo ArchiMate
  const cliente = el(makeElement('archimate:BusinessActor', 'Cliente'));
  const gestor = el(makeElement('archimate:BusinessRole', 'Gestor comercial'));
  const alta = el(makeElement('archimate:BusinessProcess', 'Alta de cliente', { doc: 'Proceso de incorporación de un cliente nuevo. Tiene vista BPMN y máquina de estados.' }));
  const servicio = el(makeElement('archimate:BusinessService', 'Servicio de onboarding'));
  const crm = el(makeElement('archimate:ApplicationComponent', 'CRM', { fields: {} }));
  const kyc = el(makeElement('archimate:ApplicationService', 'Verificación KYC'));
  const datos = el(makeElement('archimate:DataObject', 'Expediente de cliente'));
  const nodo = el(makeElement('archimate:Node', 'Clúster Kubernetes'));

  const vArchi = vw(makeView('Arquitectura · Alta de cliente', { notationId: 'archimate', viewpointId: 'layered', doc: 'Vista en capas del proceso de alta.' }));
  const nCliente = node(vArchi.id, cliente, 40, 40, 140, 56);
  const nGestor = node(vArchi.id, gestor, 240, 40, 140, 56);
  const nAlta = node(vArchi.id, alta, 140, 160, 180, 56);
  const nServ = node(vArchi.id, servicio, 400, 160, 180, 56);
  const nCrm = node(vArchi.id, crm, 140, 300, 160, 56);
  const nKyc = node(vArchi.id, kyc, 400, 300, 160, 56);
  const nDatos = node(vArchi.id, datos, 660, 300, 160, 56);
  const nNodo = node(vArchi.id, nodo, 140, 430, 160, 56);
  edge(vArchi.id, rel('archimate:Assignment', cliente, gestor), nCliente, nGestor);
  edge(vArchi.id, rel('archimate:Assignment', gestor, alta), nGestor, nAlta);
  edge(vArchi.id, rel('archimate:Realization', alta, servicio), nAlta, nServ);
  edge(vArchi.id, rel('archimate:Serving', crm, alta), nCrm, nAlta);
  edge(vArchi.id, rel('archimate:Serving', kyc, alta), nKyc, nAlta);
  edge(vArchi.id, rel('archimate:Access', alta, datos), nAlta, nDatos);
  edge(vArchi.id, rel('archimate:Realization', nodo, crm), nNodo, nCrm);

  // Dimensión BPMN del mismo proceso
  const vBpmn = vw(makeView('Alta de cliente · BPMN', { notationId: 'bpmn', rootElementId: alta.id }));
  const pool = el(makeElement('bpmn:Pool', 'Banco'));
  const laneG = el(makeElement('bpmn:Lane', 'Gestor'));
  const laneS = el(makeElement('bpmn:Lane', 'Sistemas'));
  const start = el(makeElement('bpmn:StartEvent', 'Solicitud recibida'));
  const t1 = el(makeElement('bpmn:Task', 'Recoger datos', { fields: { taskType: 'user' } }));
  const t2 = el(makeElement('bpmn:Task', 'Verificar identidad', { fields: { taskType: 'service' } }));
  const gw = el(makeElement('bpmn:ExclusiveGateway', '¿Verificado?'));
  const t3 = el(makeElement('bpmn:Task', 'Crear cuenta', { fields: { taskType: 'service' } }));
  const endOk = el(makeElement('bpmn:EndEvent', 'Cliente activo'));
  const endKo = el(makeElement('bpmn:EndEvent', 'Rechazado'));
  const nPool = node(vBpmn.id, pool, 20, 20, 900, 360);
  const nLaneG = node(vBpmn.id, laneG, 30, 0, 870, 180, { parentNodeId: nPool.id });
  const nLaneS = node(vBpmn.id, laneS, 30, 180, 870, 180, { parentNodeId: nPool.id });
  const nStart = node(vBpmn.id, start, 40, 70, 40, 40, { parentNodeId: nLaneG.id });
  const nT1 = node(vBpmn.id, t1, 130, 60, 140, 60, { parentNodeId: nLaneG.id });
  const nT2 = node(vBpmn.id, t2, 130, 60, 140, 60, { parentNodeId: nLaneS.id });
  const nGw = node(vBpmn.id, gw, 330, 60, 50, 50, { parentNodeId: nLaneS.id });
  const nT3 = node(vBpmn.id, t3, 450, 60, 140, 60, { parentNodeId: nLaneS.id });
  const nEndOk = node(vBpmn.id, endOk, 660, 70, 40, 40, { parentNodeId: nLaneS.id });
  const nEndKo = node(vBpmn.id, endKo, 450, 70, 40, 40, { parentNodeId: nLaneG.id });
  edge(vBpmn.id, rel('bpmn:SequenceFlow', start, t1), nStart, nT1);
  edge(vBpmn.id, rel('bpmn:SequenceFlow', t1, t2), nT1, nT2);
  edge(vBpmn.id, rel('bpmn:SequenceFlow', t2, gw), nT2, nGw);
  edge(vBpmn.id, rel('bpmn:SequenceFlow', gw, t3, 'sí'), nGw, nT3);
  edge(vBpmn.id, rel('bpmn:SequenceFlow', gw, endKo, 'no'), nGw, nEndKo);
  edge(vBpmn.id, rel('bpmn:SequenceFlow', t3, endOk), nT3, nEndOk);
  // Trazabilidad entre dimensiones: la tarea "Verificar identidad" realiza el servicio KYC
  rel('core:trace', t2, kyc, 'usa');
  rel('core:trace', t3, crm, 'crea en');

  // Dimensión máquina de estados del mismo proceso
  const vSt = vw(makeView('Alta de cliente · Estados', { notationId: 'statechart', rootElementId: alta.id }));
  const sInit = el(makeElement('statechart:Initial', ''));
  const sPend = el(makeElement('statechart:State', 'Pendiente'));
  const sVer = el(makeElement('statechart:State', 'En verificación', { fields: { entry: 'lanzar KYC' } }));
  const sAct = el(makeElement('statechart:State', 'Activo'));
  const sRej = el(makeElement('statechart:State', 'Rechazado'));
  const sFin = el(makeElement('statechart:Final', ''));
  const nI = node(vSt.id, sInit, 40, 60, 24, 24);
  const nP = node(vSt.id, sPend, 120, 44, 140, 56);
  const nV = node(vSt.id, sVer, 320, 44, 160, 56);
  const nA = node(vSt.id, sAct, 560, 0, 140, 56);
  const nR = node(vSt.id, sRej, 560, 110, 140, 56);
  const nF = node(vSt.id, sFin, 760, 16, 28, 28);
  const tr = (a: Element, b: Element, event: string, guard = '') => { const r = makeRelation('statechart:Transition', { elementId: a.id }, { elementId: b.id }, { fields: { event, guard } }); ws.relations[r.id] = r; return r; };
  edge(vSt.id, tr(sInit, sPend, ''), nI, nP);
  edge(vSt.id, tr(sPend, sVer, 'datos completos'), nP, nV);
  edge(vSt.id, tr(sVer, sAct, 'kyc ok'), nV, nA);
  edge(vSt.id, tr(sVer, sRej, 'kyc ko'), nV, nR);
  edge(vSt.id, tr(sAct, sFin, ''), nA, nF);

  // Vista C4 del CRM
  const vC4 = vw(makeView('CRM · Contenedores', { notationId: 'c4', viewpointId: 'container', rootElementId: crm.id }));
  const c4sys = el(makeElement('c4:SoftwareSystem', 'CRM'));
  const c4web = el(makeElement('c4:Container', 'Portal del gestor', { fields: { technology: 'React', kind: 'browser' } }));
  const c4api = el(makeElement('c4:Container', 'API de clientes', { fields: { technology: 'Node.js', kind: 'microservice', contract: '' } }));
  const c4db = el(makeElement('c4:Container', 'Base de datos', { fields: { technology: 'Postgres', kind: 'database' } }));
  const c4kyc = el(makeElement('c4:SoftwareSystem', 'Proveedor KYC', { fields: { external: true } }));
  rel('core:trace', c4sys, crm, 'es');
  rel('core:trace', c4kyc, kyc, 'provee');
  const nSys = node(vC4.id, c4sys, 40, 40, 560, 300);
  const nWeb = node(vC4.id, c4web, 30, 60, 160, 70, { parentNodeId: nSys.id });
  const nApi = node(vC4.id, c4api, 230, 60, 160, 70, { parentNodeId: nSys.id });
  const nDb = node(vC4.id, c4db, 230, 190, 160, 70, { parentNodeId: nSys.id });
  const nKycS = node(vC4.id, c4kyc, 680, 80, 160, 70);
  const nGestorC4 = node(vC4.id, gestor, 40, 400, 140, 56); // el mismo rol ArchiMate, en la vista C4 (atenuado)
  edge(vC4.id, rel('c4:Relationship', c4web, c4api, 'JSON/HTTPS'), nWeb, nApi);
  edge(vC4.id, rel('c4:Relationship', c4api, c4db, 'SQL'), nApi, nDb);
  edge(vC4.id, rel('c4:Relationship', c4api, c4kyc, 'REST'), nApi, nKycS);
  edge(vC4.id, rel('core:link', gestor, c4web, 'usa'), nGestorC4, nWeb);

  // Rejilla capas × etapas con pines
  const vGrid = vw(makeView('Mapa capas × etapas', { notationId: 'grid', kind: 'grid', grid: {
    layers: [{ id: 'ly_neg', name: 'Negocio', color: '#fef3c7' }, { id: 'ly_app', name: 'Aplicación', color: '#dbeafe' }, { id: 'ly_tec', name: 'Tecnología', color: '#d1fae5' }],
    stages: [{ id: 'st_1', name: 'Captación' }, { id: 'st_2', name: 'Alta' }, { id: 'st_3', name: 'Operación' }], stageGroups: [] } }));
  ws.libraries['lib_demo'] = { id: 'lib_demo', name: 'Sistemas', description: '', notations: [], portTypes: [], relationTypes: [], elementTypes: [
    { id: 'lib:lib_demo:svc', name: 'Microservicio', color: '#c7d2fe', icon: '⚙', category: 'Sistemas', fields: [{ key: 'repo', label: 'Repositorio', kind: 'url' }, { key: 'response', label: 'Respuesta', kind: 'json' }, { key: 'request', label: 'Petición', kind: 'json' }] },
  ] };
  const svcA = el(makeElement('lib:lib_demo:svc', 'clientes-api', { libraryId: 'lib_demo', fields: { repo: 'https://github.com/acme/clientes-api', response: '{"cliente":{"id":"c-1","email":"ana@acme.com","estado":"activo"}}' } }));
  const svcB = el(makeElement('lib:lib_demo:svc', 'notificaciones', { libraryId: 'lib_demo', fields: { request: '{"destinatario":"ana@acme.com","plantilla":"bienvenida"}' } }));
  const gAlta = node(vGrid.id, alta, 20, 20, 180, 56, { cell: { layerId: 'ly_neg', stageId: 'st_2' } });
  const gCrm = node(vGrid.id, crm, 20, 20, 160, 56, { cell: { layerId: 'ly_app', stageId: 'st_2' } });
  const gA = node(vGrid.id, svcA, 20, 90, 170, 56, { cell: { layerId: 'ly_app', stageId: 'st_2' }, style: { showPorts: true, visiblePorts: ['response.cliente.email'] } });
  const gB = node(vGrid.id, svcB, 20, 20, 170, 56, { cell: { layerId: 'ly_app', stageId: 'st_3' }, style: { showPorts: true, visiblePorts: ['request.destinatario'] } });
  node(vGrid.id, nodo, 20, 20, 160, 56, { cell: { layerId: 'ly_tec', stageId: 'st_2' } });
  node(vGrid.id, cliente, 20, 20, 140, 56, { cell: { layerId: 'ly_neg', stageId: 'st_1' } });
  edge(vGrid.id, rel('core:link', crm, svcA, 'expone'), gCrm, gA);
  const pinRel = makeRelation('core:flow', { elementId: svcA.id, portId: `${svcA.id}#response.cliente.email` }, { elementId: svcB.id, portId: `${svcB.id}#request.destinatario` }, { name: 'email', mappings: [{ fromPath: 'response.cliente.email', toPath: 'request.destinatario' }] });
  ws.relations[pinRel.id] = pinRel;
  const pe = makeEdge(vGrid.id, pinRel.id, gA.id, gB.id, { fromPortId: pinRel.from.portId, toPortId: pinRel.to.portId });
  ws.edges[pe.id] = pe;
  void gAlta;

  // Diagrama de secuencia del alta (líneas de vida en columnas; mensajes por `order` y altura `bendpoints[0].y`)
  const vSeq = vw(makeView('Alta de cliente · Secuencia', { notationId: 'sequence', kind: 'sequence', rootElementId: alta.id, doc: 'Interacción entre el cliente, el portal, la API y la base de datos al dar de alta un cliente.' }));
  const lCliente = el(makeElement('sequence:Lifeline', 'Cliente', { fields: { kind: 'actor' } }));
  const lPortal = el(makeElement('sequence:Lifeline', 'Portal', { fields: { kind: 'boundary', type: 'Web' } }));
  const lApi = el(makeElement('sequence:Lifeline', 'API de clientes', { fields: { kind: 'control' } }));
  const lDb = el(makeElement('sequence:Lifeline', 'Base de datos', { fields: { kind: 'database', type: 'Postgres' } }));
  const fAlt = el(makeElement('sequence:Fragment', 'alt', { fields: { kind: 'alt', condition: '[no existe el email]' } }));
  const actApi = el(makeElement('sequence:Activation', 'Procesar alta', { fields: { label: 'procesar alta' } }));
  rel('core:trace', lApi, c4api, 'es');
  rel('core:trace', lDb, c4db, 'es');
  const sCliente = node(vSeq.id, lCliente, 40, 0, 140, 60);
  const sPortal = node(vSeq.id, lPortal, 260, 0, 140, 60);
  const sApi = node(vSeq.id, lApi, 480, 0, 140, 60);
  const sDb = node(vSeq.id, lDb, 700, 0, 140, 60);
  node(vSeq.id, fAlt, 440, 250, 460, 120);
  node(vSeq.id, actApi, 64, 150, 12, 300, { parentNodeId: sApi.id });
  const msg = (a: Element, b: Element, order: number, text: string, kind = 'sync') => { const r = makeRelation('sequence:Message', { elementId: a.id }, { elementId: b.id }, { fields: { kind, order, text } }); ws.relations[r.id] = r; return r; };
  const at = (viewId: string, r: ReturnType<typeof rel>, a: ReturnType<typeof node>, b: ReturnType<typeof node>, y: number) => { const e = makeEdge(viewId, r.id, a.id, b.id, { bendpoints: [{ x: 0, y }] }); ws.edges[e.id] = e; return e; };
  at(vSeq.id, msg(lCliente, lPortal, 1, 'rellena el formulario'), sCliente, sPortal, 110);
  at(vSeq.id, msg(lPortal, lApi, 2, 'POST /clientes'), sPortal, sApi, 150);
  at(vSeq.id, msg(lApi, lDb, 3, 'buscar por email'), sApi, sDb, 200);
  const ret = makeRelation('sequence:Return', { elementId: lDb.id }, { elementId: lApi.id }, { fields: { order: 4, text: 'ninguno' } }); ws.relations[ret.id] = ret;
  at(vSeq.id, ret, sDb, sApi, 236);
  at(vSeq.id, msg(lApi, lDb, 5, 'INSERT cliente'), sApi, sDb, 300);
  at(vSeq.id, msg(lApi, lPortal, 6, '201 Created', 'async'), sApi, sPortal, 410);
  at(vSeq.id, msg(lPortal, lCliente, 7, 'muestra la confirmación'), sPortal, sCliente, 450);

  // Drill-down explícito y dimensiones
  nAlta.detailViewId = vBpmn.id;
  nCrm.detailViewId = vC4.id;
  ws.dimensions['dim_archi'] = { id: 'dim_archi', name: 'Arquitectura', notationId: 'archimate', color: '#ca8a04' };
  ws.dimensions['dim_bpmn'] = { id: 'dim_bpmn', name: 'Proceso (BPMN)', notationId: 'bpmn', color: '#16a34a' };
  ws.dimensions['dim_st'] = { id: 'dim_st', name: 'Estados', notationId: 'statechart', color: '#7c3aed' };
  ws.dimensions['dim_c4'] = { id: 'dim_c4', name: 'C4', notationId: 'c4', color: '#1168bd' };
  ws.dimensions['dim_grid'] = { id: 'dim_grid', name: 'Capas × etapas', notationId: 'grid', kind: 'grid', color: '#0ea5e9' };
  ws.dimensions['dim_seq'] = { id: 'dim_seq', name: 'Secuencia', notationId: 'sequence', kind: 'sequence', color: '#db2777' };
  ws.rules['rule_ext'] = { id: 'rule_ext', name: 'Externos en gris', enabled: true, priority: 1, match: 'all', target: 'element', conditions: [{ source: 'field', key: 'external', op: 'eq', value: 'true' }], style: { bg: '#e5e7eb', text: '#374151' } };
  ws.rules['rule_svc'] = { id: 'rule_svc', name: 'Servicios sin repo', enabled: true, priority: 2, match: 'all', target: 'element', conditions: [{ source: 'type', op: 'eq', value: 'Microservicio' }, { source: 'field', key: 'repo', op: 'empty' }], style: { border: '#dc2626', borderStyle: 'dashed', badge: '#dc2626', badgeText: '!' } };
  ws.meta.currentViewId = vArchi.id;
  return ws;
}

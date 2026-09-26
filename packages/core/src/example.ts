/** Ejemplo mínimo: un elemento en dos vistas de dos notaciones distintas. */
import { emptyWorkspace, type Workspace } from './model';

export function exampleWorkspace(): Workspace {
  const ws = emptyWorkspace('Ejemplo');
  ws.meta.schemaVersion = 1;
  ws.elements['el_alta'] = { id: 'el_alta', typeId: 'freeform:box', name: 'Proceso de alta', doc: '', fields: {}, ports: [], profiles: [], props: {}, features: {}, tags: [] };
  ws.elements['el_crm'] = { id: 'el_crm', typeId: 'freeform:box', name: 'CRM', doc: '', fields: { api: '{"cliente":{"id":1,"email":"a@b.c"}}' }, ports: [], profiles: [], props: {}, features: {}, tags: [] };
  ws.views['vw_1'] = { id: 'vw_1', kind: 'freeform', notationId: 'freeform', name: 'Mapa', doc: '', style: {}, props: {} };
  ws.views['vw_2'] = { id: 'vw_2', kind: 'freeform', notationId: 'freeform', name: 'Detalle del alta', doc: '', rootElementId: 'el_alta', style: {}, props: {} };
  ws.nodes['vn_1'] = { id: 'vn_1', viewId: 'vw_1', elementId: 'el_alta', x: 40, y: 40, w: 180, h: 60, style: {}, detailViewId: 'vw_2' };
  ws.nodes['vn_2'] = { id: 'vn_2', viewId: 'vw_1', elementId: 'el_crm', x: 320, y: 40, w: 180, h: 60, style: {} };
  ws.nodes['vn_3'] = { id: 'vn_3', viewId: 'vw_2', elementId: 'el_alta', x: 40, y: 40, w: 180, h: 60, style: {} };
  ws.relations['rel_1'] = { id: 'rel_1', typeId: 'core:link', name: 'usa', doc: '', from: { elementId: 'el_alta' }, to: { elementId: 'el_crm' }, mappings: [], fields: {}, props: {}, features: {} };
  ws.edges['ve_1'] = { id: 've_1', viewId: 'vw_1', relationId: 'rel_1', fromNodeId: 'vn_1', toNodeId: 'vn_2', bendpoints: [], style: {} };
  ws.dimensions['dim_free'] = { id: 'dim_free', name: 'Libre', notationId: 'freeform' };
  return ws;
}

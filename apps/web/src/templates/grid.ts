import { newId } from '@all-draw/core';
import { kit, type Tr } from './kit';

/** Mapa capas × etapas con pines: servicios con datos JSON cuyos campos se conectan (el email viaja de un servicio a otro). */
export function gridTemplate(t: Tr) {
  const k = kit(t('Mapa capas × etapas'));
  const ly = { neg: newId('ly'), app: newId('ly'), tec: newId('ly') };
  const st = { a: newId('st'), b: newId('st'), c: newId('st') };
  const v = k.view(t('Mapa capas × etapas'), { notationId: 'grid', kind: 'grid', grid: {
    layers: [{ id: ly.neg, name: t('Negocio'), color: '#fef3c7' }, { id: ly.app, name: t('Aplicación'), color: '#dbeafe' }, { id: ly.tec, name: t('Tecnología'), color: '#d1fae5' }],
    stages: [{ id: st.a, name: t('Descubrir') }, { id: st.b, name: t('Comprar') }, { id: st.c, name: t('Recibir') }], stageGroups: [] } });
  const libId = newId('lib');
  const svcType = `lib:${libId}:svc`;
  k.ws.libraries[libId] = { id: libId, name: t('Servicios'), description: '', notations: [], portTypes: [], relationTypes: [], elementTypes: [
    { id: svcType, name: t('Microservicio'), color: '#c7d2fe', category: t('Servicios'), fields: [{ key: 'repo', label: t('Repositorio'), kind: 'url' }, { key: 'response', label: t('Respuesta'), kind: 'json' }, { key: 'request', label: t('Petición'), kind: 'json' }] },
  ] };
  const cell = (layerId: string, stageId: string) => ({ cell: { layerId, stageId } });
  k.node(v, k.el('archimate:BusinessProcess', t('Buscar producto')), 20, 20, 170, 56, cell(ly.neg, st.a));
  k.node(v, k.el('archimate:BusinessProcess', t('Pagar')), 20, 20, 150, 56, cell(ly.neg, st.b));
  k.node(v, k.el('archimate:BusinessProcess', t('Seguir el envío')), 20, 20, 170, 56, cell(ly.neg, st.c));
  const web = k.node(v, k.el('archimate:ApplicationComponent', t('Tienda web')), 20, 20, 160, 56, cell(ly.app, st.a));
  const pedidos = k.el(svcType, 'pedidos-api', { libraryId: libId, fields: { repo: 'https://example.com/pedidos-api', response: '{"pedido":{"id":"p-1","email":"ana@example.com","total":42}}' } });
  const avisos = k.el(svcType, 'avisos', { libraryId: libId, fields: { request: '{"destinatario":"ana@example.com","plantilla":"envio"}' } });
  const nPed = k.node(v, pedidos, 20, 20, 170, 56, { ...cell(ly.app, st.b), style: { showPorts: true, visiblePorts: ['response.pedido.email'] } });
  const nAv = k.node(v, avisos, 20, 20, 170, 56, { ...cell(ly.app, st.c), style: { showPorts: true, visiblePorts: ['request.destinatario'] } });
  k.node(v, k.el('archimate:Node', t('Clúster')), 20, 20, 150, 56, cell(ly.tec, st.b));
  k.link(v, 'core:link', web, nPed, { name: t('crea') });
  // Relación de datos entre pines: response.pedido.email → request.destinatario.
  const r = k.rel('core:flow', pedidos, avisos, { name: 'email', mappings: [{ fromPath: 'response.pedido.email', toPath: 'request.destinatario' }] });
  r.from.portId = `${pedidos.id}#response.pedido.email`;
  r.to.portId = `${avisos.id}#request.destinatario`;
  k.edge(v, r, nPed, nAv, { fromPortId: r.from.portId, toPortId: r.to.portId });
  return k.done(v);
}

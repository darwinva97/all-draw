import { kit, type Tr } from './kit';

/** Proceso BPMN: un pedido con dos carriles, una decisión y dos finales. */
export function bpmnTemplate(t: Tr) {
  const k = kit(t('Proceso de pedido'));
  const v = k.view(t('Proceso de pedido'), { notationId: 'bpmn', viewpointId: 'process' });
  const pool = k.node(v, k.el('bpmn:Pool', t('Tienda online')), 20, 20, 940, 340);
  const laneA = k.node(v, k.el('bpmn:Lane', t('Ventas')), 30, 0, 910, 170, { parentNodeId: pool.id });
  const laneB = k.node(v, k.el('bpmn:Lane', t('Almacén')), 30, 170, 910, 170, { parentNodeId: pool.id });
  const start = k.node(v, k.el('bpmn:StartEvent', t('Pedido recibido')), 40, 65, 40, 40, { parentNodeId: laneA.id });
  const check = k.node(v, k.el('bpmn:Task', t('Comprobar stock'), { fields: { taskType: 'service' } }), 130, 55, 140, 60, { parentNodeId: laneA.id });
  const gw = k.node(v, k.el('bpmn:ExclusiveGateway', t('¿Hay stock?')), 330, 60, 50, 50, { parentNodeId: laneA.id });
  const notify = k.node(v, k.el('bpmn:Task', t('Avisar del retraso'), { fields: { taskType: 'send' } }), 450, 55, 140, 60, { parentNodeId: laneA.id });
  const endLate = k.node(v, k.el('bpmn:EndEvent', t('Cliente avisado')), 680, 65, 40, 40, { parentNodeId: laneA.id });
  const pack = k.node(v, k.el('bpmn:Task', t('Preparar el envío'), { fields: { taskType: 'user' } }), 450, 55, 140, 60, { parentNodeId: laneB.id });
  const ship = k.node(v, k.el('bpmn:Task', t('Entregar al transportista'), { fields: { taskType: 'manual' } }), 640, 55, 150, 60, { parentNodeId: laneB.id });
  const endOk = k.node(v, k.el('bpmn:EndEvent', t('Pedido enviado')), 850, 65, 40, 40, { parentNodeId: laneB.id });
  const flow = 'bpmn:SequenceFlow';
  k.link(v, flow, start, check);
  k.link(v, flow, check, gw);
  k.link(v, flow, gw, pack, { name: t('sí') });
  k.link(v, flow, gw, notify, { name: t('no') });
  k.link(v, flow, notify, endLate);
  k.link(v, flow, pack, ship);
  k.link(v, flow, ship, endOk);
  return k.done(v);
}

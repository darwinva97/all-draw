import { describe, it, expect } from 'vitest';
import { MemoryStore, NotationRegistry, CORE_PACK, validate, parseWorkspace, type Workspace } from '@all-draw/core';
import { BPMN_PACK } from '@all-draw/notation-bpmn';
import { importBpmn, exportBpmn } from '../src';

/**
 * Colaboración realista: pool "Tienda" con 2 lanes (Ventas, Almacén), inicio → tarea de usuario →
 * compuerta exclusiva → tarea de servicio (con temporizador de borde) / subproceso colapsado (con
 * su propio diagrama) → fines; flujo de mensaje a un participante colapsado "Cliente"; objeto de
 * datos con entrada y salida; anotación; extensiones camunda y colores bioc.
 */
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:camunda="http://camunda.org/schema/1.0/bpmn" xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0"
  id="Definitions_Pedido" targetNamespace="http://bezenti.com/bpmn" exporter="Camunda Modeler" exporterVersion="5.0.0">
  <bpmn:message id="Message_Pedido" name="Pedido confirmado" />
  <bpmn:error id="Error_Stock" name="Sin stock" errorCode="E_STOCK" />
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Participant_Tienda" name="Tienda" processRef="Process_Tienda" />
    <bpmn:participant id="Participant_Cliente" name="Cliente" />
    <bpmn:messageFlow id="Flow_Msg" name="Confirmación" sourceRef="Task_Notificar" targetRef="Participant_Cliente" messageRef="Message_Pedido" />
    <bpmn:textAnnotation id="Annotation_1"><bpmn:text>Cliente externo (caja negra)</bpmn:text></bpmn:textAnnotation>
    <bpmn:association id="Association_1" associationDirection="None" sourceRef="Annotation_1" targetRef="Participant_Cliente" />
  </bpmn:collaboration>
  <bpmn:process id="Process_Tienda" name="Tramitar pedido" isExecutable="true">
    <bpmn:documentation>Proceso principal de la tienda.</bpmn:documentation>
    <bpmn:extensionElements>
      <camunda:properties><camunda:property name="owner" value="ventas" /></camunda:properties>
    </bpmn:extensionElements>
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_Ventas" name="Ventas">
        <bpmn:flowNodeRef>Start_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Revisar</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gateway_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>End_Rechazado</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_Almacen" name="Almacén">
        <bpmn:flowNodeRef>Task_Notificar</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Boundary_Timer</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Sub_Envio</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>End_OK</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="Start_1" name="Pedido recibido">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
      <bpmn:messageEventDefinition id="MsgDef_Start" messageRef="Message_Pedido" />
    </bpmn:startEvent>
    <bpmn:userTask id="Task_Revisar" name="Revisar pedido" camunda:assignee="ana">
      <bpmn:documentation>Comprueba stock y datos.</bpmn:documentation>
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
      <bpmn:property id="Property_Revisar" name="__targetRef_placeholder" />
      <bpmn:dataInputAssociation id="DataIn_1"><bpmn:sourceRef>DataObjectRef_Pedido</bpmn:sourceRef><bpmn:targetRef>Property_Revisar</bpmn:targetRef></bpmn:dataInputAssociation>
      <bpmn:multiInstanceLoopCharacteristics isSequential="true" />
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="Gateway_1" name="¿Válido?" default="Flow_No">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_Si</bpmn:outgoing>
      <bpmn:outgoing>Flow_No</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:serviceTask id="Task_Notificar" name="Notificar cliente" camunda:type="external" camunda:topic="mail">
      <bpmn:incoming>Flow_Si</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
      <bpmn:dataOutputAssociation id="DataOut_1"><bpmn:targetRef>DataObjectRef_Pedido</bpmn:targetRef></bpmn:dataOutputAssociation>
    </bpmn:serviceTask>
    <bpmn:boundaryEvent id="Boundary_Timer" name="24 h" cancelActivity="false" attachedToRef="Task_Notificar">
      <bpmn:outgoing>Flow_Timeout</bpmn:outgoing>
      <bpmn:timerEventDefinition id="TimerDef_1"><bpmn:timeDuration xsi:type="bpmn:tFormalExpression" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">PT24H</bpmn:timeDuration></bpmn:timerEventDefinition>
    </bpmn:boundaryEvent>
    <bpmn:subProcess id="Sub_Envio" name="Preparar envío">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:incoming>Flow_Timeout</bpmn:incoming>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
      <bpmn:startEvent id="Sub_Start"><bpmn:outgoing>Sub_Flow_1</bpmn:outgoing></bpmn:startEvent>
      <bpmn:scriptTask id="Sub_Task" name="Generar etiqueta"><bpmn:incoming>Sub_Flow_1</bpmn:incoming><bpmn:outgoing>Sub_Flow_2</bpmn:outgoing></bpmn:scriptTask>
      <bpmn:endEvent id="Sub_End"><bpmn:incoming>Sub_Flow_2</bpmn:incoming><bpmn:errorEventDefinition id="ErrDef_1" errorRef="Error_Stock" /></bpmn:endEvent>
      <bpmn:sequenceFlow id="Sub_Flow_1" sourceRef="Sub_Start" targetRef="Sub_Task" />
      <bpmn:sequenceFlow id="Sub_Flow_2" sourceRef="Sub_Task" targetRef="Sub_End" />
    </bpmn:subProcess>
    <bpmn:endEvent id="End_OK" name="Pedido enviado"><bpmn:incoming>Flow_4</bpmn:incoming></bpmn:endEvent>
    <bpmn:endEvent id="End_Rechazado" name="Rechazado"><bpmn:incoming>Flow_No</bpmn:incoming><bpmn:terminateEventDefinition id="TermDef_1" /></bpmn:endEvent>
    <bpmn:dataObjectReference id="DataObjectRef_Pedido" name="Pedido" dataObjectRef="DataObject_Pedido"><bpmn:dataState id="State_1" name="validado" /></bpmn:dataObjectReference>
    <bpmn:dataObject id="DataObject_Pedido" isCollection="false" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_Revisar" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_Revisar" targetRef="Gateway_1" />
    <bpmn:sequenceFlow id="Flow_Si" name="sí" sourceRef="Gateway_1" targetRef="Task_Notificar">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\${valido}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_No" name="no" sourceRef="Gateway_1" targetRef="End_Rechazado" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_Notificar" targetRef="Sub_Envio" />
    <bpmn:sequenceFlow id="Flow_Timeout" sourceRef="Boundary_Timer" targetRef="Sub_Envio" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Sub_Envio" targetRef="End_OK" />
    <bpmn:textAnnotation id="Annotation_2"><bpmn:text>Revisión manual</bpmn:text></bpmn:textAnnotation>
    <bpmn:association id="Association_2" sourceRef="Annotation_2" targetRef="Task_Revisar" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1" name="Colaboración">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Participant_Tienda_di" bpmnElement="Participant_Tienda" isHorizontal="true"><dc:Bounds x="100" y="100" width="1000" height="400" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Ventas_di" bpmnElement="Lane_Ventas" isHorizontal="true"><dc:Bounds x="130" y="100" width="970" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Almacen_di" bpmnElement="Lane_Almacen" isHorizontal="true"><dc:Bounds x="130" y="300" width="970" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1"><dc:Bounds x="180" y="180" width="36" height="36" /><bpmndi:BPMNLabel><dc:Bounds x="160" y="220" width="76" height="14" /></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Revisar_di" bpmnElement="Task_Revisar" bioc:stroke="#0d4372" bioc:fill="#bbdefb"><dc:Bounds x="270" y="158" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_1_di" bpmnElement="Gateway_1" isMarkerVisible="true"><dc:Bounds x="425" y="173" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Rechazado_di" bpmnElement="End_Rechazado"><dc:Bounds x="632" y="180" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Notificar_di" bpmnElement="Task_Notificar"><dc:Bounds x="400" y="360" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Boundary_Timer_di" bpmnElement="Boundary_Timer"><dc:Bounds x="462" y="422" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sub_Envio_di" bpmnElement="Sub_Envio" isExpanded="false"><dc:Bounds x="600" y="360" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_OK_di" bpmnElement="End_OK"><dc:Bounds x="782" y="382" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="DataObjectRef_Pedido_di" bpmnElement="DataObjectRef_Pedido"><dc:Bounds x="302" y="275" width="36" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Annotation_2_di" bpmnElement="Annotation_2"><dc:Bounds x="270" y="110" width="120" height="30" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Participant_Cliente_di" bpmnElement="Participant_Cliente" isHorizontal="true"><dc:Bounds x="100" y="600" width="1000" height="60" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Annotation_1_di" bpmnElement="Annotation_1"><dc:Bounds x="1150" y="600" width="140" height="40" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="216" y="198" /><di:waypoint x="270" y="198" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="370" y="198" /><di:waypoint x="425" y="198" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Si_di" bpmnElement="Flow_Si"><di:waypoint x="450" y="223" /><di:waypoint x="450" y="360" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_No_di" bpmnElement="Flow_No"><di:waypoint x="475" y="198" /><di:waypoint x="632" y="198" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3"><di:waypoint x="500" y="400" /><di:waypoint x="600" y="400" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Timeout_di" bpmnElement="Flow_Timeout"><di:waypoint x="480" y="458" /><di:waypoint x="480" y="480" /><di:waypoint x="650" y="480" /><di:waypoint x="650" y="440" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4"><di:waypoint x="700" y="400" /><di:waypoint x="782" y="400" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Msg_di" bpmnElement="Flow_Msg"><di:waypoint x="450" y="440" /><di:waypoint x="450" y="600" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="DataIn_1_di" bpmnElement="DataIn_1"><di:waypoint x="320" y="275" /><di:waypoint x="320" y="238" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="DataOut_1_di" bpmnElement="DataOut_1"><di:waypoint x="400" y="380" /><di:waypoint x="338" y="300" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Association_2_di" bpmnElement="Association_2"><di:waypoint x="320" y="140" /><di:waypoint x="320" y="158" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Association_1_di" bpmnElement="Association_1"><di:waypoint x="1150" y="620" /><di:waypoint x="1100" y="620" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
  <bpmndi:BPMNDiagram id="BPMNDiagram_Sub" name="Preparar envío">
    <bpmndi:BPMNPlane id="BPMNPlane_Sub" bpmnElement="Sub_Envio">
      <bpmndi:BPMNShape id="Sub_Start_di" bpmnElement="Sub_Start"><dc:Bounds x="180" y="180" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sub_Task_di" bpmnElement="Sub_Task"><dc:Bounds x="270" y="158" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sub_End_di" bpmnElement="Sub_End"><dc:Bounds x="430" y="180" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Sub_Flow_1_di" bpmnElement="Sub_Flow_1"><di:waypoint x="216" y="198" /><di:waypoint x="270" y="198" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Sub_Flow_2_di" bpmnElement="Sub_Flow_2"><di:waypoint x="370" y="198" /><di:waypoint x="430" y="198" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const byType = (ws: Workspace) => {
  const out: Record<string, number> = {};
  for (const e of Object.values(ws.elements)) out[e.typeId] = (out[e.typeId] ?? 0) + 1;
  for (const r of Object.values(ws.relations)) out[r.typeId] = (out[r.typeId] ?? 0) + 1;
  return out;
};

describe('importBpmn', () => {
  it('lee elementos, tipos de tarea, definiciones de evento, lanes y datos', async () => {
    const { workspace: ws, warnings } = await importBpmn(XML);
    expect(warnings).toEqual([]);
    expect(() => parseWorkspace(ws)).not.toThrow();
    expect(byType(ws)).toMatchObject({
      'bpmn:Pool': 1, 'bpmn:Participant': 1, 'bpmn:Lane': 2, 'bpmn:StartEvent': 2, 'bpmn:Task': 3, 'bpmn:ExclusiveGateway': 1,
      'bpmn:BoundaryEvent': 1, 'bpmn:SubProcess': 1, 'bpmn:EndEvent': 3, 'bpmn:DataObject': 1, 'bpmn:TextAnnotation': 2,
      'bpmn:Message': 1, 'bpmn:Error': 1,
      'bpmn:SequenceFlow': 9, 'bpmn:MessageFlow': 1, 'bpmn:Association': 2, 'bpmn:DataInputAssociation': 1, 'bpmn:DataOutputAssociation': 1,
    });
    const e = ws.elements;
    expect(e.Participant_Tienda).toMatchObject({ typeId: 'bpmn:Pool', name: 'Tienda', doc: 'Proceso principal de la tienda.', fields: { isExecutable: true } });
    expect(e.Participant_Tienda!.features).toMatchObject({ bpmnProcessId: 'Process_Tienda', bpmnProcessName: 'Tramitar pedido', bpmnDocFrom: 'process' });
    expect(e.Participant_Tienda!.features.bpmnProcessExtensions).toBeDefined();
    expect(e.Participant_Cliente).toMatchObject({ typeId: 'bpmn:Participant', fields: { collapsed: true } });
    expect(e.Task_Revisar).toMatchObject({ typeId: 'bpmn:Task', name: 'Revisar pedido', doc: 'Comprueba stock y datos.', fields: { taskType: 'user', loop: 'sequentialMulti' } });
    expect(e.Task_Revisar!.features.bpmnAttrs).toEqual({ 'camunda:assignee': 'ana' });
    expect(e.Task_Notificar).toMatchObject({ fields: { taskType: 'service' } });
    expect(e.Task_Notificar!.features.bpmnAttrs).toEqual({ 'camunda:type': 'external', 'camunda:topic': 'mail' });
    expect(e.Sub_Task).toMatchObject({ fields: { taskType: 'script' } });
    expect(e.Start_1).toMatchObject({ fields: { eventDefinition: 'message', eventRef: 'Message_Pedido' } });
    expect(e.Boundary_Timer).toMatchObject({ fields: { eventDefinition: 'timer', timer: 'PT24H', timerKind: 'timeDuration', interrupting: false, attachedTo: 'Task_Notificar' } });
    expect(e.End_Rechazado).toMatchObject({ fields: { eventDefinition: 'terminate' } });
    expect(e.Sub_End).toMatchObject({ fields: { eventDefinition: 'error', eventRef: 'Error_Stock' } });
    expect(e.Error_Stock).toMatchObject({ typeId: 'bpmn:Error', name: 'Sin stock', fields: { errorCode: 'E_STOCK' } });
    expect(e.DataObjectRef_Pedido).toMatchObject({ typeId: 'bpmn:DataObject', name: 'Pedido', fields: { state: 'validado' } });
    expect(e.DataObjectRef_Pedido!.features.bpmnDataObjectId).toBe('DataObject_Pedido');
    expect(e.Annotation_2).toMatchObject({ fields: { text: 'Revisión manual' } });
    expect(e.Sub_Envio).toMatchObject({ typeId: 'bpmn:SubProcess', fields: { collapsed: true } });
    // Padres semánticos: lane → pool, nodos → lane, subproceso → nodos internos.
    expect(e.Lane_Ventas!.features.bpmnParent).toBe('Participant_Tienda');
    expect(e.Sub_Start!.features.bpmnParent).toBe('Sub_Envio');
    // Relaciones.
    const r = ws.relations;
    expect(r.Flow_Si).toMatchObject({ typeId: 'bpmn:SequenceFlow', name: 'sí', from: { elementId: 'Gateway_1' }, to: { elementId: 'Task_Notificar' }, fields: { condition: '${valido}' } });
    expect(r.Flow_No!.fields).toEqual({ default: true });
    expect(r.Flow_Msg).toMatchObject({ typeId: 'bpmn:MessageFlow', from: { elementId: 'Task_Notificar' }, to: { elementId: 'Participant_Cliente' }, fields: { messageRef: 'Message_Pedido', message: 'Pedido confirmado' } });
    expect(r.DataIn_1).toMatchObject({ typeId: 'bpmn:DataInputAssociation', from: { elementId: 'DataObjectRef_Pedido' }, to: { elementId: 'Task_Revisar' } });
    expect(r.DataOut_1).toMatchObject({ typeId: 'bpmn:DataOutputAssociation', from: { elementId: 'Task_Notificar' }, to: { elementId: 'DataObjectRef_Pedido' } });
    expect(r.Association_1).toMatchObject({ typeId: 'bpmn:Association', from: { elementId: 'Annotation_1' }, to: { elementId: 'Participant_Cliente' } });
  });

  it('crea una vista por diagrama con nodos relativos al padre, aristas con bendpoints y drill-down', async () => {
    const { workspace: ws } = await importBpmn(XML);
    expect(Object.keys(ws.views)).toEqual(['BPMNDiagram_1', 'BPMNDiagram_Sub']);
    expect(ws.views.BPMNDiagram_1).toMatchObject({ notationId: 'bpmn', viewpointId: 'collaboration', name: 'Colaboración' });
    expect(ws.views.BPMNDiagram_Sub).toMatchObject({ notationId: 'bpmn', viewpointId: 'process', rootElementId: 'Sub_Envio' });
    expect(ws.meta.currentViewId).toBe('BPMNDiagram_1');
    const n = ws.nodes;
    expect(n.Participant_Tienda_di).toMatchObject({ viewId: 'BPMNDiagram_1', elementId: 'Participant_Tienda', x: 100, y: 100, w: 1000, h: 400, meta: { isHorizontal: true } });
    expect(n.Participant_Tienda_di!.parentNodeId).toBeUndefined();
    expect(n.Lane_Ventas_di).toMatchObject({ parentNodeId: 'Participant_Tienda_di', x: 30, y: 0, w: 970, h: 200 });
    expect(n.Lane_Almacen_di).toMatchObject({ parentNodeId: 'Participant_Tienda_di', x: 30, y: 200 });
    expect(n.Task_Revisar_di).toMatchObject({ parentNodeId: 'Lane_Ventas_di', x: 140, y: 58, w: 100, h: 80, style: { stroke: '#0d4372', fill: '#bbdefb' } });
    expect(n.Boundary_Timer_di).toMatchObject({ parentNodeId: 'Lane_Almacen_di', x: 332, y: 122 });
    expect(n.Start_1_di!.meta).toMatchObject({ label: { x: 160, y: 220, w: 76, h: 14 } });
    expect(n.Gateway_1_di!.meta).toMatchObject({ isMarkerVisible: true });
    expect(n.Sub_Envio_di).toMatchObject({ style: { collapsed: true }, detailViewId: 'BPMNDiagram_Sub' });
    expect(n.Participant_Cliente_di).toMatchObject({ elementId: 'Participant_Cliente', x: 100, y: 600 });
    expect(n.Sub_Start_di).toMatchObject({ viewId: 'BPMNDiagram_Sub', x: 180, y: 180 });
    expect(n.Sub_Start_di!.parentNodeId).toBeUndefined();
    // Aristas: bendpoints absolutos sin extremos.
    const ed = ws.edges;
    expect(ed.Flow_Timeout_di).toMatchObject({ relationId: 'Flow_Timeout', fromNodeId: 'Boundary_Timer_di', toNodeId: 'Sub_Envio_di', bendpoints: [{ x: 480, y: 480 }, { x: 650, y: 480 }] });
    expect(ed.Flow_1_di!.bendpoints).toEqual([]);
    expect(ed.Flow_Msg_di).toMatchObject({ fromNodeId: 'Task_Notificar_di', toNodeId: 'Participant_Cliente_di' });
    expect(ed.Sub_Flow_1_di).toMatchObject({ viewId: 'BPMNDiagram_Sub', fromNodeId: 'Sub_Start_di', toNodeId: 'Sub_Task_di' });
    expect(Object.values(ed).filter(x => x.viewId === 'BPMNDiagram_1')).toHaveLength(12);
  });

  it('el workspace importado es válido para el registro (sin relaciones inválidas ni referencias rotas)', async () => {
    const { workspace: ws } = await importBpmn(XML);
    const reg = new NotationRegistry().register(CORE_PACK).register(BPMN_PACK);
    const diags = validate(new MemoryStore(ws), reg).filter(d => d.severity === 'error' || d.code === 'unknown-element-type' || d.code === 'unknown-relation-type');
    expect(diags).toEqual([]);
  });

  it('rechaza XML que no es BPMN y avisa de elementos no soportados', async () => {
    await expect(importBpmn('<foo/>')).rejects.toThrow(/BPMN inválido/);
    const { workspace, warnings } = await importBpmn(`<?xml version="1.0"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D"><bpmn:process id="P"><bpmn:task id="T"/></bpmn:process></bpmn:definitions>`);
    expect(workspace.elements.T).toMatchObject({ typeId: 'bpmn:Task' });
    expect(workspace.elements.P).toMatchObject({ typeId: 'bpmn:Process' });
    expect(workspace.elements.T!.features.bpmnParent).toBe('P');
    expect(Object.keys(workspace.views)).toEqual([]);
    expect(warnings.some(w => /BPMNDiagram/.test(w))).toBe(true);
  });
});

describe('exportBpmn', () => {
  it('genera definitions con exporter, ids conservados y DI absoluta', async () => {
    const { workspace: ws } = await importBpmn(XML);
    const xml = await exportBpmn(ws);
    expect(xml).toContain('exporter="all-draw"');
    expect(xml).toContain('targetNamespace="http://bezenti.com/bpmn"');
    expect(xml).toContain('id="Definitions_Pedido"');
    expect(xml).toContain('<bpmn:userTask id="Task_Revisar" name="Revisar pedido"');
    expect(xml).toContain('camunda:assignee="ana"');
    expect(xml).toContain('<camunda:property name="owner" value="ventas" />');
    expect(xml).toContain('<bpmn:participant id="Participant_Cliente" name="Cliente" />');
    expect(xml).toContain('processRef="Process_Tienda"');
    expect(xml).toMatch(/<bpmn:process id="Process_Tienda" name="Tramitar pedido" isExecutable="true">\s*<bpmn:documentation>Proceso principal de la tienda.<\/bpmn:documentation>/);
    expect(xml).toContain('<bpmn:participant id="Participant_Tienda" name="Tienda" processRef="Process_Tienda" />');
    expect(xml).toContain('default="Flow_No"');
    expect(xml).toContain('attachedToRef="Task_Notificar"');
    expect(xml).toContain('cancelActivity="false"');
    expect(xml).toContain('<bpmn:timeDuration xsi:type="bpmn:tFormalExpression">PT24H</bpmn:timeDuration>');
    expect(xml).toContain('<bpmn:flowNodeRef>Task_Revisar</bpmn:flowNodeRef>');
    expect(xml).toContain('<bpmn:messageFlow id="Flow_Msg" name="Confirmación" sourceRef="Task_Notificar" targetRef="Participant_Cliente" messageRef="Message_Pedido" />');
    expect(xml).toContain('isExpanded="false"');
    expect(xml).toContain('bioc:stroke="#0d4372"');
    // Coordenadas absolutas de un nodo anidado en lane → pool.
    expect(xml).toMatch(/<bpmndi:BPMNShape id="Task_Revisar_di"[^>]*>\s*<dc:Bounds x="270" y="158" width="100" height="80" \/>/);
    expect(xml).toMatch(/<bpmndi:BPMNEdge id="Flow_Timeout_di" bpmnElement="Flow_Timeout">\s*<di:waypoint x="480" y="458" \/>\s*<di:waypoint x="480" y="480" \/>\s*<di:waypoint x="650" y="480" \/>\s*<di:waypoint x="650" y="440" \/>/);
    expect(xml).toMatch(/<bpmndi:BPMNDiagram id="BPMNDiagram_Sub" name="Preparar envío">\s*<bpmndi:BPMNPlane id="BPMNPlane_Sub" bpmnElement="Sub_Envio">/);
  });

  it('ida y vuelta: importBpmn(exportBpmn(importBpmn(x))) conserva elementos, relaciones, nodos, aristas y campos', async () => {
    const a = (await importBpmn(XML)).workspace;
    const xml = await exportBpmn(a);
    const { workspace: b, warnings } = await importBpmn(xml);
    expect(warnings).toEqual([]);
    expect(Object.keys(b.elements).sort()).toEqual(Object.keys(a.elements).sort());
    expect(Object.keys(b.relations).sort()).toEqual(Object.keys(a.relations).sort());
    expect(Object.keys(b.views).sort()).toEqual(Object.keys(a.views).sort());
    expect(Object.keys(b.nodes).sort()).toEqual(Object.keys(a.nodes).sort());
    expect(Object.keys(b.edges).sort()).toEqual(Object.keys(a.edges).sort());
    for (const [id, e] of Object.entries(a.elements)) {
      expect(b.elements[id], id).toMatchObject({ typeId: e.typeId, name: e.name, doc: e.doc, fields: e.fields });
      expect(b.elements[id]!.features, id).toEqual(e.features);
    }
    for (const [id, r] of Object.entries(a.relations)) expect(b.relations[id], id).toMatchObject({ typeId: r.typeId, name: r.name, from: r.from, to: r.to, fields: r.fields });
    for (const [id, n] of Object.entries(a.nodes)) {
      const { meta: _m, ...rest } = n;
      expect(b.nodes[id], id).toMatchObject(rest);
      if (n.meta) expect(b.nodes[id]!.meta, id).toEqual(n.meta);
    }
    for (const [id, e] of Object.entries(a.edges)) expect(b.edges[id], id).toMatchObject({ relationId: e.relationId, fromNodeId: e.fromNodeId, toNodeId: e.toNodeId, bendpoints: e.bendpoints });
    for (const [id, v] of Object.entries(a.views)) {
      expect(b.views[id], id).toMatchObject({ name: v.name, viewpointId: v.viewpointId });
      expect(b.views[id]!.rootElementId, id).toBe(v.rootElementId);
    }
    // Segunda vuelta estable byte a byte.
    expect(await exportBpmn(b)).toBe(xml);
  });

  it('exporta solo una vista (y sus vistas de detalle) cuando se indica viewId', async () => {
    const a = (await importBpmn(XML)).workspace;
    const xml = await exportBpmn(a, 'BPMNDiagram_Sub');
    expect(xml).toContain('BPMNDiagram_Sub');
    expect(xml).not.toContain('BPMNDiagram_1');
    expect(xml).toContain('id="Sub_Task"');
    expect(xml).not.toContain('id="Task_Revisar"');
    await expect(exportBpmn(a, 'no-existe')).rejects.toThrow();
  });

  it('exporta un modelo creado a mano (sin DI previa): proceso por defecto, waypoints borde a borde, eventos, datos', async () => {
    const ws = parseWorkspace({
      meta: { name: 'manual' },
      views: { v1: { id: 'v1', notationId: 'bpmn', name: 'Proceso', viewpointId: 'process' } },
      elements: {
        s: { id: 's', typeId: 'bpmn:StartEvent', name: 'Inicio', fields: { eventDefinition: 'timer', timer: 'R/PT1H', timerKind: 'timeCycle' } },
        t: { id: 't', typeId: 'bpmn:Task', name: 'Hacer', fields: { taskType: 'businessRule', loop: 'standard', isForCompensation: false } },
        c: { id: 'c', typeId: 'bpmn:Task', name: 'Deshacer', fields: { isForCompensation: true } },
        bc: { id: 'bc', typeId: 'bpmn:BoundaryEvent', name: '', fields: { eventDefinition: 'compensation', attachedTo: 't', interrupting: true } },
        g: { id: 'g', typeId: 'bpmn:InclusiveGateway', name: 'OR' },
        tx: { id: 'tx', typeId: 'bpmn:Transaction', name: 'Tx', fields: { method: 'Compensate' } },
        ah: { id: 'ah', typeId: 'bpmn:AdHocSubProcess', name: 'Ad hoc', fields: { ordering: 'Sequential', completionCondition: 'done' } },
        es: { id: 'es', typeId: 'bpmn:EventSubProcess', name: 'Errores' },
        ess: { id: 'ess', typeId: 'bpmn:StartEvent', name: 'Error', fields: { eventDefinition: 'error', interrupting: false } },
        e1: { id: 'e1', typeId: 'bpmn:EndEvent', name: 'Fin', fields: { eventDefinition: 'signal', eventRef: 'sig' } },
        sig: { id: 'sig', typeId: 'bpmn:Signal', name: 'Aviso' },
        ds: { id: 'ds', typeId: 'bpmn:DataStore', name: 'BD' },
        di: { id: 'di', typeId: 'bpmn:DataInput', name: 'Entrada' },
        grp: { id: 'grp', typeId: 'bpmn:Group', name: 'Zona', fields: { categoryValue: 'Zona A' } },
      },
      relations: {
        f1: { id: 'f1', typeId: 'bpmn:SequenceFlow', from: { elementId: 's' }, to: { elementId: 't' } },
        f2: { id: 'f2', typeId: 'bpmn:SequenceFlow', from: { elementId: 't' }, to: { elementId: 'g' } },
        f3: { id: 'f3', typeId: 'bpmn:SequenceFlow', from: { elementId: 'g' }, to: { elementId: 'tx' }, fields: { condition: 'x > 1' } },
        f4: { id: 'f4', typeId: 'bpmn:SequenceFlow', from: { elementId: 'g' }, to: { elementId: 'ah' }, fields: { default: true } },
        f5: { id: 'f5', typeId: 'bpmn:SequenceFlow', from: { elementId: 'tx' }, to: { elementId: 'e1' } },
        comp: { id: 'comp', typeId: 'bpmn:Association', from: { elementId: 'bc' }, to: { elementId: 'c' }, fields: { direction: 'One' } },
        dout: { id: 'dout', typeId: 'bpmn:DataOutputAssociation', from: { elementId: 't' }, to: { elementId: 'ds' } },
        din: { id: 'din', typeId: 'bpmn:DataInputAssociation', from: { elementId: 'di' }, to: { elementId: 't' } },
      },
      nodes: {
        ns: { id: 'ns', viewId: 'v1', elementId: 's', x: 100, y: 100, w: 36, h: 36 },
        nt: { id: 'nt', viewId: 'v1', elementId: 't', x: 200, y: 78, w: 100, h: 80 },
        nc: { id: 'nc', viewId: 'v1', elementId: 'c', x: 200, y: 220, w: 100, h: 80 },
        nbc: { id: 'nbc', viewId: 'v1', elementId: 'bc', x: 232, y: 140, w: 36, h: 36 },
        ng: { id: 'ng', viewId: 'v1', elementId: 'g', x: 350, y: 93, w: 50, h: 50 },
        ngrp: { id: 'ngrp', viewId: 'v1', elementId: 'grp', x: 440, y: 0, w: 400, h: 400 },
        ntx: { id: 'ntx', viewId: 'v1', elementId: 'tx', parentNodeId: 'ngrp', x: 10, y: 50, w: 200, h: 120 },
        nah: { id: 'nah', viewId: 'v1', elementId: 'ah', parentNodeId: 'ngrp', x: 10, y: 250, w: 200, h: 120 },
        nes: { id: 'nes', viewId: 'v1', elementId: 'es', x: 100, y: 400, w: 200, h: 120 },
        ness: { id: 'ness', viewId: 'v1', elementId: 'ess', parentNodeId: 'nes', x: 20, y: 40, w: 36, h: 36 },
        ne1: { id: 'ne1', viewId: 'v1', elementId: 'e1', x: 900, y: 100, w: 36, h: 36 },
        nds: { id: 'nds', viewId: 'v1', elementId: 'ds', x: 200, y: 0, w: 50, h: 50 },
        ndi: { id: 'ndi', viewId: 'v1', elementId: 'di', x: 60, y: 0, w: 36, h: 50 },
      },
      edges: {
        ef1: { id: 'ef1', viewId: 'v1', relationId: 'f1', fromNodeId: 'ns', toNodeId: 'nt' },
        ef2: { id: 'ef2', viewId: 'v1', relationId: 'f2', fromNodeId: 'nt', toNodeId: 'ng' },
        ef3: { id: 'ef3', viewId: 'v1', relationId: 'f3', fromNodeId: 'ng', toNodeId: 'ntx' },
        ef4: { id: 'ef4', viewId: 'v1', relationId: 'f4', fromNodeId: 'ng', toNodeId: 'nah', bendpoints: [{ x: 375, y: 310 }] },
        ef5: { id: 'ef5', viewId: 'v1', relationId: 'f5', fromNodeId: 'ntx', toNodeId: 'ne1' },
        ecomp: { id: 'ecomp', viewId: 'v1', relationId: 'comp', fromNodeId: 'nbc', toNodeId: 'nc' },
        edout: { id: 'edout', viewId: 'v1', relationId: 'dout', fromNodeId: 'nt', toNodeId: 'nds' },
        edin: { id: 'edin', viewId: 'v1', relationId: 'din', fromNodeId: 'ndi', toNodeId: 'nt' },
      },
    });
    const xml = await exportBpmn(ws);
    expect(xml).toContain('<bpmn:process id="Process_1"');
    expect(xml).toContain('<bpmn:businessRuleTask id="t" name="Hacer"');
    expect(xml).toContain('<bpmn:standardLoopCharacteristics />');
    expect(xml).toContain('<bpmn:task id="c" name="Deshacer" isForCompensation="true"');
    expect(xml).toContain('<bpmn:compensateEventDefinition id="bc_compensation" />');
    expect(xml).toContain('<bpmn:association id="comp" associationDirection="One" sourceRef="bc" targetRef="c" />');
    expect(xml).toContain('<bpmn:transaction id="tx" name="Tx" method="##Compensate"');
    expect(xml).toContain('<bpmn:adHocSubProcess id="ah" name="Ad hoc" ordering="Sequential"');
    expect(xml).toContain('<bpmn:subProcess id="es" name="Errores" triggeredByEvent="true"');
    expect(xml).toContain('<bpmn:startEvent id="ess" name="Error" isInterrupting="false"');
    expect(xml).toContain('<bpmn:timeCycle xsi:type="bpmn:tFormalExpression">R/PT1H</bpmn:timeCycle>');
    expect(xml).toContain('<bpmn:signalEventDefinition id="e1_signal" signalRef="sig" />');
    expect(xml).toContain('<bpmn:signal id="sig" name="Aviso" />');
    expect(xml).toContain('<bpmn:dataStore id="ds_ds" name="BD" />');
    expect(xml).toContain('<bpmn:dataStoreReference id="ds" name="BD" dataStoreRef="ds_ds"');
    expect(xml).toContain('<bpmn:dataInput id="di" name="Entrada" />');
    expect(xml).toContain('<bpmn:categoryValue id="grp_cv" value="Zona A" />');
    expect(xml).toMatch(/<bpmn:inclusiveGateway id="g" name="OR" default="f4">/);
    expect(xml).toContain('<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">x &gt; 1</bpmn:conditionExpression>');
    // El grupo no cuenta como contenedor semántico: la transacción cuelga del proceso, con posición absoluta.
    expect(xml).toMatch(/<bpmndi:BPMNShape id="ntx" bpmnElement="tx" isExpanded="true">\s*<dc:Bounds x="450" y="50" width="200" height="120" \/>/);
    // Waypoints borde a borde: inicio (centro 118,118) → tarea (centro 250,118).
    expect(xml).toMatch(/<bpmndi:BPMNEdge id="ef1" bpmnElement="f1">\s*<di:waypoint x="136" y="118" \/>\s*<di:waypoint x="200" y="118" \/>/);
    // Con bendpoint: primer punto en el borde de la compuerta hacia el bendpoint.
    expect(xml).toMatch(/<bpmndi:BPMNEdge id="ef4" bpmnElement="f4">\s*<di:waypoint x="375" y="143" \/>\s*<di:waypoint x="375" y="310" \/>\s*<di:waypoint x="450" y="310" \/>/);
    // Y se puede volver a leer.
    const { workspace: back, warnings } = await importBpmn(xml);
    expect(warnings).toEqual([]);
    expect(back.elements.t).toMatchObject({ typeId: 'bpmn:Task', fields: { taskType: 'businessRule', loop: 'standard' } });
    expect(back.elements.es).toMatchObject({ typeId: 'bpmn:EventSubProcess' });
    expect(back.elements.ess!.features.bpmnParent).toBe('es');
    expect(back.elements.ah).toMatchObject({ typeId: 'bpmn:AdHocSubProcess', fields: { ordering: 'Sequential', completionCondition: 'done' } });
    expect(back.elements.tx).toMatchObject({ typeId: 'bpmn:Transaction', fields: { method: 'Compensate' } });
    expect(back.elements.bc).toMatchObject({ fields: { eventDefinition: 'compensation', attachedTo: 't' } });
    expect(back.relations.comp).toMatchObject({ fields: { direction: 'One' } });
    expect(back.relations.f4!.fields.default).toBe(true);
    expect(back.nodes.ntx).toMatchObject({ x: 450, y: 50 });
    expect(back.nodes.ness).toMatchObject({ parentNodeId: 'nes', x: 20, y: 40 });
    expect(back.views.v1).toMatchObject({ rootElementId: 'Process_1', viewpointId: 'process' });
  });

  it('coreografía y conversación: tipos con matriz propia van a bpmn:Choreography y a la colaboración', async () => {
    const ws = parseWorkspace({
      meta: { name: 'coreo' },
      views: { vc: { id: 'vc', notationId: 'bpmn', name: 'Coreografía', viewpointId: 'choreography' } },
      elements: {
        pa: { id: 'pa', typeId: 'bpmn:Participant', name: 'Comprador' },
        pb: { id: 'pb', typeId: 'bpmn:Participant', name: 'Vendedor' },
        st: { id: 'st', typeId: 'bpmn:StartEvent', name: '' },
        ct: { id: 'ct', typeId: 'bpmn:ChoreographyTask', name: 'Pedir', fields: { initiatingParticipant: 'pa', participants: ['pa', 'pb'], loopType: 'None' } },
        en: { id: 'en', typeId: 'bpmn:EndEvent', name: '' },
      },
      relations: {
        f1: { id: 'f1', typeId: 'bpmn:SequenceFlow', from: { elementId: 'st' }, to: { elementId: 'ct' } },
        f2: { id: 'f2', typeId: 'bpmn:SequenceFlow', from: { elementId: 'ct' }, to: { elementId: 'en' } },
      },
      nodes: {
        nst: { id: 'nst', viewId: 'vc', elementId: 'st', x: 0, y: 0, w: 36, h: 36 },
        nct: { id: 'nct', viewId: 'vc', elementId: 'ct', x: 100, y: 0, w: 120, h: 100 },
        nen: { id: 'nen', viewId: 'vc', elementId: 'en', x: 300, y: 0, w: 36, h: 36 },
      },
      edges: {
        e1: { id: 'e1', viewId: 'vc', relationId: 'f1', fromNodeId: 'nst', toNodeId: 'nct' },
        e2: { id: 'e2', viewId: 'vc', relationId: 'f2', fromNodeId: 'nct', toNodeId: 'nen' },
      },
    });
    const xml = await exportBpmn(ws);
    expect(xml).toContain('<bpmn:choreography id="Choreography_1">');
    expect(xml).toContain('<bpmn:participant id="pa" name="Comprador" />');
    expect(xml).toMatch(/<bpmn:choreographyTask id="ct" name="Pedir" initiatingParticipantRef="pa">[\s\S]*?<bpmn:participantRef>pa<\/bpmn:participantRef>\s*<bpmn:participantRef>pb<\/bpmn:participantRef>/);
    expect(xml).not.toContain('<bpmn:collaboration');
    expect(xml).toContain('<bpmn:sequenceFlow id="f1" sourceRef="st" targetRef="ct" />');
    expect(xml).toContain('bpmnElement="Choreography_1"');
    const { workspace: back, warnings } = await importBpmn(xml);
    expect(warnings).toEqual([]);
    expect(back.elements.ct).toMatchObject({ typeId: 'bpmn:ChoreographyTask', fields: { initiatingParticipant: 'pa', participants: ['pa', 'pb'], loopType: 'None' } });
    expect(back.elements.pa).toMatchObject({ typeId: 'bpmn:Participant' });
    expect(back.views.vc).toMatchObject({ viewpointId: 'choreography' });
    expect(back.relations.f1).toMatchObject({ from: { elementId: 'st' }, to: { elementId: 'ct' } });

    // Conversación.
    const conv = parseWorkspace({
      meta: { name: 'conv' },
      views: { v: { id: 'v', notationId: 'bpmn', name: 'Conversación', viewpointId: 'collaboration' } },
      elements: {
        pa: { id: 'pa', typeId: 'bpmn:Participant', name: 'A' },
        pb: { id: 'pb', typeId: 'bpmn:Pool', name: 'B' },
        cv: { id: 'cv', typeId: 'bpmn:Conversation', name: 'Negociar' },
      },
      relations: {
        l1: { id: 'l1', typeId: 'bpmn:ConversationLink', from: { elementId: 'pa' }, to: { elementId: 'cv' } },
        l2: { id: 'l2', typeId: 'bpmn:ConversationLink', from: { elementId: 'cv' }, to: { elementId: 'pb' } },
      },
      nodes: {
        npa: { id: 'npa', viewId: 'v', elementId: 'pa', x: 0, y: 0, w: 200, h: 60 },
        npb: { id: 'npb', viewId: 'v', elementId: 'pb', x: 0, y: 300, w: 200, h: 60 },
        ncv: { id: 'ncv', viewId: 'v', elementId: 'cv', x: 300, y: 150, w: 60, h: 50 },
      },
      edges: {
        el1: { id: 'el1', viewId: 'v', relationId: 'l1', fromNodeId: 'npa', toNodeId: 'ncv' },
        el2: { id: 'el2', viewId: 'v', relationId: 'l2', fromNodeId: 'ncv', toNodeId: 'npb' },
      },
    });
    const cxml = await exportBpmn(conv);
    expect(cxml).toContain('<bpmn:conversation id="cv" name="Negociar" />');
    expect(cxml).toContain('<bpmn:conversationLink id="l1" sourceRef="pa" targetRef="cv" />');
    expect(cxml).toContain('<bpmn:participant id="pb" name="B" processRef="Process_pb" />');
    const back2 = (await importBpmn(cxml)).workspace;
    expect(back2.elements.cv).toMatchObject({ typeId: 'bpmn:Conversation' });
    expect(back2.elements.pb).toMatchObject({ typeId: 'bpmn:Pool' });
    expect(back2.relations.l2).toMatchObject({ typeId: 'bpmn:ConversationLink', from: { elementId: 'cv' }, to: { elementId: 'pb' } });
  });
});

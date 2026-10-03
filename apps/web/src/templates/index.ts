/**
 * Galería de plantillas del inicio. Cada una construye un `Workspace` nuevo (ids nuevos) con los nombres en el
 * idioma activo (`build(t)`); nombre y descripción son claves en español que se traducen al pintarlas.
 */
import type { Workspace } from '@all-draw/core';
import { demoWorkspace } from '../demo';
import type { Tr } from './kit';
import { blankTemplate } from './blank';
import { bpmnTemplate } from './bpmn';
import { archimateTemplate } from './archimate';
import { c4Template } from './c4';
import { statechartTemplate } from './statechart';
import { erTemplate } from './er';
import { umlTemplate } from './uml';
import { gridTemplate } from './grid';
import { sequenceTemplate } from './sequence';
import { mindmapTemplate } from './mindmap';
import { flowchartTemplate } from './flowchart';

export type { Tr } from './kit';

export interface Template {
  id: string;
  /** Clave en español. */
  name: string;
  /** Clave en español: una frase. */
  description: string;
  /** Packs que usa (chips de color en la tarjeta). */
  notations: string[];
  build(t: Tr): Workspace;
}

export const TEMPLATES: Template[] = [
  { id: 'blank', name: 'Espacio en blanco', description: 'Un lienzo libre vacío; añade vistas de cualquier notación cuando las necesites.', notations: ['freeform'], build: blankTemplate },
  { id: 'demo', name: 'Demo multidimensión', description: 'El alta de un cliente vista como arquitectura, proceso, estados, C4, secuencia y mapa de capas.', notations: ['archimate', 'bpmn', 'statechart', 'c4', 'sequence', 'grid'], build: () => demoWorkspace() },
  { id: 'bpmn', name: 'Proceso BPMN', description: 'Un pedido con dos carriles, una decisión y dos finales.', notations: ['bpmn'], build: bpmnTemplate },
  { id: 'archimate', name: 'Arquitectura ArchiMate', description: 'Negocio, aplicación y tecnología en capas, con sus servicios.', notations: ['archimate'], build: archimateTemplate },
  { id: 'c4', name: 'C4: contexto y contenedores', description: 'El sistema y su entorno; entra en él para ver sus contenedores.', notations: ['c4'], build: c4Template },
  { id: 'statechart', name: 'Máquina de estados', description: 'El ciclo de vida de un pedido, con eventos y una guarda.', notations: ['statechart'], build: statechartTemplate },
  { id: 'er', name: 'Modelo entidad-relación', description: 'Clientes, pedidos y productos con cardinalidades.', notations: ['er'], build: erTemplate },
  { id: 'uml', name: 'Diagrama de clases UML', description: 'Clases, una interfaz y una enumeración con sus asociaciones.', notations: ['uml'], build: umlTemplate },
  { id: 'grid', name: 'Mapa capas × etapas con pines', description: 'Servicios con datos JSON cuyos campos se conectan entre sí.', notations: ['grid'], build: gridTemplate },
  { id: 'sequence', name: 'Diagrama de secuencia', description: 'Un pago con tarjeta entre cliente, tienda, API y banco.', notations: ['sequence'], build: sequenceTemplate },
  { id: 'mindmap', name: 'Mapa mental', description: 'Una idea central con cuatro ramas para ordenar un lanzamiento.', notations: ['mindmap'], build: mindmapTemplate },
  { id: 'flowchart', name: 'Diagrama de flujo', description: 'Validar una solicitud, con una decisión y un bucle de corrección.', notations: ['flow'], build: flowchartTemplate },
];

export const templateById = (id: string): Template | undefined => TEMPLATES.find(x => x.id === id);

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
import { usecaseTemplate } from './usecase';
import { componentTemplate } from './component';
import { deploymentTemplate } from './deployment';
import { activityTemplate } from './activity';
import { ganttTemplate } from './gantt';
import { dddTemplate } from './ddd';

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
  { id: 'usecase', name: 'Casos de uso: tienda online', description: 'Clientes y pasarela de pago alrededor del sistema, con «include», «extend» y generalización.', notations: ['usecase'], build: usecaseTemplate },
  { id: 'component', name: 'Componentes: tienda online', description: 'La web consume la interfaz de pedidos; un puerto delega en el gestor de pedidos.', notations: ['component'], build: componentTemplate },
  { id: 'deployment', name: 'Despliegue: tienda en la nube', description: 'Móvil, servidor con un contenedor Docker y base de datos, con sus artefactos.', notations: ['deployment'], build: deploymentTemplate },
  { id: 'activity', name: 'Actividad: tramitar un pedido', description: 'Dos calles, una decisión, una bifurcación con su unión y un nodo objeto.', notations: ['activity'], build: activityTemplate },
  { id: 'gantt', name: 'Gantt: lanzamiento de una web', description: 'Dos fases con dependencias, ruta crítica y un hito, sobre una línea de tiempo.', notations: ['gantt'], build: ganttTemplate },
  { id: 'ddd', name: 'DDD: mapa de contextos de una tienda', description: 'Subdominios y contextos con sus patrones de relación, y el modelo táctico de Pedidos.', notations: ['ddd'], build: dddTemplate },
];

export const templateById = (id: string): Template | undefined => TEMPLATES.find(x => x.id === id);

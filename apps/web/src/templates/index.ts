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
  /** Clave en español: 2–3 frases con qué muestra y cómo seguir (galería y nota de bienvenida de la primera vista). */
  about: string;
  build(t: Tr): Workspace;
}

/**
 * Propiedad de la vista con la nota de bienvenida (`WELCOME_PROP` de `@all-draw/editor`): el lienzo la enseña como un
 * aviso plegable que se puede cerrar. Se escribe aquí el literal para no cargar el editor al pintar miniaturas.
 */
export const WELCOME_PROP = 'welcome';

/** El espacio de la plantilla con su nota de bienvenida en la vista que se abre primero. */
export function withWelcome(ws: Workspace, text: string): Workspace {
  const v = ws.meta.currentViewId ? ws.views[ws.meta.currentViewId] : Object.values(ws.views)[0];
  if (v && text) v.props = { ...v.props, [WELCOME_PROP]: text };
  return ws;
}

const RAW: Template[] = [
  { id: 'blank', name: 'Espacio en blanco', description: 'Un lienzo libre vacío; añade vistas de cualquier notación cuando las necesites.', notations: ['freeform'], about: 'Un lienzo libre, sin reglas de notación, para dibujar con formas y notas. Cuando necesites otra notación, crea una vista nueva con el botón + del panel Vistas o con Ctrl+K → «Nueva vista…».', build: blankTemplate },
  { id: 'demo', name: 'Demo multidimensión', description: 'El alta de un cliente vista como arquitectura, proceso, estados, C4, secuencia y mapa de capas.', notations: ['archimate', 'bpmn', 'statechart', 'c4', 'sequence', 'grid'], about: 'El mismo alta de cliente modelado en seis dimensiones: cada vista es una notación distinta sobre los mismos elementos. Doble clic en un nodo con rombo para entrar en su vista de detalle; el inspector dice en qué otras vistas aparece cada elemento.', build: () => demoWorkspace() },
  { id: 'bpmn', name: 'Proceso BPMN', description: 'Un pedido con dos carriles, una decisión y dos finales.', notations: ['bpmn'], about: 'Un pedido que recorre una pool con dos carriles, una compuerta exclusiva y dos finales. Pulsa «Simular» para seguirlo paso a paso, o arrastra desde el borde de una tarea hasta un hueco vacío para crear y conectar el paso siguiente.', build: bpmnTemplate },
  { id: 'archimate', name: 'Arquitectura ArchiMate', description: 'Negocio, aplicación y tecnología en capas, con sus servicios.', notations: ['archimate'], about: 'Las capas de negocio, aplicación y tecnología con sus servicios, unidas por relaciones de servicio y realización. Al conectar dos elementos solo se ofrecen las relaciones que ArchiMate permite, y el panel Problemas avisa de lo que no encaja.', build: archimateTemplate },
  { id: 'c4', name: 'C4: contexto y contenedores', description: 'El sistema y su entorno; entra en él para ver sus contenedores.', notations: ['c4'], about: 'El nivel de contexto: el sistema, quién lo usa y con qué sistemas externos habla. Doble clic en el sistema para bajar a sus contenedores; desde un contenedor puedes abrir otra vista de detalle para sus componentes.', build: c4Template },
  { id: 'statechart', name: 'Máquina de estados', description: 'El ciclo de vida de un pedido, con eventos y una guarda.', notations: ['statechart'], about: 'El ciclo de vida de un pedido con eventos, una guarda y sus estados inicial y final. Selecciona una transición para editar su evento y su guarda en el inspector, y pulsa «Simular» para disparar los eventos.', build: statechartTemplate },
  { id: 'er', name: 'Modelo entidad-relación', description: 'Clientes, pedidos y productos con cardinalidades.', notations: ['er'], about: 'Clientes, pedidos y productos con sus atributos y las cardinalidades de cada relación. Edita los atributos en el inspector (la clave primaria se marca como PK) y genera las tablas en SQL con «Generar código…».', build: erTemplate },
  { id: 'uml', name: 'Diagrama de clases UML', description: 'Clases, una interfaz y una enumeración con sus asociaciones.', notations: ['uml'], about: 'Clases con atributos y operaciones, una interfaz y una enumeración, unidas por asociaciones, herencia y realización. Edita los compartimentos en el inspector y genera las clases en TypeScript o Java con «Generar código…».', build: umlTemplate },
  { id: 'grid', name: 'Mapa capas × etapas con pines', description: 'Servicios con datos JSON cuyos campos se conectan entre sí.', notations: ['grid'], about: 'Un mapa de capas por etapas: cada servicio vive en su celda y lleva datos JSON cuyos campos salen como pines. Une un pin con otro para documentar qué dato alimenta a cuál, y añade capas o etapas desde el inspector de la vista.', build: gridTemplate },
  { id: 'sequence', name: 'Diagrama de secuencia', description: 'Un pago con tarjeta entre cliente, tienda, API y banco.', notations: ['sequence'], about: 'Un pago con tarjeta entre cliente, tienda, API de pagos y banco, con llamadas y respuestas. Arrastra de una línea de vida a otra para añadir un mensaje: el orden de arriba abajo es el orden en el tiempo.', build: sequenceTemplate },
  { id: 'mindmap', name: 'Mapa mental', description: 'Una idea central con cuatro ramas para ordenar un lanzamiento.', notations: ['mindmap'], about: 'Una idea central con cuatro ramas para preparar un lanzamiento. Arrastra desde el borde de un nodo hasta un hueco vacío para crear una rama nueva, y usa «Layout automático» cuando quieras reordenarlo todo.', build: mindmapTemplate },
  { id: 'flowchart', name: 'Diagrama de flujo', description: 'Validar una solicitud, con una decisión y un bucle de corrección.', notations: ['flow'], about: 'Validar una solicitud con una decisión y un bucle de corrección. Rotula las salidas de cada decisión («sí», «no») seleccionando la flecha, y usa «Layout automático» si el flujo crece.', build: flowchartTemplate },
  { id: 'usecase', name: 'Casos de uso: tienda online', description: 'Clientes y pasarela de pago alrededor del sistema, con «include», «extend» y generalización.', notations: ['usecase'], about: 'Los actores de una tienda online alrededor del límite del sistema, con «include», «extend» y generalización entre casos de uso. Conecta cada actor con los casos que inicia; los casos nuevos van dentro del límite del sistema.', build: usecaseTemplate },
  { id: 'component', name: 'Componentes: tienda online', description: 'La web consume la interfaz de pedidos; un puerto delega en el gestor de pedidos.', notations: ['component'], about: 'La web consume la interfaz de pedidos que ofrece un componente, y un puerto delega en el gestor interno. Une interfaces proporcionadas y requeridas con Ensamblaje; el panel Problemas avisa si queda alguna sin satisfacer.', build: componentTemplate },
  { id: 'deployment', name: 'Despliegue: tienda en la nube', description: 'Móvil, servidor con un contenedor Docker y base de datos, con sus artefactos.', notations: ['deployment'], about: 'Un móvil, un servidor con un contenedor Docker y una base de datos, con los artefactos desplegados en cada nodo. Arrastra un artefacto dentro de un nodo para desplegarlo y une los nodos con rutas de comunicación.', build: deploymentTemplate },
  { id: 'activity', name: 'Actividad: tramitar un pedido', description: 'Dos calles, una decisión, una bifurcación con su unión y un nodo objeto.', notations: ['activity'], about: 'Tramitar un pedido en dos calles, con una decisión, una bifurcación con su unión y un nodo objeto. Las guardas van en las flechas que salen de la decisión: selecciona una para editarla en el inspector.', build: activityTemplate },
  { id: 'gantt', name: 'Gantt: lanzamiento de una web', description: 'Dos fases con dependencias, ruta crítica y un hito, sobre una línea de tiempo.', notations: ['gantt'], about: 'Un lanzamiento en dos fases con dependencias, la ruta crítica resaltada y un hito. Arrastra una barra para moverla en el tiempo o estira su borde para cambiar la duración; conecta dos tareas para crear una dependencia.', build: ganttTemplate },
  { id: 'ddd', name: 'DDD: mapa de contextos de una tienda', description: 'Subdominios y contextos con sus patrones de relación, y el modelo táctico de Pedidos.', notations: ['ddd'], about: 'El mapa de contextos de una tienda: subdominios, contextos acotados y sus patrones de relación, con el modelo táctico de Pedidos en otra vista. Selecciona una relación entre contextos para elegir su patrón en el inspector.', build: dddTemplate },
];

/**
 * Plantillas de la galería. `build` deja la nota de bienvenida (`about`) en la primera vista, salvo el espacio en
 * blanco, cuya vista vacía ya explica qué hacer.
 */
export const TEMPLATES: Template[] = RAW.map(tpl => ({ ...tpl, build: (t: Tr) => (tpl.id === 'blank' ? tpl.build(t) : withWelcome(tpl.build(t), t(tpl.about))) }));

export const templateById = (id: string): Template | undefined => TEMPLATES.find(x => x.id === id);

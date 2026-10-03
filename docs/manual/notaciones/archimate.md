# ArchiMate 3.2

## Qué es y cuándo usarla {#que-es}

ArchiMate es el lenguaje de **arquitectura empresarial** de The Open Group. Sirve para contar, en un
mismo dibujo, qué hace la organización (negocio), con qué aplicaciones lo hace (aplicación) y sobre qué
infraestructura corren (tecnología), además de la estrategia, la motivación (objetivos, requisitos) y los
proyectos de cambio.

Úsala cuando quieras responder preguntas como "¿qué aplicaciones dan soporte a este proceso?", "¿qué
pasa si apagamos este servidor?" o "¿qué capacidades cubre este proyecto?". Si lo que necesitas es el
paso a paso de un proceso, combínala con [BPMN](bpmn.md); para el detalle de un software, con [C4](c4.md).

El pack de all-draw se genera a partir de los ficheros de la herramienta Archi, así que es fiel a la
especificación: **61 elementos** (los 60 de ArchiMate 3.2 más *Junction*), **11 relaciones**, la matriz
de validez completa y **25 viewpoints**. Los nombres de los tipos se mantienen en inglés, como en la
especificación.

![Vista ArchiMate de la demo en el editor](../img/03-editor-archimate.png)

## Elementos clave {#elementos-clave}

La paleta agrupa los elementos por capa (*Strategy*, *Business*, *Application*, *Technology*,
*Physical*, *Motivation*, *Implementation & Migration* y *Composite / Other*). Los que más vas a usar:

| Elemento | Capa | Qué representa |
|---|---|---|
| **Business Actor** | Negocio | Una persona u organización concreta: "Cliente", "Departamento de riesgos" |
| **Business Role** | Negocio | Un papel que alguien desempeña: "Gestor comercial" |
| **Business Process** | Negocio | Una secuencia de trabajo con un resultado: "Alta de cliente" |
| **Business Service** | Negocio | Lo que el negocio ofrece hacia fuera: "Servicio de onboarding" |
| **Business Object** | Negocio | Información de negocio: "Contrato", "Solicitud" |
| **Application Component** | Aplicación | Una aplicación o módulo: "CRM" |
| **Application Service** | Aplicación | Lo que una aplicación ofrece a otros: "Verificación KYC" |
| **Data Object** | Aplicación | Datos que maneja una aplicación: "Expediente de cliente" |
| **Node** | Tecnología | Infraestructura donde corre software: "Clúster Kubernetes" |
| **Capability**, **Goal**, **Work Package** | Estrategia, motivación, implementación | Lo que la organización sabe hacer, lo que quiere conseguir y los proyectos para llegar |

Dos elementos especiales: **Grouping** (agrupa cualquier cosa) y **Location** (dónde está algo) aceptan
cualquier hijo; **Junction** une o reparte relaciones (*and*/*or*).

En la pestaña **Estilo** del inspector puedes elegir cómo se pinta cada nodo: *Rectángulo con icono* o
*Figura ArchiMate* (la forma alternativa de la especificación, como el muñeco del actor).

## Relaciones {#relaciones}

| Relación | Significado | Ejemplo |
|---|---|---|
| **Composition** | Está formado por (la parte no existe sin el todo) | Un componente compuesto de módulos |
| **Aggregation** | Agrupa (la parte puede existir sola) | Un producto agrupa servicios |
| **Assignment** | Quién hace qué | *Gestor comercial* → *Alta de cliente* |
| **Realization** | Hace realidad | *CRM* → *Verificación KYC* |
| **Serving** | Da servicio a | *Verificación KYC* → *Alta de cliente* |
| **Access** | Lee o escribe datos (campo `accessType`: lectura, escritura…) | *Alta de cliente* → *Expediente de cliente* |
| **Influence** | Influye en (motivación; campo `strength`) | Un principio influye en un requisito |
| **Triggering** | Desencadena (orden temporal) | Un proceso dispara otro |
| **Flow** | Pasa algo a | Un proceso pasa información a otro |
| **Specialization** | Es un tipo de | "Cliente premium" es un tipo de "Cliente" |
| **Association** | Relación genérica (campo `directed`). Es la relación por defecto | Cualquier vínculo sin semántica fuerte |

Al conectar dos nodos, el selector ofrece solo las relaciones que la matriz permite entre esos dos tipos
(más las [relaciones puente](../notaciones.md#relaciones-puente) del núcleo, que valen siempre).

## Cómo empezar {#como-empezar}

Ejemplo basado en la vista *Arquitectura · Alta de cliente* de la demo:

1. En el panel **Vistas**, pulsa **＋** y elige **ArchiMate 3.2**. En el inspector de la vista (clic en el
   fondo del lienzo) pon el nombre y, si quieres, el viewpoint *Layered*.
2. Arrastra desde la paleta un **Business Actor** "Cliente", un **Business Role** "Gestor comercial" y un
   **Business Process** "Alta de cliente". Renombra con **F2**.
3. Une el rol con el proceso: arrastra desde el borde inferior del rol hasta el proceso y elige
   **Assignment**.
4. Añade un **Application Service** "Verificación KYC" y únelo al proceso con **Serving**.
5. Añade un **Application Component** "CRM" y únelo al servicio con **Realization**.
6. Añade un **Data Object** "Expediente de cliente" y une el proceso con él mediante **Access**.
7. Para detallar el proceso en BPMN: botón derecho sobre "Alta de cliente" → **Abrir en otra dimensión**
   (ver [Conceptos](../conceptos.md#drill-down)).

## Reglas de la notación {#reglas}

- **Matriz de validez completa** (la misma que Archi): entre cada par de tipos solo se permiten las
  relaciones que la especificación admite. Las relaciones puente del núcleo (`core:trace`,
  `core:realizes`…) valen siempre para enlazar con otras notaciones.
- **Anidar crea relación**: al meter un elemento dentro de otro se propone una relación de anidamiento,
  *Composition* por defecto; también *Aggregation*, *Assignment*, *Realization*, *Specialization* o
  *Access* si la matriz lo permite. Sacarlo del contenedor la elimina.
- **Grouping** y **Location** aceptan cualquier hijo, con *Composition* o *Aggregation*.
- **Viewpoints**: hay 25 (*Organization*, *Business Process Cooperation*, *Application Cooperation*,
  *Layered*, *Capability Map*, *Motivation*, *Implementation and Migration*…). Elegir uno atenúa en la
  paleta los tipos que no le corresponden y el panel de problemas avisa si los usas; no los prohíbe.

## Importar y exportar {#importar-exportar}

- **Archi** (`.archimate`): importa y exporta, con vistas, carpetas, propiedades, colores y puntos de
  quiebre. Ver [Importar y exportar](../importar-exportar.md#archi).
- **ArchiMate Open Exchange** (`.oef.xml`): el formato de intercambio estándar, para Archi, BiZZdesign,
  Sparx y otras herramientas.
- Al exportar a estos formatos se omiten, con aviso, los elementos que no son ArchiMate. Lo que no cabe
  en ellos (dimensiones, pines, trazas) se conserva en el JSON de all-draw.
- Cada vista también se exporta a SVG, PNG, Mermaid y draw.io ([tabla de formatos](../importar-exportar.md#formatos)).

## Errores comunes {#errores-comunes}

- **La relación no aparece al conectar**: la matriz no la permite en ese sentido. Por ejemplo, un
  *Business Object* no puede *acceder* a un proceso: es el proceso el que accede al objeto. Prueba a
  conectar en sentido contrario.
- **Se crea una Composition que no querías** al soltar un nodo dentro de otro. Selecciona la relación y
  cámbiala en el inspector, o usa un **Grouping** o un **Grupo** visual si solo quieres agrupar.
- **Confundir actor y rol**: el actor es *quién* (Ana, el cliente); el rol, *qué papel* tiene. Asigna el
  actor al rol y el rol al proceso.
- **Mezclar capas sin servicios**: una aplicación no "hace" un proceso de negocio; le da servicio
  (*Application Service* → *Serving* → proceso).

## Referencia completa {#referencia}

La lista completa de tipos, relaciones, matriz de validez y viewpoints se genera desde el propio pack:

<!-- docs:notation-ref archimate -->

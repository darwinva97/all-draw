# Flujo de datos (DFD)

## Qué es y cuándo usarla {#que-es}

Un diagrama de flujo de datos (DFD) muestra **por dónde viaja la información** de un sistema: de dónde
viene, qué procesos la transforman, dónde se guarda y adónde va. No dice en qué orden pasan las cosas ni
quién las hace; solo qué datos se mueven.

Úsalo para analizar un sistema antes de diseñarlo, para revisiones de privacidad y seguridad ("¿por
dónde pasan los datos personales?") o para documentar integraciones. Sigue las notaciones clásicas de
Yourdon/DeMarco y Gane-Sarson, y se trabaja por **niveles**: un diagrama de contexto con un único proceso
y, a partir de él, diagramas más detallados.

## Elementos clave {#elementos-clave}

| Elemento | Forma | Qué representa |
|---|---|---|
| **Proceso** | Círculo | Algo que transforma datos: "Validar pedido". El campo **Número** lleva la numeración por niveles: "0" para el contexto, "1", "1.2"… |
| **Almacén de datos** | Dos líneas paralelas | Datos en reposo: una tabla, un fichero, una cola. Su **Identificador** es "D1", "D2"… |
| **Entidad externa** | Rectángulo | Quien envía o recibe datos desde fuera del sistema: una persona, una organización, otro sistema |

## Relaciones {#relaciones}

Una sola: el **Flujo de datos**, una flecha con el campo obligatorio **Datos**, que nombra lo que viaja
("pedido validado", "datos de pago").

## Cómo empezar {#como-empezar}

1. En el panel **Vistas**, pulsa **＋** y elige **Flujo de datos (DFD)**. Para el nivel de contexto, elige
   en el inspector de la vista el viewpoint **Contexto (nivel 0)**.
2. Arrastra un **Proceso** "Sistema de altas" (Número `0`) y dos **Entidad externa**: "Cliente" y
   "Proveedor KYC".
3. Une "Cliente" con el proceso, elige **Flujo de datos** en el selector (sale el primero) y escribe en
   **Datos** "solicitud de alta".
4. Une el proceso con "Proveedor KYC" ("datos de identidad") y el proveedor con el proceso ("resultado de
   verificación").
5. Para el nivel 1: botón derecho sobre el proceso → **Nueva vista de detalle…**. En la vista nueva,
   descompón el proceso en "1 Recoger datos", "2 Verificar identidad", "3 Crear cuenta" y añade un
   **Almacén de datos** "D1 Clientes".

## Reglas de la notación {#reglas}

- **Todo flujo toca un proceso**: no valen flujos entre dos entidades externas, entre dos almacenes ni
  entre una entidad externa y un almacén. Los datos siempre pasan por un proceso.
- **Los niveles no se anidan**: cada nivel es una **vista de detalle** del proceso que descompone (ver
  [drill-down](../conceptos.md#drill-down)), y el campo **Número** mantiene la numeración ("1" → "1.1",
  "1.2").
- **Viewpoint** *Contexto (nivel 0)*: solo procesos y entidades externas.
- El campo **Datos** del flujo es obligatorio en la notación. all-draw no impide dejarlo vacío, así que
  revísalo antes de dar el diagrama por terminado.

## Importar y exportar {#importar-exportar}

- No hay un formato estándar de DFD para importar o exportar.
- La vista se exporta a **SVG**, **PNG**, **draw.io** y **HTML autocontenido**; **Mermaid** la exporta como
  `flowchart`. Ver la [tabla de formatos](../importar-exportar.md#formatos).

## Errores comunes {#errores-comunes}

- **Flujo directo de una entidad externa a un almacén**: falta el proceso que recibe y guarda los datos.
- **Flujos sin nombre**: un DFD sin el campo **Datos** no dice nada; ponle nombre a cada flujo.
- **Confundir DFD con diagrama de flujo**: si estás dibujando decisiones sí/no y el orden de los pasos,
  quieres un [diagrama de flujo](flow.md) o [BPMN](bpmn.md).
- **Procesos con nombre de sustantivo**: un proceso hace algo ("Validar pedido"), no es una cosa
  ("Pedidos").

## Referencia completa {#referencia}

La lista completa de tipos, relaciones, matriz de validez y viewpoints se genera desde el propio pack:

<!-- docs:notation-ref dfd -->

# 5. Librerías, reglas y personas

El botón **Espacio** de la barra (o Ctrl+K → "Abrir Espacio") abre un panel con tres pestañas.
Todo lo que defines aquí pertenece al espacio, viaja con él al exportar y se sincroniza con los
colaboradores.

![Panel Espacio, pestaña Reglas](img/09-espacio-reglas.png)

## Librerías

Una **librería** agrupa tipos de componente propios (además de los de las notaciones) y
**componentes** reutilizables.

- **Crear librería** (nombre y descripción). Dentro, crea **tipos** con: nombre, categoría (la
  sección en la que aparece en la paleta), forma, color, icono (texto o emoji), documentación, si
  es **contenedor** y sus **campos**.
- Cada campo tiene clave interna, nombre, tipo (`text`, `number`, `url`, `ref`, `list`,
  `keyvalue`, `json`) y la casilla **pin**: los campos marcados como pin se convierten en puntos de
  conexión de cada elemento de ese tipo (un campo `json` da un pin por hoja del ejemplo). Los
  botones *Subir/Bajar* ordenan los campos.
- Si borras un tipo que está en uso, el panel pide **reasignar** sus elementos a otro tipo.
- **Componentes**: elementos plantilla (por ejemplo "clientes-api" de tipo *Microservicio*) que se
  arrastran desde la pestaña *Librerías* de la paleta. Las instancias se crean a partir de la
  plantilla; si cambias la plantilla, el panel avisa de que las instancias no están al día y
  ofrece propagar los cambios.

El importador de `.drawer` crea una librería por cada librería del fichero y una librería `lib:apis`
con las APIs y sus operaciones (los cuerpos de petición/respuesta son pines). Lo mismo hace el
importador de OpenAPI.

## Reglas

Una **regla** pinta los elementos (o relaciones) que cumplen sus condiciones, en todas las vistas o
en una concreta. Sirve para "colorear por datos": marcar en rojo lo que tiene la etiqueta
`deprecated`, resaltar los componentes de un equipo, atenuar lo que no tiene dueño…

- **Se aplica a**: elementos o relaciones; *Todas las vistas* o *En la vista* concreta.
- **Debe cumplirse**: *Todas las condiciones* o *Alguna condición*. Cada condición compara un
  campo (tipo, nombre, etiqueta, campo de la librería, persona asignada…) con un valor.
- **Qué se pinta**: relleno, borde, texto, línea (continuo, discontinuo, punteado), con vista
  previa.
- **Prioridad**: si varias reglas afectan al mismo elemento, la de más prioridad gana en las
  propiedades que fija; el panel muestra el **impacto** (cuántos elementos cumple) y las
  **colisiones** entre reglas.
- **Activa**: desactiva una regla sin borrarla.

El estilo manual de un nodo (pestaña *Estilo* del inspector) solo afecta a esa aparición; las
reglas son la forma de estilizar por datos y de manera coherente en todas las vistas.

## Personas

Quién participa en el modelo: nombre, correo, equipo, notas. Una persona se **asigna** con un
papel (placeholder "papel") a elementos, vistas, capas o etapas de una rejilla, tipos o relaciones.
En el inspector de un elemento hay una sección *Personas* para asignar directamente. Las
asignaciones son datos del modelo: se pueden usar en reglas ("pintar lo de Ana") y se exportan.
No confundir con las **cuentas** del servidor (capítulo 6): las personas son parte del contenido.

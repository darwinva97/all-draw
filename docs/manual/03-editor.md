# 3. El editor

![Editor: barra, vistas y paleta a la izquierda, lienzo, inspector a la derecha](img/03-editor-archimate.png)

Zonas, de izquierda a derecha:

1. **Barra**: *Espacio* (librerías, reglas, personas), ☰ (volver al inicio), nombre del espacio
   (editable), ruta de vistas, presencia, buscar (⌕), ajuste a rejilla (⌗), tema (◐/☀/☾), atajos
   (?), deshacer/rehacer, estado de guardado, *Importar / Exportar*, *Compartir* o *Subir al servidor*.
2. **Vistas** y **Paleta** (columna izquierda).
3. **Lienzo** con los controles de zoom y el minimapa; debajo, la barra de **problemas**.
4. **Inspector** (columna derecha): lo seleccionado (elemento, arista o vista).

## Paleta

Cuatro pestañas:

| Pestaña | Contenido |
|---|---|
| **Notación** | Tipos de la notación de la vista actual agrupados por categoría (los que no encajan en el viewpoint van atenuados al final). Debajo, plegadas, las demás notaciones ("otra notación"): puedes mezclar, y el validador avisará si la relación no es válida. |
| **Librerías** | Tipos definidos en las librerías del espacio y **componentes** reutilizables (plantillas; ver [capítulo 5](05-librerias-reglas-personas.md)). |
| **Modelo** | Elementos que ya existen. Arrastrar uno crea una **nueva aparición** del mismo elemento en esta vista. Los que no aparecen en ninguna vista van marcados como huérfanos. |
| **Visual** | Nodos sin elemento de modelo: **Nota**, **Grupo** (marco que mueve lo que contiene), **Etiqueta** e **Imágenes** (por URL o desde fichero, que se guarda incrustada). |

El campo *Buscar…* filtra cualquiera de las pestañas. Para añadir un nodo, **arrastra** el tipo al
lienzo (se crea un elemento nuevo del tipo con el nombre del tipo; pulsa **F2** para renombrarlo).

## Conectar

- Arrastra desde el **borde inferior** de un nodo hasta otro nodo. Si la matriz de la notación
  permite varias relaciones entre esos dos tipos, aparece un selector; si solo una, se crea
  directamente; si ninguna, la conexión se rechaza.
- Arrastra desde un **pin** (cuadradito en el borde) hasta otro pin: conecta dos valores tipados.
  Solo se ofrecen las relaciones compatibles con esos tipos de pin.
- Seleccionada una arista, el inspector permite cambiar el tipo de relación, el nombre, los campos
  de la relación (condición de un `SequenceFlow`, evento/guarda de una transición…), el enrutado
  (*Recta*, *Curva*, *Ortogonal*) y el estilo de línea.
- **Doble clic** en una arista inserta un **punto de quiebre**; arrástralo para moverlo y haz
  doble clic sobre el manejador para quitarlo. La barra de alineación tiene *Quitar todos los
  puntos de quiebre*.

## Pines

Los **pines** son los valores tipados de un elemento expuestos como puntos de conexión. Se derivan
de los campos del tipo (un campo `json` da un pin por hoja: `respuesta.cliente.email`; los campos
`list`, `keyvalue` o simples dan un pin plano) o se declaran a mano.

![Inspector, pestaña Pines, sobre un microservicio de la demo](img/07-rejilla-pines.png)

En la pestaña **Pines** del inspector marcas cuáles quieres ver en *este* nodo (*Todos* /
*Ninguno*); los que ya usa una relación llevan un punto y no se pueden ocultar. Una relación entre
pines guarda además **mapeos** campo→campo, que se pintan como etiqueta sobre la arista
(`email ⇄`). En la demo, el microservicio `clientes-api` conecta `cliente.email` con
`notificaciones`.

## Anidar

Suelta un nodo dentro de otro que sea **contenedor** en su notación (pool/lane/subproceso en BPMN,
sistema/contenedor en C4, estado compuesto, grupo en ArchiMate, paquete UML…). El hijo se mueve
con el padre y, si la notación define una **relación implícita** de anidamiento (en ArchiMate,
*Composition* por defecto), se crea sola. Sacarlo fuera la elimina. Las coordenadas del hijo son
relativas al padre. Para anidar sin relación, usa un **Grupo** visual.

## Mover, redimensionar, alinear

- Arrastra para mover; **flechas** mueven 1 px y **Shift+flechas** 10 px.
- Arrastra las esquinas del nodo seleccionado para cambiar el tamaño.
- **Ajuste a rejilla** (⌗ en la barra, 8 px): mantén **Alt** mientras arrastras para desactivarlo
  puntualmente.
- Con **dos o más nodos** seleccionados (Shift+clic o Shift+arrastrar por área) aparece la barra
  flotante: alinear izquierda/centro/derecha/arriba/medio/abajo, distribuir horizontal o
  verticalmente, igualar ancho o alto.
- **Layout automático** (Ctrl+K → "Layout automático de la vista"): coloca los nodos con elkjs
  según la notación (por capas en BPMN y flujos, árbol en mapas mentales, por celda en la rejilla).

## Copiar, pegar, duplicar

| Atajo | Efecto |
|---|---|
| Ctrl+C / Ctrl+V | Pega **nuevas apariciones de los mismos elementos** (útil para llevar un elemento a otra vista: copia, cambia de vista, pega) |
| Ctrl+Shift+V | Pega como **copia**: elementos nuevos |
| Ctrl+D | Duplica la selección (elementos nuevos) |
| Supr | Quita de la vista (no del modelo); *Borrar del modelo* está en el menú del nodo |

En una rejilla, lo pegado va a la celda bajo el cursor.

## Rejilla capas × etapas

En una vista *Capas × etapas* el lienzo es una tabla: filas = capas, columnas = etapas, y una
banda opcional de grupos de etapas. Los nodos se sueltan en una celda y quedan asociados a ella
(si se mueve la celda, se mueven). Capas y etapas (nombre, color, tamaño, orden) se editan en el
inspector de la vista. Es la vista que produce el importador de `.drawer`.

## Buscar (Ctrl+K)

Abre la paleta de búsqueda: escribe para encontrar **elementos** (te lleva a una de sus
apariciones; si hay varias, elige la vista), **vistas** y **acciones** (crear vista de cada
notación, abrir Espacio, layout automático, ajustar a la vista, cambiar tema, atajos).
**Ctrl+F** hace lo mismo.

## Panel de problemas

![Panel de problemas desplegado](img/08-problemas.png)

La barra inferior resume errores, avisos y notas. Al desplegarla, cada problema tiene un enlace
que selecciona el nodo o arista afectado y, cuando existe, un botón de **arreglo** (cambiar la
relación por una válida, borrar duplicados, quitar un huérfano…). Validadores incluidos: reglas
del núcleo (referencias rotas, tipos desconocidos, relaciones inválidas por la matriz, huérfanos),
geometría (solapes, aristas que cruzan nodos), diez reglas de **bpmnlint** y **cobertura de
trazas** entre notaciones.

## Tema

El botón de la barra alterna *sistema → claro → oscuro*. Se guarda en el navegador. La
exportación SVG "dual" respeta el tema del lector.

## Atajos de teclado

Pulsa **?** en el editor para ver esta tabla en pantalla.

| Grupo | Atajo | Acción |
|---|---|---|
| General | Ctrl+K / Ctrl+F | Buscar elementos, vistas y acciones |
| | ? | Panel de atajos |
| | Esc | Cerrar paneles, cancelar |
| | Ctrl+Z / Ctrl+Y | Deshacer / rehacer |
| Selección | Ctrl+A | Seleccionar todo |
| | Shift+clic | Añadir a la selección |
| | Shift+arrastrar | Selección por área |
| | F2 | Renombrar el elemento seleccionado |
| | Supr | Quitar de la vista |
| Edición | Ctrl+C / Ctrl+V | Copiar / pegar (misma aparición) |
| | Ctrl+Shift+V | Pegar como copia (elementos nuevos) |
| | Ctrl+D | Duplicar |
| | Flechas / Shift+flechas | Mover 1 px / 10 px |
| | Alt (mantener) | Desactivar el ajuste a rejilla |
| Vista | + / − | Acercar / alejar |
| | Ctrl+0 | Zoom al 100 % |
| | Ctrl+Shift+F | Ajustar a la vista |
| | Doble clic en nodo | Entrar en su vista de detalle |
| | Doble clic en el nombre | Renombrar en línea |
| | Doble clic en arista | Añadir punto de quiebre |
| | Botón derecho | Menú del nodo / del lienzo |

## Accesibilidad

- Todos los controles se alcanzan con **Tab** y el foco es visible; los botones de icono tienen
  nombre accesible; los diálogos (entrar, compartir, buscar, atajos, Espacio) atrapan el foco y se
  cierran con **Escape** devolviendo el foco al botón que los abrió.
- Los mensajes de error y de estado (conexión, enlace copiado) se anuncian en regiones `aria-live`.
- El lienzo es un componente gráfico: la alternativa por teclado es la búsqueda (Ctrl+K) más el
  inspector, que expone todos los datos de lo seleccionado en campos etiquetados.
- Contraste de texto ≥ 4.5:1 en tema claro y oscuro; `prefers-reduced-motion` desactiva las
  transiciones.

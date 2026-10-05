# Diagrama de Gantt

## Qué es y cuándo usarla {#que-es}

El diagrama de Gantt muestra **un plan en el tiempo**: cada tarea es una barra que va de su fecha de
inicio a su fecha de fin, los hitos marcan fechas clave y las flechas dicen qué tiene que acabar antes de
que empiece otra cosa. De un vistazo se ve qué se hace cada semana, qué va en paralelo y qué retrasa al
resto.

Úsalo para planificar un proyecto, seguir su avance o explicar un calendario a quien tiene que aprobarlo.
Para el orden lógico de los pasos sin fechas, un diagrama de [actividad](activity.md) es más adecuado.

Las vistas de Gantt tienen **lienzo propio**: una fila por tarea y las barras sobre una línea de tiempo.
Las barras se calculan a partir de los campos **Inicio**, **Fin** y **Duración (días)**, no de la
posición del nodo. La escala (días, semanas o meses) se elige sola según lo que dura el proyecto, y
puedes cambiarla con los botones de arriba a la izquierda de la línea de tiempo.

## Elementos clave {#elementos-clave}

| Elemento | Forma | Qué representa |
|---|---|---|
| **Tarea** | Barra | Un trabajo con **Inicio**, **Fin** y **Duración (días)**. **Progreso (%)** rellena la barra; **Crítica** la pinta en rojo (está en el camino crítico). Campo **Responsable** |
| **Hito** | Rombo | Un punto de control sin duración: entrega, aprobación, lanzamiento. Solo tiene **Fecha** |
| **Fase** | Barra resumen | Un grupo de tareas: va de la primera a la última fecha de las tareas e hitos que contiene. Puede contener otras fases |

Las fechas son ISO (`AAAA-MM-DD`) y cuentan días naturales. El **Fin** es inclusivo: una tarea de un día
tiene el mismo inicio y fin. Si falta el **Fin**, sale de la duración; si falta el **Inicio**, se deduce
de las predecesoras (según sus dependencias) o del fin y la duración.

## Relaciones {#relaciones}

| Relación | Dibujo | Significado |
|---|---|---|
| **Dependencia** | Flecha en codo | La tarea destino depende de la origen. **Tipo de dependencia**: *Fin → inicio (FS)*, la habitual y la que se usa si no eliges otra; *Inicio → inicio (SS)*; *Fin → fin (FF)*; *Inicio → fin (SF)*. **Desfase (días)** añade espera (o solapamiento, si es negativo) |

## Cómo empezar {#como-empezar}

1. En el panel **Vistas**, pulsa **＋** y elige **Diagrama de Gantt**. O parte de la plantilla **Gantt:
   lanzamiento de una web** de la pantalla de inicio.
2. Arrastra una **Fase** "Diseño" y, después, dos **Tarea** soltándolas sobre la fila de la fase (así quedan
   dentro de ella): "Bocetos" y "Maqueta". Una tarea nace el día sobre el que la sueltas, con 5 días de duración.
3. En el inspector de "Bocetos", pon **Inicio** `2026-11-02` y **Duración (días)** `5`. En "Maqueta",
   solo **Duración (días)** `10`.
4. Une "Bocetos" → "Maqueta" con **Dependencia** (sale la primera): "Maqueta" empieza el día siguiente
   a que acabe "Bocetos", sin que tengas que escribir su inicio.
5. Añade un **Hito** "Aprobación del diseño" y únelo desde "Maqueta" con otra **Dependencia**.
6. Ajusta sobre el lienzo: **arrastra una barra** en horizontal para mover sus fechas (en días enteros),
   **arrastra su borde derecho** para cambiar la duración y **arrastra una fase** para mover todo lo que
   contiene.
7. A medida que avanza el trabajo, rellena **Progreso (%)** y marca **Crítica** en las tareas que no
   pueden retrasarse.

## Reglas de la notación {#reglas}

- **Dependencia** une cualquier combinación de tareas, hitos y fases.
- **Anidamiento**: una **Fase** contiene tareas, hitos y otras fases. Anidar no crea relaciones, pero
  la fase se estira para abarcar todo lo que contiene.
- No hay viewpoints.

## Importar y exportar {#importar-exportar}

- **Mermaid** (`gantt`): las fases se exportan como `section`, las dependencias FS como `after`, los
  hitos como `milestone`, las tareas críticas como `crit` y el progreso como `done` o `active`.
- Al **importar** un `gantt` de Mermaid se crea una vista de Gantt. Las dependencias que no son FS se
  convierten en fechas explícitas, con un aviso.
- La vista se exporta también a **SVG**, **PNG**, **draw.io** y **HTML autocontenido**. Ver la
  [tabla de formatos](../importar-exportar.md#formatos).

## Errores comunes {#errores-comunes}

- **Barras que no están donde esperas**: salen de **Inicio**, **Fin** y **Duración (días)**, no de la
  posición; revisa esos campos o la dependencia que fija el inicio.
- **Fin un día de más**: el fin es el **último día** de la tarea, no el siguiente. Una tarea del lunes al
  viernes acaba el viernes.
- **Escribir todas las fechas a mano**: pon el inicio de la primera tarea y une el resto con
  dependencias; así, si algo se retrasa, las tareas sin inicio propio se mueven con ello.
- **Hitos con duración**: si algo dura días, es una **Tarea**; el hito es solo una fecha.

## Referencia completa {#referencia}

La lista completa de tipos, relaciones, matriz de validez y viewpoints se genera desde el propio pack:

<!-- docs:notation-ref gantt -->

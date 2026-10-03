# Mapa mental

## Qué es y cuándo usarla {#que-es}

Un mapa mental parte de una **idea central** y la desarrolla en **ramas**: temas principales alrededor
y, de cada uno, subtemas cada vez más concretos. Es la forma más rápida de ordenar ideas sin
preocuparse todavía por la estructura formal.

Úsalo para lluvias de ideas, preparar una reunión o una presentación, resumir un documento o hacer un
primer esquema de algo que luego modelarás con una notación más formal.

## Elementos clave {#elementos-clave}

| Elemento | Forma | Qué representa |
|---|---|---|
| **Idea central** | Elipse amarilla | El tema del mapa. Normalmente hay una |
| **Tema** | Caja redondeada | Una rama principal que sale de la idea central. Tiene **Prioridad** (un número) |
| **Subtema** | Texto | Un detalle de un tema; puede tener sus propios subtemas, tan profundo como quieras |

Los tres tienen un campo **Notas** para apuntar lo que no cabe en el nombre.

## Relaciones {#relaciones}

Una sola: la **Rama**, una línea sin flecha del padre al hijo.

## Cómo empezar {#como-empezar}

1. En el panel **Vistas**, pulsa **＋** y elige **Mapa mental**.
2. Arrastra una **Idea central**: "Lanzamiento del producto".
3. Arrastra tres **Tema**: "Marketing", "Ventas", "Soporte". Une la idea central con cada uno y elige
   **Rama** en el selector (sale la primera).
4. Añade **Subtema** bajo cada tema ("Campaña en redes", "Formación del equipo"…) y únelos a su tema con
   **Rama**.
5. Pulsa **Ctrl+K** y elige **Layout automático de la vista**: el mapa se ordena solo en forma de árbol.

## Reglas de la notación {#reglas}

- Las ramas van siempre **hacia fuera**: idea central → tema o subtema; tema → tema o subtema; subtema →
  subtema. **Nada apunta a la idea central** y un subtema no puede tener un tema como hijo.
- La jerarquía se expresa con ramas, **no anidando** nodos unos dentro de otros.
- El layout automático usa una disposición en árbol de izquierda a derecha.

## Importar y exportar {#importar-exportar}

- No hay todavía importación ni exportación a formatos de mapas mentales (FreeMind, XMind, Mermaid
  `mindmap`).
- La vista se exporta a **SVG**, **PNG**, **draw.io** y **HTML autocontenido**; **Mermaid** la exporta como
  `flowchart`. Ver la [tabla de formatos](../importar-exportar.md#formatos).

## Errores comunes {#errores-comunes}

- **La Rama no aparece en el selector** (solo salen las relaciones del núcleo): probablemente vas del hijo
  al padre. Conecta siempre desde el nodo más cercano al centro.
- **Frases largas en los nodos**: un mapa mental funciona con palabras clave; lo demás, en **Notas**.
- **Varias ideas centrales**: si te salen dos, quizá son dos mapas, o dos temas de una idea más general.

## Referencia completa {#referencia}

La lista completa de tipos, relaciones, matriz de validez y viewpoints se genera desde el propio pack:

<!-- docs:notation-ref mindmap -->

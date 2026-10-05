# Componentes (UML)

## Qué es y cuándo usarla {#que-es}

El diagrama de componentes de UML muestra **de qué piezas reemplazables está hecho un sistema y cómo
encajan**: cada componente ofrece unas interfaces (lo que sabe hacer) y necesita otras (lo que pide a los
demás), y el diagrama dice quién satisface a quién.

Úsalo para diseñar o documentar la arquitectura interna de una aplicación, decidir qué módulos pueden
cambiarse sin tocar el resto o acordar los contratos entre equipos. Si buscas una vista más ligera para
explicar un sistema a cualquiera, [C4](c4.md) es más directo; para ver dónde corre cada pieza, usa el
diagrama de [despliegue](deployment.md).

## Elementos clave {#elementos-clave}

| Elemento | Forma | Qué representa |
|---|---|---|
| **Componente** | Rectángulo con el icono de componente arriba a la derecha | Una parte modular del sistema. Es contenedor: dentro van subcomponentes, puertos, interfaces y artefactos. Campos **Estereotipo** («subsystem», «service», «library»…) y **Tecnología** |
| **Interfaz proporcionada** | Círculo («lollipop») | Lo que el componente ofrece. Campo **Operaciones**, una por línea: `+ consultar(id): Pedido` |
| **Interfaz requerida** | Semicírculo («socket») | Lo que el componente necesita de otro. Campo **Operaciones** |
| **Puerto** | Cuadrado pequeño sobre el borde | Un punto de interacción del componente que agrupa interfaces proporcionadas y requeridas |
| **Artefacto** | Rectángulo con el icono de documento | La pieza física que implementa un componente. Campo **Fichero** (`pedidos.jar`, `api:1.4.2`) |
| **Paquete** | Carpeta con pestaña | Agrupa componentes, interfaces y artefactos |

## Relaciones {#relaciones}

| Relación | Dibujo | Significado |
|---|---|---|
| **Proporciona** | Línea continua | Une un componente o puerto con la interfaz que ofrece (el palo del «lollipop») |
| **Requiere** | Línea continua | Une un componente o puerto con la interfaz que necesita (el palo del «socket») |
| **Ensamblaje** | Línea continua | La interfaz requerida (origen) queda satisfecha por la proporcionada (destino); también une dos componentes o dos puertos. Es la relación por defecto |
| **Delegación** | Continua con flecha abierta, rotulada «delegate» | Lo que llega a un puerto lo atiende una parte interna del componente |
| **Realización** | Discontinua con triángulo hueco | El componente (origen) implementa una interfaz o la especificación de otro componente |
| **Dependencia** | Discontinua con flecha abierta | El origen necesita al destino para funcionar. **Estereotipo** opcional («use», «import», «manifest»…) |

El rótulo «delegate» lo pinta el lienzo solo, a partir del tipo de relación.

## Cómo empezar {#como-empezar}

1. En el panel **Vistas**, pulsa **＋** y elige **Componentes (UML)**. O parte de la plantilla
   **Componentes: tienda online** de la pantalla de inicio.
2. Arrastra dos **Componente**: "Pedidos" y "Pagos" (Estereotipo «service»).
3. Junto a "Pagos", arrastra una **Interfaz proporcionada** "API de pagos" con la operación
   `+ cobrar(pedido: Pedido): Recibo`, y únela desde "Pagos" con **Proporciona**.
4. Junto a "Pedidos", arrastra una **Interfaz requerida** "Cobro" y únela desde "Pedidos" con
   **Requiere**.
5. Une "Cobro" → "API de pagos" con **Ensamblaje** (sale el primero): la necesidad de "Pedidos" queda
   cubierta por lo que ofrece "Pagos".
6. Si "Pedidos" expone un **Puerto** en su borde, mete dentro un subcomponente "Validador" y une el puerto
   con él mediante **Delegación**.
7. Añade un **Artefacto** "pedidos.jar" y únelo a "Pedidos" con **Dependencia** y estereotipo «manifest».

## Reglas de la notación {#reglas}

- **Proporciona** y **Requiere** solo salen de un componente o de un puerto hacia una interfaz del tipo
  correspondiente.
- **Ensamblaje**: de interfaz requerida a interfaz proporcionada, entre dos componentes o entre dos
  puertos.
- **Delegación**: entre dos puertos, o entre un puerto y un componente (en cualquier sentido).
- **Realización**: de un componente a otro componente o a una interfaz proporcionada.
- **Dependencia**: entre componentes, de un componente a una interfaz, entre artefactos y componentes (en
  ambos sentidos), entre artefactos y entre paquetes.
- **Anidamiento**: un componente contiene componentes, puertos, interfaces y artefactos; un paquete
  contiene cualquier cosa. Anidar no crea relaciones.
- No hay viewpoints.

## Importar y exportar {#importar-exportar}

- Mermaid no tiene diagrama de componentes: **Mermaid** exporta la vista como un `flowchart` genérico de
  cajas y flechas, con un aviso.
- La vista se exporta a **SVG**, **PNG**, **draw.io** y **HTML autocontenido**. Ver la
  [tabla de formatos](../importar-exportar.md#formatos).

## Errores comunes {#errores-comunes}

- **Ensamblaje al revés**: el origen es la interfaz **requerida** (el semicírculo) y el destino la
  **proporcionada** (el círculo).
- **Unir componentes directamente para todo**: si el contrato importa, dibuja las interfaces; así se ve
  qué pieza puede sustituirse por otra que ofrezca lo mismo.
- **Confundir componente y artefacto**: el componente es la pieza lógica ("Pagos"); el artefacto, el
  fichero que la contiene ("pagos.jar"). Dónde se instala ese fichero va en el diagrama de
  [despliegue](deployment.md).
- **Un componente por clase**: si hay decenas de componentes diminutos, probablemente estás dibujando un
  [diagrama de clases](uml.md).

## Referencia completa {#referencia}

La lista completa de tipos, relaciones, matriz de validez y viewpoints se genera desde el propio pack:

<!-- docs:notation-ref component -->

# DDD: mapa de contextos

## Qué es y cuándo usarla {#que-es}

El diseño guiado por el dominio (DDD, de Eric Evans) parte el negocio en piezas con su propio lenguaje.
Tiene dos niveles. El **estratégico** es el **mapa de contextos**: qué subdominios tiene el negocio, qué
**contextos acotados** los resuelven y cómo se relacionan entre sí (quién manda, quién se adapta). El
**táctico** es el modelo de cada contexto: agregados, entidades, objetos de valor, eventos de dominio y
servicios.

Úsalo para decidir cómo partir un sistema en servicios o equipos, documentar las integraciones entre
ellos o diseñar el modelo de un contexto antes de programarlo. Para el detalle de clases sin la
semántica de DDD, usa el [diagrama de clases](uml.md); para las aplicaciones y bases de datos que
implementan cada contexto, [C4](c4.md).

## Elementos clave {#elementos-clave}

| Elemento | Nivel | Qué representa |
|---|---|---|
| **Dominio** | Estratégico | El área de negocio que se modela. Contiene subdominios y contextos acotados. Campo **Visión** |
| **Subdominio** | Estratégico | Una parte del dominio. **Tipo de subdominio** (obligatorio): *Núcleo (core)*, lo que diferencia al negocio; *De soporte (supporting)*; o *Genérico (generic)*, lo que se puede comprar |
| **Contexto acotado** | Estratégico | La frontera dentro de la cual un modelo y su lenguaje son coherentes. Contiene el modelo táctico. Campos **Equipo**, **Responsabilidades** (una por línea) y **Visión** |
| **Agregado** | Táctico | Un grupo que cambia como una unidad. Contiene entidades, objetos de valor y eventos. Campos **Raíz** e **Invariantes** |
| **Entidad** | Táctico | Un objeto con identidad propia («Entity»). Campos **Identidad**, **Atributos** y **Operaciones** |
| **Objeto de valor** | Táctico | Un objeto inmutable sin identidad: "Dinero", "Dirección" («Value Object»). Campo **Atributos** |
| **Evento de dominio** | Táctico | Algo que ya ha ocurrido, en pasado: "Pedido confirmado" («Domain Event»). Campo **Atributos** |
| **Servicio** | Táctico | Una operación que no es de ninguna entidad («Service»). **Capa** (*Dominio*, *Aplicación* o *Infraestructura*) y **Operaciones** |

Entidades, objetos de valor, eventos y servicios se dibujan como clasificadores: el «estereotipo» arriba
y los compartimentos de **Atributos** y **Operaciones** debajo, una línea por elemento (`importe:
Dinero`, `confirmar(): void`). El campo **Estereotipo** sustituye al de por defecto («Aggregate Root»,
«Repository»…).

## Relaciones {#relaciones}

| Relación | Dibujo | Significado |
|---|---|---|
| **Relación entre contextos** | Línea continua con el patrón rotulado | Cómo se relacionan dos contextos acotados. **Patrón** (obligatorio): *Partnership*, *Shared Kernel*, *Customer/Supplier*, *Conformist*, *Anticorruption Layer*, *Open Host Service*, *Published Language* o *Separate Ways*. **Papel del origen** y **Papel del destino**: *U* (upstream, del que se depende) o *D* (downstream), rotulados junto a cada extremo. Es la relación por defecto |
| **Implementa** | Discontinua con flecha abierta | El contexto acotado resuelve (total o parcialmente) un subdominio |
| **Referencia** | Continua con flecha abierta | El origen conoce o usa al destino; entre agregados, solo por identidad. **Multiplicidad origen** y **destino** |
| **Publica** | Discontinua con flecha | Un agregado, entidad o servicio emite un evento de dominio |
| **Desencadena** | Discontinua con flecha | Un evento de dominio pone en marcha un servicio, un agregado o un contexto que lo escucha |

## Cómo empezar {#como-empezar}

1. En el panel **Vistas**, pulsa **＋** y elige **DDD: mapa de contextos**. En el inspector de la vista,
   elige el viewpoint **Mapa de contextos**. O parte de la plantilla **DDD: mapa de contextos de una
   tienda** de la pantalla de inicio.
2. Arrastra un **Dominio** "Comercio electrónico" y, dentro, dos **Subdominio**: "Ventas" (*Núcleo*) y
   "Facturación" (*Genérico*).
3. Dentro del dominio, añade dos **Contexto acotado**: "Pedidos" y "Facturas". Une cada uno con su
   subdominio mediante **Implementa**.
4. Une "Pedidos" → "Facturas" con **Relación entre contextos** (sale la primera). Elige el **Patrón**
   *Customer/Supplier*, **Papel del origen** *U* y **Papel del destino** *D*: el lienzo rotula el patrón
   y las letras.
5. Crea otra vista DDD con el viewpoint **Modelo táctico** y lleva a ella el contexto "Pedidos" (es el
   mismo elemento; ver [reutilizar elementos](../modelo-y-vistas.md#reutilizar)). Dentro, mete un
   **Agregado** "Pedido" con la **Entidad** "Pedido" (Identidad `pedidoId`) y el **Objeto de valor**
   "Dinero".
6. Añade un **Evento de dominio** "Pedido confirmado", únelo desde el agregado con **Publica** y desde el
   evento a un **Servicio** "Emitir factura" con **Desencadena**.

## Reglas de la notación {#reglas}

- **Relación entre contextos** solo entre contextos acotados; **Implementa**, solo de un contexto acotado
  a un subdominio.
- **Referencia**: de un agregado, entidad, objeto de valor o servicio hacia un agregado, entidad u objeto
  de valor. Un objeto de valor solo puede referenciar otros objetos de valor.
- **Publica**: de un agregado, entidad o servicio a un evento de dominio. **Desencadena**: de un evento a
  un servicio, un agregado o un contexto acotado.
- **Anidamiento**: un dominio contiene subdominios y contextos acotados; un contexto acotado contiene
  agregados, entidades, objetos de valor, eventos y servicios; un agregado contiene entidades, objetos de
  valor y eventos. Anidar no crea relaciones.
- **Viewpoints**: *Mapa de contextos* (dominio, subdominios y contextos acotados, con relaciones entre
  contextos e implementa) y *Modelo táctico* (contexto acotado, agregados, entidades, objetos de valor,
  eventos y servicios, con referencia, publica y desencadena).

## Importar y exportar {#importar-exportar}

- No hay importación desde formatos de DDD (Context Mapper CML). Mermaid no tiene equivalente: **Mermaid**
  exporta la vista como un `flowchart` genérico de cajas y flechas, con un aviso.
- La vista se exporta a **SVG**, **PNG**, **draw.io** y **HTML autocontenido**. Ver la
  [tabla de formatos](../importar-exportar.md#formatos).

## Errores comunes {#errores-comunes}

- **Confundir subdominio y contexto acotado**: el subdominio es el problema ("Facturación"); el contexto,
  la solución con su modelo y su lenguaje. Únelos con **Implementa**.
- **U y D al revés**: *upstream* es el contexto del que se depende, el que publica su modelo;
  *downstream*, el que se adapta.
- **Agregados que se referencian por objeto**: entre agregados, la **Referencia** es por identidad
  (`clienteId`), no metiendo un agregado dentro de otro.
- **Todo es una entidad**: si un objeto no necesita identidad propia ("Dinero", "Dirección"), es un
  **Objeto de valor**.

## Referencia completa {#referencia}

La lista completa de tipos, relaciones, matriz de validez y viewpoints se genera desde el propio pack:

<!-- docs:notation-ref ddd -->

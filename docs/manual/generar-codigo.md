# Generar código

Un diagrama bien hecho ya contiene buena parte del código que vendrá después. **Generar código** convierte el modelo
en ficheros de partida: clases TypeScript o Java, el esquema SQL de la base de datos, una máquina XState lista para
ejecutar, el contrato OpenAPI de tus APIs o un workspace de Structurizr. El espacio no cambia: solo se leen los datos.

## Cómo se usa {#como}

1. Abre la vista de la que quieres el código (por ejemplo, el diagrama de clases).
2. **Importar / Exportar → Generar código…**
3. Elige el **generador**. Arriba salen los que sirven para la vista abierta; debajo, los que trabajan con **todo el
   espacio**.
4. Revisa la **vista previa** (con colores) y los **avisos**, si los hay.
5. **Copiar** copia el fichero que estás viendo. **Descargar** baja el fichero o, si hay varios, un **.zip** con
   todos.

Con una vista abierta, el generador usa **solo lo que aparece en esa vista**; desde *Para todo el espacio*, todo lo de
su notación.

## Generadores {#generadores}

| Generador | A partir de | Produce |
|---|---|---|
| **TypeScript (clases UML)** | Diagrama de clases | `src/model.ts` con enumeraciones, interfaces y clases (primero las superclases). |
| **Java (clases UML)** | Diagrama de clases | Un fichero por clase, interfaz o enumeración en `src/main/java/<paquete>/`. |
| **SQL PostgreSQL** / **SQL SQLite** | Entidad-relación | `schema.postgres.sql` / `schema.sqlite.sql`: tablas, claves primarias y ajenas, índices y vistas. |
| **Máquina XState** | Máquina de estados | `<nombre>.machine.ts`: máquina **XState v5** ejecutable con *stubs* para acciones y guardas. |
| **Tabla de transiciones** | Máquina de estados | `<nombre>.transitions.md`: estado, evento, guarda, destino y acciones, más entradas y salidas. |
| **OpenAPI** | Librería de APIs | Un `openapi/<api>.yaml` (OpenAPI 3.1) por API, con operaciones, parámetros y cuerpos. |
| **Structurizr DSL** | C4 o ArchiMate | `workspace.dsl` con el modelo, el despliegue y las vistas. |

### Clases UML → TypeScript y Java {#uml}

- Los **atributos** y **operaciones** se leen de cada línea del compartimento: `- nombre: String`,
  `+ total(): Decimal`, `# items: Linea[*]`, `+ crear(pedido: Pedido): void`. La visibilidad (`+ - # ~`), el tipo, el
  valor por defecto y la multiplicidad (`[*]`, `[0..1]`) se respetan.
- Los tipos habituales se traducen (`String` → `string` / `String`, `int` → `number` / `int`, `Date` → `Date` /
  `LocalDateTime`, listas → `T[]` / `List<T>`). Un tipo que no se reconoce queda tal cual y genera un aviso.
- **Generalización** → `extends`; **Realización** → `implements`. **Asociación**, **agregación** y **composición**
  añaden una propiedad en el lado navegable con el **rol** y la **multiplicidad** del extremo.
- Los métodos llevan un cuerpo que lanza "no implementado", para que el fichero compile desde el principio.
- Nombres con espacios o acentos se convierten en identificadores válidos (y se avisa).

### Entidad-relación → SQL {#sql}

- Cada **entidad** es una tabla (el campo *Tabla física* manda sobre el nombre) y cada **atributo**, una columna con
  su tipo traducido a cada base de datos.
- La **clave primaria** sale del campo *Clave primaria*; si está vacío y hay una columna `id`, se usa esa.
- Las relaciones con **cardinalidad** crean las claves ajenas: el lado "muchos" apunta al lado "uno"; en 1:1, el
  destino lleva la clave ajena con `UNIQUE`; en N:M se crea una tabla intermedia. Si la relación une **pines** de
  atributo (columna con columna), se usan esas columnas.
- `NULL` / `NOT NULL` según la cardinalidad mínima (`0..1`, `0..*` admiten nulos), `ON DELETE` según *Al borrar*, y
  un índice por cada clave ajena.
- Las tablas se crean en el orden correcto; si hay referencias circulares, en PostgreSQL las claves ajenas se añaden
  al final con `ALTER TABLE`.

### Máquina de estados → XState {#xstate}

La configuración es la misma que la de la exportación **XState JSON** (y la misma semántica que la
[simulación](simulacion.md)). El fichero importa `setup` de `xstate`, declara un *stub* por cada acción y guarda
(las guardas devuelven `true` y llevan su texto original en un comentario) y exporta la máquina y el tipo de sus
eventos:

```ts
import { createActor } from 'xstate';
import { altaDeClienteEstadosMachine } from './alta-de-cliente-estados.machine';

const actor = createActor(altaDeClienteEstadosMachine).start();
actor.send({ type: 'datos completos' });
```

Instala `xstate` en tu proyecto (`npm install xstate`) y sustituye los *stubs* por tu lógica.

### APIs → OpenAPI {#openapi}

Toma las **operaciones** de la librería de APIs (las que importas de Drawer u OpenAPI, o las que defines a mano):
método, path, resumen, parámetros de path, query y cabeceras, cuerpo de petición y de respuesta, y códigos de
respuesta. Los cuerpos JSON de ejemplo se convierten en un **esquema** (tipos inferidos) con el ejemplo incluido. El
resultado se puede volver a importar en all-draw.

### C4 y ArchiMate → Structurizr DSL {#structurizr}

- **C4**: personas, sistemas, contenedores y componentes anidados como en el modelo, con tecnología, descripción y la
  etiqueta `External`; relaciones con descripción y tecnología; nodos de despliegue con instancias; y una vista por
  cada vista C4 (contexto, contenedores, componentes).
- **ArchiMate**: actores y roles → `person`, componentes de aplicación → `softwareSystem`, el resto → `element` con su
  tipo ArchiMate; las relaciones llevan el nombre de su tipo.

Ábrelo con [Structurizr](https://structurizr.com) o con Structurizr Lite.

## Avisos {#avisos}

Si algo no tiene traducción exacta (un tipo desconocido, una tabla sin clave primaria, una operación sin path, una
herencia múltiple…), el código se genera igualmente y la lista de **avisos** explica qué se ha decidido. Corrige el
modelo y vuelve a generar.

Ver también: [Importar y exportar](importar-exportar.md), [Simulación](simulacion.md),
[Clases UML](notaciones/uml.md), [Entidad-relación](notaciones/er.md).

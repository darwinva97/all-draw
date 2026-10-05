# Despliegue (UML)

## Qué es y cuándo usarla {#que-es}

El diagrama de despliegue de UML muestra **dónde corre el software**: las máquinas, dispositivos y
entornos de ejecución (servidores, contenedores, máquinas virtuales, navegadores) y qué artefactos
(ejecutables, imágenes, ficheros de configuración) se instalan en cada uno, además de cómo se comunican
entre sí.

Úsalo para documentar una infraestructura, preparar una migración a la nube o explicar a operaciones qué
hay que instalar y dónde. Para la estructura lógica de las piezas, usa el diagrama de
[componentes](component.md); si prefieres una notación más sencilla, la vista de despliegue de
[C4](c4.md) cubre lo básico.

## Elementos clave {#elementos-clave}

| Elemento | Forma | Qué representa |
|---|---|---|
| **Nodo** | Caja 3D | Un recurso de cómputo: servidor, máquina virtual, clúster. Campos **Estereotipo** («server», «cloud»…), **Sistema operativo** e **Instancias** |
| **Dispositivo** | Caja 3D («device») | Un nodo físico: servidor, móvil, router, sensor. Campo **Estereotipo** |
| **Entorno de ejecución** | Caja 3D («executionEnvironment») | Software que aloja artefactos: contenedor, JVM, servidor de aplicaciones, navegador. Campos **Estereotipo** y **Tecnología** (`Docker 27`, `OpenJDK 21`, `Node 24`) |
| **Artefacto** | Rectángulo con el icono de documento | Lo que se despliega: ejecutable, librería, imagen de contenedor, script. Campos **Fichero** y **Versión** |
| **Especificación de despliegue** | Rectángulo con el icono de documento («deployment spec») | Los parámetros con que se despliega un artefacto: puertos, réplicas, variables. Campo **Propiedades** (pares propiedad → valor) |
| **Componente** | Rectángulo con el icono de componente | El componente lógico que un artefacto manifiesta; se detalla en un diagrama de [componentes](component.md) |

Nodos, dispositivos y entornos de ejecución **se anidan**: un servidor contiene un contenedor Docker que
contiene una JVM que contiene el `.jar`.

## Relaciones {#relaciones}

| Relación | Dibujo | Significado |
|---|---|---|
| **Ruta de comunicación** | Línea continua | Dos nodos intercambian mensajes. Campo **Protocolo** (`HTTPS`, `JDBC`, `AMQP`, `gRPC`). Es la relación por defecto |
| **Despliegue** | Discontinua con flecha abierta, rotulada «deploy» | El artefacto (origen) se instala en el nodo (destino). Equivale a dibujarlo dentro |
| **Manifestación** | Discontinua con flecha abierta, rotulada «manifest» | El artefacto (origen) es la forma física del componente (destino) |
| **Dependencia** | Discontinua con flecha abierta | Una especificación de despliegue configura un artefacto o un nodo, o un artefacto necesita a otro. **Estereotipo** opcional («use», «configure»…) |

Las palabras clave «deploy» y «manifest» las pinta el lienzo solo, a partir del tipo de relación.

## Cómo empezar {#como-empezar}

1. En el panel **Vistas**, pulsa **＋** y elige **Despliegue (UML)**. O parte de la plantilla
   **Despliegue: tienda en la nube** de la pantalla de inicio.
2. Arrastra un **Nodo** "Servidor web" (Sistema operativo *Debian 13*) y otro **Nodo** "Servidor de base
   de datos".
3. Dentro de "Servidor web", arrastra un **Entorno de ejecución** "Docker" (Tecnología *Docker 27*) y,
   dentro de él, un **Artefacto** "tienda-api" (Fichero `tienda-api:1.4.2`). Al anidarlo queda desplegado
   allí, sin crear ninguna relación.
4. Une los dos servidores con **Ruta de comunicación** (sale la primera) y escribe **Protocolo** `JDBC`.
5. Añade un **Componente** "API de la tienda" fuera de los nodos y únelo desde "tienda-api" con
   **Manifestación**.
6. Añade una **Especificación de despliegue** "tienda-api.env" con las propiedades `PUERTO → 8080` y
   `REPLICAS → 2`, y únela al artefacto con **Dependencia**.

## Reglas de la notación {#reglas}

- **Ruta de comunicación** solo entre nodos, dispositivos y entornos de ejecución (en cualquier
  combinación).
- **Despliegue**: de un artefacto o una especificación de despliegue hacia un nodo, dispositivo o entorno.
- **Manifestación**: solo de un artefacto a un componente.
- **Dependencia**: de una especificación de despliegue a un artefacto o a un nodo, o entre artefactos.
- **Anidamiento**: un nodo o un dispositivo contiene nodos, dispositivos, entornos, artefactos,
  especificaciones y componentes; un entorno de ejecución contiene otros entornos, artefactos,
  especificaciones y componentes (no nodos ni dispositivos). Anidar no crea relaciones.
- No hay viewpoints.

## Importar y exportar {#importar-exportar}

- Mermaid no tiene diagrama de despliegue: **Mermaid** exporta la vista como un `flowchart` genérico de
  cajas y flechas, con un aviso.
- La vista se exporta a **SVG**, **PNG**, **draw.io** y **HTML autocontenido**. Ver la
  [tabla de formatos](../importar-exportar.md#formatos).

## Errores comunes {#errores-comunes}

- **Dibujar dentro y además unir con «deploy»**: las dos formas dicen lo mismo; elige una. Anidar suele
  ser más claro.
- **Meter un servidor dentro de un contenedor Docker**: un entorno de ejecución no puede contener nodos ni
  dispositivos; la jerarquía va del hierro al software.
- **Repetir el nodo por cada réplica**: usa el campo **Instancias** en lugar de dibujar diez servidores
  iguales.
- **Rutas de comunicación sin protocolo**: rellena **Protocolo**; es lo primero que pregunta quien opera
  el sistema.

## Referencia completa {#referencia}

La lista completa de tipos, relaciones, matriz de validez y viewpoints se genera desde el propio pack:

<!-- docs:notation-ref deployment -->

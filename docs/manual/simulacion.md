# Simulación

Antes de dar por bueno un proceso o una máquina de estados, puedes **ejecutarlo**: all-draw coloca tokens en los
eventos de inicio (BPMN) o entra en el estado inicial (máquina de estados) y avanza paso a paso, preguntándote cuando
hace falta una decisión. Así ves enseguida si hay ramas a las que no se llega, uniones que se quedan esperando para
siempre o bucles de los que no se sale.

La simulación **solo lee el modelo**: trabaja sobre una copia y no cambia nada del espacio, así que puedes usarla
también en espacios de solo lectura.

## Abrir el panel {#abrir}

1. Abre una vista **BPMN** o de **máquina de estados**.
2. Pulsa **Simular** en la barra superior. Se abre el panel de simulación a la derecha del lienzo.
3. Pulsa **Iniciar**.

El botón solo aparece en vistas de esas dos notaciones. Si pasas a otra vista BPMN o de estados, la simulación vuelve
a empezar en ella; en cualquier otra vista el panel se cierra. Al cerrarlo, el lienzo recupera su aspecto normal.

## Controles {#controles}

| Control | Qué hace |
|---|---|
| **Iniciar / Reiniciar** | Empieza de cero con las variables actuales. |
| **Paso** | Avanza una sola cosa: mueve un token (BPMN) o dispara el siguiente temporizador (estados). |
| **Ejecutar / Pausa** | Avanza paso a paso a la **velocidad** elegida hasta que haga falta una acción tuya, termine o se bloquee. *Al instante* lo hace todo de golpe. |
| **Limpiar** | Quita la simulación del lienzo. |

En el lienzo:

- **Verde con un punto**: hay un token (BPMN) o es el estado activo.
- **Ámbar con un punto que late**: está esperando algo (una decisión, un mensaje, un temporizador, el resto de ramas).
- **Rojo**: bloqueado.
- **Punto pequeño apagado**: ya se ha pasado por ahí.
- Las **flechas** recorridas en el último paso se animan; las ya recorridas quedan coloreadas. Con *reducir
  movimiento* activado en el sistema, no hay animaciones.

El **historial** lista cada paso con su **tiempo simulado** (`t = 5 min`). Pulsa una línea para seleccionar el
elemento en el lienzo.

## Procesos BPMN {#bpmn}

| Elemento | Cómo se simula |
|---|---|
| Evento de inicio | Al iniciar recibe un token (los simples; si no hay simples, todos). |
| Tarea, subproceso colapsado, actividad de llamada | El token entra y sale cuando acaba su **duración** (propiedad `duration`, p. ej. `5m`, `2h`, `PT30M`; por defecto 0). Las de recepción esperan un mensaje. |
| Compuerta **exclusiva** | Sigue la primera rama cuya **condición** se cumple; si ninguna, la rama **por defecto**; si no hay condiciones, **te pregunta**. |
| Compuerta **paralela** | Divide en todas las ramas; al unir, espera un token por cada entrada. |
| Compuerta **inclusiva** | Sigue todas las ramas cuya condición se cumple (o la de por defecto); al unir, espera solo a las ramas que se activaron. Sin condiciones, te deja elegir una o varias. |
| Compuerta **basada en eventos** | Espera al primero de sus eventos: el temporizador vence solo, el mensaje o la señal los disparas tú. |
| Subproceso expandido | Crea un ámbito con sus propios tokens y sale cuando terminan. Si está colapsado y tiene vista de detalle, usa esa vista. |
| Temporizador intermedio | Espera su duración (campo *Temporizador*); el reloj simulado salta hasta el vencimiento. |
| Mensaje / señal intermedios | Esperan a que pulses el botón del mensaje o la señal en **Acciones disponibles**. Un lanzamiento de señal despierta a todo lo que la espera; los flujos de mensaje dibujados entregan el mensaje solos. |
| Evento condicional | Espera a que su condición se cumpla (cambia las variables). |
| Evento de **borde** | Mientras la actividad está en curso. **Interruptor** (por defecto) cancela la actividad y sigue por el borde; **no interruptor** abre una rama más. Error y cancelación los lanza un fin dentro del subproceso. |
| Subproceso de evento | Se arma mientras su ámbito está vivo (mensaje, señal, temporizador, condición, error). |
| Fin de **terminación** | Detiene todos los tokens (en un subproceso, solo los de ese subproceso). |
| Fin de error sin capturar | La simulación acaba con *Error sin capturar*. |

Con **Esperar en las tareas de usuario y manuales** activado, esas tareas no terminan solas: pulsa **Completar** en
cada una. Útil para probar eventos de borde.

> [!TIP]
> Para que una compuerta decida sola, escribe la condición en el flujo de salida (Inspector → *Condición*), por
> ejemplo `importe > 1000`, y marca otra salida como *Por defecto*.

## Máquinas de estados {#estados}

La simulación sigue la misma semántica que **XState v5**, la que usa la exportación a XState JSON:

- Estados compuestos (entra por el pseudoestado **Inicial**, o por el primer hijo de arriba abajo), **regiones
  paralelas** (todas a la vez) y **finales** (un final de primer nivel termina la máquina).
- **Historia** superficial (H) y profunda (H\*): recuerda dónde estaba al salir; si aún no hay nada que recordar, usa
  su transición por defecto.
- **Decisión**: sus transiciones sin evento se evalúan en orden; la guarda `else` siempre se cumple.
- Transiciones con **evento**, **guarda**, **acciones** y **retardo** (`after 5s`). Sin evento ni retardo, se toman
  en cuanto la guarda se cumple.
- **Bifurcación**, **Unión** y **Terminar** también se simulan, aunque XState no los tenga.

**Eventos disponibles** muestra un botón por cada evento que esperan los estados activos (desactivado si ninguna
guarda se cumple ahora). La pestaña **Acciones ejecutadas** lista las acciones de entrada, salida y transición en el
orden en que se ejecutan.

Las acciones con forma de asignación cambian variables: `intentos = intentos + 1`, `total += importe`, `n++`.
`raise(EVENTO)` envía un evento interno. Cualquier otra acción (`enviarCorreo`) solo se registra.

## Variables y condiciones {#variables}

El panel sugiere las variables que leen las condiciones y guardas del modelo. Escribe un valor y pulsa Intro:
números (`1500`), `true` / `false`, texto o JSON (`["a", "b"]`). Puedes añadir más con **nueva variable**.

Las condiciones son expresiones sencillas, evaluadas sin ejecutar código:

| Escribe | Significa |
|---|---|
| `importe > 1000 && pais == "ES"` | comparación y "y" (también `and`) |
| `vip \|\| urgente`, `not aprobado` | "o" y "no" (`or`, `!`) |
| `cliente.tipo == 'empresa'`, `items[0]` | campos y posiciones |
| `'vip' in etiquetas`, `len(items) > 3` | pertenencia y funciones (`len`, `min`, `max`, `round`, `lower`, `contains`…) |
| `${importe > 100}` | el formato de Camunda también vale |

## Bloqueos y bucles {#bloqueos}

- **Bloqueada**: quedan tokens que nunca podrán avanzar, por ejemplo una unión paralela detrás de una compuerta
  exclusiva. El panel dice qué ramas faltan.
- **Bucle sin salida**: el mismo estado se repite sin que hagas nada (por ejemplo, un reintento cuya condición nunca
  cambia). *Ejecutar* se detiene; cambia una variable o elige otra rama para salir.
- **Avisos del modelo**: al abrir el panel se revisan temporizadores ilegibles, condiciones mal escritas, eventos de
  borde sin actividad y nodos desde los que no se llega a ningún fin.

Ver también: [BPMN](notaciones/bpmn.md), [Máquina de estados](notaciones/statechart.md),
[Generar código](generar-codigo.md).

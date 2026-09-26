# 6. Compartir y colaborar

Solo los espacios **en el servidor** se comparten. Un espacio local se sube con **Subir al
servidor** (en la barra del editor o en el inicio) y a partir de ahí su URL es `#/s/<id>`.

## Roles

| Rol | Puede |
|---|---|
| `viewer` | Ver todas las vistas y seguir los cambios en directo. El editor se abre en modo solo lectura (sin paleta ni inspector editable). |
| `editor` | Además, editar: cualquier cambio suyo se aplica y se retransmite. |
| `owner` | Además, compartir (miembros y enlaces), renombrar, transferir y borrar el espacio. |

El dueño es quien crea el espacio. Los administradores del servidor (el primer usuario
registrado) ven todos los espacios. Los miembros con cuenta se gestionan hoy por API
(`PUT /api/workspaces/:id/members/:userId {role}`); desde la interfaz se comparte con **enlaces**.

## Enlaces compartidos

Botón **Compartir** (solo el dueño):

![Diálogo Compartir con un enlace de edición y otro de lectura](img/10-compartir.png)

- **Nuevo enlace de edición**: quien lo abra edita a la vez contigo, sin necesidad de cuenta.
- **Nuevo enlace de lectura**: quien lo abra solo ve.
- **Copiar enlace** copia la URL al portapapeles (el mensaje de confirmación se anuncia).
- **Revocar** invalida el enlace al instante; quien lo tuviera abierto deja de recibir cambios y no
  puede volver a abrirlo.

El enlace tiene la forma `https://alldraw.bezenti.com/#/s/<id>?token=lnk_…`. El token vale para
ese espacio y nada más; con un enlace de lectura, cualquier intento de escritura (incluso por
API) se rechaza. Los enlaces pueden llevar caducidad (por API, `expiresAt`).

## Presencia

En un espacio del servidor la barra muestra tu avatar y los de las demás personas conectadas
(iniciales sobre un color; al pasar el ratón, el nombre y la vista en la que están). En el lienzo
ves sus **cursores** y sus selecciones cuando estáis en la misma vista. El nombre que se muestra
es el de tu cuenta; sin cuenta (enlace compartido) se genera "Anónimo NNN" y se guarda en el
navegador.

## Edición simultánea

La sincronización es CRDT (Yjs): dos personas pueden editar el mismo nodo a la vez y ambas
versiones convergen sin bloqueos ni conflictos. Deshacer (Ctrl+Z) solo revierte **tus** cambios,
no los de los demás.

## Sin conexión

Cada espacio del servidor tiene una **copia local** en el navegador (IndexedDB). Si se cae la
conexión, el indicador pasa a `○ sin conexión (se sincroniza al volver)` y sigues editando; al
recuperar la red, los cambios de ambos lados se fusionan. La aplicación está instalable como PWA y
sirve sus recursos desde caché, así que también arranca sin red (los espacios del servidor que ya
hayas abierto y todos los locales).

## Solo lectura por API y agentes

Los mismos roles rigen para la API REST y los agentes (capítulo 8): una clave API tiene los
permisos de su usuario en cada espacio, y un enlace de lectura solo permite `GET`.

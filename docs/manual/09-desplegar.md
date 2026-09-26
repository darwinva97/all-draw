# 9. Desplegar

all-draw se despliega como **un solo proceso Node** (≥ 22.13) que sirve la aplicación web
compilada, la API REST, el WebSocket de sincronización y guarda todo en un fichero SQLite. No
necesita base de datos externa ni Redis.

## Compilar

```bash
git clone https://github.com/darwinva97/all-draw && cd all-draw
pnpm install
pnpm --filter web build          # → apps/web/dist
```

## Arrancar

```bash
cd apps/server
PORT=4002 HOST=127.0.0.1 DATA_DIR=~/.alldraw-data node src/server.mjs
```

| Variable | Por defecto | Uso |
|---|---|---|
| `PORT` / `HOST` | `4002` / `127.0.0.1` | Dónde escucha. Déjalo en loopback y pon un proxy delante. |
| `DATA_DIR` | `~/.alldraw-data` | Directorio de datos |
| `DB_PATH` | `$DATA_DIR/alldraw.sqlite` | Fichero SQLite (WAL). Haz copia de él (y del `-wal`) para el backup. |
| `STATIC_DIR` | `../web/dist` | Carpeta de la app compilada |
| `SESSION_SECRET` | *(vacío)* | Recomendado en producción: los tokens se guardan como HMAC con este secreto, así una copia de la BD no sirve para suplantar sesiones. Cambiarlo cierra todas las sesiones y claves API. |
| `ALLOW_REGISTRATION` | `true` | `false` cierra el registro (salvo si aún no hay usuarios). Útil tras crear las cuentas. |
| `COOKIE_SECURE` | `false` | Fuerza `Secure` en la cookie; detrás de un proxy https se activa sola con `x-forwarded-proto`. |
| `PUBLIC_URL` | *(de la petición)* | Base para las URLs de los enlaces compartidos, si el proxy no la transmite bien. |

El **primer usuario** que se registra es administrador. Los datos de una instalación anterior
(`<id>.yupdate`) se importan solos al primer arranque bajo un usuario técnico `legacy@…`; ver
`apps/server/README.md` → *Migración*.

## Servicio systemd (usuario, sin root)

`~/.config/systemd/user/alldraw.service`:

```ini
[Unit]
Description=all-draw (app estática + sincronización Yjs)
After=network.target

[Service]
WorkingDirectory=/home/<usuario>/projects/all-draw/apps/server
Environment=PORT=4002 HOST=127.0.0.1 DATA_DIR=/home/<usuario>/.alldraw-data
# Environment=SESSION_SECRET=... ALLOW_REGISTRATION=false
ExecStart=/usr/bin/env node src/server.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now alldraw
loginctl enable-linger $USER        # que siga corriendo sin sesión abierta
systemctl --user status alldraw
journalctl --user -u alldraw -f
```

Actualizar: `git pull && pnpm install && pnpm deploy` (el script hace `build` + `restart`).

## Proxy inverso con Caddy

```
alldraw.ejemplo.com {
    reverse_proxy 127.0.0.1:4002
}
```

Caddy gestiona el certificado y pasa el WebSocket (`/ws/<id>`) sin configuración extra. Con nginx,
añade `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";` en la
`location /ws/` y `X-Forwarded-Proto https` para que la cookie sea `Secure`.

Comprobación: `curl https://alldraw.ejemplo.com/healthz` → `ok`, y `GET /api/notations` devuelve
los packs.

## Staging actual

<https://alldraw.bezenti.com>: Caddy → `127.0.0.1:4002`, unidad de usuario `alldraw`, datos en
`~/.alldraw-data`. Detalles en `docs/05-estado.md`.

## Cloudflare (Workers + Durable Objects)

La capa de persistencia (`WorkspaceStore` en `apps/server/src/store/`) y el protocolo de
sincronización están diseñados para que un espacio pueda vivir en un **Durable Object** (documento
Yjs y actualizaciones en su storage; usuarios, miembros y enlaces en D1), pero el adaptador y el
paquete `apps/worker` **todavía no existen**: es el siguiente paso. Cuando exista, su
`apps/worker/README.md` describirá `wrangler deploy`, las variables y la migración desde SQLite.
Mientras tanto, el despliegue soportado es el de VPS descrito arriba.

## Copia de seguridad y restauración

- Copia `$DATA_DIR` completo (SQLite + WAL) con el servicio parado o usando `sqlite3 .backup`.
- Alternativa por espacio: `GET /api/workspaces/:id/snapshot` guarda un `.alldraw.json` que se
  restaura con `PUT …/snapshot` o importándolo desde la interfaz.

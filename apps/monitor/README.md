# @all-draw/monitor

Monitor externo de all-draw: un Cloudflare Worker con cron cada 5 minutos que comprueba `GET /api/status` del VPS
(entorno principal, https://alldraw.bezenti.com) y del worker de Cloudflare (copia de respaldo de solo lectura,
https://alldraw.darwin-sva-97.workers.dev), guarda el historial y avisa por ntfy.

Página de estado pública: **https://alldraw-monitor.darwin-sva-97.workers.dev** (`/api/status.json` en JSON).

```
src/index.ts   scheduled → checkTarget de cada destino → MonitorDO.record → avisos ntfy; fetch → página / JSON
               MonitorDO: Durable Object con SQLite (sin D1): checks (8 días), state (fallos seguidos), incidents (90 días)
src/logic.ts   lógica pura: judge (qué es caída), step (avisos), alertFor (textos), renderPage (HTML autocontenido)
test/          vitest en Node (lo corre `npx vitest run` desde la raíz)
```

- **Sano** = HTTP 200, `status: "ok"` y `db.ok` distinto de `false`, en menos de `CHECK_TIMEOUT_MS` (10 s). Un 503
  (BD caída), un HTML, una redirección o un error de red cuentan como fallo.
- **Avisos** (ntfy, `NTFY_TOPIC` como secreto): al llegar a `FAIL_THRESHOLD` (2) fallos seguidos, una sola vez
  (prioridad máxima), y al primer acierto después (recuperado, con la duración). Cada caída avisada abre un incidente.
  ntfy.sh limita por IP y las IP de salida de Cloudflare son compartidas: a veces responde **429** (pasó con el primer
  aviso real). Por eso los avisos van a una bandeja de salida en el DO (`outbox`): 3 intentos en la misma ejecución
  (0, 2 y 6 s) y, si no sale, se reintenta en las siguientes hasta 3 horas (con la nota «aviso con retraso»).
- **`global_fetch_strictly_public`**: sin ese flag, pedir otro `*.workers.dev` de la misma cuenta desde un worker da
  404 (error 1042) y el worker de all-draw parecía caído.
- **Página**: disponibilidad 24 h y 7 días, latencia media, última comprobación, una barra por hora de las últimas 24 h
  y los 20 últimos incidentes. HTML sin scripts ni recursos externos (CSP `default-src 'none'`), claro/oscuro,
  español o inglés según `Accept-Language`, se recarga cada minuto. Rate limit opcional `RL_PAGE` (60/min por IP).
- **Privacidad**: sólo pide `/api/status` (versión, tiempo en marcha y si la BD responde); no ve cuentas ni diagramas.

| Variable | Uso |
|---|---|
| `TARGETS` | JSON `[{ id, name, url }]` (en `wrangler.toml`) |
| `FAIL_THRESHOLD` | fallos seguidos para dar por caído (2) |
| `NTFY_TOPIC` | secreto: tema de ntfy (sin él sólo se registra en el log) |
| `NTFY_URL` | servidor de ntfy (`https://ntfy.sh`) |
| `PAGE_URL` / `APP_URL` | enlaces de los avisos y de la página |
| `MONITOR_LABEL` | prefijo de los avisos (`[prueba local] …`) |
| `CHECK_TIMEOUT_MS` | tiempo máximo por comprobación (10000) |

## Desplegar

```bash
cd apps/monitor
export CLOUDFLARE_API_TOKEN=…  CLOUDFLARE_ACCOUNT_ID=…      # token con Workers Scripts: Edit
npx wrangler deploy
tr -d '\r\n' < ~/.config/alldraw/ntfy-topic | npx wrangler secret put NTFY_TOPIC   # una vez
```

## Probar en local (fallo simulado)

```bash
umask 077; printf 'NTFY_TOPIC=%s\n' "$(cat ~/.config/alldraw/ntfy-topic)" > /tmp/mon.env
npx wrangler dev --test-scheduled --port 18788 --env-file /tmp/mon.env --persist-to /tmp/mon-state \
  --var 'TARGETS:[{"id":"falso","name":"URL inexistente","url":"https://no-existe.alldraw.invalid/api/status"}]' \
  --var 'MONITOR_LABEL:prueba local'
curl localhost:18788/__scheduled; curl localhost:18788/__scheduled   # el segundo fallo seguido avisa
```

Comprobado el 5 de octubre de 2026: con una URL inexistente, la segunda comprobación mandó «[prueba local] all-draw
caído: …» (recibido en ntfy) y, al apuntar el mismo destino a una URL sana, «… recuperado» con el incidente cerrado.

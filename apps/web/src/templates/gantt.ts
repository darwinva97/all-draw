import { kit, type Tr } from './kit';

const DAY = 86_400_000;
/** `AAAA-MM-DD` del día `n` contado desde el lunes de hace tres semanas (el plan siempre está "en curso"). */
function dayFromStart(n: number): string {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const monday = today - ((new Date(today).getUTCDay() + 6) % 7) * DAY - 21 * DAY;
  return new Date(monday + n * DAY).toISOString().slice(0, 10);
}

/** Gantt: lanzamiento de una web en dos fases, con dependencias FS, SS (con desfase) y FF, ruta crítica y un hito. */
export function ganttTemplate(t: Tr) {
  const k = kit(t('Lanzamiento de una web'));
  const v = k.view(t('Lanzamiento de una web'), { notationId: 'gantt', kind: 'gantt' });
  const fase = (name: string, y: number, h: number) => k.node(v, k.el('gantt:Group', name), 0, y, 300, h);
  const task = (name: string, fields: Record<string, unknown>, parent: ReturnType<typeof fase> | undefined, y: number) =>
    k.node(v, k.el('gantt:Task', name, { fields }), parent ? 20 : 0, y, 260, 40, parent ? { parentNodeId: parent.id } : {});
  const diseno = fase(t('Diseño'), 0, 150);
  const inv = task(t('Investigación de usuarios'), { start: dayFromStart(0), end: dayFromStart(4), progress: 100, assignee: 'Ana' }, diseno, 40);
  const boc = task(t('Bocetos y maquetas'), { duration: 10, progress: 100, assignee: 'Luis' }, diseno, 90);
  const desa = fase(t('Desarrollo'), 170, 200);
  const maq = task(t('Maquetación'), { duration: 20, progress: 30, assignee: 'Marta' }, desa, 40);
  const api = task(t('Integración con la API'), { duration: 12, critical: true, assignee: 'Jorge' }, desa, 90);
  const pru = task(t('Pruebas'), { duration: 10, critical: true, assignee: 'Ana' }, desa, 140);
  const camp = task(t('Campaña de comunicación'), { duration: 10, assignee: t('Marketing') }, undefined, 390);
  const hito = k.node(v, k.el('gantt:Milestone', t('Lanzamiento')), 0, 450, 60, 60);
  const dep = (a: typeof inv, b: typeof inv, kind = 'FS', lag?: number) => k.link(v, 'gantt:Dependency', a, b, { fields: lag ? { kind, lag } : { kind } });
  dep(inv, boc);
  dep(boc, maq);
  dep(maq, api, 'SS', 5);
  dep(maq, pru);
  dep(api, pru);
  dep(pru, camp, 'FF');
  dep(pru, hito);
  return k.done(v);
}

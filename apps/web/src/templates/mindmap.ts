import { kit, type Tr } from './kit';

/** Mapa mental: un lanzamiento con cuatro ramas y sus ideas. */
export function mindmapTemplate(t: Tr) {
  const k = kit(t('Lanzamiento del producto'));
  const v = k.view(t('Lanzamiento del producto'), { notationId: 'mindmap' });
  const root = k.node(v, k.el('mindmap:Root', t('Lanzamiento del producto')), 380, 230, 200, 80);
  const branch = (name: string, x: number, y: number, ideas: string[], side: 1 | -1) => {
    const topic = k.node(v, k.el('mindmap:Topic', name), x, y, 140, 44);
    k.link(v, 'mindmap:Branch', root, topic);
    ideas.forEach((idea, i) => {
      const sub = k.node(v, k.el('mindmap:Subtopic', idea), side > 0 ? x + 200 : x - 200, y - (ideas.length - 1) * 30 + i * 60, 150, 40);
      k.link(v, 'mindmap:Branch', topic, sub);
    });
  };
  branch(t('Público'), 160, 70, [t('Equipos de producto'), t('Arquitectos')], -1);
  branch(t('Mensaje'), 660, 70, [t('Un modelo, muchas vistas'), t('Funciona sin conexión')], 1);
  branch(t('Canales'), 160, 420, [t('Blog'), t('Charla'), t('Boletín')], -1);
  branch(t('Calendario'), 660, 420, [t('Beta privada'), t('Lanzamiento')], 1);
  return k.done(v);
}

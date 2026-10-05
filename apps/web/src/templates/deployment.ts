import { kit, type Tr } from './kit';

/** Despliegue UML: móvil, servidor con un contenedor Docker y base de datos, con «deploy», «manifest» y rutas de comunicación. */
export function deploymentTemplate(t: Tr) {
  const k = kit(t('Despliegue de la tienda'));
  const v = k.view(t('Despliegue de la tienda'), { notationId: 'deployment' });
  const movil = k.node(v, k.el('deployment:Device', t('Móvil del cliente'), { fields: { os: 'Android / iOS' } }), 0, 90, 200, 110);
  const server = k.node(v, k.el('deployment:Node', t('Servidor de aplicaciones'), { fields: { stereotype: 'cloud', os: 'Debian 13' } }), 280, 0, 380, 320);
  const docker = k.node(v, k.el('deployment:ExecutionEnvironment', 'Docker', { fields: { technology: 'Docker 27' } }), 20, 50, 340, 250, { parentNodeId: server.id });
  const jar = k.node(v, k.el('deployment:Artifact', 'tienda-api.jar', { fields: { fileName: 'tienda-api.jar', version: '2.3.0' } }), 20, 50, 180, 60, { parentNodeId: docker.id });
  const spec = k.node(v, k.el('deployment:DeploymentSpecification', 'compose.yaml', { fields: { properties: [{ key: t('puerto'), value: '8080' }, { key: t('réplicas'), value: '2' }] } }), 20, 150, 180, 70, { parentNodeId: docker.id });
  const db = k.node(v, k.el('deployment:Node', t('Servidor de base de datos')), 740, 40, 240, 180);
  const pg = k.node(v, k.el('deployment:ExecutionEnvironment', 'PostgreSQL 17'), 20, 60, 190, 90, { parentNodeId: db.id });
  const comp = k.node(v, k.el('deployment:Component', t('Pedidos')), 380, 400, 180, 60);
  k.link(v, 'deployment:CommunicationPath', movil, server, { fields: { protocol: 'HTTPS' } });
  k.link(v, 'deployment:CommunicationPath', docker, pg, { fields: { protocol: 'JDBC' } });
  k.link(v, 'deployment:Dependency', spec, jar);
  k.link(v, 'deployment:Manifestation', jar, comp);
  return k.done(v);
}

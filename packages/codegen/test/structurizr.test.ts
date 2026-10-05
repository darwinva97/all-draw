import { describe, it, expect } from 'vitest';
import { generate, warningText } from '../src';
import { archimateWorkspace, c4Workspace } from './fixtures';

describe('structurizr-dsl (C4)', () => {
  const res = generate('structurizr-dsl', c4Workspace());
  const dsl = res.files[0]!.content;

  it('genera workspace.dsl', () => {
    expect(res.files.map(f => [f.path, f.language])).toEqual([['workspace.dsl', 'text']]);
    expect(dsl).toMatchSnapshot();
    expect(dsl).toContain('workspace "Tienda \\"online\\"" "Arquitectura de la tienda." {');
  });

  it('modelo anidado: sistema ⊃ contenedor ⊃ componente (por parentId o por anidamiento de nodos)', () => {
    const sys = dsl.slice(dsl.indexOf('tiendaOnline = softwareSystem'));
    expect(sys).toMatch(/^tiendaOnline = softwareSystem "Tienda online" "Vende productos." \{\n {12}api = container "API" "API \\"REST\\"." "Node.js" \{\n {16}controladorDePedidos = component "Controlador de pedidos" "" "Express"\n {12}\}/);
    expect(dsl).toContain('            web = container "Web" "" "React"');
    expect(dsl).toContain('            baseDeDatos = container "Base de datos" "" "PostgreSQL" "database"');
    expect(dsl).toContain('        pasarelaDePago = softwareSystem "Pasarela de pago" "" "External"');
    expect(dsl).toContain('        cliente = person "Cliente" "Compra productos."');
  });

  it('relaciones con descripción y tecnología', () => {
    expect(dsl).toContain('        tiendaOnline -> pasarelaDePago "Cobra con" "HTTPS"');
    expect(dsl).toContain('        web -> api "Llama a" "JSON/HTTPS"');
    expect(dsl).toContain('        api -> baseDeDatos "Lee y escribe"');
  });

  it('despliegue con nodos anidados, instancias y entorno de la vista', () => {
    expect(dsl).toContain('        deploymentEnvironment "Producción" {\n            aws = deploymentNode "AWS" "" "Cloud" {\n                ec2 = deploymentNode "EC2" "" "Ubuntu" "" 2 {\n                    containerInstance api\n                }\n            }\n        }');
  });

  it('vistas según el viewpoint y estilos', () => {
    expect(dsl).toContain('        systemContext tiendaOnline "contexto" "Contexto" {\n            include *\n            autoLayout\n        }');
    expect(dsl).toContain('        container tiendaOnline "contenedores" "Contenedores" {');
    expect(dsl).toContain('        component api "componentes-de-la-api" "Componentes de la API" {');
    expect(dsl).toContain('        deployment * "Producción" "despliegue" "Despliegue" {');
    expect(dsl).toContain('        styles {');
  });

  it('avisos: elementos sin equivalente y relaciones omitidas', () => {
    expect(res.warnings.map(warningText)).toEqual([
      'El elemento "Pedido.ts" (c4:Code) no tiene equivalente en Structurizr; se omite',
      'El componente "Huérfano" no está dentro de ningún contenedor; se omite',
      'La relación u7 une elementos no exportados; se omite',
      'La vista "Solo personas" no tiene un sistema de software de referencia; se genera como vista general',
    ]);
  });

  it('con vista: solo sus elementos (más los padres necesarios) y su vista', () => {
    const r = generate('structurizr-dsl', c4Workspace(), { viewId: 'v-comp' });
    const d = r.files[0]!.content;
    expect(d).toMatchSnapshot();
    expect(d).toContain('tiendaOnline = softwareSystem "Tienda online"');
    expect(d).not.toContain('person');
    expect(d).toContain('component api "componentes-de-la-api"');
    expect(d).not.toContain('systemContext');
  });

  it('contenedor sin sistema → sistema sintético', () => {
    const ws = c4Workspace();
    delete ws.nodes['v-cont/api'];
    delete ws.nodes['v-comp/api'];
    const r = generate('structurizr-dsl', ws, { viewId: 'v-dep' });
    expect(r.files[0]!.content).toContain('sinSistema = softwareSystem "Sin sistema"');
    expect(r.warnings.map(warningText)).toContain('El contenedor "API" no está dentro de ningún sistema; va a "Sin sistema"');
  });
});

describe('structurizr-dsl (ArchiMate)', () => {
  it('personas, sistemas y elementos personalizados con el tipo ArchiMate; vista custom', () => {
    const r = generate('structurizr-dsl', archimateWorkspace(), { viewId: 'v-am' });
    const d = r.files[0]!.content;
    expect(d).toMatchSnapshot();
    expect(d).toContain('        cliente = person "Cliente"');
    expect(d).toContain('        crm = softwareSystem "CRM"');
    expect(d).toContain('        altaDeCliente = element "Alta de cliente" "BusinessProcess" "Registrar un cliente nuevo."');
    expect(d).toContain('        gestionDeClientes -> altaDeCliente "Serving: soporta"');
    expect(d).toContain('        crm -> gestionDeClientes "Realization"');
    expect(d).toContain('        custom "vision-general" "Visión general" {\n            include *');
    expect(r.warnings).toEqual([]);
  });
});

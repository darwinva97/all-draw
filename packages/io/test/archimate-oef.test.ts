import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { importOpenExchange, exportOpenExchange, importArchimate, exportArchimate } from '../src';

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" identifier="id-m1">
  <name xml:lang="en">Exchange test</name>
  <name xml:lang="es">Prueba de intercambio</name>
  <documentation xml:lang="en">Doc del modelo</documentation>
  <elements>
    <element identifier="e-actor" xsi:type="BusinessActor">
      <name xml:lang="en">Sales Person</name>
      <documentation>Vende</documentation>
      <properties><property propertyDefinitionRef="pd-owner"><value xml:lang="en">ventas</value></property></properties>
    </element>
    <element identifier="e-proc" xsi:type="BusinessProcess"><name xml:lang="en">Sell Product</name></element>
    <element identifier="e-obj" xsi:type="BusinessObject"><name xml:lang="en">Order</name></element>
    <element identifier="e-j" xsi:type="OrJunction"/>
    <element identifier="e-raro" xsi:type="Klingon"><name>Raro</name></element>
  </elements>
  <relationships>
    <relationship identifier="r-asg" source="e-actor" target="e-proc" xsi:type="Assignment"/>
    <relationship identifier="r-acc" source="e-proc" target="e-obj" xsi:type="Access" accessType="ReadWrite"/>
    <relationship identifier="r-aso" source="e-obj" target="r-asg" xsi:type="Association" isDirected="true"><name xml:lang="en">sobre</name></relationship>
    <relationship identifier="r-inf" source="e-proc" target="e-actor" xsi:type="Influence" modifier="+"/>
    <relationship identifier="r-rota" source="e-proc" target="e-nadie" xsi:type="Flow"/>
  </relationships>
  <organizations>
    <item><label xml:lang="en">Business</label>
      <item><label xml:lang="en">Actores</label><item identifierRef="e-actor"/></item>
      <item identifierRef="e-proc"/>
    </item>
  </organizations>
  <propertyDefinitions>
    <propertyDefinition identifier="pd-owner" type="string"><name xml:lang="en">owner</name></propertyDefinition>
  </propertyDefinitions>
  <views>
    <diagrams>
      <view identifier="v1" xsi:type="Diagram" viewpoint="Business Process Cooperation">
        <name xml:lang="en">Vista 1</name>
        <properties><property propertyDefinitionRef="pd-owner"><value>arq</value></property></properties>
        <node identifier="g1" xsi:type="Container" x="100" y="100" w="400" h="200">
          <label xml:lang="en">Negocio</label>
          <style><fillColor r="218" g="254" b="203"/></style>
          <node identifier="n-actor" elementRef="e-actor" xsi:type="Element" x="120" y="140" w="120" h="55">
            <style><fillColor r="255" g="255" b="128" a="50"/><lineColor r="0" g="0" b="0"/></style>
          </node>
          <node identifier="n-proc" elementRef="e-proc" xsi:type="Element" x="300" y="140" w="120" h="55"/>
        </node>
        <node identifier="nota1" xsi:type="Label" x="600" y="100" w="185" h="80"><label xml:lang="en">Una nota</label></node>
        <node identifier="ref1" xsi:type="Label" x="600" y="300" w="120" h="55"><label>Vista 2</label><viewRef ref="v2"/></node>
        <connection identifier="c1" xsi:type="Relationship" relationshipRef="r-asg" source="n-actor" target="n-proc">
          <style lineWidth="2"><lineColor r="255" g="0" b="0"/></style>
          <bendpoint x="240" y="167"/>
        </connection>
        <connection identifier="c-nota" xsi:type="Line" source="nota1" target="n-actor"><label>ver</label></connection>
      </view>
      <view identifier="v2" xsi:type="Diagram"><name xml:lang="en">Vista 2</name></view>
    </diagrams>
  </views>
</model>`;

describe('importOpenExchange', () => {
  const { workspace: ws, warnings } = importOpenExchange(FIXTURE);

  it('lee nombre por idioma, elementos, junctions, propiedades y carpetas', () => {
    expect(ws.meta.name).toBe('Prueba de intercambio');
    expect(ws.elements['e-actor']).toMatchObject({ typeId: 'archimate:BusinessActor', name: 'Sales Person', doc: 'Vende', props: { owner: 'ventas' }, features: { archiFolder: 'Actores' } });
    expect(ws.elements['e-proc']!.features.archiFolder).toBeUndefined();
    expect(ws.elements['e-j']).toMatchObject({ typeId: 'archimate:Junction', fields: { junctionType: 'or' } });
    expect(ws.elements['e-raro']).toBeUndefined();
    expect(warnings.some(w => w.includes('Klingon'))).toBe(true);
  });

  it('lee relaciones con accessType, modifier, isDirected y extremos sobre relaciones', () => {
    expect(ws.relations['r-acc']!.fields.accessType).toBe('readwrite');
    expect(ws.relations['r-inf']!.fields.strength).toBe('+');
    expect(ws.relations['r-aso']).toMatchObject({ name: 'sobre', fields: { directed: true }, to: { relationId: 'r-asg' } });
    expect(ws.relations['r-rota']).toBeUndefined();
  });

  it('lee vistas con viewpoint por nombre, coordenadas relativas, estilos, referencias y conexiones', () => {
    expect(ws.views['v1']).toMatchObject({ notationId: 'archimate', viewpointId: 'business_process_cooperation', props: { owner: 'arq' } });
    expect(ws.nodes['g1']).toMatchObject({ visualType: 'core:group', text: 'Negocio', x: 100, y: 100, style: { fill: '#dafecb' } });
    expect(ws.nodes['n-actor']).toMatchObject({ elementId: 'e-actor', parentNodeId: 'g1', x: 20, y: 40, style: { fill: '#ffff80', opacity: 0.5, stroke: '#000000' } });
    expect(ws.nodes['nota1']).toMatchObject({ visualType: 'core:note', text: 'Una nota' });
    expect(ws.nodes['ref1']).toMatchObject({ visualType: 'core:label', detailViewId: 'v2', text: 'Vista 2' });
    expect(ws.edges['c1']).toMatchObject({ relationId: 'r-asg', bendpoints: [{ x: 240, y: 167 }], style: { color: '#ff0000', width: 2 } });
    expect(ws.edges['c-nota']).toMatchObject({ label: 'ver', fromNodeId: 'nota1' });
  });
});

describe('exportOpenExchange', () => {
  it('ida y vuelta conserva conceptos, propiedades, vistas y coordenadas', () => {
    const a = importOpenExchange(FIXTURE).workspace;
    const { text, warnings } = exportOpenExchange(a);
    expect(warnings).toEqual([]);
    expect(text).toContain('xmlns="http://www.opengroup.org/xsd/archimate/3.0/"');
    expect(text).toContain('xsi:type="OrJunction"');
    expect(text).toContain('accessType="ReadWrite"');
    expect(text).toContain('isDirected="true"');
    expect(text).toContain('viewpoint="Business Process Cooperation"');
    expect(text.indexOf('<organizations>')).toBeLessThan(text.indexOf('<propertyDefinitions>'));
    expect(text.indexOf('<propertyDefinitions>')).toBeLessThan(text.indexOf('<views>'));
    const b = importOpenExchange(text).workspace;
    expect(b.elements).toEqual(a.elements);
    expect(b.relations).toEqual(a.relations);
    expect(b.views).toEqual(a.views);
    expect(b.nodes).toEqual(a.nodes);
    expect(b.edges).toEqual(a.edges);
  });

  it('desplaza coordenadas negativas y prefija ids que no son NCName', () => {
    const a = importOpenExchange(FIXTURE).workspace;
    a.nodes['n-proc']!.x = -500;
    a.elements['123'] = { ...a.elements['e-obj']!, id: '123' };
    const { text } = exportOpenExchange(a);
    expect(text).toContain('identifier="id-123"');
    expect(text).not.toMatch(/ x="-/);
  });

  it('un modelo nativo de Archi pasa por el formato de intercambio y vuelve', () => {
    const native = importArchimate(exportArchimate(importOpenExchange(FIXTURE).workspace).text).workspace;
    const oef = importOpenExchange(exportOpenExchange(native).text).workspace;
    expect(Object.keys(oef.elements).sort()).toEqual(Object.keys(native.elements).sort());
    expect(Object.keys(oef.nodes).sort()).toEqual(Object.keys(native.nodes).sort());
    expect(oef.nodes['n-actor']).toEqual(native.nodes['n-actor']);
  });

  const dir = '/home/maka/projects/all-draw/_research/archi/tests/org.opengroup.archimate.xmlexchange.tests/testdata/';
  it.skipIf(!existsSync(dir))('lee los ficheros de prueba de Archi', () => {
    const s = importOpenExchange(readFileSync(dir + 'Sample1.xml', 'utf8'));
    expect(Object.keys(s.workspace.elements)).toHaveLength(2);
    expect(Object.keys(s.workspace.relations)).toHaveLength(1);
    const b = importOpenExchange(readFileSync(dir + 'bendpoint.test.xml', 'utf8'));
    expect(Object.keys(b.workspace.edges)).toHaveLength(2);
    expect(b.warnings).toEqual([]);
  });
});

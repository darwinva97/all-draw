import { describe, it, expect } from 'vitest';
import { generate, warningText, parseAttributeLine, parseOperationLine, parseMult } from '../src';
import { umlWorkspace, umlEdgeWorkspace } from './fixtures';

const texts = (ws: ReturnType<typeof umlWorkspace>, id: 'uml-typescript' | 'uml-java', viewId?: string) => generate(id, ws, viewId ? { viewId } : {}).warnings.map(warningText);

describe('análisis de líneas UML', () => {
  it('atributos: visibilidad, multiplicidad, valor por defecto, estático y derivado', () => {
    expect(parseAttributeLine('+ edad: int = 0')).toMatchObject({ vis: '+', name: 'edad', typeText: 'int', def: '0', isStatic: false });
    expect(parseAttributeLine('# items: Item[*]')).toMatchObject({ vis: '#', name: 'items', typeText: 'Item', mult: { many: true } });
    expect(parseAttributeLine('- email: String [0..1]')).toMatchObject({ name: 'email', mult: { many: false, optional: true } });
    expect(parseAttributeLine('/derivado: X')).toMatchObject({ name: 'derivado', derived: true });
    expect(parseAttributeLine('+ {static} total: int')).toMatchObject({ name: 'total', isStatic: true });
    expect(parseAttributeLine('_contador_: int {readOnly}')).toMatchObject({ name: 'contador', isStatic: true, readonly: true });
    expect(parseAttributeLine('- url: String = "http://x:80"')).toMatchObject({ typeText: 'String', def: '"http://x:80"' });
    expect(parseAttributeLine('mapa: Map<String, List<Item>>')).toMatchObject({ typeText: 'Map<String, List<Item>>' });
  });
  it('operaciones: parámetros, retorno, abstracta y estilo Java', () => {
    expect(parseOperationLine('+ crear(pedido: Pedido, n: int): void')).toMatchObject({ vis: '+', name: 'crear', retText: 'void', params: [{ name: 'pedido', typeText: 'Pedido' }, { name: 'n', typeText: 'int' }] });
    expect(parseOperationLine('describir(): String {abstract}')).toMatchObject({ isAbstract: true, retText: 'String' });
    expect(parseOperationLine('buscar(in ids: int[*], String q = "x")')).toMatchObject({ params: [{ name: 'ids', mult: { many: true } }, { name: 'q', typeText: 'String', def: '"x"' }] });
    expect(parseOperationLine('- recalcular')).toMatchObject({ name: 'recalcular', params: [], retText: '' });
  });
  it('multiplicidades', () => {
    expect(parseMult('*')).toEqual({ many: true, optional: false });
    expect(parseMult('1..*')).toEqual({ many: true, optional: false });
    expect(parseMult('0..1')).toEqual({ many: false, optional: true });
    expect(parseMult('1')).toEqual({ many: false, optional: false });
    expect(parseMult('2..5')).toEqual({ many: true, optional: false });
    expect(parseMult('abc')).toBeNull();
  });
});

describe('uml-typescript', () => {
  const ws = umlWorkspace();
  const res = generate('uml-typescript', ws, { viewId: 'v-uml' });
  const code = res.files[0]!.content;

  it('genera un único src/model.ts', () => {
    expect(res.files.map(f => [f.path, f.language])).toEqual([['src/model.ts', 'typescript']]);
    expect(code).toMatchSnapshot();
  });

  it('herencia, realización, interfaces que extienden interfaces y clases abstractas', () => {
    expect(code).toContain('export abstract class Persona {');
    expect(code).toContain('export class Cliente extends Persona {');
    expect(code).toContain('export class Pedido implements Facturable {');
    expect(code).toContain('export interface Facturable extends Pagable {');
    expect(code).toContain('  abstract describir(): string;');
    // la superclase va antes que la subclase
    expect(code.indexOf('class Persona')).toBeLessThan(code.indexOf('class Cliente'));
  });

  it('stubs de interfaz y de operaciones abstractas heredadas', () => {
    const pedido = code.slice(code.indexOf('export class Pedido'));
    expect(pedido).toContain('/** Requerido por Facturable. */\n  facturar(): string {');
    const cliente = code.slice(code.indexOf('export class Cliente'), code.indexOf('export class LineaDePedido'));
    expect(cliente).toContain('/** Requerido por Persona. */\n  describir(): string {');
  });

  it('miembros: visibilidad, tipos mapeados, multiplicidad, valores por defecto y derivados', () => {
    expect(code).toContain('  private nombre!: string;');
    expect(code).toContain('  protected fechaAlta!: Date;');
    expect(code).toContain('  static contador: number = 0;');
    expect(code).toContain('  private email?: string;');
    expect(code).toContain('  get nivel(): Nivel {');
    expect(code).toContain('  private estado: EstadoPedido = EstadoPedido.PENDIENTE;');
    expect(code).toContain('  private etiquetas: string[] = [];');
    expect(code).toContain('  private extra!: unknown;');
    expect(code).toContain('  buscar(codigo: string): LineaDePedido | undefined {');
    expect(code).toContain("    throw new Error('No implementado');");
  });

  it('asociaciones: propiedades de navegación con rol y multiplicidad en el lado navegable', () => {
    expect(code).toContain('  lineas: LineaDePedido[] = [];');
    expect(code).toContain('  pedido: Pedido[] = [];');
    expect(code).toContain('  cliente!: Cliente;');
  });

  it('enumeraciones con valores saneados, estereotipo, doc y paquete en JSDoc', () => {
    expect(code).toContain("export enum EstadoPedido {\n  PENDIENTE = 'PENDIENTE',\n  PAGADO = 'PAGADO',\n  EN_ENVIO = 'EN_ENVIO',\n}");
    expect(code).toContain('/** «entity» */\nexport class Cliente');
    expect(code).toContain('/** Alguien que interactúa con la tienda. */');
    expect(code).toContain('/** Paquete com.acme.ventas. */\nexport class Pedido');
  });

  it('avisa de nombres saneados y tipos desconocidos', () => {
    expect(res.warnings.map(warningText)).toEqual(expect.arrayContaining([
      'El nombre "Línea de pedido" no es un identificador válido; se usa "LineaDePedido"',
      'El nombre "nombre del producto" no es un identificador válido; se usa "nombreDelProducto"',
      'El nombre "en envío" no es un identificador válido; se usa "EN_ENVIO"',
      'Tipo desconocido "Mapa" en Pedido.extra; se usa unknown',
    ]));
  });

  it('sin vista usa todos los clasificadores del espacio; es determinista', () => {
    const all = generate('uml-typescript', ws);
    expect(all.files[0]!.content).toContain('Generado por all-draw a partir de «Tienda».');
    expect(generate('uml-typescript', umlWorkspace(), { viewId: 'v-uml' }).files[0]!.content).toBe(code);
  });

  it('casos límite: ciclos, herencia múltiple, duplicados, reservadas, sin tipo, fuera de la vista', () => {
    const edge = umlEdgeWorkspace();
    const r = generate('uml-typescript', edge, { viewId: 'v-raro' });
    expect(r.files[0]!.content).toMatchSnapshot();
    const w = r.warnings.map(warningText);
    expect(w).toEqual(expect.arrayContaining([
      'Ciclo de herencia entre B y A; se ignora esa relación',
      'La clase C hereda de varias clases (B, Cosa); se usa B',
      'Generalización no válida de I (interfaz) a C (clase); se ignora',
      'Realización no válida de A a B: el destino no es una interfaz; se ignora',
      'Hay varios elementos que se llamarían "Cosa"; se usa "Cosa2"',
      'El miembro "class" está repetido en C; se renombra a "class_2"',
      '"sinTipo" de C no tiene tipo; se usa unknown',
      'El tipo "Fuera" de A.y es un clasificador que no está en la vista; se referencia pero no se genera',
    ]));
    expect(r.files[0]!.content).toContain('export class A extends B {');
    expect(r.files[0]!.content).toContain('export class B {}');
    expect(r.files[0]!.content).toContain('  class_!: number;');
  });

  it('vista vacía o inexistente: sin ficheros y con aviso', () => {
    const edge = umlEdgeWorkspace();
    expect(generate('uml-typescript', edge, { viewId: 'v-vacia' })).toEqual({ files: [], warnings: [{ key: 'No hay nada que generar en {scope}', vars: { scope: 'Vacía' } }] });
    expect(generate('uml-typescript', edge, { viewId: 'nada' }).warnings.map(warningText)).toEqual(['La vista nada no existe']);
  });
});

describe('uml-java', () => {
  const ws = umlWorkspace();
  const res = generate('uml-java', ws, { viewId: 'v-uml' });
  const file = (p: string) => res.files.find(f => f.path === p)!.content;

  it('un fichero por clasificador en su paquete (namespace del uml:Package o model)', () => {
    expect(res.files.map(f => f.path)).toEqual([
      'src/main/java/com/acme/ventas/EstadoPedido.java',
      'src/main/java/com/acme/ventas/LineaDePedido.java',
      'src/main/java/com/acme/ventas/Pedido.java',
      'src/main/java/model/Cliente.java',
      'src/main/java/model/Facturable.java',
      'src/main/java/model/Nivel.java',
      'src/main/java/model/Pagable.java',
      'src/main/java/model/Persona.java',
    ]);
    expect(res.files.every(f => f.language === 'java')).toBe(true);
    for (const f of res.files) expect(f.content).toMatchSnapshot(f.path);
  });

  it('package, imports, tipos mapeados y cuerpos', () => {
    const pedido = file('src/main/java/com/acme/ventas/Pedido.java');
    expect(pedido).toContain('package com.acme.ventas;');
    expect(pedido).toContain('import java.util.*;');
    expect(pedido).toContain('import java.math.BigDecimal;');
    expect(pedido).toContain('import model.Cliente;');
    expect(pedido).toContain('public class Pedido implements Facturable {');
    expect(pedido).toContain('    private List<String> etiquetas = new ArrayList<>();');
    expect(pedido).toContain('    private float descuento = 0.5f;');
    expect(pedido).toContain('    LocalDate creado;');
    expect(pedido).toContain('    private List<LineaDePedido> lineas = new ArrayList<>();');
    expect(pedido).toContain('    @Override\n    public String facturar() {\n        throw new UnsupportedOperationException();\n    }');
    const persona = file('src/main/java/model/Persona.java');
    expect(persona).toContain('public abstract class Persona {');
    expect(persona).toContain('    public abstract String describir();');
    expect(persona).toContain('    protected LocalDateTime fechaAlta;');
    expect(persona).toContain('import java.time.LocalDateTime;');
    const cliente = file('src/main/java/model/Cliente.java');
    expect(cliente).toContain('public class Cliente extends Persona {');
    expect(cliente).toContain('    private String email;');
    expect(cliente).toContain('    public Nivel getNivel() {');
    expect(file('src/main/java/model/Pagable.java')).toContain('    boolean pagar(BigDecimal importe);');
    expect(file('src/main/java/com/acme/ventas/EstadoPedido.java')).toContain('public enum EstadoPedido {\n    PENDIENTE,\n    PAGADO,\n    EN_ENVIO\n}');
  });

  it('tipos desconocidos → Object con aviso', () => {
    expect(texts(ws, 'uml-java', 'v-uml')).toContain('Tipo desconocido "Mapa" en Pedido.extra; se usa Object');
    expect(file('src/main/java/com/acme/ventas/Pedido.java')).toContain('    private Object extra;');
  });
});

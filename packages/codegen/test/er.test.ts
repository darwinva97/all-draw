import { describe, it, expect } from 'vitest';
import { generate, warningText } from '../src';
import { erWorkspace, erCycleWorkspace, erEdgeWorkspace } from './fixtures';

/** Bloque `CREATE TABLE <name> (...)` del esquema. */
const table = (sql: string, name: string) => {
  const i = sql.indexOf(`CREATE TABLE ${name} (`);
  return i < 0 ? '' : sql.slice(i, sql.indexOf(');', i) + 2);
};

describe('er-postgres', () => {
  const res = generate('er-postgres', erWorkspace(), { viewId: 'v-er' });
  const sql = res.files[0]!.content;

  it('genera schema.postgres.sql', () => {
    expect(res.files.map(f => [f.path, f.language])).toEqual([['schema.postgres.sql', 'sql']]);
    expect(sql).toMatchSnapshot();
  });

  it('tablas, tipos, PK (declarada, por columna id) y entrecomillado solo si hace falta', () => {
    const cliente = table(sql, 'cliente');
    expect(cliente).toContain('  id serial NOT NULL,');
    expect(cliente).toContain('  nombre varchar(100) NOT NULL,');
    expect(cliente).toContain('  UNIQUE (email)');
    expect(table(sql, 'pedido')).toContain('  PRIMARY KEY (id)');
    expect(table(sql, 'pedido')).toContain('  total numeric(10, 2),');
    expect(table(sql, 'productos')).toContain('  precio numeric(19, 4),');
    const perfil = table(sql, 'perfil');
    expect(perfil).toContain('  "Fecha alta" date,');
    expect(perfil).toContain('  "order" integer,');
    expect(perfil).toContain('  datos jsonb,');
    expect(table(sql, 'linea_de_pedido')).toContain('  PRIMARY KEY (pedido_id, num),');
  });

  it('claves ajenas 1:N con nulabilidad, ON DELETE e índice', () => {
    const pedido = table(sql, 'pedido');
    expect(pedido).toContain('  cliente_id integer,');
    expect(pedido).toContain('CONSTRAINT fk_pedido_cliente_id FOREIGN KEY (cliente_id) REFERENCES cliente (id) ON DELETE SET NULL');
    expect(sql).toContain('CREATE INDEX idx_pedido_cliente_id ON pedido (cliente_id);');
    const linea = table(sql, 'linea_de_pedido');
    // por puertos: usa la columna existente pedido_id (sin crear otra) y no indexa el prefijo de la PK
    expect(linea.match(/pedido_id/g)!.length).toBe(4);
    expect(linea).toContain('FOREIGN KEY (pedido_id) REFERENCES pedido (id) ON DELETE CASCADE');
    expect(sql).not.toContain('idx_linea_de_pedido_pedido_id');
    // sin puertos: <tabla>_<pk> con el tipo de la PK y NOT NULL por cardinalidad 1
    expect(linea).toContain('  productos_codigo varchar(20) NOT NULL,');
    expect(linea).toContain('FOREIGN KEY (productos_codigo) REFERENCES productos (codigo)');
    // autorreferencia: nombre por la relación
    expect(table(sql, 'cliente')).toContain('FOREIGN KEY (recomendado_por_id) REFERENCES cliente (id)');
  });

  it('1:1 con UNIQUE, N:M con tabla intermedia y herencia joined', () => {
    const perfil = table(sql, 'perfil');
    expect(perfil).toContain('  cliente_id integer NOT NULL,');
    expect(perfil).toContain('  UNIQUE (cliente_id),');
    const nm = table(sql, 'cliente_productos');
    expect(nm).toContain('  PRIMARY KEY (cliente_id, productos_codigo),');
    expect(nm).toContain('REFERENCES cliente (id) ON DELETE CASCADE');
    expect(nm).toContain('REFERENCES productos (codigo) ON DELETE CASCADE');
    const empresa = table(sql, 'empresa');
    expect(empresa).toContain('  id integer NOT NULL,');
    expect(empresa).toContain('FOREIGN KEY (id) REFERENCES cliente (id) ON DELETE CASCADE');
    expect(sql).toContain('-- empresa hereda de cliente (estrategia joined');
  });

  it('orden topológico: las referenciadas antes', () => {
    const pos = (t: string) => sql.indexOf(`CREATE TABLE ${t} (`);
    expect(pos('cliente')).toBeLessThan(pos('pedido'));
    expect(pos('pedido')).toBeLessThan(pos('linea_de_pedido'));
    expect(pos('productos')).toBeLessThan(pos('linea_de_pedido'));
    expect(pos('productos')).toBeLessThan(pos('cliente_productos'));
    expect(pos('cliente')).toBeLessThan(pos('empresa'));
    expect(sql).toContain('CREATE MATERIALIZED VIEW ventas_por_cliente AS');
  });

  it('avisos: sin PK, tipo desconocido y columna sin tipo', () => {
    expect(res.warnings.map(warningText)).toEqual([
      'La columna nota.texto no tiene tipo; se usa text',
      'Tipo SQL desconocido "hstore" en pedido.meta; se deja tal cual',
      'La tabla nota no tiene clave primaria',
    ]);
  });

  it('ciclos: las FK circulares van al final con ALTER TABLE', () => {
    const r = generate('er-postgres', erCycleWorkspace(), { viewId: 'v' });
    const s = r.files[0]!.content;
    expect(s).toMatchSnapshot();
    expect(s).toContain('ALTER TABLE departamento ADD CONSTRAINT fk_departamento_empleado_id FOREIGN KEY (empleado_id) REFERENCES empleado (id);');
    expect(table(s, 'departamento')).not.toContain('FOREIGN KEY');
    expect(r.warnings.map(warningText)).toEqual(['Hay referencias circulares entre tablas (departamento, empleado); sus claves ajenas se añaden al final con ALTER TABLE']);
  });
});

describe('er-sqlite', () => {
  it('tipos SQLite, PRAGMA y FK en línea', () => {
    const res = generate('er-sqlite', erWorkspace(), { viewId: 'v-er' });
    const sql = res.files[0]!.content;
    expect(res.files[0]!.path).toBe('schema.sqlite.sql');
    expect(sql).toMatchSnapshot();
    expect(sql).toContain('PRAGMA foreign_keys = ON;');
    expect(table(sql, 'productos')).toContain('  precio NUMERIC,');
    expect(table(sql, 'productos')).toContain('  activo INTEGER,');
    expect(table(sql, 'perfil')).toContain('  id TEXT NOT NULL,');
    expect(sql).toContain('CREATE VIEW ventas_por_cliente AS');
  });

  it('ciclos: FK en línea y aviso', () => {
    const r = generate('er-sqlite', erCycleWorkspace());
    expect(table(r.files[0]!.content, 'departamento')).toContain('REFERENCES empleado (id)');
    expect(r.warnings.map(w => w.key)).toEqual(['Hay referencias circulares entre tablas ({tables}); SQLite las admite, pero al cargar datos hay que desactivar o diferir las claves ajenas']);
  });
});

describe('ER: casos límite', () => {
  it('PK inexistente, FK a tabla sin PK, columnas que no encajan, SET NULL imposible y herencias', () => {
    const r = generate('er-postgres', erEdgeWorkspace(), { viewId: 'v' });
    const sql = r.files[0]!.content;
    expect(sql).toMatchSnapshot();
    expect(r.warnings.map(warningText)).toEqual(expect.arrayContaining([
      'La clave primaria de a nombra la columna falta, que no existe; se omite',
      'La relación e1 apunta a b, que no tiene clave primaria; no se genera la clave ajena',
      'La clave ajena de d (id, codigo) referencia columnas de a que no son su clave primaria',
      'La relación e6 une 1 columnas con una clave de 2; se usan las columnas por defecto',
      'ON DELETE SET NULL en c.a_codigo, que no admite nulos',
      'Herencia de d a a con estrategia "single table": solo se documenta con un comentario',
      'La clave primaria de c no encaja con la de d; no se genera la clave ajena de la herencia',
      'La tabla b no tiene clave primaria',
    ]));
    expect(table(sql, 'd')).toContain('FOREIGN KEY (a1, a2) REFERENCES a (id, codigo)');
    expect(table(sql, 'd')).toContain('FOREIGN KEY (c_k1, c_k2) REFERENCES c (k1, k2)');
    expect(sql).toContain('-- d hereda de a (estrategia single table).');
  });
});

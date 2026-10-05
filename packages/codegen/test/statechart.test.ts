import { describe, it, expect, vi, afterAll } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createActor, setup, type AnyStateMachine } from 'xstate';
import { XSTATE_VIEW_ID } from '@all-draw/io';
import { generate, statechartMachines, parseDelay, warningText } from '../src';
import { Warnings } from '../src/warnings';
import { statechartEdgeWorkspace, statechartWorkspace } from './fixtures';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '.generated');
afterAll(() => rmSync(OUT, { recursive: true, force: true }));

/** Escribe el `.machine.ts` generado junto a los tests e importa la máquina (vitest transpila el TS). */
async function loadGenerated(): Promise<AnyStateMachine> {
  const res = generate('statechart-xstate', statechartWorkspace(), { viewId: XSTATE_VIEW_ID });
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, res.files[0]!.path);
  writeFileSync(file, res.files[0]!.content);
  const mod = (await import(/* @vite-ignore */ file)) as Record<string, AnyStateMachine>;
  return mod.cajeroMachine!;
}

const value = (a: { getSnapshot(): { value: unknown } }) => a.getSnapshot().value;

describe('statechart-xstate', () => {
  const res = generate('statechart-xstate', statechartWorkspace(), { viewId: XSTATE_VIEW_ID });
  const code = res.files[0]!.content;

  it('genera <nombre>.machine.ts con setup().createMachine()', () => {
    expect(res.files.map(f => [f.path, f.language])).toEqual([['cajero.machine.ts', 'typescript']]);
    expect(res.warnings).toEqual([]);
    expect(code).toMatchSnapshot();
    expect(code).toContain("import { setup } from 'xstate';");
    expect(code).toContain('export const cajeroMachine = setup({');
    expect(code).toContain("export type CajeroEvent =\n  | { type: 'CANCELAR' }");
  });

  it('claves entre comillas para guardas/acciones que no son identificadores y retardos con nombre', () => {
    expect(code).toContain("    'saldo > 0': () => {");
    expect(code).toContain("    'x = x + 1': () => {");
    expect(code).toContain("    'leer tarjeta': () => {");
    expect(code).toContain('    apagarPantalla: () => {');
    expect(code).toContain("guard: 'saldo > 0',");
    expect(code).toContain("    '5s': 5000,");
    expect(code).toContain('            2000: \'fin\',');
  });

  it('el modelo arranca con el paquete xstate real y recorre los eventos', () => {
    const w = new Warnings();
    const [m] = statechartMachines(statechartWorkspace(), { viewId: XSTATE_VIEW_ID }, w)!;
    expect(m!.actions).toEqual(['apagarPantalla', 'expulsarTarjeta', 'leer tarjeta', 'x = x + 1']);
    expect(m!.guards).toEqual(['saldo > 0', 'tieneTarjeta']);
    expect(m!.delays).toEqual({ '5s': 5000 });
    const calls: string[] = [];
    const machine = setup({
      actions: Object.fromEntries(m!.actions.map(a => [a, () => { calls.push(a); }])),
      guards: Object.fromEntries(m!.guards.map(g => [g, () => true])),
      delays: m!.delays,
    }).createMachine(m!.config as never);
    const actor = createActor(machine).start();
    expect(value(actor)).toBe('inactivo');
    actor.send({ type: 'TARJETA' });
    expect(value(actor)).toEqual({ operando: 'pin' });
    actor.send({ type: 'PIN_OK' });
    actor.send({ type: 'RETIRAR' });
    expect(value(actor)).toEqual({ operando: 'dispensando' });
    actor.send({ type: 'CANCELAR' });
    expect(value(actor)).toBe('inactivo');
    expect(calls).toEqual(['apagarPantalla', 'leer tarjeta', 'expulsarTarjeta', 'apagarPantalla']);
    actor.stop();
  });

  it('el fichero generado se importa y se ejecuta (always, after con retardo con nombre y numérico)', async () => {
    vi.useFakeTimers();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const machine = await loadGenerated();
      const actor = createActor(machine).start();
      expect(value(actor)).toBe('inactivo');
      actor.send({ type: 'REVISAR' });                 // revisando → always [tieneTarjeta] → operando
      expect(value(actor)).toEqual({ operando: 'pin' });
      actor.send({ type: 'PIN_KO' });
      expect(log).toHaveBeenCalledWith('acción: x = x + 1');
      vi.advanceTimersByTime(5000);                     // after 5s → #inactivo
      expect(value(actor)).toBe('inactivo');
      actor.send({ type: 'TARJETA' });
      actor.send({ type: 'PIN_OK' });
      actor.send({ type: 'RETIRAR' });
      vi.advanceTimersByTime(2000);                     // after 2000 → fin
      expect(value(actor)).toEqual({ operando: 'fin' });
      actor.stop();
    } finally {
      log.mockRestore();
      vi.useRealTimers();
    }
  });

  it('sin vista: una máquina por vista statechart; vista inexistente → aviso', () => {
    expect(generate('statechart-xstate', statechartWorkspace()).files.map(f => f.path)).toEqual(['cajero.machine.ts']);
    expect(generate('statechart-xstate', statechartWorkspace(), { viewId: 'x' }).warnings.map(warningText)).toEqual(['La vista x no existe']);
  });

  it('parseDelay', () => {
    expect(parseDelay('5s')).toBe(5000);
    expect(parseDelay('1.5 min')).toBe(90000);
    expect(parseDelay('200ms')).toBe(200);
    expect(parseDelay('pronto')).toBeNull();
  });
});

describe('statechart-table', () => {
  it('tabla de transiciones con rutas, after y always, y tabla de estados', () => {
    const res = generate('statechart-table', statechartWorkspace(), { viewId: XSTATE_VIEW_ID });
    expect(res.files.map(f => [f.path, f.language])).toEqual([['cajero.transitions.md', 'markdown']]);
    const md = res.files[0]!.content;
    expect(md).toMatchSnapshot();
    expect(md).toContain('| Estado | Evento | Guarda | Destino | Acciones |');
    expect(md).toContain('| operando.menu | RETIRAR | saldo > 0 | operando.dispensando | — |');
    expect(md).toContain('| operando.pin | after 5s | — | inactivo | — |');
    expect(md).toContain('| operando.dispensando | after 2s | — | operando.fin | — |');
    expect(md).toContain('| revisando | always | tieneTarjeta | operando | — |');
    expect(md).toContain('| operando | compuesto | operando.pin | — | expulsarTarjeta | — |');
  });
});

describe('máquinas de estados: casos límite', () => {
  it('pseudoestados sin equivalente y retardos ilegibles → avisos; la máquina sigue arrancando', () => {
    const ws = statechartEdgeWorkspace();
    const r = generate('statechart-xstate', ws, { viewId: 'v-sc' });
    expect(r.files[0]!.content).toMatchSnapshot();
    expect(r.warnings.map(warningText)).toEqual([
      'Exportador XState: La transición t2 apunta a un pseudoestado statechart:Fork que XState no representa; se omite',
      'Retardo "pronto" no reconocido; se define como 1000 ms',
    ]);
    const [m] = statechartMachines(ws, { viewId: 'v-sc' }, new Warnings())!;
    const actor = createActor(setup({ delays: m!.delays }).createMachine(m!.config as never)).start();
    expect(value(actor)).toBe('uno');
    actor.stop();
  });
});

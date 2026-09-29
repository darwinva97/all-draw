import { describe, it, expect } from 'vitest';
import { MemoryStore, exampleWorkspace, parseWorkspace, type Person } from '@all-draw/core';
import { t } from '@all-draw/i18n';
import {
  applyMention, anchorLabel, anchorTarget, anchorNodesIn, commentAuthor, isOwn, matchPeople, mentionQuery, mentionsIn, relativeTime, splitMentions,
} from '../src/panels/comments-helpers';

const person = (id: string, name: string, extra: Partial<Person> = {}): Person => ({ id, name, assignments: [], ...extra });
const people = [person('p1', 'Ana López', { team: 'Plataforma' }), person('p2', 'Álvaro Ruiz'), person('p3', 'Ana')];

describe('comentarios: menciones', () => {
  it('detecta la @consulta antes del cursor', () => {
    expect(mentionQuery('hola @an', 8)).toEqual({ start: 5, query: 'an' });
    expect(mentionQuery('@', 1)).toEqual({ start: 0, query: '' });
    expect(mentionQuery('correo a@b', 10)).toBeNull();
    expect(mentionQuery('hola @ana y', 11)).toBeNull();
  });
  it('sugiere personas sin distinguir acentos ni mayúsculas', () => {
    expect(matchPeople(people, 'al').map(p => p.id)).toEqual(['p2']);
    expect(matchPeople(people, 'lop').map(p => p.id)).toEqual(['p1']);
    expect(matchPeople(people, '').length).toBe(3);
  });
  it('inserta la mención y extrae los ids del texto final', () => {
    const r = applyMention('revisa @an esto', 10, 7, 'Ana López');
    expect(r.text).toBe('revisa @Ana López esto');
    expect(r.caret).toBe('revisa @Ana López '.length);
    expect(mentionsIn(r.text, people).sort()).toEqual(['p1', 'p3']);
    expect(mentionsIn('hola @Anabel', people)).toEqual([]);
    expect(mentionsIn('cc @Álvaro Ruiz.', people)).toEqual(['p2']);
  });
  it('trocea el texto para resaltar las menciones (el nombre más largo gana)', () => {
    const parts = splitMentions('ok @Ana López y @Ana', people);
    expect(parts.map(p => [p.text, p.person?.id])).toEqual([['ok ', undefined], ['@Ana López', 'p1'], [' y ', undefined], ['@Ana', 'p3']]);
  });
});

describe('comentarios: autor, fechas y anclas', () => {
  it('autor: presencia, si no "Anónimo"; propios por userId o nombre', () => {
    expect(commentAuthor({ name: 'Eva', color: '#f00', userId: 'u9' }, 'Anónimo')).toEqual({ name: 'Eva', color: '#f00', userId: 'u9' });
    expect(commentAuthor(null, 'Anónimo').name).toBe('Anónimo');
    expect(isOwn({ author: { name: 'Eva', userId: 'u9' } }, { name: 'Otra', userId: 'u9' })).toBe(true);
    expect(isOwn({ author: { name: 'Eva', userId: 'u9' } }, { name: 'Eva', userId: 'u1' })).toBe(false);
    expect(isOwn({ author: { name: 'Eva' } }, { name: 'Eva' })).toBe(true);
  });
  it('fecha relativa', () => {
    const now = Date.parse('2026-01-10T12:00:00Z');
    expect(relativeTime('2026-01-10T11:59:50Z', now, 'en')).toBe('now');
    expect(relativeTime('2026-01-10T11:55:00Z', now, 'en')).toMatch(/^5 min.* ago$/);
    expect(relativeTime('2026-01-09T12:00:00Z', now, 'en')).toBe('yesterday');
  });
  it('etiqueta y destino de las anclas', () => {
    const s = new MemoryStore(parseWorkspace(exampleWorkspace()));
    expect(anchorLabel(s, { kind: 'node', id: 'vn_2' }, t).label).toBe('CRM');
    expect(anchorLabel(s, { kind: 'relation', id: 'rel_1' }, t).label).toBe('usa');
    expect(anchorLabel(s, { kind: 'view' }, t).missing).toBe(true);
    expect(anchorLabel(s, { kind: 'point', viewId: 'vw_1', x: 0, y: 0 }, t).label).toContain('Mapa');
    expect(anchorTarget(s, { kind: 'element', id: 'el_alta' }, 'vw_2')).toEqual({ viewId: 'vw_2', nodes: ['vn_3'], edges: [] });
    expect(anchorTarget(s, { kind: 'element', id: 'el_alta' }, null)!.viewId).toBe('vw_1');
    expect(anchorTarget(s, { kind: 'relation', id: 'rel_1' }, null)).toEqual({ viewId: 'vw_1', nodes: [], edges: ['ve_1'] });
    expect(anchorTarget(s, { kind: 'view' }, 'vw_1')).toBeNull();
    expect(anchorNodesIn(s, { kind: 'edge', id: 've_1' }, 'vw_1')).toEqual(['vn_1', 'vn_2']);
  });
});

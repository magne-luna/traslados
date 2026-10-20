/// <reference types="node" />
// Guarda (design.md §D3): la publicación `supabase_realtime` y TABLAS_REALTIME no pueden divergir.
// Se lee la migración con `node:fs` (mismo motivo que obraSocialMigrations.test.ts).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TABLAS_REALTIME } from './tablas';

const carpeta = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../supabase/migrations');
const archivo = readdirSync(carpeta).find((f) => f.endsWith('_realtime_publicacion.sql'));

function sqlActivo(sql: string): string {
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
}

function tablasDe(sql: string, accion: 'ADD' | 'DROP'): string[] {
  const m = new RegExp(`ALTER PUBLICATION supabase_realtime ${accion} TABLE([^;]+);`, 'i').exec(sql);
  return (m?.[1] ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

describe('migración de publicación realtime', () => {
  it('existe', () => {
    expect(archivo).toBeDefined();
  });

  const sql = archivo ? readFileSync(resolve(carpeta, archivo), 'utf-8') : '';

  it('publica exactamente las tablas de TABLAS_REALTIME', () => {
    expect(tablasDe(sqlActivo(sql), 'ADD').sort()).toEqual(Object.keys(TABLAS_REALTIME).sort());
  });

  it('trae el rollback comentado con las mismas tablas, sin DROP activo', () => {
    expect(tablasDe(sqlActivo(sql), 'DROP')).toEqual([]);
    const comentado = sql
      .split('\n')
      .filter((l) => l.trim().startsWith('--'))
      .map((l) => l.replace(/^\s*--\s?/, ''))
      .join('\n');
    expect(tablasDe(comentado, 'DROP').sort()).toEqual(Object.keys(TABLAS_REALTIME).sort());
  });

  it('no toca REPLICA IDENTITY, RLS ni grants', () => {
    expect(sqlActivo(sql)).not.toMatch(/REPLICA IDENTITY|POLICY|GRANT|ROW LEVEL SECURITY/i);
  });
});

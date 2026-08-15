/// <reference types="node" />
// Test de la migración `20260816090000_catalogo_accesorios_icono_activa.sql` como texto fuente.
// Patrón del repo (`obraSocialMigrations.test.ts`): `?raw` no sirve para rutas fuera de
// `frontend/` (fs.allow de Vite) → `node:fs` + resolución relativa desde el archivo de test.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NOMBRE = '20260816090000_catalogo_accesorios_icono_activa.sql';

function leerMigracion(): string {
  return readFileSync(resolve(__dirname, `../../../../../supabase/migrations/${NOMBRE}`), 'utf-8');
}

// El archivo puede mencionar "SECURITY DEFINER" solo DENTRO de comentarios `--` (documentación
// deliberada). El chequeo de seguridad opera sobre el SQL activo: sin comentarios ni literales.
function quitarComentariosYStrings(sql: string): string {
  const sinComentarios = sql
    .split('\n')
    .map((linea) => {
      const idx = linea.indexOf('--');
      return idx === -1 ? linea : linea.slice(0, idx);
    })
    .join('\n');
  return sinComentarios.replace(/'(?:[^']|'')*'/g, "''");
}

describe('migración catalogo_accesorios_icono_activa.sql (1.1/1.2)', () => {
  const fuente = leerMigracion();
  const codigoActivo = quitarComentariosYStrings(fuente);

  it('es aditiva: agrega icono y activa sin soltar la tabla ni sus columnas', () => {
    expect(codigoActivo).toContain('ADD COLUMN icono TEXT');
    expect(codigoActivo).toContain('ADD COLUMN activa BOOLEAN NOT NULL DEFAULT true');
    expect(codigoActivo).not.toMatch(/DROP TABLE/i);
    expect(codigoActivo).not.toMatch(/DROP COLUMN/i);
    expect(codigoActivo).not.toMatch(/DELETE FROM/i);
  });

  it('tiene el backfill icono = tipo ANTES del SET NOT NULL', () => {
    const idxBackfill = codigoActivo.indexOf('SET icono = tipo');
    const idxNotNull = codigoActivo.indexOf('ALTER COLUMN icono SET NOT NULL');
    expect(idxBackfill).toBeGreaterThanOrEqual(0);
    expect(idxNotNull).toBeGreaterThan(idxBackfill);
  });

  it('no crea funciones: ni CREATE FUNCTION ni SECURITY DEFINER', () => {
    expect(codigoActivo).not.toMatch(/CREATE\s+FUNCTION/i);
    expect(codigoActivo).not.toContain('SECURITY DEFINER');
    expect(codigoActivo).not.toMatch(/SECURITY\s+INVOKER/i); // plan recortado: sin RPC
  });

  it('la policy de lectura cubre vehiculos y conductores, sin tocar la write', () => {
    expect(fuente).toContain("modulos.tiene_permiso('vehiculos', 'read')");
    expect(fuente).toContain("modulos.tiene_permiso('conductores', 'read')");
    expect(fuente).toContain("modulos.tiene_permiso('pacientes', 'read')");
    // La policy de escritura NO se redefine en esta migración (se mantiene solo pacientes)
    expect(codigoActivo).not.toContain('"Write accesorios"');
  });
});
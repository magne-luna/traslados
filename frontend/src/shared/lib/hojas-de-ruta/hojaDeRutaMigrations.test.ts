/// <reference types="node" />
// Test de la migración de RPC como texto (mismo patrón que obraSocialMigrations.test.ts): `?raw`
// no sirve para rutas fuera de `frontend/` (fs.allow de Vite deniega "Denied ID"), se usa
// `node:fs`. Ver openspec/changes/integracion-hojas-de-ruta/design.md D3 — "el mismo test
// automatizado que lee el .sql con node:fs para verificar que ninguna de las dos funciones se
// declaró DEFINER".
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

function leerMigracion(nombre: string): string {
  return readFileSync(resolve(__dirname, `../../../../../supabase/migrations/${nombre}`), 'utf-8');
}

// El archivo menciona "SECURITY DEFINER" varias veces DENTRO de comentarios `--` (advirtiendo, en
// castellano, que no hay que usarlo) — documentación deliberada, no la cláusula activa. El chequeo
// real es que, quitando comentarios y literales de cadena, la única cláusula de seguridad que
// queda en el SQL activo es `SECURITY INVOKER`.
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

describe('migración 20260804110000_hoja_de_ruta_rpc.sql', () => {
  it('declara SECURITY INVOKER en las dos funciones y la cláusula activa nunca es SECURITY DEFINER', () => {
    const fuente = leerMigracion('20260804110000_hoja_de_ruta_rpc.sql');
    const codigoActivo = quitarComentariosYStrings(fuente);

    const ocurrenciasInvoker = codigoActivo.match(/SECURITY INVOKER/g) ?? [];
    expect(ocurrenciasInvoker.length).toBe(2); // crear_hoja_de_ruta_completa + actualizar_hoja_de_ruta_completa
    expect(codigoActivo).not.toContain('SECURITY DEFINER');
  });

  it('revoca EXECUTE de anon/PUBLIC y lo otorga solo a authenticated para las dos funciones', () => {
    const fuente = leerMigracion('20260804110000_hoja_de_ruta_rpc.sql');

    expect(fuente).toContain('REVOKE ALL ON FUNCTION pacientes.crear_hoja_de_ruta_completa(jsonb) FROM anon');
    expect(fuente).toContain(
      'REVOKE ALL ON FUNCTION pacientes.actualizar_hoja_de_ruta_completa(uuid, jsonb) FROM anon',
    );
    expect(fuente).toContain('GRANT EXECUTE ON FUNCTION pacientes.crear_hoja_de_ruta_completa(jsonb) TO authenticated');
    expect(fuente).toContain(
      'GRANT EXECUTE ON FUNCTION pacientes.actualizar_hoja_de_ruta_completa(uuid, jsonb) TO authenticated',
    );
  });

  it('usa los cuatro códigos de error propios (45301-45304) que el repository ya traduce (D4)', () => {
    const fuente = leerMigracion('20260804110000_hoja_de_ruta_rpc.sql');

    expect(fuente).toContain("ERRCODE = '45301'");
    expect(fuente).toContain("ERRCODE = '45302'");
    expect(fuente).toContain("ERRCODE = '45303'");
    expect(fuente).toContain("ERRCODE = '45304'");
  });
});

describe('migración 20260804100000_schema_hoja_de_ruta.sql', () => {
  it('habilita RLS y define las cuatro policies read/write sobre las dos tablas nuevas (D5)', () => {
    const fuente = leerMigracion('20260804100000_schema_hoja_de_ruta.sql');

    expect(fuente).toContain('ALTER TABLE pacientes.hoja_de_ruta ENABLE ROW LEVEL SECURITY');
    expect(fuente).toContain('ALTER TABLE pacientes.recorrido ENABLE ROW LEVEL SECURITY');
    expect(fuente).toContain("modulos.tiene_permiso('hojas_de_ruta', 'read')");
    expect(fuente).toContain("modulos.tiene_permiso('hojas_de_ruta', 'write')");
  });

  it('no borra ninguna columna existente de historial_recorridos (expand aditivo)', () => {
    const fuente = leerMigracion('20260804100000_schema_hoja_de_ruta.sql');

    expect(fuente).not.toMatch(/DROP COLUMN/);
    expect(fuente).not.toMatch(/^\s*DROP TABLE/m);
  });
});

/// <reference types="node" />
// 4.9 — test de las dos migraciones como texto. `?raw` no sirve para rutas fuera de `frontend/`
// (`fs.allow` de Vite deniega "Denied ID", ya probado empíricamente por
// `integracion-pacientes` 3.12b) — se usa `node:fs`. `tsconfig.app.json` no incluye
// `types: ["node"]` a propósito (código de `src/` es de navegador); la referencia de arriba trae
// los tipos de `@types/node` solo para este archivo de test.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

function leerMigracion(nombre: string): string {
  return readFileSync(resolve(__dirname, `../../../../../supabase/migrations/${nombre}`), 'utf-8');
}

// El archivo menciona "SECURITY DEFINER" varias veces DENTRO de comentarios `--` (advirtiendo, en
// castellano, que no hay que usarlo) — eso es documentación deliberada (D6), no la cláusula
// activa. El chequeo real es que, quitando comentarios y literales de cadena, la única cláusula de
// seguridad que queda en el SQL activo es `SECURITY INVOKER`.
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

describe('migración 20260731120001_obra_social_rpc.sql (4.9)', () => {
  it('declara SECURITY INVOKER en las dos funciones y la cláusula activa nunca es SECURITY DEFINER', () => {
    const fuente = leerMigracion('20260731120001_obra_social_rpc.sql');
    const codigoActivo = quitarComentariosYStrings(fuente);

    const ocurrenciasInvoker = codigoActivo.match(/SECURITY INVOKER/g) ?? [];
    expect(ocurrenciasInvoker.length).toBe(2); // crear_obra_social_completa + actualizar_obra_social_completa
    expect(codigoActivo).not.toContain('SECURITY DEFINER');
  });

  it('revoca EXECUTE de anon/PUBLIC y lo otorga solo a authenticated para las dos funciones', () => {
    const fuente = leerMigracion('20260731120001_obra_social_rpc.sql');

    expect(fuente).toContain('REVOKE ALL ON FUNCTION obra_social.crear_obra_social_completa(jsonb) FROM anon');
    expect(fuente).toContain('REVOKE ALL ON FUNCTION obra_social.actualizar_obra_social_completa(uuid, jsonb) FROM anon');
    expect(fuente).toContain('GRANT EXECUTE ON FUNCTION obra_social.crear_obra_social_completa(jsonb) TO authenticated');
    expect(fuente).toContain(
      'GRANT EXECUTE ON FUNCTION obra_social.actualizar_obra_social_completa(uuid, jsonb) TO authenticated',
    );
  });
});

// 20260731120000 dejó de ser la migración de creación que design.md planeaba (D4/D6) y pasó a ser
// una migración de RECONCILIACIÓN: casi todo lo que planeaba ya existía en la base real (hallazgo
// de las tareas 1.1-1.4, ver la cabecera del propio archivo). El test refleja eso: en vez de exigir
// que la migración HABILITE RLS sobre una tabla nueva, exige que documente explícitamente que la
// RLS de `plantilla_campo` ya estaba aplicada (para que nadie la lea y crea que la tabla quedó sin
// RLS) y que no toque ninguna tabla existente de forma destructiva.
describe('migración 20260731120000_obra_social_config_facturacion.sql (4.9)', () => {
  it('documenta que RLS de plantilla_campo ya estaba aplicada y agrega solo los índices faltantes', () => {
    const fuente = leerMigracion('20260731120000_obra_social_config_facturacion.sql');

    expect(fuente).toContain('CREATE INDEX IF NOT EXISTS idx_requisitos_os_tipo_documento_id');
    expect(fuente).toContain('CREATE INDEX IF NOT EXISTS idx_plantilla_campo_obra_social_id');
    expect(fuente).toContain('ya está habilitada');
    expect(fuente).not.toMatch(/^\s*DROP TABLE/m);
    expect(fuente).not.toMatch(/^\s*ALTER TABLE.*DROP COLUMN/m);
  });

  it('no declara ningún SECURITY DEFINER (no crea funciones, pero se blinda igual)', () => {
    const fuente = leerMigracion('20260731120000_obra_social_config_facturacion.sql');
    const codigoActivo = quitarComentariosYStrings(fuente);

    expect(codigoActivo).not.toContain('SECURITY DEFINER');
  });
});

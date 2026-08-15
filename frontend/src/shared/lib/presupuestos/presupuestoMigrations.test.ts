/// <reference types="node" />
// Test de las dos migraciones de presupuesto-prestaciones (PR 2) como texto (mismo patrón que
// hojaDeRutaMigrations.test.ts/obraSocialMigrations.test.ts): `?raw` no sirve para rutas fuera de
// `frontend/` (fs.allow de Vite deniega "Denied ID"), se usa `node:fs`. Ver
// openspec/changes/presupuesto-prestaciones/tasks.md 5.3 — "única barrera automatizada contra la
// regresión de seguridad más grave de este change".
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
// real es que, quitando comentarios y literales de cadena, la única cláusula de seguridad que queda
// en el SQL activo es `SECURITY INVOKER`.
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

describe('migración 20260812140000_presupuesto_rpc.sql', () => {
  it('declara SECURITY INVOKER en las dos funciones y la cláusula activa nunca es SECURITY DEFINER', () => {
    const fuente = leerMigracion('20260812140000_presupuesto_rpc.sql');
    const codigoActivo = quitarComentariosYStrings(fuente);

    const ocurrenciasInvoker = codigoActivo.match(/SECURITY INVOKER/g) ?? [];
    expect(ocurrenciasInvoker.length).toBe(2); // crear_presupuesto_completo + crear_presupuestos_lote
    expect(codigoActivo).not.toContain('SECURITY DEFINER');
  });

  it('revoca EXECUTE de anon/PUBLIC y lo otorga solo a authenticated para las dos funciones', () => {
    const fuente = leerMigracion('20260812140000_presupuesto_rpc.sql');

    expect(fuente).toContain('REVOKE ALL ON FUNCTION facturacion.crear_presupuesto_completo(jsonb) FROM anon');
    expect(fuente).toContain('REVOKE ALL ON FUNCTION facturacion.crear_presupuestos_lote(jsonb) FROM anon');
    expect(fuente).toContain('GRANT EXECUTE ON FUNCTION facturacion.crear_presupuesto_completo(jsonb) TO authenticated');
    expect(fuente).toContain('GRANT EXECUTE ON FUNCTION facturacion.crear_presupuestos_lote(jsonb) TO authenticated');
  });

  it('declara SET search_path = \'\' en las dos funciones (código activo, sin contar la mención en la cabecera)', () => {
    const fuente = leerMigracion('20260812140000_presupuesto_rpc.sql');
    const codigoActivo = quitarComentariosYStrings(fuente);

    const ocurrencias = codigoActivo.match(/SET search_path = ''/g) ?? [];
    expect(ocurrencias.length).toBe(2);
  });

  it('usa los tres códigos de error propios (45401-45403), rango nuevo sin colisión con otros dominios', () => {
    const fuente = leerMigracion('20260812140000_presupuesto_rpc.sql');

    expect(fuente).toContain("ERRCODE = '45401'");
    expect(fuente).toContain("ERRCODE = '45402'");
    expect(fuente).toContain("ERRCODE = '45403'");
    // Rango libre: no reutiliza los códigos ya usados por crear_paciente_completo (45001-2),
    // crear_obra_social_completa (45101-3), crear_conductor_completo (45201-2) ni
    // crear_hoja_de_ruta_completa (45301-4).
    expect(fuente).not.toContain("ERRCODE = '45001'");
    expect(fuente).not.toContain("ERRCODE = '45101'");
    expect(fuente).not.toContain("ERRCODE = '45201'");
    expect(fuente).not.toContain("ERRCODE = '45301'");
  });

  it('crear_presupuestos_lote inserta dentro de un único FOR sin BEGIN/EXCEPTION que capture errores (atomicidad real, D2)', () => {
    const fuente = leerMigracion('20260812140000_presupuesto_rpc.sql');

    expect(fuente).not.toMatch(/EXCEPTION\s+WHEN/i);
    expect(fuente).toContain('FOR v_item IN SELECT value FROM jsonb_array_elements(p_presupuestos)');
  });

  it('COMMENT ON FUNCTION de las dos funciones prohíbe explícitamente convertir a DEFINER', () => {
    const fuente = leerMigracion('20260812140000_presupuesto_rpc.sql');

    expect(fuente).toContain(
      "COMMENT ON FUNCTION facturacion.crear_presupuesto_completo(jsonb) IS",
    );
    expect(fuente).toContain(
      "COMMENT ON FUNCTION facturacion.crear_presupuestos_lote(jsonb) IS",
    );
    const ocurrenciasNoConvertir = (fuente.match(/NO convertir a SECURITY DEFINER/g) ?? []).length;
    expect(ocurrenciasNoConvertir).toBe(2);
  });
});

describe('migración 20260812130000_presupuesto_prestacion_id.sql', () => {
  it('agrega prestacion_id como columna nullable con FK a pacientes.prestaciones (D1, expand aditivo)', () => {
    const fuente = leerMigracion('20260812130000_presupuesto_prestacion_id.sql');

    expect(fuente).toContain(
      'ALTER TABLE facturacion.presupuesto\n  ADD COLUMN prestacion_id UUID REFERENCES pacientes.prestaciones(id);',
    );
    expect(fuente).not.toMatch(/prestacion_id[^\n]*NOT NULL/);
  });

  it('crea un índice sobre prestacion_id', () => {
    const fuente = leerMigracion('20260812130000_presupuesto_prestacion_id.sql');

    expect(fuente).toContain('CREATE INDEX idx_presupuesto_prestacion_id ON facturacion.presupuesto (prestacion_id);');
  });

  it('no borra ninguna columna existente (expand aditivo, D1)', () => {
    const fuente = leerMigracion('20260812130000_presupuesto_prestacion_id.sql');

    expect(fuente).not.toMatch(/^\s*DROP COLUMN/m);
    expect(fuente).not.toMatch(/^\s*DROP TABLE/m);
  });
});

// Auto-creación de la autorización 'pendiente' al crear el presupuesto (requerimiento aprobado por
// la usuaria 2026-08-15): mismo patrón de test que la migración base -- lee el archivo con node:fs
// y confirma que la cláusula de seguridad activa nunca degrada a SECURITY DEFINER.
describe('migración 20260815090000_presupuesto_autoriza_pendiente.sql', () => {
  const NOMBRE = '20260815090000_presupuesto_autoriza_pendiente.sql';

  it('declara SECURITY INVOKER en las dos funciones y la cláusula activa nunca es SECURITY DEFINER', () => {
    const fuente = leerMigracion(NOMBRE);
    const codigoActivo = quitarComentariosYStrings(fuente);

    const ocurrenciasInvoker = codigoActivo.match(/SECURITY INVOKER/g) ?? [];
    expect(ocurrenciasInvoker.length).toBe(2); // crear_presupuesto_completo + crear_presupuestos_lote
    expect(codigoActivo).not.toContain('SECURITY DEFINER');
  });

  it('declara SET search_path = \'\' en las dos funciones (código activo)', () => {
    const fuente = leerMigracion(NOMBRE);
    const codigoActivo = quitarComentariosYStrings(fuente);

    const ocurrencias = codigoActivo.match(/SET search_path = ''/g) ?? [];
    expect(ocurrencias.length).toBe(2);
  });

  it('inserta una autorización pendiente por cada presupuesto creado (alta simple y alta en lote)', () => {
    const fuente = leerMigracion(NOMBRE);

    const ocurrencias = fuente.match(
      /INSERT INTO facturacion\.autorizacion \(presupuesto_id, estado\) VALUES \(v_id, 'pendiente'\);/g,
    ) ?? [];
    expect(ocurrencias.length).toBe(2); // una en crear_presupuesto_completo, una en crear_presupuestos_lote (dentro del FOR)
  });

  it('mantiene la firma de las dos funciones (jsonb -> uuid / jsonb -> uuid[]) sin cambios', () => {
    const fuente = leerMigracion(NOMBRE);

    expect(fuente).toContain('CREATE OR REPLACE FUNCTION facturacion.crear_presupuesto_completo(p_presupuesto jsonb)');
    expect(fuente).toContain('RETURNS uuid');
    expect(fuente).toContain('CREATE OR REPLACE FUNCTION facturacion.crear_presupuestos_lote(p_presupuestos jsonb)');
    expect(fuente).toContain('RETURNS uuid[]');
  });

  it('el INSERT de autorizacion en crear_presupuestos_lote está dentro del FOR (una autorización por ítem del lote)', () => {
    const fuente = leerMigracion(NOMBRE);
    const inicioFor = fuente.indexOf('FOR v_item IN SELECT value FROM jsonb_array_elements(p_presupuestos)');
    const finFor = fuente.indexOf('END LOOP;');
    expect(inicioFor).toBeGreaterThan(-1);
    expect(finFor).toBeGreaterThan(inicioFor);

    const cuerpoFor = fuente.slice(inicioFor, finFor);
    expect(cuerpoFor).toContain("INSERT INTO facturacion.autorizacion (presupuesto_id, estado) VALUES (v_id, 'pendiente');");
  });
});

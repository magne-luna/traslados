/// <reference types="node" />
// 1B.5 — test de las dos migraciones de este change como texto. `?raw` no sirve para rutas fuera
// de `frontend/` (`fs.allow` de Vite deniega "Denied ID", ya probado empíricamente por
// `integracion-pacientes` 3.12b y reusado por `integracion-obra-social` 4.9) — se usa `node:fs`.
// `tsconfig.app.json` no incluye `types: ["node"]` a propósito (código de `src/` es de navegador);
// la referencia de arriba trae los tipos de `@types/node` solo para este archivo de test.
//
// Es la ÚNICA barrera automatizada contra la regresión de seguridad más grave del change (D4,
// design.md): que alguien convierta `crear_factura_completa` o `actualizar_factura_completa` a
// SECURITY DEFINER, lo que bypassearía RLS sobre el registro financiero de la empresa.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

function leerMigracion(nombre: string): string {
  return readFileSync(resolve(__dirname, `../../../../../supabase/migrations/${nombre}`), 'utf-8');
}

// El archivo menciona "SECURITY DEFINER" varias veces DENTRO de comentarios `--` (advirtiendo, en
// castellano, que no hay que usarlo) y en el `COMMENT ON FUNCTION` (que es un literal de cadena
// SQL, no una cláusula activa) — eso es documentación deliberada (D4), no la cláusula activa. El
// chequeo real es que, quitando comentarios y literales de cadena, la única cláusula de seguridad
// que queda en el SQL activo es SECURITY INVOKER.
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

describe('migración 20260812160000_factura_rpc.sql (1B.5)', () => {
  it('declara SECURITY INVOKER en las dos funciones y la cláusula activa nunca es SECURITY DEFINER', () => {
    const fuente = leerMigracion('20260812160000_factura_rpc.sql');
    const codigoActivo = quitarComentariosYStrings(fuente);

    const ocurrenciasInvoker = codigoActivo.match(/SECURITY INVOKER/g) ?? [];
    expect(ocurrenciasInvoker.length).toBe(2); // crear_factura_completa + actualizar_factura_completa
    expect(codigoActivo).not.toContain('SECURITY DEFINER');
  });

  it('revoca EXECUTE de anon/PUBLIC y lo otorga solo a authenticated para las dos funciones', () => {
    const fuente = leerMigracion('20260812160000_factura_rpc.sql');

    expect(fuente).toContain('REVOKE ALL ON FUNCTION facturacion.crear_factura_completa(jsonb) FROM PUBLIC');
    expect(fuente).toContain('REVOKE ALL ON FUNCTION facturacion.crear_factura_completa(jsonb) FROM anon');
    expect(fuente).toContain(
      'REVOKE ALL ON FUNCTION facturacion.actualizar_factura_completa(uuid, jsonb) FROM PUBLIC',
    );
    expect(fuente).toContain(
      'REVOKE ALL ON FUNCTION facturacion.actualizar_factura_completa(uuid, jsonb) FROM anon',
    );
    expect(fuente).toContain('GRANT EXECUTE ON FUNCTION facturacion.crear_factura_completa(jsonb) TO authenticated');
    expect(fuente).toContain(
      'GRANT EXECUTE ON FUNCTION facturacion.actualizar_factura_completa(uuid, jsonb) TO authenticated',
    );
  });

  it('fija SET search_path a vacío en las dos funciones', () => {
    const fuente = leerMigracion('20260812160000_factura_rpc.sql');
    const ocurrencias = fuente.match(/SET search_path = ''/g) ?? [];
    expect(ocurrencias.length).toBe(2);
  });

  it('usa el operador jsonb `?` (no `->>`) para distinguir clave ausente de presente en asistencias (1B.3, la trampa central)', () => {
    const fuente = leerMigracion('20260812160000_factura_rpc.sql');
    expect(fuente).toContain("p_cambios ? 'asistencias'");
  });

  it('declara los 4 códigos de error propios en el rango 452xx (D4/D7), sin colisionar con el 451xx de integracion-obra-social', () => {
    const fuente = leerMigracion('20260812160000_factura_rpc.sql');

    expect(fuente).toContain("USING ERRCODE = '45201'");
    expect(fuente).toContain("USING ERRCODE = '45202'");
    expect(fuente).toContain("USING ERRCODE = '45203'");
    expect(fuente).toContain("USING ERRCODE = '45204'");
    expect(fuente).not.toMatch(/ERRCODE = '451\d\d'/);
  });

  it('el COMMENT ON FUNCTION de las dos funciones deja escrita la prohibición de SECURITY DEFINER', () => {
    const fuente = leerMigracion('20260812160000_factura_rpc.sql');
    const bloqueComentarios = fuente.slice(fuente.indexOf('COMMENT ON FUNCTION'));

    expect(bloqueComentarios).toContain('SECURITY DEFINER');
    expect(bloqueComentarios.toLowerCase()).toContain('nunca');
  });
});

describe('migración 20260812150000_factura_fecha_emision_indices.sql (1B.1)', () => {
  it('agrega fecha_factura como columna nullable, sin default ni NOT NULL', () => {
    const fuente = leerMigracion('20260812150000_factura_fecha_emision_indices.sql');

    const lineaColumna = fuente
      .split('\n')
      .find((linea) => linea.trim().startsWith('ALTER TABLE') && linea.includes('fecha_factura'));

    expect(lineaColumna).toBeDefined();
    expect(lineaColumna).toContain('ADD COLUMN IF NOT EXISTS fecha_factura DATE');
    expect(lineaColumna).not.toContain('NOT NULL');
    expect(lineaColumna).not.toContain('DEFAULT');
  });

  it('crea los 6 índices de D10 con IF NOT EXISTS, sobre las 4 tablas del dominio propio', () => {
    const fuente = leerMigracion('20260812150000_factura_fecha_emision_indices.sql');

    const indices = [
      'idx_facturas_paciente_id',
      'idx_facturas_domicilio_id',
      'idx_asistencia_prestacion_factura_id',
      'idx_cobros_facturas_id',
      'idx_documento_factura_factura_id',
      'idx_documento_factura_id_tipo_documento',
    ];

    for (const indice of indices) {
      expect(fuente).toContain(`CREATE INDEX IF NOT EXISTS ${indice}`);
    }
  });

  it('no usa CONCURRENTLY (D10, aprobado en 0.5 porque las 4 tablas objetivo están en 0 filas)', () => {
    const fuente = leerMigracion('20260812150000_factura_fecha_emision_indices.sql');
    const codigoActivo = quitarComentariosYStrings(fuente);
    expect(codigoActivo).not.toContain('CONCURRENTLY');
  });

  it('no toca ninguna tabla o columna existente de forma destructiva', () => {
    const fuente = leerMigracion('20260812150000_factura_fecha_emision_indices.sql');
    expect(fuente).not.toMatch(/^\s*DROP TABLE/m);
    expect(fuente).not.toMatch(/^\s*ALTER TABLE.*DROP COLUMN/m);
  });
});

describe('migración 20260813090000_factura_autorizacion_id.sql (1B.1, facturacion-seleccion-autorizacion)', () => {
  it('agrega autorizacion_id como columna nullable, referenciando facturacion.autorizacion, sin UNIQUE', () => {
    const fuente = leerMigracion('20260813090000_factura_autorizacion_id.sql');
    const codigoActivo = quitarComentariosYStrings(fuente);

    expect(fuente).toContain(
      'ADD COLUMN autorizacion_id UUID REFERENCES facturacion.autorizacion(id)',
    );
    expect(codigoActivo).not.toContain('NOT NULL');
    expect(codigoActivo).not.toContain('UNIQUE');
  });

  it('crea el índice de la columna con IF NOT EXISTS y sin CONCURRENTLY (0.3: count(*) = 0 verificado)', () => {
    const fuente = leerMigracion('20260813090000_factura_autorizacion_id.sql');
    const codigoActivo = quitarComentariosYStrings(fuente);

    expect(fuente).toContain(
      'CREATE INDEX IF NOT EXISTS idx_facturas_autorizacion_id\n  ON facturacion.facturas (autorizacion_id)',
    );
    expect(codigoActivo).not.toContain('CONCURRENTLY');
  });

  it('no toca ninguna tabla, columna o policy existente de forma destructiva', () => {
    const fuente = leerMigracion('20260813090000_factura_autorizacion_id.sql');
    expect(fuente).not.toMatch(/^\s*DROP TABLE/m);
    expect(fuente).not.toMatch(/^\s*ALTER TABLE.*DROP COLUMN/m);
    expect(fuente).not.toMatch(/^\s*DROP POLICY/m);
  });
});

describe('migración 20260813090001_factura_rpc_autorizacion.sql (1B.2/1B.3, facturacion-seleccion-autorizacion)', () => {
  it('declara SECURITY INVOKER en las dos funciones reemplazadas y la cláusula activa nunca es SECURITY DEFINER', () => {
    const fuente = leerMigracion('20260813090001_factura_rpc_autorizacion.sql');
    const codigoActivo = quitarComentariosYStrings(fuente);

    const ocurrenciasInvoker = codigoActivo.match(/SECURITY INVOKER/g) ?? [];
    expect(ocurrenciasInvoker.length).toBe(2); // crear_factura_completa + actualizar_factura_completa
    expect(codigoActivo).not.toContain('SECURITY DEFINER');
  });

  it('fija SET search_path a vacío en las dos funciones reemplazadas', () => {
    const fuente = leerMigracion('20260813090001_factura_rpc_autorizacion.sql');
    const codigoActivo = quitarComentariosYStrings(fuente);
    const ocurrencias = codigoActivo.match(/SET search_path = ''/g) ?? [];
    expect(ocurrencias.length).toBe(2);
  });

  it('usa CREATE OR REPLACE FUNCTION sobre las dos RPC vivas, sin DROP FUNCTION previo', () => {
    const fuente = leerMigracion('20260813090001_factura_rpc_autorizacion.sql');

    expect(fuente).toContain('CREATE OR REPLACE FUNCTION facturacion.crear_factura_completa(p_factura jsonb)');
    expect(fuente).toContain(
      'CREATE OR REPLACE FUNCTION facturacion.actualizar_factura_completa(p_id uuid, p_cambios jsonb)',
    );
    expect(fuente).not.toMatch(/^\s*DROP FUNCTION/m);
  });

  it('crear_factura_completa lee autorizacion_id del jsonb como columna opcional del INSERT', () => {
    const fuente = leerMigracion('20260813090001_factura_rpc_autorizacion.sql');
    expect(fuente).toContain("(p_factura ->> 'autorizacion_id')::uuid");
  });

  it('actualizar_factura_completa usa el operador jsonb `?` (no `->>` suelto) para autorizacion_id — la trampa central de este change', () => {
    const fuente = leerMigracion('20260813090001_factura_rpc_autorizacion.sql');
    expect(fuente).toContain("p_cambios ? 'autorizacion_id'");
  });

  it('conserva los 4 códigos de error 452xx existentes sin agregar ni quitar ninguno', () => {
    const fuente = leerMigracion('20260813090001_factura_rpc_autorizacion.sql');

    expect(fuente).toContain("USING ERRCODE = '45201'");
    expect(fuente).toContain("USING ERRCODE = '45202'");
    expect(fuente).toContain("USING ERRCODE = '45203'");
    expect(fuente).toContain("USING ERRCODE = '45204'");
  });

  it('el COMMENT ON FUNCTION de las dos funciones deja escrita la prohibición de SECURITY DEFINER', () => {
    const fuente = leerMigracion('20260813090001_factura_rpc_autorizacion.sql');
    const bloqueComentarios = fuente.slice(fuente.indexOf('COMMENT ON FUNCTION'));

    expect(bloqueComentarios).toContain('SECURITY DEFINER');
    expect(bloqueComentarios.toLowerCase()).toContain('nunca');
  });
});

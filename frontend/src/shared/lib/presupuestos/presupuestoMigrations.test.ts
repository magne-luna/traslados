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

// -----------------------------------------------------------------------------------------------
// REAPERTURA #13 (decisión usuaria 2026-08-16, brief `facturacion-cambios-ui` WU1): la modalidad
// `general` SÍ persiste su desglose por prestación. Nueva tabla `facturacion.presupuesto_linea`
// + reemplazo de ambas RPC con soporte de líneas (alta simple: parámetro `p_lineas`; alta en lote:
// `lineas` opcional por ítem), MISMO código de error nuevo 45404 para líneas malformadas y SIN
// degradar a SECURITY DEFINER.
// -----------------------------------------------------------------------------------------------
describe('migración 20260816110000_presupuesto_lineas.sql', () => {
  const NOMBRE = '20260816110000_presupuesto_lineas.sql';

  it('crea facturacion.presupuesto_linea con FKs, monto NUMERIC(10,2), orden SMALLINT y UNIQUE(presupuesto_id, prestacion_id, orden)', () => {
    const fuente = leerMigracion(NOMBRE);

    expect(fuente).toContain('CREATE TABLE facturacion.presupuesto_linea (');
    expect(fuente).toContain('presupuesto_id UUID NOT NULL REFERENCES facturacion.presupuesto(id) ON DELETE CASCADE');
    expect(fuente).toContain('prestacion_id UUID NOT NULL REFERENCES pacientes.prestaciones(id) ON DELETE RESTRICT');
    expect(fuente).toContain('monto NUMERIC(10,2) NOT NULL');
    expect(fuente).toContain('orden SMALLINT NOT NULL DEFAULT 0');
    expect(fuente).toContain('UNIQUE (presupuesto_id, prestacion_id, orden)');
  });

  it('habilita RLS y gatea por el módulo presupuestos (read/write), mismo patrón que facturacion.presupuesto', () => {
    const fuente = leerMigracion(NOMBRE);

    expect(fuente).toContain('ALTER TABLE facturacion.presupuesto_linea ENABLE ROW LEVEL SECURITY;');
    expect(fuente).toContain("CREATE POLICY \"Read presupuesto_linea\" ON facturacion.presupuesto_linea FOR SELECT TO authenticated USING (modulos.tiene_permiso('presupuestos', 'read'));");
    expect(fuente).toContain("CREATE POLICY \"Write presupuesto_linea\" ON facturacion.presupuesto_linea FOR ALL TO authenticated USING (modulos.tiene_permiso('presupuestos', 'write'));");
    expect(fuente).toContain('GRANT ALL ON facturacion.presupuesto_linea TO authenticated;');
  });

  it('agrega el trigger de auditoría log_action (RN-GL-02), mismo patrón que presupuesto/autorizacion', () => {
    const fuente = leerMigracion(NOMBRE);

    expect(fuente).toContain(
      'CREATE TRIGGER trg_audit_presupuesto_linea AFTER INSERT OR UPDATE OR DELETE ON facturacion.presupuesto_linea FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();',
    );
  });

  it('reemplaza la RPC de alta simple (DROP + firma nueva con p_lineas), mantiene la firma del lote y declara SECURITY INVOKER + search_path en el cuerpo activo', () => {
    const fuente = leerMigracion(NOMBRE);
    const codigoActivo = quitarComentariosYStrings(fuente);

    expect(fuente).toContain('DROP FUNCTION facturacion.crear_presupuesto_completo(jsonb);');
    expect(fuente).toContain('CREATE OR REPLACE FUNCTION facturacion.crear_presupuesto_completo(p_presupuesto jsonb, p_lineas jsonb DEFAULT NULL)');
    // Lote: firma SIN cambios (el canal de líneas de un lote son las `lineas` opcionales DENTRO de
    // cada ítem, ver cabecera de la migración) — no se dropea ni se reemplaza su firma.
    expect(fuente).toContain('CREATE OR REPLACE FUNCTION facturacion.crear_presupuestos_lote(p_presupuestos jsonb)');

    // 3 funciones con el patrón de seguridad: las dos RPC + el helper insertar_lineas_presupuesto.
    const ocurrenciasInvoker = codigoActivo.match(/SECURITY INVOKER/g) ?? [];
    expect(ocurrenciasInvoker.length).toBe(3);
    expect(codigoActivo).not.toContain('SECURITY DEFINER');
    const ocurrenciasSearchPath = codigoActivo.match(/SET search_path = ''/g) ?? [];
    expect(ocurrenciasSearchPath.length).toBe(3);
  });

  it('mantiene intactos los códigos 45401-45403 y agrega el 45404 para líneas malformadas', () => {
    const fuente = leerMigracion(NOMBRE);

    expect(fuente).toContain("ERRCODE = '45401'");
    expect(fuente).toContain("ERRCODE = '45402'");
    expect(fuente).toContain("ERRCODE = '45403'");
    expect(fuente).toContain("ERRCODE = '45404'");
  });

  it('valida e inserta las líneas dentro de la misma transacción (helper insertar_lineas_presupuesto)', () => {
    const fuente = leerMigracion(NOMBRE);

    expect(fuente).toContain('CREATE OR REPLACE FUNCTION facturacion.insertar_lineas_presupuesto(p_presupuesto_id uuid, p_lineas jsonb)');
    expect(fuente).toContain('IF p_lineas IS NULL THEN');
    expect(fuente).toContain("IF jsonb_typeof(p_lineas) <> 'array' THEN");
    expect(fuente).toContain('INSERT INTO facturacion.presupuesto_linea (presupuesto_id, prestacion_id, monto, orden)');
    // Ambas RPC llaman al helper dentro de su cuerpo (alta simple y la iteración del lote).
    const llamadasHelper = (fuente.match(/PERFORM facturacion\.insertar_lineas_presupuesto\(/g) ?? []).length;
    expect(llamadasHelper).toBe(2);
  });

  it('sin BEGIN/EXCEPTION que capture errores (la atomicidad la da la transacción de la función)', () => {
    const fuente = leerMigracion(NOMBRE);

    expect(fuente).not.toMatch(/EXCEPTION\s+WHEN/i);
  });

  it('reapertura la discrepancia #13 de la KB con marcador ⚠️ y fecha 2026-08-16 en la cabecera', () => {
    const fuente = leerMigracion(NOMBRE);

    expect(fuente).toMatch(/⚠️/);
    expect(fuente).toContain('#13');
    expect(fuente).toContain('2026-08-16');
  });
});

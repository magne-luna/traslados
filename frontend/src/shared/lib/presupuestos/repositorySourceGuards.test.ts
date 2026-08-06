import { describe, expect, it } from 'vitest';
// Import Vite `?raw` (declarado en vite/client.d.ts), mismo patrón que
// SupabaseCuentaRepository.test.ts: trae el código fuente como string en build time.
import supabasePresupuestoRepositorySource from './SupabasePresupuestoRepository.ts?raw';
import supabaseAutorizacionRepositorySource from './SupabaseAutorizacionRepository.ts?raw';

// tasks.md 3.10 — test de código fuente sobre los dos repositories. **Ojo con el regex ingenuo**:
// `/\bany\b/` sobre el archivo entero matchearía dentro de comentarios en castellano ("cualquier
// otro", etc. no contienen "any", pero SÍ lo contienen los propios comentarios explicativos de este
// change, que mencionan literalmente "no contiene `any`" y "modulos.permisos"/"modulos.modulos" en
// prosa) — es exactamente la trampa que le pasó a `integracion-pacientes` 3.12. Por eso el check se
// escopea a **líneas de código**, descartando comentarios de línea completa y la cola de comentario
// de las líneas mixtas, antes de aplicar cualquier regex.

function soloLineasDeCodigo(fuente: string): string {
  return fuente
    .split('\n')
    .filter((linea) => !linea.trim().startsWith('//'))
    .map((linea) => {
      const indice = linea.indexOf('//');
      return indice === -1 ? linea : linea.slice(0, indice);
    })
    .join('\n');
}

describe.each([
  ['SupabasePresupuestoRepository.ts', supabasePresupuestoRepositorySource],
  ['SupabaseAutorizacionRepository.ts', supabaseAutorizacionRepositorySource],
])('%s (tasks.md 3.10)', (_nombre, fuenteCompleta) => {
  const codigo = soloLineasDeCodigo(fuenteCompleta);

  it('no contiene "service_role"', () => {
    expect(fuenteCompleta).not.toContain('service_role');
  });

  it('no contiene la palabra "any" como token — solo en líneas de código, no en comentarios en castellano', () => {
    expect(codigo).not.toMatch(/\bany\b/);
  });

  it('no consulta modulos.permisos ni modulos.modulos — la autorización no se duplica client-side (D3, security-review)', () => {
    // Chequeo sobre la sintaxis real de consulta (`.schema('modulos')`/`.from('permisos'|'modulos')`),
    // no sobre la substring "modulos.permisos" — los propios comentarios explicativos del archivo la
    // mencionan en prosa (ver arriba), así que un `.not.toContain` sobre el string crudo daría un
    // falso positivo.
    expect(codigo).not.toMatch(/\.schema\(\s*['"]modulos['"]\s*\)/);
    expect(codigo).not.toMatch(/\.from\(\s*['"](permisos|modulos)['"]\s*\)/);
  });

  it('toda la I/O es vía functions.invoke — sin insert/update/delete directo sobre las tablas', () => {
    expect(codigo).not.toMatch(/\.(insert|update|delete)\(/);
    expect(codigo).toContain('functions.invoke(');
  });
});

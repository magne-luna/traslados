import type { Prestador } from '../../types/prestador';

// Fixture de Prestador para el mock (fix de coordinación 2026-08-04 sobre `factura-por-prestador`,
// ver `CHANGES.md`): `FacturacionRoute.tsx` inyectaba originalmente `supabasePrestadorRepository`
// (real) para alimentar `PrestadorSelector`, pero `ObraSocial.id` en esa misma pantalla viene de
// `mockObraSocialRepository`/`osecacFixture.ts` — ids de fixture literales ('osecac'), no UUIDs de
// Supabase. `listarPorObraSocial('osecac')` contra el backend real nunca iba a matchear ninguna
// fila — el selector quedaba siempre vacío en la práctica, y además rompía la promesa del
// proposal.md de "cero cambios a Supabase" para este change. Corrección: mock propio
// (`mockPrestadorRepository.ts`), sembrado en el mismo espacio de ids que `mockObraSocialRepository`
// (única obra social sembrada hoy: 'osecac').
//
// Id del primer prestador tomado literal de
// `supabase/migrations/20260801120000_seed_obras_sociales_prestadores.sql` ("Traslados Andrea
// Pastor", vinculada a OSECAC en el seed real de Supabase) — mismo criterio narrativo, pero con un
// id propio de mock (no un UUID real). `facturasFixture.ts` reutiliza esta misma constante para
// que `Factura.prestadorId` de sus ejemplos apunte a un prestador que el mock efectivamente sirve.
export const PRESTADOR_ID_TRASLADOS_ANDREA_PASTOR = 'prestador-traslados-andrea-pastor';

export function buildPrestadoresFixture(): Prestador[] {
  return [
    {
      id: PRESTADOR_ID_TRASLADOS_ANDREA_PASTOR,
      razonSocial: 'Traslados Andrea Pastor',
      cuit: '30-71234567-8',
      plazoCobroDias: 90,
      tipoComprobante: 'B',
    },
    {
      id: 'prestador-kinesiologia-caba',
      razonSocial: 'Kinesiología CABA SRL',
      cuit: '30-65432198-3',
      direccion: 'Av. Callao 1200, CABA',
      telefono: '11-2222-3333',
      plazoCobroDias: 60,
      tipoComprobante: 'A',
    },
  ];
}

/**
 * Vínculo N:N mock Prestador↔ObraSocial (prestadorId -> obraSocialId[]): a diferencia de
 * `SupabasePrestadorRepository.ts` (tabla real `obra_social.obra_social_prestador`), el mock no
 * modela una tabla de vínculo aparte — este mapa vive junto al fixture y lo consume
 * `mockPrestadorRepository.ts` para `listarPorObraSocial()`. Los dos prestadores del seed están
 * vinculados a 'osecac', la única obra social sembrada por `mockObraSocialRepository` hoy.
 */
export function buildVinculosFixture(): Record<string, string[]> {
  return {
    [PRESTADOR_ID_TRASLADOS_ANDREA_PASTOR]: ['osecac'],
    'prestador-kinesiologia-caba': ['osecac'],
  };
}

import { describe, expect, it } from 'vitest';
import { parsePrestadorRow } from './prestadorMapping';

// Testing reducido a propósito para esta rama de demo (ver cabecera de tasks.md, tarea 3.3): un
// solo smoke test, no la batería exhaustiva de `obraSocialMapping.test.ts`.

describe('parsePrestadorRow (3.3, smoke test)', () => {
  it('mapea una fila completa, incluido el renombre razon_social->razonSocial y el embed del vínculo', () => {
    const prestador = parsePrestadorRow({
      id: 'p-1',
      razon_social: 'Traslados Andrea SA',
      cuit: '30-11111111-1',
      direccion: 'Av. Siempre Viva 742',
      telefono: '11-2222-3333',
      plazo_cobro_dias: 60,
      tipo_comprobante: 'B',
      obra_social_prestador: [{ obra_social_id: 'os-1' }, { obra_social_id: 'os-2' }],
    });

    expect(prestador).toEqual({
      id: 'p-1',
      razonSocial: 'Traslados Andrea SA',
      cuit: '30-11111111-1',
      direccion: 'Av. Siempre Viva 742',
      telefono: '11-2222-3333',
      plazoCobroDias: 60,
      tipoComprobante: 'B',
      obrasSocialesIds: ['os-1', 'os-2'],
    });
  });
});

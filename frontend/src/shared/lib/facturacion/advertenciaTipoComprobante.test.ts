import { describe, expect, it } from 'vitest';
import type { CondicionIvaArca } from '../../types/obraSocial';
import { advertenciaTipoComprobante } from './advertenciaTipoComprobante';

describe('advertenciaTipoComprobante', () => {
  it('Factura A + obra social exenta → devuelve la condición problemática', () => {
    expect(
      advertenciaTipoComprobante({ tipoComprobante: 'A', condicionIvaObraSocial: 'IVA_SUJETO_EXENTO' }),
    ).toEqual({ condicion: 'IVA_SUJETO_EXENTO' });
  });

  it('Factura A + Responsable Inscripto → null (es la única condición que ARCA acepta para A)', () => {
    expect(
      advertenciaTipoComprobante({ tipoComprobante: 'A', condicionIvaObraSocial: 'IVA_RESPONSABLE_INSCRIPTO' }),
    ).toBeNull();
  });

  it('Factura A sin condición cargada → null (lo cubre el 422 EMISION_SIN_CONDICION_IVA)', () => {
    expect(advertenciaTipoComprobante({ tipoComprobante: 'A', condicionIvaObraSocial: undefined })).toBeNull();
  });

  it('Factura B / C → null cualquiera sea la condición (triangulación)', () => {
    const condiciones: (CondicionIvaArca | undefined)[] = ['IVA_SUJETO_EXENTO', 'IVA_RESPONSABLE_INSCRIPTO', undefined];
    for (const condicion of condiciones) {
      expect(advertenciaTipoComprobante({ tipoComprobante: 'B', condicionIvaObraSocial: condicion })).toBeNull();
      expect(advertenciaTipoComprobante({ tipoComprobante: 'C', condicionIvaObraSocial: condicion })).toBeNull();
    }
  });

  it('Factura A + monotributo / consumidor final → también advierte (triangulación)', () => {
    expect(
      advertenciaTipoComprobante({ tipoComprobante: 'A', condicionIvaObraSocial: 'MONOTRIBUTO' }),
    ).toEqual({ condicion: 'MONOTRIBUTO' });
    expect(
      advertenciaTipoComprobante({ tipoComprobante: 'A', condicionIvaObraSocial: 'CONSUMIDOR_FINAL' }),
    ).toEqual({ condicion: 'CONSUMIDOR_FINAL' });
  });
});

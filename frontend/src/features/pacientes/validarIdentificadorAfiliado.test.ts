import { describe, expect, it } from 'vitest';
import { validarIdentificadorAfiliado } from './validarIdentificadorAfiliado';

// RF-106/RN-ID-02: el formato del identificador de afiliado depende de la obra social elegida.
// Reglas confirmadas por Enzo (backend) el 2026-08-06 — ver validarIdentificadorAfiliado.ts.

describe('validarIdentificadorAfiliado', () => {
  describe('formato null (sin obra social seleccionada)', () => {
    it('no reporta error sin importar el valor', () => {
      expect(validarIdentificadorAfiliado(null, '')).toBeUndefined();
      expect(validarIdentificadorAfiliado(null, 'cualquier-cosa')).toBeUndefined();
    });
  });

  describe('valor vacío', () => {
    it('no reporta error para ningún formato (carga diferida de la cobertura)', () => {
      expect(validarIdentificadorAfiliado('numero-documento', '')).toBeUndefined();
      expect(validarIdentificadorAfiliado('alfanumerico', '')).toBeUndefined();
      expect(validarIdentificadorAfiliado('cuil-con-sufijo', '')).toBeUndefined();
    });

    it('trata espacios en blanco como vacío', () => {
      expect(validarIdentificadorAfiliado('numero-documento', '   ')).toBeUndefined();
    });
  });

  describe('numero-documento', () => {
    it('acepta 7 dígitos', () => {
      expect(validarIdentificadorAfiliado('numero-documento', '4512345')).toBeUndefined();
    });

    it('acepta 8 dígitos', () => {
      expect(validarIdentificadorAfiliado('numero-documento', '45123456')).toBeUndefined();
    });

    it('rechaza 6 dígitos', () => {
      expect(validarIdentificadorAfiliado('numero-documento', '451234')).toBeTruthy();
    });

    it('rechaza 9 dígitos', () => {
      expect(validarIdentificadorAfiliado('numero-documento', '451234567')).toBeTruthy();
    });

    it('rechaza letras', () => {
      expect(validarIdentificadorAfiliado('numero-documento', 'OS1234567')).toBeTruthy();
    });

    it('rechaza separadores', () => {
      expect(validarIdentificadorAfiliado('numero-documento', '45.123.456')).toBeTruthy();
    });
  });

  describe('alfanumerico', () => {
    it('acepta cualquier valor no vacío, sin restricción de patrón (libre)', () => {
      expect(validarIdentificadorAfiliado('alfanumerico', 'OS-AB12345')).toBeUndefined();
      expect(validarIdentificadorAfiliado('alfanumerico', '1')).toBeUndefined();
      expect(validarIdentificadorAfiliado('alfanumerico', 'a')).toBeUndefined();
      expect(validarIdentificadorAfiliado('alfanumerico', '###')).toBeUndefined();
    });
  });

  describe('cuil-con-sufijo', () => {
    it('acepta el ejemplo de Enzo: 8 dígitos + / + 3 dígitos', () => {
      expect(validarIdentificadorAfiliado('cuil-con-sufijo', '46734546/001')).toBeUndefined();
    });

    it('acepta una cantidad distinta de dígitos antes de la barra (regla genérica, no fija a 8)', () => {
      expect(validarIdentificadorAfiliado('cuil-con-sufijo', '123/001')).toBeUndefined();
      expect(validarIdentificadorAfiliado('cuil-con-sufijo', '2733456789/002')).toBeUndefined();
    });

    it('rechaza sin barra', () => {
      expect(validarIdentificadorAfiliado('cuil-con-sufijo', '46734546001')).toBeTruthy();
    });

    it('rechaza sufijo de 2 dígitos', () => {
      expect(validarIdentificadorAfiliado('cuil-con-sufijo', '46734546/01')).toBeTruthy();
    });

    it('rechaza sufijo de 4 dígitos', () => {
      expect(validarIdentificadorAfiliado('cuil-con-sufijo', '46734546/0011')).toBeTruthy();
    });

    it('rechaza sufijo con letras', () => {
      expect(validarIdentificadorAfiliado('cuil-con-sufijo', '46734546/00A')).toBeTruthy();
    });

    it('rechaza parte antes de la barra con letras', () => {
      expect(validarIdentificadorAfiliado('cuil-con-sufijo', 'ABC/001')).toBeTruthy();
    });
  });
});

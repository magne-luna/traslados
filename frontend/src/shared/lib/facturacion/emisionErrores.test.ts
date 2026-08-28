import { describe, expect, it } from 'vitest';
import { traducirErrorEmision } from './emisionErrores';

// Traducción del error de la Edge Function `facturar` a un mensaje de UI en castellano
// (facturacion-electronica-arca, design.md D9). Ningún mensaje filtra texto crudo del miniserver,
// nombres de tabla/columna ni inglés técnico. La única info del backend que se propaga son las
// `observaciones` de ARCA en un rechazo 422 (útiles para la operadora, no son internals).

function errorEF(status: number, body?: Record<string, unknown>): { context: Response } {
  return {
    context: new Response(body === undefined ? null : JSON.stringify(body), { status }),
  };
}

describe('traducirErrorEmision (D9) — una rama por fila de la tabla', () => {
  it('503 EMISION_NO_CONFIGURADA → mensaje de "no configurada"', async () => {
    const e = await traducirErrorEmision(errorEF(503, { error: 'x', codigo: 'EMISION_NO_CONFIGURADA' }));
    expect(e.message).toBe('La emisión electrónica todavía no está configurada. Avisá a administración.');
  });

  it('401 → sesión expirada', async () => {
    const e = await traducirErrorEmision(errorEF(401, { error: 'token invalido' }));
    expect(e.message).toBe('Tu sesión expiró. Volvé a iniciar sesión.');
  });

  it('403 → sin permiso para emitir', async () => {
    const e = await traducirErrorEmision(errorEF(403, { error: 'no tenes permiso' }));
    expect(e.message).toBe('No tenés permiso para emitir facturas.');
  });

  it('404 → la factura ya no existe', async () => {
    const e = await traducirErrorEmision(errorEF(404, { error: 'not found' }));
    expect(e.message).toBe('La factura ya no existe.');
  });

  it('409 YA_EMITIDA → menciona el CAE existente', async () => {
    const e = await traducirErrorEmision(errorEF(409, { error: 'x', codigo: 'YA_EMITIDA', cae: '75123456789012' }));
    expect(e.message).toBe('Esta factura ya fue emitida (CAE 75123456789012).');
  });

  it('409 YA_EMITIDA sin cae en el body → mensaje sin paréntesis vacío', async () => {
    const e = await traducirErrorEmision(errorEF(409, { error: 'x', codigo: 'YA_EMITIDA' }));
    expect(e.message).toBe('Esta factura ya fue emitida.');
  });

  it('409 sin código (estado ≠ a-facturar) → mensaje de estado', async () => {
    const e = await traducirErrorEmision(errorEF(409, { error: 'x' }));
    expect(e.message).toBe('Solo se pueden emitir facturas en estado "a facturar".');
  });

  it('422 ARCA_RECHAZO → incluye las observaciones de ARCA', async () => {
    const e = await traducirErrorEmision(
      errorEF(422, { error: 'x', codigo: 'ARCA_RECHAZO', observaciones: 'CUIT del receptor inválido' }),
    );
    expect(e.message).toBe('ARCA rechazó el comprobante: CUIT del receptor inválido');
  });

  it('422 EMISION_TIPO_NO_SOPORTADO → solo A y B', async () => {
    const e = await traducirErrorEmision(errorEF(422, { error: 'x', codigo: 'EMISION_TIPO_NO_SOPORTADO' }));
    expect(e.message).toBe('La facturación electrónica solo admite comprobantes A y B por ahora.');
  });

  it('422 EMISION_SIN_CONDICION_IVA → falta la condición IVA de la obra social', async () => {
    const e = await traducirErrorEmision(errorEF(422, { error: 'x', codigo: 'EMISION_SIN_CONDICION_IVA' }));
    expect(e.message).toBe('Falta la condición frente al IVA de la obra social para emitir Factura A.');
  });

  it('502 ARCA_IDENTIDAD → remite a administración sin exponer el certificado', async () => {
    const e = await traducirErrorEmision(errorEF(502, { error: 'x', codigo: 'ARCA_IDENTIDAD' }));
    expect(e.message).toBe('Hay un problema con el certificado fiscal. Avisá a administración.');
  });

  it('502 ARCA_ERROR → servicio de ARCA no respondió', async () => {
    const e = await traducirErrorEmision(errorEF(502, { error: 'x', codigo: 'ARCA_ERROR' }));
    expect(e.message).toBe('El servicio de facturación de ARCA no respondió. Probá de nuevo en unos minutos.');
  });

  it('500 (emitió en ARCA, falló la persistencia local) → menciona el número de comprobante', async () => {
    const e = await traducirErrorEmision(errorEF(500, { error: 'x', cbteNro: 45 }));
    expect(e.message).toBe(
      'La factura se emitió en ARCA pero no se pudo guardar acá. Avisá a administración con el número 45.',
    );
  });

  it('500 sin cbteNro → mensaje genérico', async () => {
    const e = await traducirErrorEmision(errorEF(500, { error: 'x' }));
    expect(e.message).toBe('No se pudo emitir la factura.');
  });

  it('error de red (context no es Response) → sin conexión', async () => {
    const e = await traducirErrorEmision({ message: 'Failed to fetch' });
    expect(e.message).toBe('No se pudo conectar con el servidor.');
  });

  it('body no-JSON → cae al genérico, nunca propaga el texto crudo', async () => {
    const e = await traducirErrorEmision({ context: new Response('<html>500</html>', { status: 500 }) });
    expect(e.message).toBe('No se pudo emitir la factura.');
  });

  it('ningún mensaje contiene inglés técnico, nombres de tabla ni el texto crudo del miniserver', async () => {
    const casos = [
      errorEF(503, { error: 'ARCA_MINISERVER_URL missing', codigo: 'EMISION_NO_CONFIGURADA' }),
      errorEF(422, { error: 'facturacion.facturas constraint', codigo: 'ARCA_RECHAZO', observaciones: 'obs' }),
      errorEF(502, { error: 'ETIMEDOUT connect', codigo: 'ARCA_ERROR' }),
      errorEF(500, { error: 'null value in column "cae"' }),
    ];
    for (const caso of casos) {
      const { message } = await traducirErrorEmision(caso);
      expect(message).not.toMatch(/facturacion\.|column|constraint|ETIMEDOUT|ARCA_MINISERVER|null value/i);
    }
  });
});

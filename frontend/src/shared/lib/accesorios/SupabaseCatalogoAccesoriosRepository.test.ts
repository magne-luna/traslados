import { describe, expect, it } from 'vitest';
import { mapearErrorCatalogo } from './SupabaseCatalogoAccesoriosRepository';

// 2.4 — traducción de errores del catálogo (molde mapearErrorObraSocial). Casos fijos del
// design.md D5: 23505 (UNIQUE tipo, nombra el duplicado), 42501 (permiso), 23503 (referencia
// inexistente), 45110-45112 (reservados para la RPC que el plan recortado NO agrega, no se
// traducen acá) y desconocido → genérico sin propagar el mensaje crudo.

describe('mapearErrorCatalogo (2.4)', () => {
  it('23505 traduce a mensaje accionable que nombra el tipo duplicado', () => {
    const error = mapearErrorCatalogo(
      { code: '23505', message: 'duplicate key value violates unique constraint "accesorios_tipo_unique"' },
      { tipo: 'andador' },
    );
    expect(error.message).toContain('Ya existe un accesorio');
    expect(error.message).toContain('andador');
  });

  it('23505 sin contexto cae al mensaje genérico de duplicado', () => {
    const error = mapearErrorCatalogo({
      code: '23505',
      message: 'duplicate key value violates unique constraint "accesorios_tipo_unique"',
    });
    expect(error.message).toContain('Ya existe un accesorio');
  });

  it('42501 traduce a falta de permiso de escritura', () => {
    const error = mapearErrorCatalogo({ code: '42501', message: 'new row violates row-level security policy' });
    expect(error.message).toContain('No tenés permiso');
  });

  it('PGRST301 (permiso PostgREST) también traduce a falta de permiso', () => {
    const error = mapearErrorCatalogo({ code: 'PGRST301', message: 'permission denied' });
    expect(error.message).toContain('No tenés permiso');
  });

  it('23503 traduce a accesorio inexistente', () => {
    const error = mapearErrorCatalogo({ code: '23503', message: 'foreign key violation' });
    expect(error.message).toContain('No existe ese accesorio');
  });

  it('código desconocido cae a genérico sin propagar el mensaje crudo de Postgres', () => {
    const error = mapearErrorCatalogo({ code: 'XX000', message: 'internal_error ALTER SYSTEM SET x' });
    expect(error.message).toBe('No se pudo guardar el accesorio.');
    expect(error.message).not.toContain('internal_error');
  });
});
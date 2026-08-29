import { describe, expect, it } from 'vitest';
import { aMensaje } from './aMensaje';

// tasks.md 1.6. React Query expone `error: Error | null`; los hooks del proyecto exponen
// `error: string | null` y las pantallas ya renderizan ese string (design.md §D6, traducción 1).
// Este módulo es el único puente entre ambos, y replica exactamente el `toErrorMessage` que hoy
// está duplicado en cada hook — mismo texto de fallback incluido, para que ningún test de pantalla
// que afirme sobre el mensaje tenga que cambiar.

describe('aMensaje', () => {
  it('devuelve null cuando no hay error, para no inventar un mensaje', () => {
    expect(aMensaje(null)).toBeNull();
    expect(aMensaje(undefined)).toBeNull();
  });

  it('devuelve el mensaje de un Error tal cual', () => {
    expect(aMensaje(new Error('No se pudo cargar el padrón.'))).toBe('No se pudo cargar el padrón.');
  });

  it('conserva el mensaje de las subclases de Error', () => {
    class ErrorDeRed extends Error {}
    expect(aMensaje(new ErrorDeRed('Sin conexión.'))).toBe('Sin conexión.');
  });

  it('cae al texto genérico ante cualquier cosa que no sea un Error', () => {
    const generico = 'Ocurrió un error inesperado.';
    expect(aMensaje('un string suelto')).toBe(generico);
    expect(aMensaje({ code: 500 })).toBe(generico);
    expect(aMensaje(42)).toBe(generico);
  });

  it('cae al texto genérico si el Error tiene mensaje vacío', () => {
    expect(aMensaje(new Error(''))).toBe('Ocurrió un error inesperado.');
  });
});

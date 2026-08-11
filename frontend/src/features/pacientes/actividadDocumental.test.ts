import { describe, expect, it } from 'vitest';
import type { Direccion } from '../../shared/types/paciente';
import { etiquetaActividad, obtenerActividadesConChecklist } from './actividadDocumental';

// Modelo del dominio "actividad" para el checklist documental por actividad
// (documentos-checklist-por-actividad, tasks.md §1). Checkpoint (a) — VEREDICTO (2026-08-06,
// usuaria): reusar `Direccion`, sin entidad nueva. Solo las direcciones no-domicilio son
// "actividades" con checklist propio; `tipo: 'domicilio'` (la casa del paciente) queda excluido.

function crearDireccion(overrides: Partial<Direccion>): Direccion {
  return {
    id: 'dir-1',
    tipo: 'terapia',
    calle: 'Calle Falsa 123',
    localidad: 'CABA',
    ...overrides,
  };
}

describe('obtenerActividadesConChecklist', () => {
  it('excluye el domicilio y conserva el resto de las direcciones', () => {
    const domicilio = crearDireccion({ id: 'dom', tipo: 'domicilio' });
    const escuela = crearDireccion({ id: 'esc', tipo: 'escuela' });
    const terapia = crearDireccion({ id: 'ter', tipo: 'terapia' });

    expect(obtenerActividadesConChecklist([domicilio, escuela, terapia])).toEqual([escuela, terapia]);
  });

  it('devuelve una lista vacía si solo hay domicilio', () => {
    const domicilio = crearDireccion({ id: 'dom', tipo: 'domicilio' });

    expect(obtenerActividadesConChecklist([domicilio])).toEqual([]);
  });

  it('devuelve una lista vacía si el paciente no tiene direcciones', () => {
    expect(obtenerActividadesConChecklist([])).toEqual([]);
  });

  it('conserva todas las direcciones no-domicilio, incluidas varias del mismo tipo', () => {
    const terapia1 = crearDireccion({ id: 'ter-1', tipo: 'terapia', descripcion: 'Kinesióloga' });
    const terapia2 = crearDireccion({ id: 'ter-2', tipo: 'terapia', descripcion: 'Fonoaudióloga' });

    expect(obtenerActividadesConChecklist([terapia1, terapia2])).toEqual([terapia1, terapia2]);
  });
});

describe('etiquetaActividad', () => {
  it('usa el label del tipo cuando no hay descripción', () => {
    const escuela = crearDireccion({ tipo: 'escuela', descripcion: undefined });

    expect(etiquetaActividad(escuela)).toBe('Escuela');
  });

  it('combina el label del tipo con la descripción cuando existe', () => {
    const terapia = crearDireccion({ tipo: 'terapia', descripcion: 'Kinesióloga' });

    expect(etiquetaActividad(terapia)).toBe('Terapia — Kinesióloga');
  });

  it('distingue dos actividades del mismo tipo por su descripción', () => {
    const kine = crearDireccion({ id: 'ter-1', tipo: 'terapia', descripcion: 'Kinesióloga' });
    const fono = crearDireccion({ id: 'ter-2', tipo: 'terapia', descripcion: 'Fonoaudióloga' });

    expect(etiquetaActividad(kine)).not.toBe(etiquetaActividad(fono));
    expect(etiquetaActividad(kine)).toBe('Terapia — Kinesióloga');
    expect(etiquetaActividad(fono)).toBe('Terapia — Fonoaudióloga');
  });

  it('trata la descripción vacía como si no existiera', () => {
    const otro = crearDireccion({ tipo: 'otro', descripcion: '' });

    expect(etiquetaActividad(otro)).toBe('Otro');
  });
});

// documentos-checklist-items-por-actividad (design.md Checkpoint (c) — ⚠️ REVISIÓN 2026-08-11,
// durante §9 verificación manual en vivo): la función pura `combinarItemsDeActividad` (merge +
// dedup entre los ítems de la obra social y los del tipo de actividad) se ELIMINÓ. El veredicto
// original de merge/dedup del checkpoint (c) quedó revertido probando la pantalla real: cada
// bloque de actividad muestra ÚNICAMENTE sus ítems propios del tipo — sin sumar los de la obra
// social. Ya no existe ninguna operación de "combinar" que testear acá: `PacienteDocumentos.tsx`
// pasa `itemsPorTipo[direccion.tipo] ?? []` directamente a cada bloque de actividad (ver
// `PacienteDocumentos.test.tsx`, describe "ítems por tipo de actividad"). `obtenerActividadesConChecklist`
// y `etiquetaActividad` (arriba) no cambian — siguen siendo el resto del dominio "actividad".

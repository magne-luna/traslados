import { describe, expect, it } from 'vitest';
import type { ChecklistItem } from '../../shared/types/documento';
import type { Direccion } from '../../shared/types/paciente';
import { combinarItemsDeActividad, etiquetaActividad, obtenerActividadesConChecklist } from './actividadDocumental';

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

// documentos-checklist-items-por-actividad (tasks.md §2, design.md D1/D2, Checkpoint (c) VEREDICTO
// 1.4): función pura de combinación — la obra social es la base (RN-FA-08: su orden se preserva
// siempre), los ítems propios del tipo de actividad se suman al final, deduplicados por identidad
// real (`ChecklistItem.id`, que es el `tipos_documento.id` compartido — veredicto 1.2 opción A). Sin
// configuración por tipo (`itemsPorTipo = []`), el resultado es EXACTAMENTE `itemsObraSocial`: es el
// comportamiento actual, y el default documentado (`design.md` D2) — spec: "Sin configuración por
// tipo de actividad, el comportamiento no cambia".
function item(overrides: Partial<ChecklistItem>): ChecklistItem {
  return { id: 'item-1', nombre: 'Ítem', requerido: true, ...overrides };
}

describe('combinarItemsDeActividad', () => {
  it('sin ítems por tipo, devuelve exactamente los de la obra social (mismo orden, mismos ids) — default documentado', () => {
    const itemsObraSocial: ChecklistItem[] = [
      item({ id: 'os-1', nombre: 'RHC' }),
      item({ id: 'os-2', nombre: 'Consentimiento informado' }),
    ];

    const resultado = combinarItemsDeActividad(itemsObraSocial, []);

    expect(resultado).toEqual(itemsObraSocial);
  });

  it('listas disjuntas: une los ítems, con los de la obra social primero y su orden preservado (RN-FA-08)', () => {
    const itemsObraSocial: ChecklistItem[] = [item({ id: 'os-1', nombre: 'RHC' }), item({ id: 'os-2', nombre: 'CBU' })];
    const itemsPorTipo: ChecklistItem[] = [item({ id: 'esc-1', nombre: 'Constancia de alumno regular' })];

    const resultado = combinarItemsDeActividad(itemsObraSocial, itemsPorTipo);

    expect(resultado.map((i) => i.id)).toEqual(['os-1', 'os-2', 'esc-1']);
  });

  it('un ítem con el mismo id en las dos listas aparece una sola vez (dedup por identidad real, veredicto 1.4 opción A)', () => {
    const itemsObraSocial: ChecklistItem[] = [item({ id: 'compartido', nombre: 'Autorización', requerido: true })];
    const itemsPorTipo: ChecklistItem[] = [item({ id: 'compartido', nombre: 'Autorización', requerido: true })];

    const resultado = combinarItemsDeActividad(itemsObraSocial, itemsPorTipo);

    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.id).toBe('compartido');
  });

  it('conflicto de requerido: gana el más estricto (true) sin importar de qué lista venga (veredicto 1.4, sub-pregunta)', () => {
    const itemsObraSocialNoRequerido: ChecklistItem[] = [item({ id: 'compartido', requerido: false })];
    const itemsPorTipoRequerido: ChecklistItem[] = [item({ id: 'compartido', requerido: true })];

    const [resultado1] = combinarItemsDeActividad(itemsObraSocialNoRequerido, itemsPorTipoRequerido);
    expect(resultado1?.requerido).toBe(true);

    // Triangulación del sentido inverso: la obra social exige, el tipo de actividad no — sigue
    // ganando el más estricto, nunca se relaja una exigencia por efecto del merge.
    const itemsObraSocialRequerido: ChecklistItem[] = [item({ id: 'compartido', requerido: true })];
    const itemsPorTipoNoRequerido: ChecklistItem[] = [item({ id: 'compartido', requerido: false })];

    const [resultado2] = combinarItemsDeActividad(itemsObraSocialRequerido, itemsPorTipoNoRequerido);
    expect(resultado2?.requerido).toBe(true);
  });

  it('itemsObraSocial vacío no revienta: devuelve solo los del tipo de actividad', () => {
    const itemsPorTipo: ChecklistItem[] = [item({ id: 'esc-1', nombre: 'Constancia' })];

    expect(combinarItemsDeActividad([], itemsPorTipo)).toEqual(itemsPorTipo);
  });

  it('las dos listas vacías devuelven una lista vacía', () => {
    expect(combinarItemsDeActividad([], [])).toEqual([]);
  });

  it('el nombre de un ítem coincidente conserva el de la obra social, no el del tipo de actividad (la obra social es la base)', () => {
    const itemsObraSocial: ChecklistItem[] = [item({ id: 'compartido', nombre: 'Autorización (obra social)' })];
    const itemsPorTipo: ChecklistItem[] = [item({ id: 'compartido', nombre: 'Autorización (escuela)' })];

    const [resultado] = combinarItemsDeActividad(itemsObraSocial, itemsPorTipo);

    expect(resultado?.nombre).toBe('Autorización (obra social)');
  });
});

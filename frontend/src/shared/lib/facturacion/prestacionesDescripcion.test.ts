import { describe, expect, it } from 'vitest';
import type { Paciente } from '../../types/paciente';
import type { Presupuesto } from '../../types/presupuesto';
import { prestacionesDePresupuesto } from './prestacionesDescripcion';

// WU2 de `facturacion-cambios-ui` (decisión usuaria 2026-08-16): la descripción de la factura en
// modalidad `general` agrega un bloque "Prestaciones:" con los nombres de las LÍNEAS del
// presupuesto de la autorización elegida (REAPERTURA #13 — `presupuesto.lineas` se persiste desde
// el WU1), resueltos client-side contra el catálogo `paciente.prestaciones` (mismo criterio que
// `prestacionRealAutorizacion` de `etiquetaAutorizacion.ts`).

const paciente: Paciente = {
  id: 'paciente-martina',
  apellido: 'Gómez',
  nombre: 'Martina',
  fechaNacimiento: '2015-03-12',
  dni: '45123456',
  cuilTitular: '27-30111222-4',
  diagnostico: 'Parálisis cerebral',
  accesorioMovilidad: [],
  obraSocialId: 'os-general',
  numeroAfiliado: { valor: '45123456' },
  cud: null,
  direcciones: [],
  personasACargo: [],
  amparoJudicial: false,
  prestaciones: [
    { id: 'prest-kine', pacienteId: 'paciente-martina', nombre: 'Kinesiología', activa: true },
    { id: 'prest-fono', pacienteId: 'paciente-martina', nombre: 'Fonoaudiología', activa: true },
  ],
};

function presupuestoConLineas(lineas: NonNullable<Presupuesto['lineas']>): Presupuesto {
  return {
    id: 'presupuesto-general',
    pacienteId: 'paciente-martina',
    obraSocialId: 'os-general',
    monto: 13500,
    fechaEmision: '2026-03-01',
    lineas,
  };
}

describe('prestacionesDePresupuesto (WU2 — bloque Prestaciones: de la descripción, opción a del brief)', () => {
  it('resuelve los nombres de las líneas contra el catálogo del paciente, preservando el orden de las líneas', () => {
    const resultado = prestacionesDePresupuesto(
      presupuestoConLineas([
        { id: 'linea-1', prestacionId: 'prest-kine', monto: 9000, orden: 1 },
        { id: 'linea-2', prestacionId: 'prest-fono', monto: 4500, orden: 2 },
      ]),
      paciente,
    );

    expect(resultado).toEqual(['Kinesiología', 'Fonoaudiología']);
  });

  it('una línea cuyo prestacionId ya no está en el catálogo (borrado lógico) se muestra como "Prestación desconocida", nunca rompe', () => {
    const resultado = prestacionesDePresupuesto(
      presupuestoConLineas([{ id: 'linea-1', prestacionId: 'prest-eliminada', monto: 9000, orden: 1 }]),
      paciente,
    );

    expect(resultado).toEqual(['Prestación desconocida']);
  });

  it('presupuesto sin líneas (legacy, previo a la REAPERTURA #13): devuelve [] — no hay bloque', () => {
    expect(prestacionesDePresupuesto(presupuestoConLineas([]), paciente)).toEqual([]);
    expect(prestacionesDePresupuesto({ ...presupuestoConLineas([]), lineas: undefined }, paciente)).toEqual([]);
  });

  it('presupuesto ausente (factura sin autorización / sin resolución): devuelve []', () => {
    expect(prestacionesDePresupuesto(undefined, paciente)).toEqual([]);
  });
});
import type { Presupuesto } from '../../types/presupuesto';

// Fixture inicial de Presupuestos (tasks.md 3.2): ligados a pacientes/obra social que existen en
// pacientesFixture/osecacFixture ('paciente-martina', 'paciente-facundo', obraSocialId 'osecac' —
// ver mocks/pacientesFixture.ts y mocks/osecacFixture.ts). Cuatro presupuestos, uno por cada
// autorización de ejemplo de autorizacionesFixture.ts (una por estado). Las fechas se calculan
// relativas a "ahora" (mismo criterio que vehiculosFixture.ts) para que el fixture siga siendo
// representativo sin importar cuándo se corra la app.

function isoMonthsAgo(meses: number): string {
  const fecha = new Date();
  fecha.setMonth(fecha.getMonth() - meses);
  return fecha.toISOString().slice(0, 10);
}

export function buildPresupuestosFixture(): Presupuesto[] {
  return [
    {
      // Autorización asociada: pendiente (sin respuesta todavía).
      id: 'presupuesto-martina-1',
      pacienteId: 'paciente-martina',
      obraSocialId: 'osecac',
      monto: 150_000,
      fechaEmision: isoMonthsAgo(1),
    },
    {
      // Autorización asociada: autorizada, con montoAutorizado === monto (borde "igual", RN-PA-01).
      id: 'presupuesto-facundo-1',
      pacienteId: 'paciente-facundo',
      obraSocialId: 'osecac',
      monto: 90_000,
      fechaEmision: isoMonthsAgo(4),
      archivo: { nombre: 'presupuesto-facundo-abril.pdf', cargadoEn: isoMonthsAgo(4) },
    },
    {
      // Autorización asociada: judicializada, con montoAutorizado menor al monto.
      id: 'presupuesto-martina-2',
      pacienteId: 'paciente-martina',
      obraSocialId: 'osecac',
      monto: 200_000,
      fechaEmision: isoMonthsAgo(3),
    },
    {
      // Autorización asociada: rechazada (sin monto autorizado).
      id: 'presupuesto-facundo-2',
      pacienteId: 'paciente-facundo',
      obraSocialId: 'osecac',
      monto: 60_000,
      fechaEmision: isoMonthsAgo(2),
    },
  ];
}

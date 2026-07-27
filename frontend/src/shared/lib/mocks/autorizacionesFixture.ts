import type { Autorizacion } from '../../types/presupuesto';

// Fixture inicial de Autorizaciones (tasks.md 3.2): una por cada estado relevante
// (`EstadoAutorizacion`), referenciando por `presupuestoId` los presupuestos de
// presupuestosFixture.ts. Incluye el caso "vigenciaDesde anterior a fechaRespuesta" (carga
// retroactiva, RN-PA-02) y el caso "montoAutorizado === monto del presupuesto" (borde de RN-PA-01).

function isoMonthsAgo(meses: number): string {
  const fecha = new Date();
  fecha.setMonth(fecha.getMonth() - meses);
  return fecha.toISOString().slice(0, 10);
}

export function buildAutorizacionesFixture(): Autorizacion[] {
  return [
    {
      // Pendiente: todavía sin respuesta de la obra social, sin monto ni cupos.
      id: 'autorizacion-martina-1',
      presupuestoId: 'presupuesto-martina-1',
      estado: 'pendiente',
    },
    {
      // Autorizada en julio (isoMonthsAgo(0)) con vigencia retroactiva desde 4 meses atrás — RN-PA-02.
      // montoAutorizado === monto del presupuesto asociado (90_000): borde inclusivo de RN-PA-01.
      id: 'autorizacion-facundo-1',
      presupuestoId: 'presupuesto-facundo-1',
      estado: 'autorizada',
      fechaRespuesta: isoMonthsAgo(0),
      montoAutorizado: 90_000,
      vigenciaDesde: isoMonthsAgo(4),
      cupoMensualDias: 20,
      cupoMensualKm: 600,
      archivo: { nombre: 'autorizacion-facundo.pdf', cargadoEn: isoMonthsAgo(0) },
    },
    {
      // Judicializada: monto autorizado menor al presupuesto (150_000 < 200_000).
      id: 'autorizacion-martina-2',
      presupuestoId: 'presupuesto-martina-2',
      estado: 'judicializada',
      fechaRespuesta: isoMonthsAgo(1),
      montoAutorizado: 150_000,
      vigenciaDesde: isoMonthsAgo(1),
      cupoMensualDias: 22,
      cupoMensualKm: 800,
    },
    {
      // Rechazada: sin monto autorizado ni cupos.
      id: 'autorizacion-facundo-2',
      presupuestoId: 'presupuesto-facundo-2',
      estado: 'rechazada',
      fechaRespuesta: isoMonthsAgo(1),
    },
  ];
}

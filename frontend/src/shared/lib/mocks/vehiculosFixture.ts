import type { Vehiculo } from '../../types/vehiculo';

// Fixture inicial de flota (tasks.md 3.2, RN-VE-01 a RN-VE-04): 3 vehículos que cubren los
// casos de alerta relevantes de mantenimiento y habilitaciones, con los modelos de ejemplo de
// `04_modelo_de_datos.md §Vehiculo`. Las fechas se calculan relativas a "ahora" (al momento de
// sembrar el mock) para que las alertas se vean vencidas/próximas sin importar cuándo se corra
// la app — las funciones puras de `shared/lib/mantenimiento/` siguen recibiendo `ahora` como
// parámetro explícito, esto solo arma datos de ejemplo creíbles.

function isoDaysFromNow(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function isoMonthsAgo(meses: number): string {
  const fecha = new Date();
  fecha.setMonth(fecha.getMonth() - meses);
  return fecha.toISOString().slice(0, 10);
}

export function buildVehiculosFixture(): Vehiculo[] {
  return [
    {
      // Etios: silla plegable (04_modelo_de_datos.md §Vehiculo). Service vencido por antigüedad
      // y VTV/RTO vigentes — cubre el caso "vencido" de estadoServicePreventivo.
      id: 'vehiculo-etios',
      patente: 'AC123DE',
      modelo: 'Toyota Etios',
      tipo: 'sedan',
      capacidad: 4,
      accesoriosCompatibles: ['silla-plegable'],
      estado: 'habilitado',
      kilometraje: 85_000,
      kilometrajeUltimoService: 82_000,
      fechaUltimoService: isoMonthsAgo(4),
      habilitaciones: [
        { tipo: 'vtv', fechaEmision: isoMonthsAgo(2), fechaVencimiento: isoDaysFromNow(150) },
        { tipo: 'rto', fechaEmision: isoMonthsAgo(2), fechaVencimiento: isoDaysFromNow(150) },
      ],
      gastos: [
        { id: 'gasto-etios-1', fecha: isoMonthsAgo(1), monto: 45_000, descripcion: 'Cambio de cubiertas', categoria: 'mantenimiento' },
      ],
    },
    {
      // Kangoo: sillas rígidas/posturales. Service en alerta intermedia (>= 5.000 km) y VTV
      // próxima a vencer — cubre "alerta-intermedia" y "por-vencer".
      id: 'vehiculo-kangoo',
      patente: 'AD456FG',
      modelo: 'Renault Kangoo',
      tipo: 'furgon',
      capacidad: 5,
      accesoriosCompatibles: ['silla-rigida', 'silla-postural'],
      estado: 'habilitado',
      kilometraje: 46_000,
      kilometrajeUltimoService: 40_000,
      fechaUltimoService: isoMonthsAgo(1),
      habilitaciones: [
        { tipo: 'vtv', fechaEmision: isoMonthsAgo(6), fechaVencimiento: isoDaysFromNow(15) },
        { tipo: 'rto', fechaEmision: isoMonthsAgo(1), fechaVencimiento: isoDaysFromNow(200) },
      ],
      gastos: [],
    },
    {
      // Partner: capacidad reducida (chofer + un menor adelante + dos personas de contextura
      // delgada). Service al día, RTO vencida — cubre "ok" y "vencida".
      id: 'vehiculo-partner',
      patente: 'AE789HI',
      modelo: 'Peugeot Partner',
      tipo: 'furgon',
      capacidad: 3,
      accesoriosCompatibles: ['andador', 'tripode'],
      estado: 'fuera-de-servicio',
      kilometraje: 61_200,
      kilometrajeUltimoService: 60_000,
      fechaUltimoService: isoMonthsAgo(1),
      habilitaciones: [
        { tipo: 'vtv', fechaEmision: isoMonthsAgo(3), fechaVencimiento: isoDaysFromNow(90) },
        { tipo: 'rto', fechaEmision: isoMonthsAgo(8), fechaVencimiento: isoDaysFromNow(-10) },
      ],
      gastos: [{ id: 'gasto-partner-1', fecha: isoMonthsAgo(2), monto: 12_500, categoria: 'reparacion' }],
    },
  ];
}

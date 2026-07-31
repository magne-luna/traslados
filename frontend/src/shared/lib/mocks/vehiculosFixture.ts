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
      // Con notas (tasks.md 2.3): al menos un vehículo del fixture ejercita el campo nuevo.
      notas: 'Aire acondicionado con pérdida de gas — revisar antes del verano.',
      habilitaciones: [
        { tipo: 'vtv', fechaEmision: isoMonthsAgo(2), fechaVencimiento: isoDaysFromNow(150) },
        { tipo: 'rto', fechaEmision: isoMonthsAgo(2), fechaVencimiento: isoDaysFromNow(150) },
      ],
      gastos: [{ id: 'gasto-etios-1', fecha: isoMonthsAgo(1), monto: 45_000, descripcion: 'Cambio de cubiertas' }],
      mantenimientos: [
        // Preventivo con próximo vencimiento por km (cambio de aceite/filtros, RN-VE-03).
        {
          id: 'mantenimiento-etios-1',
          fecha: isoMonthsAgo(1),
          kilometraje: 82_000,
          tipoIntervencion: 'preventivo',
          subtipo: 'cambio-aceite-filtros',
          proximoVencimientoKm: 92_000,
        },
        // Correctivo fuera de catálogo ('otro' + detalle) — cubiertas ya están en gastos arriba,
        // acá una intervención distinta para no duplicar el mismo evento en dos entidades.
        {
          id: 'mantenimiento-etios-2',
          fecha: isoMonthsAgo(3),
          kilometraje: 78_000,
          tipoIntervencion: 'correctivo',
          subtipo: 'otro',
          detalle: 'Reemplazo de radiador perforado',
        },
        // D3-B (tasks.md 2B.4): fila de mantenimiento preventiva VTV/RTO de la que se deriva la
        // habilitación de arriba — mismas fechas, para que el mock y `SupabaseVehiculoRepository`
        // muestren lo mismo en la misma pantalla.
        {
          id: 'mantenimiento-etios-3',
          fecha: isoMonthsAgo(2),
          kilometraje: 84_000,
          tipoIntervencion: 'preventivo',
          subtipo: 'vtv',
          proximoVencimientoFecha: isoDaysFromNow(150),
        },
        {
          id: 'mantenimiento-etios-4',
          fecha: isoMonthsAgo(2),
          kilometraje: 84_000,
          tipoIntervencion: 'preventivo',
          subtipo: 'rto',
          proximoVencimientoFecha: isoDaysFromNow(150),
        },
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
      mantenimientos: [
        // Preventivo con próximo vencimiento por fecha (VTV) — señaliza a propósito la
        // duplicación con `habilitaciones[].fechaVencimiento` (design.md Decisión 5, Open
        // Question 3): la fecha acá es informativa, la alerta real la sigue calculando
        // `estadoHabilitacion` sobre `habilitaciones`.
        {
          id: 'mantenimiento-kangoo-1',
          fecha: isoMonthsAgo(6),
          kilometraje: 40_000,
          tipoIntervencion: 'preventivo',
          subtipo: 'vtv',
          proximoVencimientoFecha: isoDaysFromNow(15),
        },
        // D3-B (tasks.md 2B.4): fila RTO correspondiente a la habilitación RTO de arriba.
        {
          id: 'mantenimiento-kangoo-2',
          fecha: isoMonthsAgo(1),
          kilometraje: 46_000,
          tipoIntervencion: 'preventivo',
          subtipo: 'rto',
          proximoVencimientoFecha: isoDaysFromNow(200),
        },
      ],
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
      gastos: [{ id: 'gasto-partner-1', fecha: isoMonthsAgo(2), monto: 12_500, descripcion: 'Reparación de frenos' }],
      mantenimientos: [
        // Correctivo con sub-tipo conocido del catálogo.
        {
          id: 'mantenimiento-partner-1',
          fecha: isoMonthsAgo(2),
          kilometraje: 59_500,
          tipoIntervencion: 'correctivo',
          subtipo: 'frenos',
        },
        // Registro de nivel 1 "gasto" (design.md Decisión 2): la UI no puede darlo de alta desde
        // esta pantalla, pero sí debe poder mostrarlo — cubre el camino de lectura por test.
        {
          id: 'mantenimiento-partner-2',
          fecha: isoMonthsAgo(5),
          kilometraje: 55_000,
          tipoIntervencion: 'gasto',
        },
        // D3-B (tasks.md 2B.4): filas VTV/RTO de las que se derivan las dos habilitaciones de
        // arriba (una vigente, una vencida — RN-VE-04 las evalúa de forma independiente).
        {
          id: 'mantenimiento-partner-3',
          fecha: isoMonthsAgo(3),
          kilometraje: 58_000,
          tipoIntervencion: 'preventivo',
          subtipo: 'vtv',
          proximoVencimientoFecha: isoDaysFromNow(90),
        },
        {
          id: 'mantenimiento-partner-4',
          fecha: isoMonthsAgo(8),
          kilometraje: 50_000,
          tipoIntervencion: 'preventivo',
          subtipo: 'rto',
          proximoVencimientoFecha: isoDaysFromNow(-10),
        },
      ],
    },
  ];
}

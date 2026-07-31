import { describe, expect, it } from 'vitest';
import {
  parseVehiculoRow,
  parseEstadoVehiculo,
  toEstadoVehiculoRow,
  parseMantenimientoRow,
  toMantenimientoRows,
  parseAccesoriosRows,
  parseGastoRow,
  ensamblarVehiculo,
  toCrearVehiculoPayload,
  toActualizarVehiculoPayload,
} from './vehiculoMapping';
import type { ActualizacionVehiculo, MantenimientoRegistro, NuevoVehiculo } from '../../types/vehiculo';

// vehiculoMapping.ts: mapeo puro fila<->dominio para Vehículos (tasks.md §4, design.md D3/D4/D5/
// D10/D12/D13). Sin red, sin mocks, sin `any`, sin `as` (regla dura de esta sección).

describe('parseVehiculoRow', () => {
  it('mapea los campos base de una fila plana de conductores.vehiculo (renombres, numéricos)', () => {
    const row = {
      id: 'v-1',
      patente: 'AA123BB',
      modelo: 'Toyota Etios',
      tipo: 'sedan',
      capacidad: 4,
      estado: 'habilitado',
      notas: 'Aire acondicionado roto',
      kilometraje: 50000,
      kilometraje_ultimo_service: 48000,
      fecha_ultimo_service: '2026-06-01',
      año: 2020, // discrepancia D15 #14: sin campo en el dominio, se ignora deliberadamente
    };

    expect(parseVehiculoRow(row)).toEqual({
      id: 'v-1',
      patente: 'AA123BB',
      modelo: 'Toyota Etios',
      tipo: 'sedan',
      capacidad: 4,
      estado: 'habilitado',
      notas: 'Aire acondicionado roto',
      kilometraje: 50000,
      kilometrajeUltimoService: 48000,
      fechaUltimoService: '2026-06-01',
    });
  });

  it('notas ausente en la fila -> undefined, no string vacío inventado', () => {
    const row = {
      id: 'v-2',
      patente: 'AC456DE',
      modelo: 'Renault Kangoo',
      tipo: 'utilitario',
      capacidad: 6,
      estado: 'habilitado',
      kilometraje: 1000,
      kilometraje_ultimo_service: 0,
      fecha_ultimo_service: null,
    };

    const parsed = parseVehiculoRow(row);
    expect(parsed?.notas).toBeUndefined();
    expect(parsed?.fechaUltimoService).toBe('');
  });

  it('fila sin id -> se descarta (null), no rompe el list() entero', () => {
    const row = { patente: 'AA123BB', modelo: 'Toyota Etios' };
    expect(parseVehiculoRow(row)).toBeNull();
  });

  it('fila sin patente -> se descarta (null)', () => {
    const row = { id: 'v-1', modelo: 'Toyota Etios' };
    expect(parseVehiculoRow(row)).toBeNull();
  });

  it('valor no-objeto -> se descarta (null)', () => {
    expect(parseVehiculoRow(null)).toBeNull();
    expect(parseVehiculoRow(undefined)).toBeNull();
    expect(parseVehiculoRow('not a row')).toBeNull();
  });

  it('capacidad/kilometraje no numéricos degradan a 0, nunca NaN ni string', () => {
    const row = {
      id: 'v-3',
      patente: 'AB789CD',
      modelo: 'Peugeot Partner',
      tipo: 'utilitario',
      capacidad: 'no-es-numero',
      estado: 'habilitado',
      kilometraje: null,
      kilometraje_ultimo_service: undefined,
      fecha_ultimo_service: null,
    };

    const parsed = parseVehiculoRow(row);
    expect(parsed?.capacidad).toBe(0);
    expect(parsed?.kilometraje).toBe(0);
    expect(parsed?.kilometrajeUltimoService).toBe(0);
  });
});

describe('parseEstadoVehiculo (D13)', () => {
  it("'fuera de servicio' (con espacio, valor de la base) -> 'fuera-de-servicio' (guion, dominio)", () => {
    expect(parseEstadoVehiculo('fuera de servicio')).toBe('fuera-de-servicio');
  });

  it("'habilitado' -> 'habilitado' (idéntico en los dos lados)", () => {
    expect(parseEstadoVehiculo('habilitado')).toBe('habilitado');
  });

  it('valor desconocido de la base -> degrada a `habilitado`, nunca lanza', () => {
    expect(parseEstadoVehiculo('valor-inventado')).toBe('habilitado');
    expect(parseEstadoVehiculo(null)).toBe('habilitado');
    expect(parseEstadoVehiculo(undefined)).toBe('habilitado');
    expect(parseEstadoVehiculo(42)).toBe('habilitado');
  });
});

describe('toEstadoVehiculoRow (D13)', () => {
  it("'fuera-de-servicio' (dominio) -> 'fuera de servicio' (base, con espacio)", () => {
    expect(toEstadoVehiculoRow('fuera-de-servicio')).toBe('fuera de servicio');
  });

  it("'habilitado' -> 'habilitado'", () => {
    expect(toEstadoVehiculoRow('habilitado')).toBe('habilitado');
  });
});

function baseMantenimientoRow(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'm-1',
    fecha: '2026-06-01',
    km_actual: 50000,
    fecha_proximo_vencimiento: null,
    km_proximo_vencimiento: null,
    descripcion: null,
    ...overrides,
  };
}

describe('parseMantenimientoRow — reconstruye la unión discriminada de 4 miembros (D4)', () => {
  it('miembro 1: preventivo con subtipo de la unión (cambio-aceite-filtros)', () => {
    const row = baseMantenimientoRow({ categoria: 'preventivo', subtipo: 'cambio-aceite-filtros', detalle: null });
    expect(parseMantenimientoRow(row)).toEqual({
      id: 'm-1',
      fecha: '2026-06-01',
      kilometraje: 50000,
      tipoIntervencion: 'preventivo',
      subtipo: 'cambio-aceite-filtros',
    });
  });

  it('miembro 1: preventivo vtv con vencimiento propaga fecha/km de vencimiento', () => {
    const row = baseMantenimientoRow({
      categoria: 'preventivo',
      subtipo: 'vtv',
      detalle: null,
      fecha_proximo_vencimiento: '2026-12-01',
      km_proximo_vencimiento: 60000,
      descripcion: 'VTV anual',
    });
    expect(parseMantenimientoRow(row)).toEqual({
      id: 'm-1',
      fecha: '2026-06-01',
      kilometraje: 50000,
      proximoVencimientoFecha: '2026-12-01',
      proximoVencimientoKm: 60000,
      descripcion: 'VTV anual',
      tipoIntervencion: 'preventivo',
      subtipo: 'vtv',
    });
  });

  it('miembro 2: correctivo con subtipo conocido (frenos)', () => {
    const row = baseMantenimientoRow({ categoria: 'correctivo', subtipo: 'frenos', detalle: null });
    expect(parseMantenimientoRow(row)).toEqual({
      id: 'm-1',
      fecha: '2026-06-01',
      kilometraje: 50000,
      tipoIntervencion: 'correctivo',
      subtipo: 'frenos',
    });
  });

  it("miembro 3: correctivo 'otro' con detalle requerido", () => {
    const row = baseMantenimientoRow({ categoria: 'correctivo', subtipo: 'otro', detalle: 'Radiador perforado' });
    expect(parseMantenimientoRow(row)).toEqual({
      id: 'm-1',
      fecha: '2026-06-01',
      kilometraje: 50000,
      tipoIntervencion: 'correctivo',
      subtipo: 'otro',
      detalle: 'Radiador perforado',
    });
  });

  it('miembro 4: gasto, sin subtipo ni detalle', () => {
    const row = baseMantenimientoRow({ categoria: 'gasto', subtipo: null, detalle: null });
    expect(parseMantenimientoRow(row)).toEqual({
      id: 'm-1',
      fecha: '2026-06-01',
      kilometraje: 50000,
      tipoIntervencion: 'gasto',
    });
  });

  it("fila incoherente: correctivo + 'otro' SIN detalle -> descartada (null), no rompe el vehículo", () => {
    const row = baseMantenimientoRow({ categoria: 'correctivo', subtipo: 'otro', detalle: null });
    expect(parseMantenimientoRow(row)).toBeNull();
  });

  it("fila incoherente: correctivo + 'otro' con detalle vacío/blanco -> descartada (null)", () => {
    const row = baseMantenimientoRow({ categoria: 'correctivo', subtipo: 'otro', detalle: '   ' });
    expect(parseMantenimientoRow(row)).toBeNull();
  });

  it('fila incoherente: preventivo con subtipo fuera de la unión -> descartada (null)', () => {
    const row = baseMantenimientoRow({ categoria: 'preventivo', subtipo: 'lavado-completo', detalle: null });
    expect(parseMantenimientoRow(row)).toBeNull();
  });

  it('fila incoherente: correctivo con subtipo fuera de la unión conocida y distinto de "otro" -> descartada', () => {
    const row = baseMantenimientoRow({ categoria: 'correctivo', subtipo: 'inventado', detalle: null });
    expect(parseMantenimientoRow(row)).toBeNull();
  });

  it('fila incoherente: gasto con subtipo presente (viola chk_categoria_subtipo) -> descartada', () => {
    const row = baseMantenimientoRow({ categoria: 'gasto', subtipo: 'vtv', detalle: null });
    expect(parseMantenimientoRow(row)).toBeNull();
  });

  it('fila sin id -> descartada (null)', () => {
    const row = baseMantenimientoRow({ id: '', categoria: 'gasto', subtipo: null, detalle: null });
    expect(parseMantenimientoRow(row)).toBeNull();
  });

  it('fila sin fecha -> descartada (null)', () => {
    const row = baseMantenimientoRow({ fecha: '', categoria: 'gasto', subtipo: null, detalle: null });
    expect(parseMantenimientoRow(row)).toBeNull();
  });

  it('valor no-objeto -> descartado (null)', () => {
    expect(parseMantenimientoRow(null)).toBeNull();
    expect(parseMantenimientoRow('nope')).toBeNull();
  });

  it(
    'correctivo con subtipo conocido y un `detalle` perdido (el CHECK no lo prohíbe en esa rama) ' +
      '-> igual se mapea, `detalle` se ignora (el miembro 2 no tiene ese campo)',
    () => {
      const row = baseMantenimientoRow({ categoria: 'correctivo', subtipo: 'frenos', detalle: 'dato perdido' });
      expect(parseMantenimientoRow(row)).toEqual({
        id: 'm-1',
        fecha: '2026-06-01',
        kilometraje: 50000,
        tipoIntervencion: 'correctivo',
        subtipo: 'frenos',
      });
    },
  );
});

describe('toMantenimientoRows — la vuelta de parseMantenimientoRow', () => {
  it("'gasto' no emite subtipo ni detalle (viajan como null, la columna es NULLable)", () => {
    const registros: MantenimientoRegistro[] = [
      { id: 'm-1', fecha: '2026-06-01', kilometraje: 1000, tipoIntervencion: 'gasto' },
    ];
    expect(toMantenimientoRows(registros)).toEqual([
      {
        id: 'm-1',
        categoria: 'gasto',
        subtipo: null,
        detalle: null,
        descripcion: null,
        fecha: '2026-06-01',
        km_actual: 1000,
        fecha_proximo_vencimiento: null,
        km_proximo_vencimiento: null,
      },
    ]);
  });

  it("'otro' emite subtipo='otro' Y detalle", () => {
    const registros: MantenimientoRegistro[] = [
      {
        id: 'm-2',
        fecha: '2026-06-02',
        kilometraje: 2000,
        tipoIntervencion: 'correctivo',
        subtipo: 'otro',
        detalle: 'Radiador perforado',
      },
    ];
    expect(toMantenimientoRows(registros)).toEqual([
      {
        id: 'm-2',
        categoria: 'correctivo',
        subtipo: 'otro',
        detalle: 'Radiador perforado',
        descripcion: null,
        fecha: '2026-06-02',
        km_actual: 2000,
        fecha_proximo_vencimiento: null,
        km_proximo_vencimiento: null,
      },
    ]);
  });

  it('preventivo/correctivo-conocido emiten subtipo, nunca detalle', () => {
    const registros: MantenimientoRegistro[] = [
      { id: 'm-3', fecha: '2026-06-03', kilometraje: 3000, tipoIntervencion: 'preventivo', subtipo: 'vtv', proximoVencimientoFecha: '2026-12-01', proximoVencimientoKm: 4000 },
      { id: 'm-4', fecha: '2026-06-04', kilometraje: 4000, tipoIntervencion: 'correctivo', subtipo: 'frenos' },
    ];
    const rows = toMantenimientoRows(registros);
    expect(rows[0]).toEqual({
      id: 'm-3',
      categoria: 'preventivo',
      subtipo: 'vtv',
      detalle: null,
      descripcion: null,
      fecha: '2026-06-03',
      km_actual: 3000,
      fecha_proximo_vencimiento: '2026-12-01',
      km_proximo_vencimiento: 4000,
    });
    expect(rows[1]).toEqual({
      id: 'm-4',
      categoria: 'correctivo',
      subtipo: 'frenos',
      detalle: null,
      descripcion: null,
      fecha: '2026-06-04',
      km_actual: 4000,
      fecha_proximo_vencimiento: null,
      km_proximo_vencimiento: null,
    });
  });

  it('lista vacía -> []', () => {
    expect(toMantenimientoRows([])).toEqual([]);
  });
});

describe('parseAccesoriosRows — embed de dos niveles accesorios_vehiculo -> accesorios.tipo', () => {
  it('mapea los tipos válidos del embed', () => {
    const rows = [
      { accesorio_id: 'ac-1', accesorios: { id: 'ac-1', tipo: 'andador' } },
      { accesorio_id: 'ac-2', accesorios: { id: 'ac-2', tipo: 'tripode' } },
    ];
    expect(parseAccesoriosRows(rows)).toEqual(['andador', 'tripode']);
  });

  it('un tipo que no pertenece a la unión cerrada se descarta (no se castea), se conserva el resto', () => {
    const rows = [
      { accesorio_id: 'ac-1', accesorios: { id: 'ac-1', tipo: 'andador' } },
      { accesorio_id: 'ac-2', accesorios: { id: 'ac-2', tipo: 'silla de oficina' } },
    ];
    expect(parseAccesoriosRows(rows)).toEqual(['andador']);
  });

  it('embed vacío -> [] (sin distinguir todavía "no tiene" de "RLS lo ocultó" — eso lo agrega el repository en 5.4)', () => {
    expect(parseAccesoriosRows([])).toEqual([]);
  });

  it('fila sin el embed anidado (RLS lo ocultó parcialmente) se descarta sin romper el resto', () => {
    const rows = [{ accesorio_id: 'ac-1' }, { accesorio_id: 'ac-2', accesorios: { id: 'ac-2', tipo: 'tripode' } }];
    expect(parseAccesoriosRows(rows)).toEqual(['tripode']);
  });

  it('valor no-array -> []', () => {
    expect(parseAccesoriosRows(null)).toEqual([]);
    expect(parseAccesoriosRows(undefined)).toEqual([]);
    expect(parseAccesoriosRows('nope')).toEqual([]);
  });
});

describe('parseGastoRow — facturacion.gastos_vehiculos', () => {
  it('monto numérico normal', () => {
    const row = { id: 'g-1', fecha: '2026-06-01', monto: 1500.5, descripcion: 'Combustible' };
    expect(parseGastoRow(row)).toEqual({ id: 'g-1', fecha: '2026-06-01', monto: 1500.5, descripcion: 'Combustible' });
  });

  it('monto NUMERIC(10,2) llega como string desde PostgREST -> se parsea con Number()', () => {
    const row = { id: 'g-2', fecha: '2026-06-02', monto: '2500.75' };
    expect(parseGastoRow(row)).toEqual({ id: 'g-2', fecha: '2026-06-02', monto: 2500.75, descripcion: undefined });
  });

  it('descripcion ausente -> undefined, no string vacío', () => {
    const row = { id: 'g-3', fecha: '2026-06-03', monto: 100 };
    expect(parseGastoRow(row)?.descripcion).toBeUndefined();
  });

  it('monto no parseable (NaN) -> fila descartada (null), nunca un monto inventado', () => {
    const row = { id: 'g-4', fecha: '2026-06-04', monto: 'no-es-un-numero' };
    expect(parseGastoRow(row)).toBeNull();
  });

  it('monto ausente -> descartada (null)', () => {
    const row = { id: 'g-5', fecha: '2026-06-05' };
    expect(parseGastoRow(row)).toBeNull();
  });

  it('sin id -> descartada (null)', () => {
    expect(parseGastoRow({ fecha: '2026-06-01', monto: 100 })).toBeNull();
  });

  it('sin fecha -> descartada (null)', () => {
    expect(parseGastoRow({ id: 'g-6', monto: 100 })).toBeNull();
  });

  it('valor no-objeto -> descartado (null)', () => {
    expect(parseGastoRow(null)).toBeNull();
    expect(parseGastoRow('nope')).toBeNull();
  });
});

describe('ensamblarVehiculo — combina la fila con embeds y las habilitaciones derivadas (D3-B)', () => {
  function filaVehiculoCompleta(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: 'v-1',
      patente: 'AA123BB',
      modelo: 'Toyota Etios',
      tipo: 'sedan',
      capacidad: 4,
      estado: 'habilitado',
      notas: undefined,
      kilometraje: 50000,
      kilometraje_ultimo_service: 48000,
      fecha_ultimo_service: '2026-06-01',
      accesorios_vehiculo: [],
      mantenimiento: [],
      ...overrides,
    };
  }

  it('4.7: la VTV derivada de la fila de mantenimiento preventivo llega en `habilitaciones`', () => {
    const row = filaVehiculoCompleta({
      mantenimiento: [
        {
          id: 'm-1',
          categoria: 'preventivo',
          subtipo: 'vtv',
          detalle: null,
          descripcion: null,
          fecha: '2026-06-01',
          fecha_proximo_vencimiento: '2026-12-01',
          km_actual: 50000,
          km_proximo_vencimiento: null,
        },
      ],
    });

    const vehiculo = ensamblarVehiculo(row, []);
    expect(vehiculo?.habilitaciones).toEqual([{ tipo: 'vtv', fechaEmision: '2026-06-01', fechaVencimiento: '2026-12-01' }]);
  });

  it('4.7: una fila de mantenimiento descartada por incoherente (4.3) NO produce una habilitación fantasma', () => {
    const row = filaVehiculoCompleta({
      mantenimiento: [
        // categoria='correctivo' + subtipo='vtv' no calza ninguna de las 4 combinaciones del CHECK
        // (D4): 'vtv' no es un subtipo correctivo válido ni 'otro'. Se descarta entera.
        {
          id: 'm-1',
          categoria: 'correctivo',
          subtipo: 'vtv',
          detalle: null,
          descripcion: null,
          fecha: '2026-06-01',
          fecha_proximo_vencimiento: '2026-12-01',
          km_actual: 50000,
          km_proximo_vencimiento: null,
        },
      ],
    });

    const vehiculo = ensamblarVehiculo(row, []);
    expect(vehiculo?.mantenimientos).toEqual([]);
    expect(vehiculo?.habilitaciones).toEqual([]);
  });

  it('4.8: ordena mantenimientos por fecha desc, desempate por id desc, determinista', () => {
    const row = filaVehiculoCompleta({
      mantenimiento: [
        { id: 'm-a', categoria: 'gasto', subtipo: null, detalle: null, descripcion: null, fecha: '2026-01-01', fecha_proximo_vencimiento: null, km_actual: 1000, km_proximo_vencimiento: null },
        { id: 'm-c', categoria: 'gasto', subtipo: null, detalle: null, descripcion: null, fecha: '2026-06-01', fecha_proximo_vencimiento: null, km_actual: 3000, km_proximo_vencimiento: null },
        { id: 'm-b', categoria: 'gasto', subtipo: null, detalle: null, descripcion: null, fecha: '2026-06-01', fecha_proximo_vencimiento: null, km_actual: 2000, km_proximo_vencimiento: null },
      ],
    });

    const vehiculo = ensamblarVehiculo(row, []);
    expect(vehiculo?.mantenimientos.map((m) => m.id)).toEqual(['m-c', 'm-b', 'm-a']);
  });

  it('4.8: ordena gastos por fecha desc, desempate por id desc', () => {
    const row = filaVehiculoCompleta({});
    const gastosRows = [
      { id: 'g-a', fecha: '2026-01-01', monto: 100, descripcion: null },
      { id: 'g-c', fecha: '2026-06-01', monto: 300, descripcion: null },
      { id: 'g-b', fecha: '2026-06-01', monto: 200, descripcion: null },
    ];

    const vehiculo = ensamblarVehiculo(row, gastosRows);
    expect(vehiculo?.gastos.map((g) => g.id)).toEqual(['g-c', 'g-b', 'g-a']);
  });

  it('4.8: colecciones vacías -> arrays vacíos, nunca undefined', () => {
    const row = filaVehiculoCompleta({});
    const vehiculo = ensamblarVehiculo(row, []);
    expect(vehiculo?.mantenimientos).toEqual([]);
    expect(vehiculo?.gastos).toEqual([]);
    expect(vehiculo?.habilitaciones).toEqual([]);
    expect(vehiculo?.accesoriosCompatibles).toEqual([]);
  });

  it('mapea accesorios del embed junto con el resto del vehículo', () => {
    const row = filaVehiculoCompleta({
      accesorios_vehiculo: [{ accesorio_id: 'ac-1', accesorios: { id: 'ac-1', tipo: 'andador' } }],
    });
    const vehiculo = ensamblarVehiculo(row, []);
    expect(vehiculo?.accesoriosCompatibles).toEqual(['andador']);
  });

  it('fila de vehículo inválida (sin id) -> null, no rompe el list() entero', () => {
    expect(ensamblarVehiculo({ patente: 'AA123BB' }, [])).toBeNull();
  });

  it('gastosRows no-array -> gastos: []', () => {
    const row = filaVehiculoCompleta({});
    expect(ensamblarVehiculo(row, null)?.gastos).toEqual([]);
  });
});

function buildNuevoVehiculoMinimo(): NuevoVehiculo {
  return {
    patente: 'AA123BB',
    modelo: 'Toyota Etios',
    tipo: 'sedan',
    capacidad: 4,
    accesoriosCompatibles: [],
    estado: 'habilitado',
    kilometraje: 0,
    kilometrajeUltimoService: 0,
    fechaUltimoService: '',
    // Campo de SALIDA (D3-B): se completa por compatibilidad de tipo (NuevoVehiculo = Omit<Vehiculo,
    // 'id'> exige la clave), pero toCrearVehiculoPayload NUNCA la lee ni la emite (4.7b).
    habilitaciones: [{ tipo: 'vtv', fechaEmision: '2020-01-01', fechaVencimiento: '2020-06-01' }],
    gastos: [],
    mantenimientos: [],
  };
}

describe('toCrearVehiculoPayload — alta (4.7b + escritura literal de los campos base)', () => {
  it('mapea patente/modelo/tipo/capacidad/estado/kilometrajes tal cual, en snake_case', () => {
    const nuevo: NuevoVehiculo = { ...buildNuevoVehiculoMinimo(), notas: 'Aire roto' };
    const payload = toCrearVehiculoPayload(nuevo);

    expect(payload.patente).toBe('AA123BB');
    expect(payload.modelo).toBe('Toyota Etios');
    expect(payload.tipo).toBe('sedan');
    expect(payload.capacidad).toBe(4);
    expect(payload.estado).toBe('habilitado');
    expect(payload.notas).toBe('Aire roto');
    expect(payload.kilometraje).toBe(0);
    expect(payload.kilometraje_ultimo_service).toBe(0);
  });

  it('estado se traduce con toEstadoVehiculoRow (D13)', () => {
    const nuevo: NuevoVehiculo = { ...buildNuevoVehiculoMinimo(), estado: 'fuera-de-servicio' };
    expect(toCrearVehiculoPayload(nuevo).estado).toBe('fuera de servicio');
  });

  it('4.7b: nunca emite la clave `habilitaciones`, aunque el vehículo nuevo la traiga (es de salida, D3-B)', () => {
    const nuevo = buildNuevoVehiculoMinimo();
    expect(nuevo.habilitaciones.length).toBeGreaterThan(0); // la fixture SÍ la trae
    const payload = toCrearVehiculoPayload(nuevo);
    expect('habilitaciones' in payload).toBe(false);
  });

  it('mantenimientos y gastos se traducen con toMantenimientoRows / la misma forma de fila', () => {
    const nuevo: NuevoVehiculo = {
      ...buildNuevoVehiculoMinimo(),
      mantenimientos: [{ id: 'm-1', fecha: '2026-01-01', kilometraje: 1000, tipoIntervencion: 'gasto' }],
      gastos: [{ id: 'g-1', fecha: '2026-01-01', monto: 500 }],
    };
    const payload = toCrearVehiculoPayload(nuevo);
    expect(payload.mantenimientos).toEqual([
      {
        id: 'm-1',
        categoria: 'gasto',
        subtipo: null,
        detalle: null,
        descripcion: null,
        fecha: '2026-01-01',
        km_actual: 1000,
        fecha_proximo_vencimiento: null,
        km_proximo_vencimiento: null,
      },
    ]);
    expect(payload.gastos).toEqual([{ id: 'g-1', monto: 500, fecha: '2026-01-01', descripcion: null }]);
  });
});

describe('toActualizarVehiculoPayload — semántica parcial (4.9, la trampa más fácil del change)', () => {
  it('clave ausente en `cambios` -> NO aparece en el payload devuelto (editar solo la patente)', () => {
    const cambios: ActualizacionVehiculo = { patente: 'AC999ZZ' };
    const payload = toActualizarVehiculoPayload(cambios);

    expect(payload).toEqual({ patente: 'AC999ZZ' });
    expect('mantenimientos' in payload).toBe(false);
    expect('gastos' in payload).toBe(false);
    expect('accesorios' in payload).toBe(false);
    expect('modelo' in payload).toBe(false);
  });

  it('clave presente con colección vacía ([]) SÍ viaja -> significa "vaciar", no "no tocar"', () => {
    const cambios: ActualizacionVehiculo = { mantenimientos: [] };
    const payload = toActualizarVehiculoPayload(cambios);

    expect('mantenimientos' in payload).toBe(true);
    expect(payload.mantenimientos).toEqual([]);
  });

  it('cada colección tiene su propio test dedicado de ausencia: gastos', () => {
    const payload = toActualizarVehiculoPayload({ gastos: [] });
    expect('gastos' in payload).toBe(true);
    expect(payload.gastos).toEqual([]);
    expect('mantenimientos' in payload).toBe(false);
  });

  it('cada colección tiene su propio test dedicado de ausencia: accesoriosCompatibles', () => {
    const payload = toActualizarVehiculoPayload({ accesoriosCompatibles: [] });
    expect('accesorios' in payload).toBe(true);
    expect(payload.accesorios).toEqual([]);
    expect('gastos' in payload).toBe(false);
  });

  it('estado presente se traduce con toEstadoVehiculoRow', () => {
    const payload = toActualizarVehiculoPayload({ estado: 'fuera-de-servicio' });
    expect(payload.estado).toBe('fuera de servicio');
  });

  it('kilometrajeUltimoService y fechaUltimoService presentes se emiten en snake_case (RN-VE-03)', () => {
    const payload = toActualizarVehiculoPayload({ kilometrajeUltimoService: 55000, fechaUltimoService: '2026-07-01' });
    expect(payload.kilometraje_ultimo_service).toBe(55000);
    expect(payload.fecha_ultimo_service).toBe('2026-07-01');
  });

  it('fechaUltimoService: "" se escribe como null (vaciar), no como string vacío', () => {
    expect(toActualizarVehiculoPayload({ fechaUltimoService: '' }).fecha_ultimo_service).toBeNull();
  });

  it('notas: "" se escribe como null (vaciar el campo), notas ausente no aparece', () => {
    expect(toActualizarVehiculoPayload({ notas: '' }).notas).toBeNull();
    expect('notas' in toActualizarVehiculoPayload({})).toBe(false);
  });

  it('4.7b: NUNCA lee ni emite `habilitaciones`, aunque `cambios.habilitaciones` venga presente', () => {
    const cambios: ActualizacionVehiculo = {
      habilitaciones: [{ tipo: 'rto', fechaEmision: '2026-01-01', fechaVencimiento: '2026-07-01' }],
      patente: 'AB111CD',
    };
    const payload = toActualizarVehiculoPayload(cambios);
    expect('habilitaciones' in payload).toBe(false);
    expect(payload.patente).toBe('AB111CD');
  });

  it('objeto de cambios vacío -> payload vacío', () => {
    expect(toActualizarVehiculoPayload({})).toEqual({});
  });

  it('todos los campos escalares presentes se emiten (modelo/tipo/capacidad/kilometraje/notas no vacías)', () => {
    const cambios: ActualizacionVehiculo = {
      modelo: 'Toyota Etios GLS',
      tipo: 'sedan',
      capacidad: 5,
      kilometraje: 60000,
      notas: 'Service al día',
    };
    expect(toActualizarVehiculoPayload(cambios)).toEqual({
      modelo: 'Toyota Etios GLS',
      tipo: 'sedan',
      capacidad: 5,
      kilometraje: 60000,
      notas: 'Service al día',
    });
  });
});

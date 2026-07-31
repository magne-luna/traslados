import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NuevoVehiculo } from '../../types/vehiculo';
import { mockVehiculoRepository } from './mockVehiculoRepository';

const STORAGE_KEY = 'vehiculos';

async function flushLatency<T>(promise: Promise<T>): Promise<T> {
  const result = promise;
  await vi.runAllTimersAsync();
  return result;
}

function buildNuevoVehiculo(overrides: Partial<NuevoVehiculo> = {}): NuevoVehiculo {
  return {
    patente: 'ZZ000ZZ',
    modelo: 'Fiat Fiorino',
    tipo: 'furgon',
    capacidad: 2,
    accesoriosCompatibles: [],
    estado: 'habilitado',
    kilometraje: 0,
    kilometrajeUltimoService: 0,
    fechaUltimoService: '2026-01-01',
    habilitaciones: [],
    gastos: [],
    mantenimientos: [],
    ...overrides,
  };
}

describe('mockVehiculoRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('siembra el fixture de 3 vehículos cuando no hay datos previos en localStorage', async () => {
    const vehiculos = await flushLatency(mockVehiculoRepository.list());

    expect(vehiculos).toHaveLength(3);
    expect(vehiculos.map((v) => v.modelo)).toContain('Toyota Etios');
  });

  it('list() resuelve una promesa con latencia simulada (loading states reales)', async () => {
    let resolved = false;
    mockVehiculoRepository.list().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    await vi.runAllTimersAsync();
    expect(resolved).toBe(true);
  });

  it('create() persiste un nuevo vehículo recuperable por list() (persistencia entre "recargas")', async () => {
    await flushLatency(mockVehiculoRepository.list());

    const creado = await flushLatency(mockVehiculoRepository.create(buildNuevoVehiculo({ patente: 'NEW111' })));

    expect(creado.id).toBeTruthy();

    const vehiculos = await flushLatency(mockVehiculoRepository.list());
    expect(vehiculos.map((v) => v.patente)).toContain('NEW111');
  });

  it('getById resuelve null cuando el id no existe', async () => {
    const found = await flushLatency(mockVehiculoRepository.getById('no-existe'));

    expect(found).toBeNull();
  });

  it('update() persiste los cambios y devuelve la entidad actualizada', async () => {
    const [primero] = await flushLatency(mockVehiculoRepository.list());
    if (!primero) throw new Error('Debería existir al menos un vehículo tras el seed inicial');

    const actualizado = await flushLatency(mockVehiculoRepository.update(primero.id, { kilometraje: 999_999 }));

    expect(actualizado.kilometraje).toBe(999_999);
    expect(actualizado.modelo).toBe(primero.modelo);

    const releido = await flushLatency(mockVehiculoRepository.getById(primero.id));
    expect(releido?.kilometraje).toBe(999_999);
  });

  it('update() lanza un error explícito si el id no existe (borde)', async () => {
    await flushLatency(mockVehiculoRepository.list());

    // update() rechaza sincrónicamente (no pasa por withLatency), así que se espera
    // directamente sin envolver en flushLatency para no dejar la rejection sin handler.
    await expect(mockVehiculoRepository.update('no-existe', { kilometraje: 1 })).rejects.toThrow();
  });

  it('re-siembra desde el fixture si el schemaVersion en localStorage no coincide (dato corrupto/viejo)', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 0, vehiculos: [{ id: 'x' }] }));

    const vehiculos = await flushLatency(mockVehiculoRepository.list());

    expect(vehiculos).toHaveLength(3);
  });

  it('re-siembra desde el fixture si el payload de localStorage está corrupto (JSON inválido)', async () => {
    localStorage.setItem(STORAGE_KEY, 'no-es-json{{{');

    const vehiculos = await flushLatency(mockVehiculoRepository.list());

    expect(vehiculos).toHaveLength(3);
  });

  // RED→GREEN (tasks.md 4.2, spec vehiculo-contract, escenario "Payload con gastos del esquema
  // anterior"): un payload guardado por la versión previa del mock (schemaVersion 2, gastos con
  // `categoria`, sin `mantenimientos`) debe re-sembrarse, nunca deserializarse tal cual — el mock
  // no migra payloads viejos (design.md Decisión 8).
  // D3-B (tasks.md 2B.1/2B.2, spec vehiculo-contract — escenario "Las habilitaciones se derivan
  // del historial, no se persisten", "con cualquier implementación de VehiculoRepository"): el
  // mock también deriva `habilitaciones` de `mantenimientos` en cada lectura, en vez de devolver
  // lo que haya quedado guardado — así el mock y `SupabaseVehiculoRepository` muestran lo mismo.
  it('deriva habilitaciones del historial de mantenimiento al leer, ignorando lo persistido (D3-B)', async () => {
    const creado = await flushLatency(
      mockVehiculoRepository.create(
        buildNuevoVehiculo({
          patente: 'VV000VV',
          // Habilitación "persistida" incoherente con el historial: no debe sobrevivir a la lectura.
          habilitaciones: [{ tipo: 'vtv', fechaEmision: '2020-01-01', fechaVencimiento: '2020-06-01' }],
          mantenimientos: [
            {
              id: 'm-vtv',
              fecha: '2026-01-01',
              kilometraje: 1000,
              tipoIntervencion: 'preventivo',
              subtipo: 'vtv',
              proximoVencimientoFecha: '2027-01-01',
            },
          ],
        }),
      ),
    );

    expect(creado.habilitaciones).toEqual([{ tipo: 'vtv', fechaEmision: '2026-01-01', fechaVencimiento: '2027-01-01' }]);

    const releido = await flushLatency(mockVehiculoRepository.getById(creado.id));
    expect(releido?.habilitaciones).toEqual([{ tipo: 'vtv', fechaEmision: '2026-01-01', fechaVencimiento: '2027-01-01' }]);
  });

  it('agregar una intervención VTV al historial actualiza la habilitación mostrada tras la relectura (D3-B)', async () => {
    const creado = await flushLatency(mockVehiculoRepository.create(buildNuevoVehiculo({ patente: 'VV111VV' })));
    expect(creado.habilitaciones).toEqual([]);

    const actualizado = await flushLatency(
      mockVehiculoRepository.update(creado.id, {
        mantenimientos: [
          {
            id: 'm-vtv-nueva',
            fecha: '2026-05-01',
            kilometraje: 2000,
            tipoIntervencion: 'preventivo',
            subtipo: 'vtv',
            proximoVencimientoFecha: '2026-11-01',
          },
        ],
      }),
    );

    expect(actualizado.habilitaciones).toEqual([{ tipo: 'vtv', fechaEmision: '2026-05-01', fechaVencimiento: '2026-11-01' }]);
  });

  it('re-siembra si el localStorage tiene gastos con el campo categoria del esquema anterior (schemaVersion 2)', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 2,
        vehiculos: [
          {
            id: 'viejo-1',
            patente: 'VV111VV',
            modelo: 'Modelo viejo',
            tipo: 'sedan',
            capacidad: 4,
            accesoriosCompatibles: [],
            estado: 'habilitado',
            kilometraje: 1000,
            kilometrajeUltimoService: 1000,
            fechaUltimoService: '2026-01-01',
            habilitaciones: [],
            gastos: [{ id: 'g-viejo', fecha: '2026-01-01', monto: 100, categoria: 'reparacion' }],
            // sin `mantenimientos`: no existía en schemaVersion 2.
          },
        ],
      }),
    );

    const vehiculos = await flushLatency(mockVehiculoRepository.list());

    expect(vehiculos).toHaveLength(3);
    expect(vehiculos.map((v) => v.patente)).not.toContain('VV111VV');
  });
});

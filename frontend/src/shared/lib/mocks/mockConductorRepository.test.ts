import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NuevoConductor } from '../../types/conductor';
import { mockConductorRepository } from './mockConductorRepository';

const STORAGE_KEY = 'conductores';

async function flushLatency<T>(promise: Promise<T>): Promise<T> {
  const result = promise;
  await vi.runAllTimersAsync();
  return result;
}

function buildNuevoConductor(overrides: Partial<NuevoConductor> = {}): NuevoConductor {
  return {
    apellido: 'Fernández',
    nombre: 'Ana',
    documento: '99887766',
    domicilio: 'Belgrano 200, Quilmes',
    cuil: '27-99887766-1',
    estado: 'operando',
    asignaciones: [],
    ...overrides,
  };
}

describe('mockConductorRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('siembra el fixture de 3 conductores cuando no hay datos previos en localStorage', async () => {
    const promise = mockConductorRepository.list();
    const conductores = await flushLatency(promise);

    expect(conductores).toHaveLength(3);
  });

  it('simula latencia de red: la promesa no resuelve antes de avanzar los timers (triangulación)', async () => {
    let resolved = false;
    mockConductorRepository.list().then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);

    await vi.runAllTimersAsync();
    expect(resolved).toBe(true);
  });

  it('create() persiste un nuevo conductor recuperable por list() (persistencia entre "recargas")', async () => {
    await flushLatency(mockConductorRepository.list());

    const creado = await flushLatency(mockConductorRepository.create(buildNuevoConductor({ apellido: 'Nuevo' })));

    expect(creado.id).toBeTruthy();

    const conductores = await flushLatency(mockConductorRepository.list());
    expect(conductores.map((c) => c.apellido)).toContain('Nuevo');
  });

  it('getById resuelve null cuando el id no existe', async () => {
    const found = await flushLatency(mockConductorRepository.getById('no-existe'));

    expect(found).toBeNull();
  });

  it('update() persiste los cambios y devuelve la entidad actualizada', async () => {
    const [primero] = await flushLatency(mockConductorRepository.list());
    if (!primero) throw new Error('Debería existir al menos un conductor tras el seed inicial');

    const actualizado = await flushLatency(
      mockConductorRepository.update(primero.id, { telefono: '11-0000-1111' }),
    );

    expect(actualizado.telefono).toBe('11-0000-1111');
    expect(actualizado.apellido).toBe(primero.apellido);

    const releido = await flushLatency(mockConductorRepository.getById(primero.id));
    expect(releido?.telefono).toBe('11-0000-1111');
  });

  it('update() lanza un error explícito si el id no existe (borde)', async () => {
    await flushLatency(mockConductorRepository.list());

    await expect(mockConductorRepository.update('no-existe', { telefono: '1' })).rejects.toThrow();
  });

  it('re-siembra desde el fixture si el schemaVersion en localStorage no coincide (dato corrupto/viejo)', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 0, conductores: [{ id: 'x' }] }));

    const conductores = await flushLatency(mockConductorRepository.list());

    expect(conductores).toHaveLength(3);
  });

  it('re-siembra desde el fixture si el payload de localStorage está corrupto (JSON inválido)', async () => {
    localStorage.setItem(STORAGE_KEY, 'no-es-json{{{');

    const conductores = await flushLatency(mockConductorRepository.list());

    expect(conductores).toHaveLength(3);
  });

  // paginacion-listados, Fase 3 (tasks.md 16.2): mismos casos que mockPacienteRepository.test.ts
  // 11.x — página completa, página parcial, orden determinista, búsqueda.
  describe('listPage (16.x)', () => {
    it('página 1 tamaño 2 devuelve 2 items y el total del fixture completo (3)', async () => {
      const pagina = await flushLatency(
        mockConductorRepository.listPage({ pagina: 1, tamanio: 2, filtros: { busqueda: '' } }),
      );

      expect(pagina.items).toHaveLength(2);
      expect(pagina.total).toBe(3);
      expect(pagina.pagina).toBe(1);
      expect(pagina.tamanio).toBe(2);
    });

    it('página 2 tamaño 2 devuelve el resto (1 item), sin solapar con la página 1', async () => {
      const p1 = await flushLatency(mockConductorRepository.listPage({ pagina: 1, tamanio: 2, filtros: { busqueda: '' } }));
      const p2 = await flushLatency(mockConductorRepository.listPage({ pagina: 2, tamanio: 2, filtros: { busqueda: '' } }));

      expect(p2.items).toHaveLength(1);
      expect(p2.total).toBe(3);
      const idsP1 = p1.items.map((c) => c.id);
      const idsP2 = p2.items.map((c) => c.id);
      expect(idsP1.filter((id) => idsP2.includes(id))).toEqual([]);
    });

    it('página fuera de rango devuelve items vacío con el total real', async () => {
      const pagina = await flushLatency(
        mockConductorRepository.listPage({ pagina: 99, tamanio: 2, filtros: { busqueda: '' } }),
      );

      expect(pagina.items).toEqual([]);
      expect(pagina.total).toBe(3);
    });

    it('tamanio mayor al total devuelve todo en una sola página', async () => {
      const pagina = await flushLatency(
        mockConductorRepository.listPage({ pagina: 1, tamanio: 50, filtros: { busqueda: '' } }),
      );

      expect(pagina.items).toHaveLength(3);
    });

    it('orden determinista: apellido asc, nombre asc, id como desempate', async () => {
      const pagina = await flushLatency(
        mockConductorRepository.listPage({ pagina: 1, tamanio: 50, filtros: { busqueda: '' } }),
      );

      const apellidos = pagina.items.map((c) => c.apellido);
      expect(apellidos).toEqual(['Díaz', 'González', 'Pérez']);
    });

    it('búsqueda por apellido encuentra solo los conductores que matchean', async () => {
      // "gonzález" con acento — checkpoint 2 (aprobado): ilike/mock no ignoran acentos, no es
      // una regresión buscar con el acento tal como está escrito el apellido.
      const pagina = await flushLatency(
        mockConductorRepository.listPage({ pagina: 1, tamanio: 50, filtros: { busqueda: 'gonzález' } }),
      );

      expect(pagina.items.map((c) => c.apellido)).toEqual(['González']);
      expect(pagina.total).toBe(1);
    });

    it('búsqueda por documento parcial encuentra el conductor', async () => {
      const pagina = await flushLatency(
        mockConductorRepository.listPage({ pagina: 1, tamanio: 50, filtros: { busqueda: '157894' } }),
      );

      expect(pagina.items.map((c) => c.apellido)).toEqual(['Pérez']);
    });

    it('búsqueda por nombre y apellido en cualquier orden encuentra al conductor', async () => {
      const p1 = await flushLatency(
        mockConductorRepository.listPage({ pagina: 1, tamanio: 50, filtros: { busqueda: 'carlos pérez' } }),
      );
      const p2 = await flushLatency(
        mockConductorRepository.listPage({ pagina: 1, tamanio: 50, filtros: { busqueda: 'pérez carlos' } }),
      );

      expect(p1.items.map((c) => c.apellido)).toEqual(['Pérez']);
      expect(p2.items.map((c) => c.apellido)).toEqual(['Pérez']);
    });

    it('búsqueda sin coincidencias devuelve items vacío y total 0', async () => {
      const pagina = await flushLatency(
        mockConductorRepository.listPage({ pagina: 1, tamanio: 50, filtros: { busqueda: 'no-existe-nadie' } }),
      );

      expect(pagina.items).toEqual([]);
      expect(pagina.total).toBe(0);
    });
  });
});

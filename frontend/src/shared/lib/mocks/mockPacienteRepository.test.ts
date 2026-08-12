import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockPacienteRepository } from './mockPacienteRepository';

const STORAGE_KEY = 'pacientes';

async function flushLatency<T>(promise: Promise<T>): Promise<T> {
  const result = promise;
  await vi.runAllTimersAsync();
  return result;
}

describe('mockPacienteRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // El formato del identificador de afiliado ya no vive en Paciente (RF-106: es una propiedad de
  // ObraSocial) — el fixture sigue sembrando tres `valor` con formas distintas (una por cada
  // formato conceptual), pero acá solo se puede verificar la diversidad de `valor`.
  it('siembra el fixture con pacientes con valores de identificador de afiliado distintos entre sí', async () => {
    const pacientes = await flushLatency(mockPacienteRepository.list());

    expect(pacientes.length).toBeGreaterThanOrEqual(2);
    const valores = new Set(pacientes.map((p) => p.numeroAfiliado.valor));
    expect(valores.size).toBe(pacientes.length);
    expect(pacientes.some((p) => p.amparoJudicial)).toBe(true);
    expect(pacientes.some((p) => !p.amparoJudicial)).toBe(true);
  });

  it('list() resuelve una promesa con latencia simulada (loading states reales)', async () => {
    let resolved = false;
    mockPacienteRepository.list().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    await vi.runAllTimersAsync();
    expect(resolved).toBe(true);
  });

  it('getById resuelve null cuando el id no existe (no lanza excepción)', async () => {
    const found = await flushLatency(mockPacienteRepository.getById('no-existe'));

    expect(found).toBeNull();
  });

  it('create() asigna id y persiste el paciente, recuperable por list()', async () => {
    await flushLatency(mockPacienteRepository.list());

    const creado = await flushLatency(
      mockPacienteRepository.create({
        apellido: 'Suárez',
        nombre: 'Iván',
        fechaNacimiento: '2012-05-01',
        dni: '47000111',
        cuilTitular: '20-30999888-1',
        diagnostico: 'Test',
        accesorioMovilidad: [],
        obraSocialId: null,
        numeroAfiliado: { valor: '47000111' },
        cud: null,
        direcciones: [],
        personasACargo: [],
        amparoJudicial: false,
      }),
    );

    expect(creado.id).toBeTruthy();

    const pacientes = await flushLatency(mockPacienteRepository.list());
    expect(pacientes.map((p) => p.apellido)).toContain('Suárez');
  });

  it('update() de un id inexistente lanza una excepción', async () => {
    await flushLatency(mockPacienteRepository.list());

    // update() rechaza sincrónicamente (no pasa por withLatency), así que se espera
    // directamente sin envolver en flushLatency para no dejar la rejection sin handler.
    await expect(mockPacienteRepository.update('no-existe', { apellido: 'X' })).rejects.toThrow();
  });

  it('update() persiste los cambios y son legibles desde otra instancia de lectura (localStorage)', async () => {
    const [primero] = await flushLatency(mockPacienteRepository.list());
    if (!primero) throw new Error('debería existir al menos un paciente tras el seed inicial');

    await flushLatency(mockPacienteRepository.update(primero.id, { diagnostico: 'Actualizado' }));

    const releido = await flushLatency(mockPacienteRepository.getById(primero.id));
    expect(releido?.diagnostico).toBe('Actualizado');
  });

  it('re-siembra desde el fixture si el schemaVersion en localStorage no coincide (dato corrupto/viejo)', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 0, pacientes: [{ id: 'x', apellido: 'Basura' }] }),
    );

    const pacientes = await flushLatency(mockPacienteRepository.list());

    expect(pacientes.some((p) => p.apellido === 'Basura')).toBe(false);
    expect(pacientes.length).toBeGreaterThan(0);
  });

  it('re-siembra desde el fixture si el payload en localStorage es JSON corrupto', async () => {
    localStorage.setItem(STORAGE_KEY, '{not-json');

    const pacientes = await flushLatency(mockPacienteRepository.list());

    expect(pacientes.length).toBeGreaterThan(0);
  });
});

// -------------------------------------------------------------------------------------------
// listPage (paginacion-listados, tasks.md 11.x). Fixture sembrado: Martina Gómez, Facundo
// Pereyra, Brisa Ledesma — orden alfabético por apellido: Gómez, Ledesma, Pereyra.
// -------------------------------------------------------------------------------------------

describe('mockPacienteRepository.listPage (11.x)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('11.1 devuelve 2 items y el total del fixture completo con tamanio 2', async () => {
    const pagina = await flushLatency(
      mockPacienteRepository.listPage({ pagina: 1, tamanio: 2, filtros: { busqueda: '' } }),
    );

    expect(pagina.items).toHaveLength(2);
    expect(pagina.total).toBe(3);
    expect(pagina.pagina).toBe(1);
    expect(pagina.tamanio).toBe(2);
  });

  it('11.3 la página 2 devuelve items distintos de la página 1', async () => {
    const p1 = await flushLatency(mockPacienteRepository.listPage({ pagina: 1, tamanio: 2, filtros: { busqueda: '' } }));
    const p2 = await flushLatency(mockPacienteRepository.listPage({ pagina: 2, tamanio: 2, filtros: { busqueda: '' } }));

    expect(p2.items).toHaveLength(1);
    expect(p2.items.map((p) => p.id)).not.toEqual(p1.items.map((p) => p.id));
  });

  it('11.3 una página fuera de rango devuelve items vacío con el total real', async () => {
    const pagina = await flushLatency(
      mockPacienteRepository.listPage({ pagina: 99, tamanio: 2, filtros: { busqueda: '' } }),
    );

    expect(pagina.items).toEqual([]);
    expect(pagina.total).toBe(3);
  });

  it('11.3 un tamanio mayor al total devuelve todo en una sola página', async () => {
    const pagina = await flushLatency(
      mockPacienteRepository.listPage({ pagina: 1, tamanio: 50, filtros: { busqueda: '' } }),
    );

    expect(pagina.items).toHaveLength(3);
    expect(pagina.total).toBe(3);
  });

  it('11.4 ordena de forma determinista por apellido (mismo criterio que la implementación real)', async () => {
    const pagina = await flushLatency(
      mockPacienteRepository.listPage({ pagina: 1, tamanio: 50, filtros: { busqueda: '' } }),
    );

    expect(pagina.items.map((p) => p.apellido)).toEqual(['Gómez', 'Ledesma', 'Pereyra']);
  });

  it('11.4 desempata por nombre y luego por id cuando el apellido coincide', async () => {
    await flushLatency(mockPacienteRepository.list());
    await flushLatency(
      mockPacienteRepository.create({
        apellido: 'Gómez',
        nombre: 'Alfredo',
        fechaNacimiento: '',
        dni: '1',
        cuilTitular: '',
        diagnostico: '',
        accesorioMovilidad: [],
        obraSocialId: null,
        numeroAfiliado: { valor: '' },
        cud: null,
        direcciones: [],
        personasACargo: [],
        amparoJudicial: false,
      }),
    );

    const pagina = await flushLatency(
      mockPacienteRepository.listPage({ pagina: 1, tamanio: 50, filtros: { busqueda: '' } }),
    );

    const gomez = pagina.items.filter((p) => p.apellido === 'Gómez');
    expect(gomez.map((p) => p.nombre)).toEqual(['Alfredo', 'Martina']);
  });

  it('11.5 búsqueda por apellido', async () => {
    const pagina = await flushLatency(
      mockPacienteRepository.listPage({ pagina: 1, tamanio: 50, filtros: { busqueda: 'pereyra' } }),
    );

    expect(pagina.items.map((p) => p.apellido)).toEqual(['Pereyra']);
    expect(pagina.total).toBe(1);
  });

  it('11.5 búsqueda por DNI parcial', async () => {
    const pagina = await flushLatency(
      mockPacienteRepository.listPage({ pagina: 1, tamanio: 50, filtros: { busqueda: '451234' } }),
    );

    expect(pagina.items.map((p) => p.dni)).toEqual(['45123456']);
  });

  it('11.5 búsqueda por nombre + apellido en cualquier orden', async () => {
    // Accent-sensitive por diseño (checkpoint 2, design.md §D5): "gómez" con tilde, igual que hoy.
    const enOrden = await flushLatency(
      mockPacienteRepository.listPage({ pagina: 1, tamanio: 50, filtros: { busqueda: 'martina gómez' } }),
    );
    const invertido = await flushLatency(
      mockPacienteRepository.listPage({ pagina: 1, tamanio: 50, filtros: { busqueda: 'gómez martina' } }),
    );

    expect(enOrden.items.map((p) => p.id)).toEqual(['paciente-martina']);
    expect(invertido.items.map((p) => p.id)).toEqual(['paciente-martina']);
  });

  it('11.5 búsqueda sin coincidencias devuelve items vacío y total 0', async () => {
    const pagina = await flushLatency(
      mockPacienteRepository.listPage({ pagina: 1, tamanio: 50, filtros: { busqueda: 'zzz-inexistente' } }),
    );

    expect(pagina.items).toEqual([]);
    expect(pagina.total).toBe(0);
  });
});

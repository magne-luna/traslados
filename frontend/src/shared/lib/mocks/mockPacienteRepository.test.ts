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

  it('siembra el fixture con los tres formatos de identificador de afiliado cuando no hay datos previos', async () => {
    const pacientes = await flushLatency(mockPacienteRepository.list());

    expect(pacientes.length).toBeGreaterThanOrEqual(2);
    const formatos = new Set(pacientes.map((p) => p.numeroAfiliado.formato));
    expect(formatos).toEqual(new Set(['numero-documento', 'alfanumerico', 'cuil-con-sufijo']));
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
        numeroAfiliado: { formato: 'numero-documento', valor: '47000111' },
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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockObraSocialRepository } from './mockObraSocialRepository';

const STORAGE_KEY = 'obras-sociales';

async function flushLatency<T>(promise: Promise<T>): Promise<T> {
  const result = promise;
  await vi.runAllTimersAsync();
  return result;
}

describe('mockObraSocialRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('siembra OSECAC con su checklist de RF-305 cuando no hay datos previos en localStorage', async () => {
    const obrasSociales = await flushLatency(mockObraSocialRepository.list());

    expect(obrasSociales).toHaveLength(1);
    expect(obrasSociales[0]?.nombre).toBe('OSECAC');
    expect(obrasSociales[0]?.checklist).toHaveLength(10);
    expect(obrasSociales[0]?.checklist.every((item) => item.requerido)).toBe(true);
  });

  // tasks.md 2.4 (D9): los 4 campos nuevos del docx (código, dirección, teléfono, condición IVA)
  // no tienen fuente verificable (docx ni KB) para OSECAC — quedan ausentes, nunca inventados.
  it('no inventa código/dirección/teléfono/condición IVA para OSECAC sin fuente verificable', async () => {
    const [osecac] = await flushLatency(mockObraSocialRepository.list());

    expect(osecac?.codigo).toBeUndefined();
    expect(osecac?.direccion).toBeUndefined();
    expect(osecac?.telefono).toBeUndefined();
    expect(osecac?.condicionIva).toBeUndefined();
  });

  it('ninguna otra obra social nace con checklist predefinido (triangulación con create)', async () => {
    await flushLatency(mockObraSocialRepository.list());

    const nueva = await flushLatency(
      mockObraSocialRepository.create({
        nombre: 'Swiss Medical',
        cuit: '30-11111111-1',
        plazoCobroDias: 90,
        tipoComprobante: 'A',
        modalidadFacturacion: 'por-prestacion',
        admitePagosParciales: false,
        checklist: [],
        plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
      }),
    );

    expect(nueva.checklist).toEqual([]);
  });

  it('list() resuelve una promesa con latencia simulada (loading states reales)', async () => {
    let resolved = false;
    mockObraSocialRepository.list().then(() => {
      resolved = true;
    });

    // Antes de avanzar los timers falsos, la promesa todavía no se resolvió.
    await Promise.resolve();
    expect(resolved).toBe(false);

    await vi.runAllTimersAsync();
    expect(resolved).toBe(true);
  });

  it('create() persiste una nueva obra social recuperable por list() (persistencia entre "recargas")', async () => {
    await flushLatency(mockObraSocialRepository.list());

    const creada = await flushLatency(
      mockObraSocialRepository.create({
        nombre: 'Swiss Medical',
        cuit: '30-11111111-1',
        plazoCobroDias: 60,
        tipoComprobante: 'B',
        modalidadFacturacion: 'general',
        admitePagosParciales: true,
        checklist: [],
        plantillaFactura: { campos: [], identificadorOrigen: 'paciente.dni' },
      }),
    );

    expect(creada.id).toBeTruthy();

    // Simula "recargar la página": otra llamada independiente a list() debe seguir viéndola.
    const obrasSociales = await flushLatency(mockObraSocialRepository.list());
    expect(obrasSociales.map((os) => os.nombre)).toContain('Swiss Medical');
  });

  it('getById resuelve null cuando el id no existe', async () => {
    const found = await flushLatency(mockObraSocialRepository.getById('no-existe'));

    expect(found).toBeNull();
  });

  it('update() persiste los cambios y devuelve la entidad actualizada', async () => {
    const [osecac] = await flushLatency(mockObraSocialRepository.list());
    if (!osecac) throw new Error('OSECAC debería existir tras el seed inicial');

    const actualizada = await flushLatency(
      mockObraSocialRepository.update(osecac.id, { plazoCobroDias: 45 }),
    );

    expect(actualizada.plazoCobroDias).toBe(45);
    expect(actualizada.nombre).toBe('OSECAC');

    const releida = await flushLatency(mockObraSocialRepository.getById(osecac.id));
    expect(releida?.plazoCobroDias).toBe(45);
  });

  it('re-siembra desde el fixture si el schemaVersion en localStorage no coincide (dato corrupto/viejo)', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 0, obrasSociales: [{ id: 'x', nombre: 'Basura' }] }),
    );

    const obrasSociales = await flushLatency(mockObraSocialRepository.list());

    expect(obrasSociales).toHaveLength(1);
    expect(obrasSociales[0]?.nombre).toBe('OSECAC');
  });

  // tasks.md 2.3 (design.md D9): SCHEMA_VERSION sube 1 -> 2 (se suman los 4 campos del docx). Un
  // payload viejo con schemaVersion 1, guardado por una versión anterior de la app, se trata igual
  // que cualquier otro esquema desactualizado: se descarta y se resiembra sin romper la pantalla.
  it('re-siembra desde el fixture si el localStorage quedó en schemaVersion 1 (versión anterior de la app)', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        obrasSociales: [
          {
            id: 'os-vieja',
            nombre: 'Obra Social Vieja',
            cuit: '30-11111111-1',
            plazoCobroDias: 90,
            tipoComprobante: 'A',
            modalidadFacturacion: 'por-prestacion',
            admitePagosParciales: false,
            checklist: [],
            plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
          },
        ],
      }),
    );

    const obrasSociales = await flushLatency(mockObraSocialRepository.list());

    expect(obrasSociales).toHaveLength(1);
    expect(obrasSociales[0]?.nombre).toBe('OSECAC');
  });
});

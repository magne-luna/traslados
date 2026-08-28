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
        modalidadFacturacion: 'por-prestacion',
        admitePagosParciales: false,
        formatoAfiliado: 'numero-documento',
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
        modalidadFacturacion: 'general',
        admitePagosParciales: true,
        formatoAfiliado: 'numero-documento',
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
      mockObraSocialRepository.update(osecac.id, { condicionIva: 'MONOTRIBUTO' }),
    );

    expect(actualizada.condicionIva).toBe('MONOTRIBUTO');
    expect(actualizada.nombre).toBe('OSECAC');

    const releida = await flushLatency(mockObraSocialRepository.getById(osecac.id));
    expect(releida?.condicionIva).toBe('MONOTRIBUTO');
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

  // paginacion-listados, Fase 3 (tasks.md 17.2): mismos casos que mockConductorRepository.test.ts
  // 16.x — página completa, página parcial, orden determinista, búsqueda. El fixture solo trae
  // OSECAC, así que se crean 2 obras sociales más antes de cada test de paginación.
  describe('listPage (17.x)', () => {
    async function sembrarTresObrasSociales(): Promise<void> {
      await flushLatency(mockObraSocialRepository.list());
      await flushLatency(
        mockObraSocialRepository.create({
          nombre: 'Swiss Medical',
          cuit: '30-11111111-1',
          modalidadFacturacion: 'general',
          admitePagosParciales: true,
          formatoAfiliado: 'numero-documento',
          checklist: [],
          plantillaFactura: { campos: [], identificadorOrigen: 'paciente.dni' },
        }),
      );
      await flushLatency(
        mockObraSocialRepository.create({
          nombre: 'Amebpba',
          cuit: '30-22222222-2',
          modalidadFacturacion: 'por-prestacion',
          admitePagosParciales: false,
          formatoAfiliado: 'numero-documento',
          checklist: [],
          plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
        }),
      );
    }

    it('página 1 tamaño 2 devuelve 2 items y el total del fixture completo (3)', async () => {
      await sembrarTresObrasSociales();

      const pagina = await flushLatency(
        mockObraSocialRepository.listPage({ pagina: 1, tamanio: 2, filtros: { busqueda: '' } }),
      );

      expect(pagina.items).toHaveLength(2);
      expect(pagina.total).toBe(3);
      expect(pagina.pagina).toBe(1);
      expect(pagina.tamanio).toBe(2);
    });

    it('página 2 tamaño 2 devuelve el resto (1 item), sin solapar con la página 1', async () => {
      await sembrarTresObrasSociales();

      const p1 = await flushLatency(mockObraSocialRepository.listPage({ pagina: 1, tamanio: 2, filtros: { busqueda: '' } }));
      const p2 = await flushLatency(mockObraSocialRepository.listPage({ pagina: 2, tamanio: 2, filtros: { busqueda: '' } }));

      expect(p2.items).toHaveLength(1);
      const idsP1 = p1.items.map((os) => os.id);
      const idsP2 = p2.items.map((os) => os.id);
      expect(idsP1.filter((id) => idsP2.includes(id))).toEqual([]);
    });

    it('página fuera de rango devuelve items vacío con el total real', async () => {
      await sembrarTresObrasSociales();

      const pagina = await flushLatency(
        mockObraSocialRepository.listPage({ pagina: 99, tamanio: 2, filtros: { busqueda: '' } }),
      );

      expect(pagina.items).toEqual([]);
      expect(pagina.total).toBe(3);
    });

    it('tamanio mayor al total devuelve todo en una sola página', async () => {
      await sembrarTresObrasSociales();

      const pagina = await flushLatency(
        mockObraSocialRepository.listPage({ pagina: 1, tamanio: 50, filtros: { busqueda: '' } }),
      );

      expect(pagina.items).toHaveLength(3);
    });

    it('orden determinista: nombre asc, id como desempate', async () => {
      await sembrarTresObrasSociales();

      const pagina = await flushLatency(
        mockObraSocialRepository.listPage({ pagina: 1, tamanio: 50, filtros: { busqueda: '' } }),
      );

      expect(pagina.items.map((os) => os.nombre)).toEqual(['Amebpba', 'OSECAC', 'Swiss Medical']);
    });

    it('búsqueda por nombre encuentra solo la obra social que matchea', async () => {
      await sembrarTresObrasSociales();

      const pagina = await flushLatency(
        mockObraSocialRepository.listPage({ pagina: 1, tamanio: 50, filtros: { busqueda: 'swiss' } }),
      );

      expect(pagina.items.map((os) => os.nombre)).toEqual(['Swiss Medical']);
      expect(pagina.total).toBe(1);
    });

    it('búsqueda por CUIT parcial encuentra la obra social', async () => {
      await sembrarTresObrasSociales();

      const pagina = await flushLatency(
        mockObraSocialRepository.listPage({ pagina: 1, tamanio: 50, filtros: { busqueda: '541552' } }),
      );

      expect(pagina.items.map((os) => os.nombre)).toEqual(['OSECAC']);
    });

    it('búsqueda sin coincidencias devuelve items vacío y total 0', async () => {
      await sembrarTresObrasSociales();

      const pagina = await flushLatency(
        mockObraSocialRepository.listPage({ pagina: 1, tamanio: 50, filtros: { busqueda: 'no-existe-nadie' } }),
      );

      expect(pagina.items).toEqual([]);
      expect(pagina.total).toBe(0);
    });
  });
});

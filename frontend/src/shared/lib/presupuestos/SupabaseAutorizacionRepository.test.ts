import { describe, expect, it, vi, beforeEach } from 'vitest';

// Fake tipado de `supabase.functions.invoke`, mismo criterio que
// SupabasePresupuestoRepository.test.ts / SupabaseCuentaRepository.test.ts.

interface FakeInvokeExito {
  data: unknown;
  error: null;
}

interface FakeInvokeErrorHttp {
  data: null;
  error: { context: Response };
}

interface FakeInvokeErrorRed {
  data: null;
  error: Error;
}

type FakeInvokeRespuesta = FakeInvokeExito | FakeInvokeErrorHttp | FakeInvokeErrorRed;

const functionsInvoke = vi.fn<(nombre: string, opciones?: { method?: string; body?: unknown }) => Promise<FakeInvokeRespuesta>>();

// Fake tipado del subconjunto de `supabase.storage` usado por uploadArchivo/removeArchivo (3.5,
// integracion-documentos-autorizaciones), mismo patrón que
// `SupabaseDocumentoRepository.test.ts` §4.1 — nunca golpea la red real.
interface FakeStorageError {
  name: string;
  message: string;
  status?: number;
}
interface StorageUploadCall {
  bucket: string;
  path: string;
  file: File;
  upsert?: boolean;
}
interface StorageRemoveCall {
  bucket: string;
  paths: string[];
}
interface FakeUploadResult {
  data: { path: string } | null;
  error: FakeStorageError | null;
}
interface FakeRemoveResult {
  data: unknown;
  error: FakeStorageError | null;
}

// getUrlArchivo() (presupuestos-vigencia-datos-traslado-vista-previa, tasks.md 7.2/7.10): mismo
// fake tipado de `supabase.storage`, extendido con `createSignedUrl` — registra con qué `options`
// se llamó (o su AUSENCIA) para poder afirmar D6b: `'inline'` NO pasa `download`, `'descarga'` sí.
interface StorageCreateSignedUrlCall {
  bucket: string;
  path: string;
  expiresIn: number;
  options?: { download?: string | boolean };
}
interface FakeCreateSignedUrlResult {
  data: { signedUrl: string } | null;
  error: FakeStorageError | null;
}

let storageUploadCalls: StorageUploadCall[] = [];
let storageRemoveCalls: StorageRemoveCall[] = [];
let storageCreateSignedUrlCalls: StorageCreateSignedUrlCall[] = [];
let uploadHandler: (call: StorageUploadCall) => FakeUploadResult = (call) => ({ data: { path: call.path }, error: null });
let removeHandler: (call: StorageRemoveCall) => FakeRemoveResult = () => ({ data: null, error: null });
let createSignedUrlHandler: (call: StorageCreateSignedUrlCall) => FakeCreateSignedUrlResult = (call) => ({
  data: { signedUrl: `https://storage.example/${call.path}?signed=1` },
  error: null,
});

function resetStorageFake(): void {
  storageUploadCalls = [];
  storageRemoveCalls = [];
  storageCreateSignedUrlCalls = [];
  uploadHandler = (call) => ({ data: { path: call.path }, error: null });
  removeHandler = () => ({ data: null, error: null });
  createSignedUrlHandler = (call) => ({ data: { signedUrl: `https://storage.example/${call.path}?signed=1` }, error: null });
}

vi.mock('../supabaseClient', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => functionsInvoke(...(args as [string, { method?: string; body?: unknown }?])) },
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, file: File, options?: { upsert?: boolean }) => {
          const call: StorageUploadCall = { bucket, path, file, upsert: options?.upsert };
          storageUploadCalls.push(call);
          return Promise.resolve(uploadHandler(call));
        },
        remove: (paths: string[]) => {
          const call: StorageRemoveCall = { bucket, paths };
          storageRemoveCalls.push(call);
          return Promise.resolve(removeHandler(call));
        },
        createSignedUrl: (path: string, expiresIn: number, options?: { download?: string | boolean }) => {
          const call: StorageCreateSignedUrlCall = { bucket, path, expiresIn, options };
          storageCreateSignedUrlCalls.push(call);
          return Promise.resolve(createSignedUrlHandler(call));
        },
      }),
    },
  },
}));

const { supabaseAutorizacionRepository } = await import('./SupabaseAutorizacionRepository');

function buildFile(name: string, type: string, sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

const AUTORIZACION_API_COMPLETA = {
  id: 'a1',
  presupuestoId: 'p1',
  estado: 'autorizada',
  fechaRespuesta: '2026-02-01',
  montoAutorizado: 12000,
  vigenciaDesde: '2026-02-01',
  cupoMensualDias: 10,
  cupoMensualKm: 500,
  archivoUrl: null,
};

describe('supabaseAutorizacionRepository.list() (3.8)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invoca GET /autorizaciones exactamente una vez, sin invocaciones adicionales por fila (anti N+1)', async () => {
    functionsInvoke.mockResolvedValue({
      data: [AUTORIZACION_API_COMPLETA, { ...AUTORIZACION_API_COMPLETA, id: 'a2' }],
      error: null,
    });

    await supabaseAutorizacionRepository.list();

    expect(functionsInvoke).toHaveBeenCalledTimes(1);
    expect(functionsInvoke).toHaveBeenCalledWith('autorizaciones', { method: 'GET' });
  });

  it('descarta filas malformadas sin tumbar el listado (D6, triangulación)', async () => {
    functionsInvoke.mockResolvedValue({
      data: [AUTORIZACION_API_COMPLETA, { esto: 'no es una autorizacion' }],
      error: null,
    });

    const autorizaciones = await supabaseAutorizacionRepository.list();

    expect(autorizaciones).toHaveLength(1);
  });

  it('data no es un array devuelve lista vacía en vez de reventar', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: null });

    const autorizaciones = await supabaseAutorizacionRepository.list();

    expect(autorizaciones).toEqual([]);
  });

  it('un error de la Edge Function se traduce con el mensaje de dominio de autorización', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 401 }) } });

    await expect(supabaseAutorizacionRepository.list()).rejects.toThrow('Tu sesión expiró. Volvé a iniciar sesión.');
  });
});

describe('supabaseAutorizacionRepository.getById() (3.8 — los tres caminos)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 invoca GET /autorizaciones/:id y devuelve la Autorizacion mapeada', async () => {
    functionsInvoke.mockResolvedValue({ data: AUTORIZACION_API_COMPLETA, error: null });

    const autorizacion = await supabaseAutorizacionRepository.getById('a1');

    expect(functionsInvoke).toHaveBeenCalledWith('autorizaciones/a1', { method: 'GET' });
    expect(autorizacion?.id).toBe('a1');
  });

  it('404 devuelve null y NO lanza', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 404 }) } });

    const autorizacion = await supabaseAutorizacionRepository.getById('inexistente');

    expect(autorizacion).toBeNull();
  });

  it('403 lanza con el mensaje de falta de permiso de lectura de autorizaciones', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 403 }) } });

    await expect(supabaseAutorizacionRepository.getById('a1')).rejects.toThrow('No tenés permiso para ver autorizaciones.');
  });
});

const NUEVA_AUTORIZACION = { presupuestoId: 'p1', estado: 'pendiente' as const };

describe('supabaseAutorizacionRepository.create() (3.8)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invoca POST /autorizaciones una sola vez con el body de toCrearAutorizacionPayload', async () => {
    functionsInvoke.mockResolvedValue({ data: { ...AUTORIZACION_API_COMPLETA, id: 'nueva' }, error: null });

    const creada = await supabaseAutorizacionRepository.create(NUEVA_AUTORIZACION);

    expect(functionsInvoke).toHaveBeenCalledTimes(1);
    expect(functionsInvoke).toHaveBeenCalledWith('autorizaciones', {
      method: 'POST',
      body: { presupuestoId: 'p1', estado: 'pendiente' },
    });
    expect(creada.id).toBe('nueva');
  });

  it('403 lanza con el mensaje de falta de permiso de escritura de autorizaciones', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 403 }) } });

    await expect(supabaseAutorizacionRepository.create(NUEVA_AUTORIZACION)).rejects.toThrow(
      'No tenés permiso para modificar autorizaciones.',
    );
  });

  it('400 con el prefijo RN-PA-01 se traduce al mensaje de UI, sin filtrar el texto crudo del trigger', async () => {
    functionsInvoke.mockResolvedValue({
      data: null,
      error: {
        context: new Response(
          JSON.stringify({ error: 'RN-PA-01: monto_autorizado (900) no puede superar el presupuesto (500)' }),
          { status: 400 },
        ),
      },
    });

    await expect(
      supabaseAutorizacionRepository.create({ ...NUEVA_AUTORIZACION, montoAutorizado: 900 }),
    ).rejects.toThrow('La autorización no puede superar el monto del presupuesto.');
  });

  it('respuesta 201 con body malformado (parseAutorizacionApi -> null) lanza un mensaje explícito (3.11, cobertura)', async () => {
    functionsInvoke.mockResolvedValue({ data: { esto: 'no tiene forma de Autorizacion' }, error: null });

    await expect(supabaseAutorizacionRepository.create(NUEVA_AUTORIZACION)).rejects.toThrow(
      'No se pudo guardar la autorización.',
    );
  });
});

describe('supabaseAutorizacionRepository.update() (3.8 — mismo criterio de asimetría que 3.7)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invoca PATCH /autorizaciones/:id con el body de toActualizarAutorizacionPayload (claves ausentes no viajan)', async () => {
    functionsInvoke.mockResolvedValue({ data: { ...AUTORIZACION_API_COMPLETA, estado: 'rechazada' }, error: null });

    const actualizada = await supabaseAutorizacionRepository.update('a1', { estado: 'rechazada' });

    expect(functionsInvoke).toHaveBeenCalledWith('autorizaciones/a1', { method: 'PATCH', body: { estado: 'rechazada' } });
    expect(actualizada.estado).toBe('rechazada');

    const [, opciones] = functionsInvoke.mock.calls[0] ?? [];
    const body = opciones && typeof opciones === 'object' && 'body' in opciones ? opciones.body : undefined;
    expect(body && typeof body === 'object' ? 'montoAutorizado' in body : true).toBe(false);
  });

  it('404 en update() SÍ lanza, con el mensaje idéntico al del mock de autorización', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 404 }) } });

    await expect(supabaseAutorizacionRepository.update('inexistente', { estado: 'rechazada' })).rejects.toThrow(
      'No existe una autorización con id "inexistente".',
    );
  });

  it('respuesta 200 con body malformado (parseAutorizacionApi -> null) lanza un mensaje explícito (3.11, cobertura)', async () => {
    functionsInvoke.mockResolvedValue({ data: { esto: 'no tiene forma de Autorizacion' }, error: null });

    await expect(supabaseAutorizacionRepository.update('a1', { estado: 'rechazada' })).rejects.toThrow(
      'No se pudo guardar la autorización.',
    );
  });
});

describe('supabaseAutorizacionRepository.getByPresupuestoId() (3.9)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invoca autorizaciones?presupuestoId=<id> con el id percent-encoded', async () => {
    functionsInvoke.mockResolvedValue({ data: AUTORIZACION_API_COMPLETA, error: null });

    await supabaseAutorizacionRepository.getByPresupuestoId('id con espacio/raro');

    expect(functionsInvoke).toHaveBeenCalledWith(
      `autorizaciones?presupuestoId=${encodeURIComponent('id con espacio/raro')}`,
      { method: 'GET' },
    );
  });

  it('200 devuelve la Autorizacion mapeada', async () => {
    functionsInvoke.mockResolvedValue({ data: AUTORIZACION_API_COMPLETA, error: null });

    const autorizacion = await supabaseAutorizacionRepository.getByPresupuestoId('p1');

    expect(autorizacion?.presupuestoId).toBe('p1');
  });

  it('404 devuelve null — el presupuesto todavía no tiene autorización, es el caso normal, no un error', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 404 }) } });

    const autorizacion = await supabaseAutorizacionRepository.getByPresupuestoId('p-sin-autorizacion');

    expect(autorizacion).toBeNull();
  });

  it('403 lanza con el mensaje de falta de permiso de lectura', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 403 }) } });

    await expect(supabaseAutorizacionRepository.getByPresupuestoId('p1')).rejects.toThrow(
      'No tenés permiso para ver autorizaciones.',
    );
  });
});

// ---------------------------------------------------------------------------------------------
// 3.5 — uploadArchivo()/removeArchivo() (design.md D3/D5 de integracion-documentos-autorizaciones)
// ---------------------------------------------------------------------------------------------

const AUTORIZACION_SIN_ARCHIVO = { ...AUTORIZACION_API_COMPLETA, id: 'a1' };
const AUTORIZACION_CON_ARCHIVO = {
  ...AUTORIZACION_API_COMPLETA,
  id: 'a1',
  archivoUrl: 'a1/vieja-clave-informe.pdf',
  archivoNombre: 'informe.pdf',
  archivoCargadoEn: '2026-08-01T10:00:00.000Z',
};

function mockGetLuego(patchRespuesta: FakeInvokeRespuesta, getRespuesta: FakeInvokeRespuesta = { data: AUTORIZACION_SIN_ARCHIVO, error: null }): void {
  functionsInvoke.mockImplementation((_nombre, opciones) => {
    if (opciones?.method === 'PATCH') return Promise.resolve(patchRespuesta);
    return Promise.resolve(getRespuesta);
  });
}

describe('supabaseAutorizacionRepository.uploadArchivo() (3.5/3.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStorageFake();
  });

  it('subida exitosa sin archivo previo: sube al bucket, hace PATCH con la clave nueva y no borra nada', async () => {
    mockGetLuego({ data: { ...AUTORIZACION_CON_ARCHIVO, archivoNombre: 'informe.pdf' }, error: null });

    const actualizada = await supabaseAutorizacionRepository.uploadArchivo('a1', buildFile('informe.pdf', 'application/pdf'));

    expect(storageUploadCalls).toHaveLength(1);
    expect(storageUploadCalls[0]?.bucket).toBe('documentos-autorizaciones');
    expect(storageUploadCalls[0]?.path).toMatch(/^a1\/.+-informe\.pdf$/);
    expect(storageUploadCalls[0]?.upsert).toBe(false);

    const patchCall = functionsInvoke.mock.calls.find(([, opciones]) => opciones?.method === 'PATCH');
    expect(patchCall?.[0]).toBe('autorizaciones/a1');
    const body = patchCall?.[1]?.body as { archivoUrl?: string; archivoNombre?: string; archivoCargadoEn?: string } | undefined;
    expect(body?.archivoUrl).toMatch(/^a1\/.+-informe\.pdf$/);
    expect(body?.archivoNombre).toBe('informe.pdf');
    expect(typeof body?.archivoCargadoEn).toBe('string');

    expect(storageRemoveCalls).toHaveLength(0);
    expect(actualizada.archivo?.nombre).toBe('informe.pdf');
  });

  it('reemplazo (triangulación): con archivo previo, borra la clave VIEJA después del PATCH exitoso, no la nueva', async () => {
    mockGetLuego({ data: AUTORIZACION_CON_ARCHIVO, error: null }, { data: AUTORIZACION_CON_ARCHIVO, error: null });

    await supabaseAutorizacionRepository.uploadArchivo('a1', buildFile('nuevo.pdf', 'application/pdf'));

    expect(storageRemoveCalls).toHaveLength(1);
    expect(storageRemoveCalls[0]?.bucket).toBe('documentos-autorizaciones');
    expect(storageRemoveCalls[0]?.paths).toEqual(['a1/vieja-clave-informe.pdf']);
    // la clave nueva (recién subida) nunca se borra en el camino feliz
    expect(storageRemoveCalls[0]?.paths).not.toContain(storageUploadCalls[0]?.path);
  });

  it('fallo del PATCH: borra el objeto recién subido (compensación) y la referencia vieja NO se toca', async () => {
    mockGetLuego(
      { data: null, error: { context: new Response(null, { status: 500 }) } },
      { data: AUTORIZACION_CON_ARCHIVO, error: null },
    );

    await expect(supabaseAutorizacionRepository.uploadArchivo('a1', buildFile('nuevo.pdf', 'application/pdf'))).rejects.toThrow();

    expect(storageRemoveCalls).toHaveLength(1);
    expect(storageRemoveCalls[0]?.paths).toEqual([storageUploadCalls[0]?.path]);
    // la clave vieja jamás se borra si el PATCH falló — la fila la sigue referenciando
    expect(storageRemoveCalls[0]?.paths).not.toContain('a1/vieja-clave-informe.pdf');
  });

  it('tipo no soportado (.docx/.zip): rechaza SIN llegar a Storage ni a la Edge Function', async () => {
    await expect(
      supabaseAutorizacionRepository.uploadArchivo('a1', buildFile('contrato.docx', 'application/vnd.openxmlformats')),
    ).rejects.toThrow(/PDF, JPG o PNG/);

    expect(storageUploadCalls).toHaveLength(0);
    expect(functionsInvoke).not.toHaveBeenCalled();
  });

  it('archivo de más de 10MB: rechaza SIN llegar a Storage ni a la Edge Function', async () => {
    await expect(
      supabaseAutorizacionRepository.uploadArchivo('a1', buildFile('grande.pdf', 'application/pdf', 11 * 1024 * 1024)),
    ).rejects.toThrow(/10\s*MB/);

    expect(storageUploadCalls).toHaveLength(0);
    expect(functionsInvoke).not.toHaveBeenCalled();
  });
});

describe('supabaseAutorizacionRepository.removeArchivo() (3.5/3.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStorageFake();
  });

  it('con archivo cargado: PATCH con los tres campos en null y borra el objeto del bucket', async () => {
    mockGetLuego(
      { data: { ...AUTORIZACION_CON_ARCHIVO, archivoUrl: null, archivoNombre: null, archivoCargadoEn: null }, error: null },
      { data: AUTORIZACION_CON_ARCHIVO, error: null },
    );

    const actualizada = await supabaseAutorizacionRepository.removeArchivo('a1');

    const patchCall = functionsInvoke.mock.calls.find(([, opciones]) => opciones?.method === 'PATCH');
    expect(patchCall?.[1]?.body).toEqual({ archivoUrl: null, archivoNombre: null, archivoCargadoEn: null });
    expect(storageRemoveCalls).toEqual([{ bucket: 'documentos-autorizaciones', paths: ['a1/vieja-clave-informe.pdf'] }]);
    expect(actualizada.archivo).toBeUndefined();
  });

  it('sin archivo adjunto: resuelve sin error y no llama a Storage ni al PATCH (idempotente)', async () => {
    mockGetLuego({ data: null, error: null }, { data: AUTORIZACION_SIN_ARCHIVO, error: null });

    const actualizada = await supabaseAutorizacionRepository.removeArchivo('a1');

    expect(functionsInvoke.mock.calls.filter(([, opciones]) => opciones?.method === 'PATCH')).toHaveLength(0);
    expect(storageRemoveCalls).toHaveLength(0);
    expect(actualizada.archivo).toBeUndefined();
  });

  it('id inexistente: lanza el mismo mensaje que update()', async () => {
    mockGetLuego({ data: null, error: null }, { data: null, error: { context: new Response(null, { status: 404 }) } });

    await expect(supabaseAutorizacionRepository.removeArchivo('inexistente')).rejects.toThrow(
      'No existe una autorización con id "inexistente".',
    );
  });
});

// ---------------------------------------------------------------------------------------------
// getUrlArchivo() (presupuestos-vigencia-datos-traslado-vista-previa, tasks.md 7.1/7.2/7.10,
// design.md D6b, spec `autorizacion-archivo-vista-previa`)
// ---------------------------------------------------------------------------------------------

describe('supabaseAutorizacionRepository.getUrlArchivo() (7.2/7.10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStorageFake();
  });

  it("modo 'inline': NO pasa la opción download a createSignedUrl (D6b, inverso deliberado del fix del 2026-08-10)", async () => {
    functionsInvoke.mockResolvedValue({ data: AUTORIZACION_CON_ARCHIVO, error: null });

    const url = await supabaseAutorizacionRepository.getUrlArchivo('a1', 'inline');

    expect(storageCreateSignedUrlCalls).toHaveLength(1);
    expect(storageCreateSignedUrlCalls[0]?.path).toBe('a1/vieja-clave-informe.pdf');
    expect(storageCreateSignedUrlCalls[0]?.options).toBeUndefined();
    expect(url).toBe('https://storage.example/a1/vieja-clave-informe.pdf?signed=1');
  });

  it("modo 'descarga': SÍ pasa download con el nombre original del archivo", async () => {
    functionsInvoke.mockResolvedValue({ data: AUTORIZACION_CON_ARCHIVO, error: null });

    await supabaseAutorizacionRepository.getUrlArchivo('a1', 'descarga');

    expect(storageCreateSignedUrlCalls).toHaveLength(1);
    expect(storageCreateSignedUrlCalls[0]?.options).toEqual({ download: 'informe.pdf' });
  });

  it('autorización sin archivo: resuelve null sin pedir ninguna firma a Storage', async () => {
    functionsInvoke.mockResolvedValue({ data: AUTORIZACION_SIN_ARCHIVO, error: null });

    const url = await supabaseAutorizacionRepository.getUrlArchivo('a1', 'inline');

    expect(url).toBeNull();
    expect(storageCreateSignedUrlCalls).toHaveLength(0);
  });

  it('autorización inexistente (404 del GET): resuelve null sin lanzar, sin pedir firma', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 404 }) } });

    const url = await supabaseAutorizacionRepository.getUrlArchivo('inexistente', 'inline');

    expect(url).toBeNull();
    expect(storageCreateSignedUrlCalls).toHaveLength(0);
  });

  it('403 real de Storage sobre una clave existente se traduce a un mensaje comprensible en castellano, nunca el crudo', async () => {
    functionsInvoke.mockResolvedValue({ data: AUTORIZACION_CON_ARCHIVO, error: null });
    createSignedUrlHandler = () => ({ data: null, error: { name: 'StorageApiError', message: 'raw storage error', status: 403 } });

    await expect(supabaseAutorizacionRepository.getUrlArchivo('a1', 'inline')).rejects.toThrow(
      'No tenés permiso para ver el archivo de la autorización.',
    );
  });

  it('404 real de Storage (objeto ya no existe) se traduce, distinto del 404 de "no tiene archivo"', async () => {
    functionsInvoke.mockResolvedValue({ data: AUTORIZACION_CON_ARCHIVO, error: null });
    createSignedUrlHandler = () => ({ data: null, error: { name: 'StorageApiError', message: 'raw storage error', status: 404 } });

    await expect(supabaseAutorizacionRepository.getUrlArchivo('a1', 'inline')).rejects.toThrow(
      'No se encontró el archivo en el almacenamiento.',
    );
  });
});

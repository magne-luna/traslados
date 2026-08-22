import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import type { Autorizacion } from '../../shared/types/presupuesto';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import { AutorizacionForm, type AutorizacionFormValues } from './AutorizacionForm';

// presupuestos-vigencia-datos-traslado-vista-previa (tasks.md 7.8/7.10): mismo criterio que
// DocumentChecklist.test.tsx/VistaPreviaArchivo.test.tsx — `PdfPreview` se mockea para verificar
// solo la delegación, sin montar pdf.js real en este archivo.
vi.mock('../../shared/components/PdfPreview', () => ({
  PdfPreview: ({ url, nombreArchivo }: { url: string; nombreArchivo: string }) => (
    <div data-testid="pdf-preview-stub" data-url={url} data-nombre-archivo={nombreArchivo} />
  ),
}));

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

// integracion-documentos-autorizaciones (tasks.md 4.1/4.2): repository fake compartido por defecto
// para los tests que no ejercitan el flujo de archivo — nunca debería invocarse en esos casos.
function buildFakeArchivoRepository(
  overrides: Partial<Pick<AutorizacionRepository, 'uploadArchivo' | 'removeArchivo' | 'getUrlArchivo'>> = {},
): Pick<AutorizacionRepository, 'uploadArchivo' | 'removeArchivo' | 'getUrlArchivo'> {
  return {
    uploadArchivo: vi.fn().mockRejectedValue(new Error('uploadArchivo no debería llamarse en este test')),
    removeArchivo: vi.fn().mockRejectedValue(new Error('removeArchivo no debería llamarse en este test')),
    getUrlArchivo: vi.fn().mockRejectedValue(new Error('getUrlArchivo no debería llamarse en este test')),
    ...overrides,
  };
}

describe('AutorizacionForm', () => {
  it('el selector de estado ofrece exactamente los 4 valores de EstadoAutorizacion', () => {
    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        repository={buildFakeArchivoRepository()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const select = screen.getByLabelText(/^estado$/i);
    const opciones = Array.from(select.querySelectorAll('option')).map((o) => o.getAttribute('value'));

    expect(opciones).toEqual(['pendiente', 'autorizada', 'judicializada', 'rechazada']);
  });

  it('bloquea el guardado y muestra el mensaje de RN-PA-01 cuando montoAutorizado supera el presupuesto', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        repository={buildFakeArchivoRepository()}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/monto autorizado/i), '150000');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/no puede ser mayor al monto del presupuesto/i)).toBeInTheDocument();
  });

  it('permite guardar cuando montoAutorizado es igual al presupuesto (borde inclusivo RN-PA-01)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        repository={buildFakeArchivoRepository()}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/monto autorizado/i), '100000');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[AutorizacionFormValues]>(
      expect.objectContaining({ montoAutorizado: 100_000 }),
    );
  });

  it('permite guardar sin montoAutorizado (estado pendiente, sin error de monto)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        repository={buildFakeArchivoRepository()}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalled();
  });

  it('acepta una vigenciaDesde anterior a la fecha de respuesta (carga retroactiva, RN-PA-02) sin bloquear', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        repository={buildFakeArchivoRepository()}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/fecha de respuesta/i), '2026-04-01');
    await user.type(screen.getByLabelText(/vigencia desde/i), '2026-01-01');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[AutorizacionFormValues]>(
      expect.objectContaining({ fechaRespuesta: '2026-04-01', vigenciaDesde: '2026-01-01' }),
    );
  });

  // integracion-documentos-autorizaciones (tasks.md 4.3, design.md D3, spec autorizacion-gestion
  // Scenario "El archivo adjunto se guarda en el servidor"): el cartel de "un solo archivo" (D13#1,
  // discrepancia real con el patrón multi-doc que asumía CHANGES.md) se conserva, pero la parte de
  // "todavía no se guarda en el servidor" se retira — ya no es cierto, el archivo se sube de verdad.
  it('el cartel de archivo único ya NO avisa que el archivo todavía no se guarda en el servidor', () => {
    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        repository={buildFakeArchivoRepository()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const notas = screen.getAllByRole('note');
    const cartel = notas.find((n) => /un solo archivo/i.test(n.textContent ?? ''));
    if (!cartel) throw new Error('No se encontró el cartel de archivo único (tasks.md 4.3)');
    expect(cartel).not.toHaveTextContent(/todavía no se guarda en el servidor/i);
  });

  // tasks.md 5.3, design.md D13#6: el cartel preexistente decía "pendiente de confirmar con
  // backend" para montoAutorizado/vigenciaDesde — ya no es cierto, son columnas reales desde
  // `C-06`. Se actualiza el texto (se retira "pendiente de confirmar") pero se conserva la parte
  // vigente: el docx no modela estos campos.
  it('muestra un cartel actualizado de montoAutorizado/vigenciaDesde que ya NO dice "pendiente de confirmar" (D13#6)', () => {
    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        repository={buildFakeArchivoRepository()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const notas = screen.getAllByRole('note');
    const cartel = notas.find((n) => /monto autorizado/i.test(n.textContent ?? '') && /vigencia/i.test(n.textContent ?? ''));
    if (!cartel) throw new Error('No se encontró el cartel de montoAutorizado/vigenciaDesde (tasks.md 5.3)');
    expect(cartel).toHaveTextContent(/no existen en el docx/i);
    expect(cartel).toHaveTextContent(/columnas reales/i);
    expect(cartel).toHaveTextContent(/c-06/i);
    expect(cartel).not.toHaveTextContent(/pendiente de confirmar/i);
  });

  // tasks.md 5.5: conteo explícito para confirmar que la migración del bloque hand-rolled a
  // AvisoModeloDatos no duplicó ni perdió ningún cartel — quedan exactamente 2 (archivo;
  // montoAutorizado+vigenciaDesde agrupados), no 3 como en el bloque viejo campo-por-campo.
  // tasks.md 9.3 sumó un TERCER cartel (vigenciaHasta/conDependencia/archivoTipoMime, Discrepancias
  // 2/3/5 del design de `presupuestos-vigencia-datos-traslado-vista-previa`) — el conteo pasa a 3.
  it('muestra exactamente 3 carteles de discrepancia (archivo; montoAutorizado+vigenciaDesde; vigenciaHasta+conDependencia+tipoMime)', () => {
    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        repository={buildFakeArchivoRepository()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('note')).toHaveLength(3);
  });

  // Triangulación: los 3 carteles se mantienen sin duplicarse también en modo edición, con
  // montoAutorizado/vigenciaDesde ya precargados desde una autorización existente.
  it('mantiene exactamente 3 carteles en modo edición con montoAutorizado/vigenciaDesde precargados', () => {
    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        initial={{ estado: 'autorizada', montoAutorizado: 90_000, vigenciaDesde: '2026-01-01' }}
        repository={buildFakeArchivoRepository()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const notas = screen.getAllByRole('note');
    expect(notas).toHaveLength(3);
    const cartelCampos = notas.find((n) => /vigencia/i.test(n.textContent ?? ''));
    if (!cartelCampos) throw new Error('No se encontró el cartel de montoAutorizado/vigenciaDesde');
    expect(cartelCampos).not.toHaveTextContent(/pendiente de confirmar/i);
  });

  // tasks.md 9.3, design.md §Discrepancias #2/#3/#5: `vigenciaHasta` (autorización),
  // `conDependencia` y `archivo_tipo_mime` son campos nuevos de este change, ninguno está en el
  // docx original. `PresupuestoForm` ya tenía sus carteles equivalentes desde la Fase 8;
  // `AutorizacionForm` no los tenía — este cartel cierra ese hueco.
  it('muestra el AvisoModeloDatos de vigenciaHasta/conDependencia/archivoTipoMime (Discrepancias 2/3/5, tasks.md 9.3)', () => {
    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        repository={buildFakeArchivoRepository()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const notas = screen.getAllByRole('note');
    const cartel = notas.find(
      (n) => /con dependencia/i.test(n.textContent ?? '') && /tipo de archivo/i.test(n.textContent ?? ''),
    );
    if (!cartel) throw new Error('No se encontró el cartel de vigenciaHasta/conDependencia/tipoMime (tasks.md 9.3)');
    expect(cartel).toHaveTextContent(/docx/i);
  });

  it('el input de archivo es de un único archivo, no un checklist', () => {
    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        repository={buildFakeArchivoRepository()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/^archivo$/i) as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.multiple).toBe(false);
  });

  it('los campos de cupo mensual de días/km son editables y se envían en el submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        repository={buildFakeArchivoRepository()}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/cupo mensual de días/i), '20');
    await user.type(screen.getByLabelText(/cupo mensual de.*km/i), '600');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[AutorizacionFormValues]>(
      expect.objectContaining({ cupoMensualDias: 20, cupoMensualKm: 600 }),
    );
  });

  it('precarga los valores iniciales en modo edición', () => {
    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        initial={{
          estado: 'autorizada',
          montoAutorizado: 90_000,
          cupoMensualDias: 20,
          cupoMensualKm: 600,
          fechaRespuesta: '2026-04-01',
          vigenciaDesde: '2026-01-01',
        }}
        repository={buildFakeArchivoRepository()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^estado$/i)).toHaveValue('autorizada');
    expect(screen.getByLabelText(/monto autorizado/i)).toHaveValue(90_000);
    expect(screen.getByLabelText(/vigencia desde/i)).toHaveValue('2026-01-01');
  });

  it('dispara onCancel al hacer click en Cancelar', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        repository={buildFakeArchivoRepository()}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// Gateo de escritura (gateo-facturacion, tasks.md 3.2/3.3, design.md D3/D6). Mismo criterio que
// PresupuestoForm: un solo envoltorio sobre el bloque de campos, Guardar declara
// `requiereEscritura`, Cancelar queda fuera y sigue operativo.
describe('AutorizacionForm — gateo de escritura', () => {
  it('sin permiso de escritura: ningún campo acepta entrada y Guardar no se puede activar, sin escrituras al repositorio', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderConPermiso(
      false,
      <AutorizacionForm
        montoPresupuesto={100_000}
        repository={buildFakeArchivoRepository()}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^estado$/i)).toBeDisabled();
    expect(screen.getByLabelText(/monto autorizado/i)).toBeDisabled();
    expect(screen.getByLabelText(/cupo mensual de días/i)).toBeDisabled();
    expect(screen.getByLabelText(/cupo mensual de.*km/i)).toBeDisabled();
    expect(screen.getByLabelText(/fecha de respuesta/i)).toBeDisabled();
    expect(screen.getByLabelText(/vigencia desde/i)).toBeDisabled();

    const guardar = screen.getByRole('button', { name: /guardar/i });
    expect(guardar).toBeDisabled();
    await user.click(guardar);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('con permiso de escritura: todo operativo y los datos ya cargados siguen siendo legibles (triangulación)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderConPermiso(
      true,
      <AutorizacionForm
        montoPresupuesto={100_000}
        initial={{ estado: 'autorizada', montoAutorizado: 90_000 }}
        repository={buildFakeArchivoRepository()}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^estado$/i)).toBeEnabled();
    expect(screen.getByLabelText(/^estado$/i)).toHaveValue('autorizada');
    expect(screen.getByLabelText(/monto autorizado/i)).toHaveValue(90_000);

    await user.click(screen.getByRole('button', { name: /guardar/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('sin permiso de escritura: Cancelar sigue activable y dispara onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    renderConPermiso(
      false,
      <AutorizacionForm
        montoPresupuesto={100_000}
        repository={buildFakeArchivoRepository()}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    );

    const cancelar = screen.getByRole('button', { name: /cancelar/i });
    expect(cancelar).toBeEnabled();
    await user.click(cancelar);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// integracion-documentos-autorizaciones (tasks.md 4.1/4.2, design.md D3/D5, spec
// autorizacion-archivo-storage): el archivo sube DIRECTO al elegirlo — vía
// repository.uploadArchivo(autorizacionId, file) —, independiente del botón "Guardar respuesta"
// de los campos planos. Retiene el `File` real (nunca fabrica nombre/fecha desde el navegador); el
// nombre/fecha mostrados son siempre los que devuelve el repository (server-side reales).
describe('AutorizacionForm — subida real del archivo (integracion-documentos-autorizaciones)', () => {
  function archivoPdf(nombre = 'informe.pdf'): File {
    return new File(['contenido'], nombre, { type: 'application/pdf' });
  }

  function autorizacionConArchivo(overrides: Partial<Autorizacion> = {}): Autorizacion {
    return {
      id: 'autorizacion-1',
      presupuestoId: 'presupuesto-1',
      estado: 'pendiente',
      archivo: { nombre: 'informe.pdf', cargadoEn: '2026-08-18T12:00:00.000Z', clave: 'autorizacion-1/uuid-informe.pdf' },
      ...overrides,
    };
  }

  it('al elegir un archivo válido, llama a repository.uploadArchivo con el id de la autorización y muestra el nombre/fecha reales devueltos', async () => {
    const user = userEvent.setup();
    const actualizada = autorizacionConArchivo();
    const uploadArchivo = vi.fn().mockResolvedValue(actualizada);

    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        autorizacionId="autorizacion-1"
        repository={buildFakeArchivoRepository({ uploadArchivo })}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/^archivo$/i);
    await user.upload(input, archivoPdf());

    expect(uploadArchivo).toHaveBeenCalledWith('autorizacion-1', expect.any(File));
    expect(await screen.findByText(/informe\.pdf/i)).toBeInTheDocument();
    // El nombre/fecha mostrados vienen del repository (server), NUNCA fabricados desde `File.name`
    // + fecha local del navegador (bug que este change corrige, design.md D4).
    expect(screen.getByText(/cargado 2026-08-18/i)).toBeInTheDocument();
  });

  // Triangulación: id/archivo distintos al caso anterior — confirma que no hay un valor
  // hardcodeado y que la respuesta real del servidor (no el `File.name` elegido) es lo que se
  // muestra.
  it('con otra autorización y otro archivo, llama con esos argumentos distintos y refleja el nombre/fecha que devuelve el servidor, no el del File elegido', async () => {
    const user = userEvent.setup();
    const actualizada = autorizacionConArchivo({
      id: 'autorizacion-2',
      archivo: { nombre: 'nombre-normalizado-por-el-servidor.pdf', cargadoEn: '2026-08-20T09:30:00.000Z', clave: 'autorizacion-2/uuid-x.pdf' },
    });
    const uploadArchivo = vi.fn().mockResolvedValue(actualizada);

    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        autorizacionId="autorizacion-2"
        repository={buildFakeArchivoRepository({ uploadArchivo })}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.upload(screen.getByLabelText(/^archivo$/i), archivoPdf('elegido-por-el-usuario.pdf'));

    expect(uploadArchivo).toHaveBeenCalledWith('autorizacion-2', expect.any(File));
    expect(await screen.findByText(/nombre-normalizado-por-el-servidor\.pdf/i)).toBeInTheDocument();
    expect(screen.queryByText(/elegido-por-el-usuario\.pdf/i)).not.toBeInTheDocument();
    expect(screen.getByText(/cargado 2026-08-20/i)).toBeInTheDocument();
  });

  it('mientras la subida está pendiente, muestra un estado de "Subiendo…"', async () => {
    const user = userEvent.setup();
    let resolverUpload!: (value: Autorizacion) => void;
    const uploadArchivo = vi.fn(
      () =>
        new Promise<Autorizacion>((resolve) => {
          resolverUpload = resolve;
        }),
    );

    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        autorizacionId="autorizacion-1"
        repository={buildFakeArchivoRepository({ uploadArchivo })}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.upload(screen.getByLabelText(/^archivo$/i), archivoPdf());

    expect(await screen.findByText(/subiendo/i)).toBeInTheDocument();

    resolverUpload(autorizacionConArchivo());
    await waitFor(() => expect(screen.queryByText(/subiendo/i)).not.toBeInTheDocument());
  });

  it('si la subida falla, muestra el error del repository (castellano) y no cambia el archivo mostrado', async () => {
    const user = userEvent.setup();
    const uploadArchivo = vi.fn().mockRejectedValue(new Error('El archivo debe ser PDF, JPG o PNG.'));

    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        autorizacionId="autorizacion-1"
        initial={{ estado: 'pendiente' }}
        repository={buildFakeArchivoRepository({ uploadArchivo })}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.upload(screen.getByLabelText(/^archivo$/i), archivoPdf());

    expect(await screen.findByText('El archivo debe ser PDF, JPG o PNG.')).toBeInTheDocument();
    expect(screen.queryByText(/cargado/i)).not.toBeInTheDocument();
  });

  it('sin autorizacionId (alta sin fila creada todavía), no llama a uploadArchivo y avisa que hay que guardar primero', async () => {
    const user = userEvent.setup();
    const uploadArchivo = vi.fn();

    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        repository={buildFakeArchivoRepository({ uploadArchivo })}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.upload(screen.getByLabelText(/^archivo$/i), archivoPdf());

    expect(uploadArchivo).not.toHaveBeenCalled();
    expect(await screen.findByText(/guardá la autorización antes de adjuntar un archivo/i)).toBeInTheDocument();
  });

  it('con un archivo ya cargado, ofrece "Quitar archivo"; al confirmar llama a removeArchivo y deja de mostrarse', async () => {
    const user = userEvent.setup();
    const sinArchivo: Autorizacion = { id: 'autorizacion-1', presupuestoId: 'presupuesto-1', estado: 'pendiente' };
    const removeArchivo = vi.fn().mockResolvedValue(sinArchivo);

    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        autorizacionId="autorizacion-1"
        initial={{ estado: 'pendiente', archivo: { nombre: 'informe.pdf', cargadoEn: '2026-08-18T12:00:00.000Z', clave: 'autorizacion-1/uuid-informe.pdf' } }}
        repository={buildFakeArchivoRepository({ removeArchivo })}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/informe\.pdf/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /quitar archivo/i }));

    expect(removeArchivo).toHaveBeenCalledWith('autorizacion-1');
    await waitFor(() => expect(screen.queryByText(/informe\.pdf/i)).not.toBeInTheDocument());
  });

  it('si quitar el archivo falla, muestra el error y conserva el archivo mostrado (no lo borra de forma optimista)', async () => {
    const user = userEvent.setup();
    const removeArchivo = vi.fn().mockRejectedValue(new Error('No se pudo quitar el archivo.'));

    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        autorizacionId="autorizacion-1"
        initial={{ estado: 'pendiente', archivo: { nombre: 'informe.pdf', cargadoEn: '2026-08-18T12:00:00.000Z', clave: 'autorizacion-1/uuid-informe.pdf' } }}
        repository={buildFakeArchivoRepository({ removeArchivo })}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /quitar archivo/i }));

    expect(await screen.findByText('No se pudo quitar el archivo.')).toBeInTheDocument();
    expect(screen.getByText(/informe\.pdf/i)).toBeInTheDocument();
  });

  it('sin archivo cargado, no ofrece el botón "Quitar archivo"', () => {
    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        autorizacionId="autorizacion-1"
        repository={buildFakeArchivoRepository()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /quitar archivo/i })).not.toBeInTheDocument();
  });
});

// presupuestos-vigencia-datos-traslado-vista-previa (tasks.md 7.8/7.10, design.md D6b, spec
// `autorizacion-archivo-vista-previa`): "Ver documento" resuelve la URL `inline` y abre el Overlay
// con VistaPreviaArchivo; una vez resuelta, aparece además un <a target="_blank"> a esa misma URL
// para "abrir en otra pestaña".
describe('AutorizacionForm — vista previa del documento adjunto (tasks.md 7.8/7.10, design.md D6b)', () => {
  function autorizacionConArchivoPdf(): { nombre: string; cargadoEn: string; clave: string; tipoMime: string } {
    return { nombre: 'informe.pdf', cargadoEn: '2026-08-18T12:00:00.000Z', clave: 'autorizacion-1/uuid-informe.pdf', tipoMime: 'application/pdf' };
  }

  it('sin archivo cargado, no ofrece el botón "Ver documento"', () => {
    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        autorizacionId="autorizacion-1"
        repository={buildFakeArchivoRepository()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /ver documento/i })).not.toBeInTheDocument();
  });

  it('clickear "Ver documento" llama a getUrlArchivo(id, \'inline\') y abre el Overlay con la vista previa resuelta', async () => {
    const user = userEvent.setup();
    const getUrlArchivo = vi.fn().mockResolvedValue('https://storage.example/informe.pdf?signed=1');

    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        autorizacionId="autorizacion-1"
        initial={{ estado: 'pendiente', archivo: autorizacionConArchivoPdf() }}
        repository={buildFakeArchivoRepository({ getUrlArchivo })}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /ver documento/i }));

    expect(getUrlArchivo).toHaveBeenCalledWith('autorizacion-1', 'inline');
    const pdfPreview = await screen.findByTestId('pdf-preview-stub');
    expect(pdfPreview).toHaveAttribute('data-url', 'https://storage.example/informe.pdf?signed=1');
    expect(pdfPreview).toHaveAttribute('data-nombre-archivo', 'informe.pdf');
  });

  it('con la vista previa resuelta, ofrece un <a target="_blank" rel="noopener noreferrer"> a la misma URL inline para abrir en otra pestaña', async () => {
    const user = userEvent.setup();
    const getUrlArchivo = vi.fn().mockResolvedValue('https://storage.example/informe.pdf?signed=1');

    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        autorizacionId="autorizacion-1"
        initial={{ estado: 'pendiente', archivo: autorizacionConArchivoPdf() }}
        repository={buildFakeArchivoRepository({ getUrlArchivo })}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /ver documento/i }));

    const abrirEnPestana = await screen.findByRole('link', { name: /abrir en otra pestaña/i });
    expect(abrirEnPestana).toHaveAttribute('href', 'https://storage.example/informe.pdf?signed=1');
    expect(abrirEnPestana).toHaveAttribute('target', '_blank');
    expect(abrirEnPestana).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('mientras resuelve, muestra el estado de carga dentro del Overlay (sin <a> "Abrir en otra pestaña" todavía)', async () => {
    const user = userEvent.setup();
    let resolverUrl!: (value: string) => void;
    const getUrlArchivo = vi.fn(() => new Promise<string>((resolve) => { resolverUrl = resolve; }));

    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        autorizacionId="autorizacion-1"
        initial={{ estado: 'pendiente', archivo: autorizacionConArchivoPdf() }}
        repository={buildFakeArchivoRepository({ getUrlArchivo })}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /ver documento/i }));

    expect(await screen.findByText(/cargando previsualización/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /abrir en otra pestaña/i })).not.toBeInTheDocument();

    resolverUrl('https://storage.example/informe.pdf?signed=1');
    await waitFor(() => expect(screen.queryByText(/cargando previsualización/i)).not.toBeInTheDocument());
    expect(await screen.findByRole('link', { name: /abrir en otra pestaña/i })).toBeInTheDocument();
  });

  it('si getUrlArchivo rechaza, muestra el mensaje de error de la vista previa (nunca el crudo)', async () => {
    const user = userEvent.setup();
    const getUrlArchivo = vi.fn().mockRejectedValue(new Error('No tenés permiso para ver el archivo de la autorización.'));

    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        autorizacionId="autorizacion-1"
        initial={{ estado: 'pendiente', archivo: autorizacionConArchivoPdf() }}
        repository={buildFakeArchivoRepository({ getUrlArchivo })}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /ver documento/i }));

    expect(await screen.findByText(/no se pudo cargar la previsualización/i)).toBeInTheDocument();
  });
});

// presupuestos-vigencia-datos-traslado-vista-previa, tasks.md 8.6/8.8, design.md D1/D3.
describe('AutorizacionForm — vigenciaHasta y CD/SD desmarcable (tasks.md 8.8)', () => {
  it('muestra el campo "Vigencia hasta" junto a "Vigencia desde"', () => {
    render(
      <AutorizacionForm montoPresupuesto={100_000} repository={buildFakeArchivoRepository()} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByLabelText(/vigencia desde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/vigencia hasta/i)).toBeInTheDocument();
  });

  it('el checkbox CD/SD arranca desmarcado sin presupuestoConDependencia', () => {
    render(
      <AutorizacionForm montoPresupuesto={100_000} repository={buildFakeArchivoRepository()} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByRole('checkbox', { name: /con dependencia/i })).not.toBeChecked();
  });

  it('en alta, con presupuestoConDependencia=true: el checkbox arranca marcado, pero SIGUE siendo desmarcable', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        presupuestoConDependencia={true}
        repository={buildFakeArchivoRepository()}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    const checkbox = screen.getByRole('checkbox', { name: /con dependencia/i });
    expect(checkbox).toBeChecked();
    expect(checkbox).not.toBeDisabled();

    // Requisito literal de la usuaria: "lo carga ella, pero la obra social puede denegarlo".
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: /guardar/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ conDependencia: false }));
  });

  it('en edición, el checkbox usa el valor YA persistido de la autorización, no se re-deriva del presupuesto', () => {
    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        presupuestoConDependencia={true}
        initial={{ estado: 'autorizada', conDependencia: false }}
        repository={buildFakeArchivoRepository()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // El presupuesto pide CD (true) pero la autorización YA registró SD (false) — no se pisa.
    expect(screen.getByRole('checkbox', { name: /con dependencia/i })).not.toBeChecked();
  });

  it('vigencia autorizada dentro del período pedido: guarda sin error', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        presupuestoVigenciaDesde="2026-02-01"
        presupuestoVigenciaHasta="2027-01-31"
        repository={buildFakeArchivoRepository()}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/vigencia desde/i), '2026-02-01');
    await user.type(screen.getByLabelText(/vigencia hasta/i), '2026-08-31');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ vigenciaDesde: '2026-02-01', vigenciaHasta: '2026-08-31' }),
    );
  });

  it('vigenciaHasta autorizada excede la del presupuesto: bloquea el guardado con un mensaje que distingue el caso de RN-PA-01', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        presupuestoVigenciaHasta="2027-01-31"
        repository={buildFakeArchivoRepository()}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/vigencia hasta/i), '2027-06-30');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/período autorizado no puede exceder/i)).toBeInTheDocument();
  });
});

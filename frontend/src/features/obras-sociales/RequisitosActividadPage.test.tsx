import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import type { RequisitosActividadRepository, RequisitosPorTipo } from '../../shared/lib/requisitosActividad/RequisitosActividadRepository';
import { RequisitosActividadPage } from './RequisitosActividadPage';

// documentos-checklist-items-por-actividad (tasks.md 5.4, capability checklist-por-tipo-actividad):
// alta, baja, marcar requerido, modo solo-lectura. Mismo criterio de test double que
// `PacienteDocumentos.test.tsx` (`buildObraSocialRepository`) — un stub tipado, no un mock global.
//
// `ChecklistEditor` (reusado tal cual, sin tocar) muestra cada nombre de ítem DOS veces — en la
// columna "Configuración" y en la "Vista previa" — por eso los asserts de nombre usan
// `getAllByText`/`getAllByRole` en vez de la variante singular, salvo cuando se puede escopar con
// `within` a un contenedor puntual (el tab, el checkbox por `aria-label`).

function buildRepository(overrides: Partial<RequisitosActividadRepository> = {}): RequisitosActividadRepository {
  return {
    listAll: vi.fn().mockResolvedValue({}),
    actualizar: vi.fn().mockImplementation((_tipo, items) => Promise.resolve(items)),
    ...overrides,
  };
}

function renderConPermiso(puedeEscribir: boolean, repository: RequisitosActividadRepository) {
  return render(
    <PuedeEscribirContext.Provider value={puedeEscribir}>
      <RequisitosActividadPage repository={repository} />
    </PuedeEscribirContext.Provider>,
  );
}

// El nombre accesible del tab incluye el Chip de cantidad cuando hay ítems configurados ("Escuela
// 2"), así que el anchor no puede exigir fin de string estricto — pero sí debe excluir "Escuela
// Especial" (mismo prefijo). `(\s+\d+)?$` acepta un sufijo numérico opcional, nada más.
async function tabEscuela() {
  return screen.findByRole('tab', { name: /^escuela\d*$/i });
}

describe('RequisitosActividadPage', () => {
  it('mientras carga, muestra un estado de carga', () => {
    const repository = buildRepository({ listAll: vi.fn(() => new Promise<RequisitosPorTipo>(() => {})) });

    renderConPermiso(true, repository);

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('arranca en el tipo "escuela" y muestra sus ítems ya configurados', async () => {
    const repository = buildRepository({
      listAll: vi.fn().mockResolvedValue({ escuela: [{ id: 't-1', nombre: 'Constancia de alumno regular', requerido: true }] }),
    });

    renderConPermiso(true, repository);

    expect((await screen.findAllByText('Constancia de alumno regular')).length).toBeGreaterThan(0);
  });

  it('cambiar de tab muestra la lista del tipo seleccionado, no la del anterior', async () => {
    const user = userEvent.setup();
    const repository = buildRepository({
      listAll: vi.fn().mockResolvedValue({
        escuela: [{ id: 't-1', nombre: 'Constancia', requerido: true }],
        terapia: [{ id: 't-2', nombre: 'Orden médica', requerido: true }],
      }),
    });

    renderConPermiso(true, repository);

    expect((await screen.findAllByText('Constancia')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Orden médica')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^terapia\d*$/i }));

    expect((await screen.findAllByText('Orden médica')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Constancia')).not.toBeInTheDocument();
  });

  it('alta: agregar un ítem lo persiste vía repository.actualizar con el tipo seleccionado', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockImplementation((_tipo, items) => Promise.resolve(items));
    const repository = buildRepository({ listAll: vi.fn().mockResolvedValue({}), actualizar });

    renderConPermiso(true, repository);
    await tabEscuela();

    await user.type(screen.getByLabelText(/nuevo ítem/i), 'Certificado de alumno regular');
    await user.click(screen.getByRole('button', { name: /^\+ agregar$/i }));

    await waitFor(() =>
      expect(actualizar).toHaveBeenCalledWith('escuela', [
        expect.objectContaining({ nombre: 'Certificado de alumno regular', requerido: true }),
      ]),
    );
    expect((await screen.findAllByText('Certificado de alumno regular')).length).toBeGreaterThan(0);
  });

  it('baja: quitar un ítem lo persiste sin él', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockImplementation((_tipo, items) => Promise.resolve(items));
    const repository = buildRepository({
      listAll: vi.fn().mockResolvedValue({ escuela: [{ id: 't-1', nombre: 'Constancia', requerido: true }] }),
      actualizar,
    });

    renderConPermiso(true, repository);
    await screen.findAllByText('Constancia');

    await user.click(screen.getByRole('button', { name: /quitar constancia/i }));

    await waitFor(() => expect(actualizar).toHaveBeenCalledWith('escuela', []));
  });

  it('marcar requerido: alterna el flag y lo persiste', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockImplementation((_tipo, items) => Promise.resolve(items));
    const repository = buildRepository({
      listAll: vi.fn().mockResolvedValue({ escuela: [{ id: 't-1', nombre: 'Constancia', requerido: true }] }),
      actualizar,
    });

    renderConPermiso(true, repository);
    await screen.findAllByText('Constancia');

    const checkbox = screen.getByRole('checkbox', { name: /requerido — constancia/i });
    await user.click(checkbox);

    await waitFor(() =>
      expect(actualizar).toHaveBeenCalledWith('escuela', [expect.objectContaining({ id: 't-1', requerido: false })]),
    );
  });

  it('sin permiso de escritura: los controles de alta/baja/reorden quedan deshabilitados, pero la lista sigue siendo consultable', async () => {
    const repository = buildRepository({
      listAll: vi.fn().mockResolvedValue({ escuela: [{ id: 't-1', nombre: 'Constancia', requerido: true }] }),
    });

    renderConPermiso(false, repository);

    expect((await screen.findAllByText('Constancia')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /^\+ agregar$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /quitar constancia/i })).toBeDisabled();
    expect(screen.getByText(/modo solo lectura/i)).toBeInTheDocument();
  });

  it('muestra el aviso del catálogo compartido (heredado de ChecklistEditor) y el aviso propio de "global por tipo"', async () => {
    const repository = buildRepository();

    renderConPermiso(true, repository);
    await tabEscuela();

    expect(screen.getByText(/catálogo de tipos de documento compartido/i)).toBeInTheDocument();
    expect(screen.getByText(/global por tipo de actividad/i)).toBeInTheDocument();
  });

  it('si falla el guardado, revierte el cambio optimista y muestra el error', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockRejectedValue(new Error('No tenés permiso para modificar la documentación por tipo de actividad.'));
    const repository = buildRepository({ listAll: vi.fn().mockResolvedValue({}), actualizar });

    renderConPermiso(true, repository);
    await tabEscuela();

    await user.type(screen.getByLabelText(/nuevo ítem/i), 'Constancia');
    await user.click(screen.getByRole('button', { name: /^\+ agregar$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no tenés permiso/i);
    // El ítem que falló al guardar no queda visible tras el rollback optimista.
    await waitFor(() => expect(screen.queryByText('Constancia')).not.toBeInTheDocument());
  });

  it('la cantidad de ítems configurados se muestra como Chip en el tab', async () => {
    const repository = buildRepository({
      listAll: vi.fn().mockResolvedValue({
        escuela: [
          { id: 't-1', nombre: 'Constancia', requerido: true },
          { id: 't-2', nombre: 'CBU', requerido: false },
        ],
      }),
    });

    renderConPermiso(true, repository);

    const tab = await tabEscuela();
    expect(within(tab).getByText('2')).toBeInTheDocument();
  });
});

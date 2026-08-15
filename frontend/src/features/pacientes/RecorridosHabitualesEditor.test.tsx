import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../../shared/auth/AuthContext';
import { createMockAuthRepository, type MockAuthRepositoryOptions } from '../../shared/lib/auth/mockAuthRepository';
import type { RecorridoHabitualRepository } from '../../shared/lib/pacientes/RecorridoHabitualRepository';
import type { Direccion } from '../../shared/types/paciente';
import type { RecorridoHabitual } from '../../shared/types/recorridoHabitual';
import { RecorridosHabitualesEditor } from './RecorridosHabitualesEditor';

// RF-110: alta/lista/baja de destinos habituales. Repository fake tipado (sin `any`, sin `as`)
// que cumple RecorridoHabitualRepository al pie de la letra — mismo criterio que el resto del
// repo para componentes con repository propio.

function fakeRepository(overrides: Partial<RecorridoHabitualRepository> = {}): RecorridoHabitualRepository {
  return {
    list: async () => [],
    create: async (data) => ({ ...data, id: 'nuevo-id' }),
    remove: async () => undefined,
    ...overrides,
  };
}

const direccionDomicilio: Direccion = { id: 'd-1', tipo: 'domicilio', calle: 'Av. Siempreviva 742', localidad: 'CABA' };
const direccionEscuela: Direccion = { id: 'd-2', tipo: 'escuela', calle: 'Belgrano 100', localidad: 'CABA' };

function wrapperCon(opciones: MockAuthRepositoryOptions) {
  const repository = createMockAuthRepository(opciones);
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <AuthProvider repository={repository}>{children}</AuthProvider>;
  };
}

describe('RecorridosHabitualesEditor', () => {
  it('muestra "Cargando…" mientras resuelve list()', () => {
    render(
      <RecorridosHabitualesEditor
        pacienteId="p-1"
        direcciones={[direccionDomicilio, direccionEscuela]}
        repository={fakeRepository({ list: () => new Promise(() => {}) })}
      />,
    );

    expect(screen.getByText(/cargando destinos habituales/i)).toBeInTheDocument();
  });

  it('paciente sin recorridos -> estado vacío, sin lanzar', async () => {
    render(
      <RecorridosHabitualesEditor
        pacienteId="p-1"
        direcciones={[direccionDomicilio, direccionEscuela]}
        repository={fakeRepository({ list: async () => [] })}
      />,
    );

    expect(await screen.findByText(/no hay destinos habituales/i)).toBeInTheDocument();
  });

  it('sin al menos 2 direcciones cargadas, el form de alta queda bloqueado con una explicación', async () => {
    render(
      <RecorridosHabitualesEditor pacienteId="p-1" direcciones={[direccionDomicilio]} repository={fakeRepository()} />,
    );

    expect(await screen.findByText(/necesita al menos 2 direcciones/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /agregar destino habitual/i })).not.toBeInTheDocument();
  });

  it('lista los recorridos existentes por dirección inicial/final, día y hora', async () => {
    const recorrido: RecorridoHabitual = {
      id: 'r-1',
      pacienteId: 'p-1',
      direccionInicialId: 'd-1',
      direccionFinalId: 'd-2',
      diaSemana: 'lunes',
      hora: '08:30',
    };
    render(
      <RecorridosHabitualesEditor
        pacienteId="p-1"
        direcciones={[direccionDomicilio, direccionEscuela]}
        repository={fakeRepository({ list: async () => [recorrido] })}
      />,
    );

    expect(await screen.findByText(/Lunes, 08:30/)).toBeInTheDocument();
    expect(screen.getByText(/Domicilio.*Escuela/)).toBeInTheDocument();
  });

  it('un error de list() se muestra traducido, sin romper la pantalla', async () => {
    render(
      <RecorridosHabitualesEditor
        pacienteId="p-1"
        direcciones={[direccionDomicilio, direccionEscuela]}
        repository={fakeRepository({ list: async () => { throw new Error('No se pudieron cargar los destinos habituales.'); } })}
      />,
    );

    expect(await screen.findByText('No se pudieron cargar los destinos habituales.')).toBeInTheDocument();
  });

  it('alta con día/hora válidos: llama a create() y agrega el destino a la lista', async () => {
    const create = vi.fn(async (data: Parameters<RecorridoHabitualRepository['create']>[0]) => ({
      ...data,
      id: 'nuevo-id',
    }));
    render(
      <RecorridosHabitualesEditor
        pacienteId="p-1"
        direcciones={[direccionDomicilio, direccionEscuela]}
        repository={fakeRepository({ list: async () => [], create })}
      />,
    );

    await screen.findByText(/no hay destinos habituales/i);

    await userEvent.selectOptions(screen.getByLabelText(/dirección inicial/i), 'd-1');
    await userEvent.selectOptions(screen.getByLabelText(/dirección final/i), 'd-2');
    await userEvent.selectOptions(screen.getByLabelText(/día de la semana/i), 'martes');
    fireEvent.change(screen.getByLabelText(/hora/i), { target: { value: '09:15' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar destino habitual/i }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith({
      pacienteId: 'p-1',
      direccionInicialId: 'd-1',
      direccionFinalId: 'd-2',
      diaSemana: 'martes',
      hora: '09:15',
    });
    expect(await screen.findByText(/Martes, 09:15/)).toBeInTheDocument();
  });

  it('un create() sin dirección/hora elegida no llama al repository (validación mínima)', async () => {
    const create = vi.fn(fakeRepository().create);
    render(
      <RecorridosHabitualesEditor
        pacienteId="p-1"
        direcciones={[direccionDomicilio, direccionEscuela]}
        repository={fakeRepository({ list: async () => [], create })}
      />,
    );

    await screen.findByText(/no hay destinos habituales/i);
    await userEvent.click(screen.getByRole('button', { name: /agregar destino habitual/i }));

    expect(create).not.toHaveBeenCalled();
  });

  it('un error de create() (23503, FK) se muestra traducido, sin agregar el destino a la lista', async () => {
    render(
      <RecorridosHabitualesEditor
        pacienteId="p-1"
        direcciones={[direccionDomicilio, direccionEscuela]}
        repository={fakeRepository({
          list: async () => [],
          create: async () => {
            throw new Error('Una de las direcciones elegidas ya no existe. Actualizá la lista de direcciones e intentá de nuevo.');
          },
        })}
      />,
    );

    await screen.findByText(/no hay destinos habituales/i);
    await userEvent.selectOptions(screen.getByLabelText(/dirección inicial/i), 'd-1');
    await userEvent.selectOptions(screen.getByLabelText(/dirección final/i), 'd-2');
    fireEvent.change(screen.getByLabelText(/hora/i), { target: { value: '09:15' } });
    await userEvent.click(screen.getByRole('button', { name: /agregar destino habitual/i }));

    expect(
      await screen.findByText('Una de las direcciones elegidas ya no existe. Actualizá la lista de direcciones e intentá de nuevo.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/no hay destinos habituales/i)).toBeInTheDocument();
  });

  it('baja: "Quitar" llama a remove() y saca el destino de la lista', async () => {
    const recorrido: RecorridoHabitual = {
      id: 'r-1',
      pacienteId: 'p-1',
      direccionInicialId: 'd-1',
      direccionFinalId: 'd-2',
      diaSemana: 'lunes',
      hora: '08:30',
    };
    const remove = vi.fn(async () => undefined);
    render(
      <RecorridosHabitualesEditor
        pacienteId="p-1"
        direcciones={[direccionDomicilio, direccionEscuela]}
        repository={fakeRepository({ list: async () => [recorrido], remove })}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: /quitar destino habitual/i }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('r-1'));
    expect(await screen.findByText(/no hay destinos habituales/i)).toBeInTheDocument();
  });

  describe('gateo cruzado de módulo (hojas_de_ruta)', () => {
    it('sin permiso de escritura en hojas_de_ruta, el form y "Quitar" quedan deshabilitados', async () => {
      const recorrido: RecorridoHabitual = {
        id: 'r-1',
        pacienteId: 'p-1',
        direccionInicialId: 'd-1',
        direccionFinalId: 'd-2',
        diaSemana: 'lunes',
        hora: '08:30',
      };
      render(
        <RecorridosHabitualesEditor
          pacienteId="p-1"
          direcciones={[direccionDomicilio, direccionEscuela]}
          repository={fakeRepository({ list: async () => [recorrido] })}
        />,
        {
          wrapper: wrapperCon({
            usuario: { id: 'u1', nombre: 'Juan', apellido: 'Pérez', email: 'juan@x.com', rol: 'empleado' },
            permisos: { pacientes: 'write', hojas_de_ruta: 'read' },
          }),
        },
      );

      expect(await screen.findByRole('button', { name: /quitar destino habitual/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /agregar destino habitual/i })).toBeDisabled();
    });

    it('con permiso de escritura en hojas_de_ruta, el form queda habilitado aunque pacientes sea solo lectura', async () => {
      render(
        <RecorridosHabitualesEditor
          pacienteId="p-1"
          direcciones={[direccionDomicilio, direccionEscuela]}
          repository={fakeRepository({ list: async () => [] })}
        />,
        {
          wrapper: wrapperCon({
            usuario: { id: 'u1', nombre: 'Juan', apellido: 'Pérez', email: 'juan@x.com', rol: 'empleado' },
            permisos: { pacientes: 'read', hojas_de_ruta: 'write' },
          }),
        },
      );

      await screen.findByText(/no hay destinos habituales/i);
      expect(screen.getByRole('button', { name: /agregar destino habitual/i })).not.toBeDisabled();
    });
  });
});

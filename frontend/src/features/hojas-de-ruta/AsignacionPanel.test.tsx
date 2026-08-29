import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderConQuery } from '../../shared/test/queryWrapper';
import userEvent from '@testing-library/user-event';
import type { Paciente } from '../../shared/types/paciente';
import type { Recorrido } from '../../shared/types/hojaDeRuta';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { AsignacionPanel } from './AsignacionPanel';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return renderConQuery(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

// RN-VE-01 (accesorio incompatible) y capacidad de vehículo (tasks.md 5.3, 9.2): la asignación
// se bloquea en la UI con un mensaje visible y nunca llega a `onAgregar` (no se persiste).

const vehiculoConSillaPlegable: Vehiculo = {
  id: 'vehiculo-1',
  patente: 'AA111AA',
  modelo: 'Test',
  tipo: 'sedan',
  capacidad: 2,
  accesoriosCompatibles: ['silla-plegable'],
  estado: 'habilitado',
  kilometraje: 0,
  kilometrajeUltimoService: 0,
  fechaUltimoService: '2026-01-01',
  habilitaciones: [],
  gastos: [],
  mantenimientos: [],
};

function buildPaciente(overrides: Partial<Paciente> = {}): Paciente {
  return {
    id: 'paciente-1',
    apellido: 'Gómez',
    nombre: 'Martina',
    fechaNacimiento: '2015-01-01',
    dni: '1',
    cuilTitular: '20-1-1',
    diagnostico: 'Test',
    accesorioMovilidad: [],
    obraSocialId: null,
    numeroAfiliado: { valor: '1' },
    cud: null,
    direcciones: [
      { id: 'dir-ida', tipo: 'domicilio', calle: 'Calle 1', localidad: 'CABA' },
      { id: 'dir-vuelta', tipo: 'escuela', calle: 'Calle 2', localidad: 'CABA' },
    ],
    personasACargo: [],
    amparoJudicial: false,
    ...overrides,
  };
}

function buildRecorrido(overrides: Partial<Recorrido> = {}): Recorrido {
  return {
    id: 'recorrido-1',
    vehiculoId: 'vehiculo-1',
    conductorId: 'conductor-1',
    manual: false,
    paradas: [],
    ...overrides,
  };
}

describe('AsignacionPanel', () => {
  it('bloquea la asignación cuando el paciente requiere un accesorio incompatible con el vehículo (RN-VE-01)', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();
    const pacienteIncompatible = buildPaciente({
      id: 'paciente-incompatible',
      apellido: 'Pereyra',
      accesorioMovilidad: ['silla-rigida'],
    });

    renderConQuery(
      <AsignacionPanel
        recorrido={buildRecorrido()}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[pacienteIncompatible]}
        onAgregar={onAgregar}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-incompatible');
    await user.click(screen.getByRole('button', { name: /agregar pasajero/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/silla-rigida/i);
    expect(onAgregar).not.toHaveBeenCalled();
  });

  it('bloquea la asignación cuando el vehículo no tiene lugar disponible (capacidad)', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();
    const compatible = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });
    // Vehículo con capacidad 2 ya con 2 paradas: lleno.
    const recorridoLleno = buildRecorrido({
      paradas: [
        { id: 'p1', pacienteId: 'x', tramo: 'ida', direccionOrigenId: 'a', direccionDestinoId: 'b', orden: 0 },
        { id: 'p2', pacienteId: 'y', tramo: 'ida', direccionOrigenId: 'a', direccionDestinoId: 'b', orden: 1 },
      ],
    });

    renderConQuery(
      <AsignacionPanel
        recorrido={recorridoLleno}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[compatible]}
        onAgregar={onAgregar}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-1');
    await user.click(screen.getByRole('button', { name: /agregar pasajero/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/lugar|capacidad/i);
    expect(onAgregar).not.toHaveBeenCalled();
  });

  it('agrega la parada cuando el paciente es compatible y hay lugar disponible', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();
    const compatible = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });

    renderConQuery(
      <AsignacionPanel
        recorrido={buildRecorrido()}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[compatible]}
        onAgregar={onAgregar}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-1');
    await user.selectOptions(screen.getByLabelText(/dirección de origen/i), 'dir-ida');
    await user.selectOptions(screen.getByLabelText(/dirección de destino/i), 'dir-vuelta');
    await user.click(screen.getByRole('button', { name: /agregar pasajero/i }));

    expect(onAgregar).toHaveBeenCalledTimes(1);
    const parada = onAgregar.mock.calls[0]?.[0];
    expect(parada).toMatchObject({
      pacienteId: 'paciente-1',
      direccionOrigenId: 'dir-ida',
      direccionDestinoId: 'dir-vuelta',
      orden: 0,
    });
  });

  it('al elegir un paciente con accesorios, los muestra como chips (feedback de usuario: mismo formulario que Nuevo recorrido)', async () => {
    const conAccesorio = buildPaciente({ id: 'paciente-acc', apellido: 'Ledesma', accesorioMovilidad: ['silla-plegable'] });

    renderConQuery(
      <AsignacionPanel
        recorrido={buildRecorrido()}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[conAccesorio]}
        onAgregar={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/silla plegable/i).length).toBeGreaterThan(0);
  });

  it('permite cargar la hora estimada del tramo y la incluye en la parada creada', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();
    const compatible = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });

    renderConQuery(
      <AsignacionPanel
        recorrido={buildRecorrido()}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[compatible]}
        onAgregar={onAgregar}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-1');
    await user.type(screen.getByLabelText(/hora/i), '08:30');
    await user.click(screen.getByRole('button', { name: /agregar pasajero/i }));

    const parada = onAgregar.mock.calls[0]?.[0];
    expect(parada).toMatchObject({ horaEstimada: '08:30' });
  });

  it('sin hora cargada, la parada no lleva horaEstimada (borde)', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();
    const compatible = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });

    renderConQuery(
      <AsignacionPanel
        recorrido={buildRecorrido()}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[compatible]}
        onAgregar={onAgregar}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-1');
    await user.click(screen.getByRole('button', { name: /agregar pasajero/i }));

    const parada = onAgregar.mock.calls[0]?.[0];
    expect(parada.horaEstimada).toBeUndefined();
  });

  it('paciente sin accesorios de movilidad se acepta en cualquier vehículo (borde)', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();
    const sinAccesorios = buildPaciente({ accesorioMovilidad: [] });

    renderConQuery(
      <AsignacionPanel
        recorrido={buildRecorrido()}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[sinAccesorios]}
        onAgregar={onAgregar}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-1');
    await user.click(screen.getByRole('button', { name: /agregar pasajero/i }));

    expect(onAgregar).toHaveBeenCalledTimes(1);
  });

  // RN-HR-02 (feedback de usuario): ida y vuelta del mismo paciente conviven en el mismo
  // recorrido (ver dashboard-recorridos-del-dia spec y resumenDelDia.test.ts) — el bloqueo debe
  // ser SOLO el duplicado exacto (mismo paciente + mismo tramo ya cargado), nunca el paciente
  // entero.
  it('preselecciona el tramo que le falta al paciente elegido cuando ya tiene una parada en este recorrido', async () => {
    const user = userEvent.setup();
    const compatible = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });
    const recorridoConIdaCargada = buildRecorrido({
      paradas: [{ id: 'p-ida', pacienteId: 'paciente-1', tramo: 'ida', direccionOrigenId: 'a', direccionDestinoId: 'b', orden: 0 }],
    });

    renderConQuery(
      <AsignacionPanel
        recorrido={recorridoConIdaCargada}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[compatible]}
        onAgregar={vi.fn()}
      />,
    );

    // pacientes[0] ya viene preseleccionado (comportamiento previo) — el tramo debe arrancar en
    // "vuelta", no en "ida" (que ya está tomado).
    expect(screen.getByLabelText(/tramo/i)).toHaveValue('vuelta');

    // Reafirmar la misma elección disparando el onChange (mismo paciente ya seleccionado)
    // también debe mantener "vuelta" (triangulación del mismo camino, no solo el mount inicial).
    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-1');
    expect(screen.getByLabelText(/tramo/i)).toHaveValue('vuelta');
  });

  it('sugiere origen/destino invertidos (la vuelta natural) cuando el paciente ya tiene una parada en este recorrido', () => {
    const compatible = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });
    const recorridoConIdaCargada = buildRecorrido({
      // buildPaciente() usa 'dir-ida' y 'dir-vuelta' como ids de direcciones reales del paciente.
      paradas: [
        { id: 'p-ida', pacienteId: 'paciente-1', tramo: 'ida', direccionOrigenId: 'dir-ida', direccionDestinoId: 'dir-vuelta', orden: 0 },
      ],
    });

    renderConQuery(
      <AsignacionPanel
        recorrido={recorridoConIdaCargada}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[compatible]}
        onAgregar={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/dirección de origen/i)).toHaveValue('dir-vuelta');
    expect(screen.getByLabelText(/dirección de destino/i)).toHaveValue('dir-ida');
  });

  it('sin ninguna parada previa del paciente, origen/destino arrancan vacíos (borde, comportamiento previo)', async () => {
    const compatible = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });

    renderConQuery(
      <AsignacionPanel recorrido={buildRecorrido()} vehiculo={vehiculoConSillaPlegable} pacientes={[compatible]} onAgregar={vi.fn()} />,
    );

    expect(screen.getByLabelText(/dirección de origen/i)).toHaveValue('');
    expect(screen.getByLabelText(/dirección de destino/i)).toHaveValue('');
  });

  it('bloquea agregar una parada con el mismo tramo que el paciente ya tiene en este recorrido (RN-HR-02)', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();
    const compatible = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });
    const recorridoConIdaCargada = buildRecorrido({
      paradas: [{ id: 'p-ida', pacienteId: 'paciente-1', tramo: 'ida', direccionOrigenId: 'a', direccionDestinoId: 'b', orden: 0 }],
    });

    renderConQuery(
      <AsignacionPanel
        recorrido={recorridoConIdaCargada}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[compatible]}
        onAgregar={onAgregar}
      />,
    );

    // Fuerza el duplicado exacto: el tramo se preseleccionó en "vuelta", lo volvemos a "ida" a mano.
    await user.selectOptions(screen.getByLabelText(/tramo/i), 'ida');
    await user.click(screen.getByRole('button', { name: /agregar pasajero/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/ya tiene una parada de ida/i);
    expect(onAgregar).not.toHaveBeenCalled();
  });

  it('permite agregar la vuelta a un paciente que ya tiene la ida cargada en el mismo recorrido (RN-HR-02)', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();
    const compatible = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });
    const recorridoConIdaCargada = buildRecorrido({
      paradas: [{ id: 'p-ida', pacienteId: 'paciente-1', tramo: 'ida', direccionOrigenId: 'a', direccionDestinoId: 'b', orden: 0 }],
    });

    renderConQuery(
      <AsignacionPanel
        recorrido={recorridoConIdaCargada}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[compatible]}
        onAgregar={onAgregar}
      />,
    );

    await user.click(screen.getByRole('button', { name: /agregar pasajero/i }));

    expect(onAgregar).toHaveBeenCalledTimes(1);
    expect(onAgregar.mock.calls[0]?.[0]).toMatchObject({ pacienteId: 'paciente-1', tramo: 'vuelta' });
  });
});

// Gateo de escritura (gateo-hojas-de-ruta, design.md D4/D9, tasks.md 5.3): una sola inserción de
// CamposSoloLectura cubre SelectorPaciente + PacienteTramoCampos + "Agregar pasajero" (mismo
// patrón que NuevoRecorridoForm). Acá, a diferencia de NuevoRecorridoForm, el primer paciente
// queda preseleccionado por defecto (`pacientes[0]`), así que PacienteTramoCampos SÍ se puede
// afirmar directamente sin necesitar seleccionar nada primero.
describe('AsignacionPanel — gateo de escritura', () => {
  const paciente = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });

  it('sin permiso de escritura: ningún campo acepta entrada, "Agregar pasajero" queda deshabilitado, y RequisitosPaciente sigue legible', () => {
    renderConPermiso(
      false,
      <AsignacionPanel recorrido={buildRecorrido()} vehiculo={vehiculoConSillaPlegable} pacientes={[paciente]} onAgregar={vi.fn()} />,
    );

    expect(screen.getByLabelText(/^paciente$/i)).toBeDisabled();
    expect(screen.getByLabelText(/hora/i)).toBeDisabled();
    expect(screen.getByLabelText(/tramo/i)).toBeDisabled();
    expect(screen.getByLabelText(/dirección de origen/i)).toBeDisabled();
    expect(screen.getByLabelText(/dirección de destino/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /agregar pasajero/i })).toBeDisabled();

    expect(screen.getAllByText(/silla plegable/i).length).toBeGreaterThan(0);
  });

  it('con permiso de escritura: todos los campos operativos y "Agregar pasajero" agrega la parada', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();

    renderConPermiso(
      true,
      <AsignacionPanel recorrido={buildRecorrido()} vehiculo={vehiculoConSillaPlegable} pacientes={[paciente]} onAgregar={onAgregar} />,
    );

    expect(screen.getByLabelText(/^paciente$/i)).toBeEnabled();
    expect(screen.getByLabelText(/hora/i)).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /agregar pasajero/i }));
    expect(onAgregar).toHaveBeenCalledTimes(1);
  });

  it('rol admin sin filas (puedeEscribir=true): "Agregar pasajero" es activable', () => {
    renderConPermiso(
      true,
      <AsignacionPanel recorrido={buildRecorrido()} vehiculo={vehiculoConSillaPlegable} pacientes={[paciente]} onAgregar={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /agregar pasajero/i })).toBeEnabled();
  });
});

// Atajo "Destino habitual" (feedback de usuario, 2026-08-27): AsignacionPanel y NuevoRecorridoForm
// son "el mismo formulario" — el atajo aparece en los dos, con el mismo comportamiento
// copy-on-create.
describe('AsignacionPanel · destino habitual del paciente', () => {
  const pacienteConDirecciones = buildPaciente({
    id: 'p-hab',
    direcciones: [
      { id: 'dir-casa', tipo: 'domicilio', calle: 'Rivadavia 100', localidad: 'CABA' },
      { id: 'dir-escuela', tipo: 'escuela', calle: 'Mitre 200', localidad: 'CABA' },
    ],
  });

  const HABITUAL_JUEVES = {
    id: 'h-jueves',
    pacienteId: 'p-hab',
    direccionInicialId: 'dir-casa',
    direccionFinalId: 'dir-escuela',
    diaSemana: 'jueves' as const,
    hora: '08:15',
  };

  // 2026-08-27 es jueves.
  const JUEVES = '2026-08-27';

  it('completa hora, origen y destino de la parada al elegir un destino habitual', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();

    renderConPermiso(
      true,
      <AsignacionPanel
        recorrido={buildRecorrido({ paradas: [] })}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[pacienteConDirecciones]}
        fecha={JUEVES}
        recorridoHabitualRepository={{ list: vi.fn().mockResolvedValue([HABITUAL_JUEVES]) }}
        onAgregar={onAgregar}
      />,
    );

    // migracion-react-query: se espera la OPCIÓN, no el select. El select existe desde el primer
    // render (deshabilitado mientras carga), así que `findByLabelText` lo encontraba vacío y
    // `selectOptions` corría antes de que llegara el dato: React Query notifica a sus observadores
    // un tick después de que la promesa resuelve. La intención del test no cambia.
    await waitFor(() => expect(screen.getByLabelText(/destino habitual/i)).toBeEnabled());
    await user.selectOptions(screen.getByLabelText(/destino habitual/i), 'h-jueves');
    await user.click(screen.getByRole('button', { name: /agregar pasajero/i }));

    expect(onAgregar).toHaveBeenCalledWith(
      expect.objectContaining({
        pacienteId: 'p-hab',
        direccionOrigenId: 'dir-casa',
        direccionDestinoId: 'dir-escuela',
        horaEstimada: '08:15',
      }),
    );
  });

  it('el destino habitual pisa la sugerencia de vuelta invertida: el operador lo pidió explícitamente', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();
    // El paciente ya tiene la ida casa -> escuela: sin atajo, RN-HR-02 sugeriría escuela -> casa.
    const recorridoConIda = buildRecorrido({
      paradas: [
        {
          id: 'parada-ida',
          pacienteId: 'p-hab',
          tramo: 'ida',
          direccionOrigenId: 'dir-casa',
          direccionDestinoId: 'dir-escuela',
          orden: 0,
        },
      ],
    });

    renderConPermiso(
      true,
      <AsignacionPanel
        recorrido={recorridoConIda}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[pacienteConDirecciones]}
        fecha={JUEVES}
        recorridoHabitualRepository={{ list: vi.fn().mockResolvedValue([HABITUAL_JUEVES]) }}
        onAgregar={onAgregar}
      />,
    );

    // migracion-react-query: se espera la OPCIÓN, no el select. El select existe desde el primer
    // render (deshabilitado mientras carga), así que `findByLabelText` lo encontraba vacío y
    // `selectOptions` corría antes de que llegara el dato: React Query notifica a sus observadores
    // un tick después de que la promesa resuelve. La intención del test no cambia.
    await waitFor(() => expect(screen.getByLabelText(/destino habitual/i)).toBeEnabled());
    await user.selectOptions(screen.getByLabelText(/destino habitual/i), 'h-jueves');

    expect(screen.getByLabelText(/dirección de origen/i)).toHaveValue('dir-casa');
    expect(screen.getByLabelText(/dirección de destino/i)).toHaveValue('dir-escuela');
  });

  it('sin repository inyectado el panel funciona exactamente como antes', () => {
    renderConPermiso(
      true,
      <AsignacionPanel
        recorrido={buildRecorrido({ paradas: [] })}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[pacienteConDirecciones]}
        onAgregar={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText(/destino habitual/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/dirección de origen/i)).toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Paciente } from '../../shared/types/paciente';
import type { Presupuesto } from '../../shared/types/presupuesto';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { PresupuestoResumen } from './PresupuestoResumen';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

const martina: Paciente = {
  id: 'paciente-martina',
  apellido: 'Gómez',
  nombre: 'Martina',
  fechaNacimiento: '2015-03-12',
  dni: '45123456',
  cuilTitular: '27-30111222-4',
  diagnostico: 'Parálisis cerebral',
  accesorioMovilidad: [],
  obraSocialId: 'osecac',
  numeroAfiliado: { valor: '45123456' },
  cud: null,
  direcciones: [],
  personasACargo: [],
  amparoJudicial: false,
};

const osecac: ObraSocial = {
  id: 'osecac',
  nombre: 'OSECAC',
  cuit: '30-54155200-6',
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
  formatoAfiliado: 'numero-documento',
  checklist: [],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
};

const presupuestoMartina: Presupuesto = {
  id: 'presupuesto-martina-1',
  pacienteId: 'paciente-martina',
  obraSocialId: 'osecac',
  monto: 150_000,
  fechaEmision: '2026-06-01',
};

describe('PresupuestoResumen', () => {
  it('dispara onEdit al hacer click en "Editar datos"', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(<PresupuestoResumen presupuesto={presupuestoMartina} paciente={martina} obraSocial={osecac} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: /editar datos/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

// presupuesto-prestacion (tasks.md 8.8, design.md D1/D5/D9): mostrar la prestación asociada
// cuando prestacionId está presente, buscando el nombre en el catálogo del paciente.
describe('PresupuestoResumen — prestación asociada (D9)', () => {
  it('sin prestacionId (modalidad general): no muestra el stat "Prestación" ni el cartel de vínculo', () => {
    render(<PresupuestoResumen presupuesto={presupuestoMartina} paciente={martina} obraSocial={osecac} onEdit={vi.fn()} />);

    expect(screen.queryByText('Prestación')).not.toBeInTheDocument();
  });

  it('sin prestacionId (modalidad general): muestra el chip "Presupuesto general"', () => {
    render(<PresupuestoResumen presupuesto={presupuestoMartina} paciente={martina} obraSocial={osecac} onEdit={vi.fn()} />);

    expect(screen.getByText('Presupuesto general')).toBeInTheDocument();
  });

  it('con prestacionId presente: muestra el chip "Presupuesto por prestación: <nombre real>"', () => {
    const martinaConPrestaciones: Paciente = {
      ...martina,
      prestaciones: [{ id: 'prestacion-kine', pacienteId: martina.id, nombre: 'Kinesiología', activa: true }],
    };
    const presupuestoConPrestacion: Presupuesto = { ...presupuestoMartina, prestacionId: 'prestacion-kine' };

    render(
      <PresupuestoResumen
        presupuesto={presupuestoConPrestacion}
        paciente={martinaConPrestaciones}
        obraSocial={osecac}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText('Presupuesto por prestación: Kinesiología')).toBeInTheDocument();
  });

  it('con prestacionId presente: muestra el nombre de la prestación buscado en el catálogo del paciente', () => {
    const martinaConPrestaciones: Paciente = {
      ...martina,
      prestaciones: [{ id: 'prestacion-kine', pacienteId: martina.id, nombre: 'Kinesiología', activa: true }],
    };
    const presupuestoConPrestacion: Presupuesto = { ...presupuestoMartina, prestacionId: 'prestacion-kine' };

    render(
      <PresupuestoResumen
        presupuesto={presupuestoConPrestacion}
        paciente={martinaConPrestaciones}
        obraSocial={osecac}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText('Prestación')).toBeInTheDocument();
    expect(screen.getByText('Kinesiología')).toBeInTheDocument();
  });

  it('con prestacionId apuntando a una prestación ya inactiva (borrado lógico, D1): sigue mostrando su nombre, no "desconocida"', () => {
    const martinaConPrestacionInactiva: Paciente = {
      ...martina,
      prestaciones: [{ id: 'prestacion-kine', pacienteId: martina.id, nombre: 'Kinesiología', activa: false }],
    };
    const presupuestoConPrestacion: Presupuesto = { ...presupuestoMartina, prestacionId: 'prestacion-kine' };

    render(
      <PresupuestoResumen
        presupuesto={presupuestoConPrestacion}
        paciente={martinaConPrestacionInactiva}
        obraSocial={osecac}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText('Kinesiología')).toBeInTheDocument();
  });

  it('con prestacionId presente: muestra el AvisoModeloDatos referenciando la discrepancia #13 reabierta (2026-08-16) — por-prestacion sin desglose, general con desglose', () => {
    const presupuestoConPrestacion: Presupuesto = { ...presupuestoMartina, prestacionId: 'prestacion-kine' };

    render(<PresupuestoResumen presupuesto={presupuestoConPrestacion} paciente={martina} obraSocial={osecac} onEdit={vi.fn()} />);

    // tasks.md 9.3 sumó un segundo cartel siempre visible (vigencia, Discrepancia 1) — ya no es
    // el único `note` de la pantalla, así que se busca el específico de la #13 entre todos.
    const notas = screen.getAllByRole('note');
    const cartel = notas.find((n) => /discrepancia #13/i.test(n.textContent ?? ''));
    if (!cartel) throw new Error('No se encontró el cartel de la discrepancia #13');
    expect(cartel).toHaveTextContent(/por prestación/i);
    expect(cartel).toHaveTextContent(/general/i);
  });
});

// Gateo de escritura (gateo-facturacion, tasks.md 2.2, design.md D1/D4). "Editar datos" queda
// visible pero no activable sin permiso de escritura; los datos siguen legibles (mismo criterio
// que PacienteResumen/gateo-pacientes).
describe('PresupuestoResumen — gateo de escritura', () => {
  it('sin permiso de escritura: "Editar datos" queda visible y no se puede activar', () => {
    renderConPermiso(
      false,
      <PresupuestoResumen presupuesto={presupuestoMartina} paciente={martina} obraSocial={osecac} onEdit={vi.fn()} />,
    );

    const editar = screen.getByRole('button', { name: /editar datos/i });
    expect(editar).toBeVisible();
    expect(editar).toBeDisabled();
    // Los datos siguen siendo legibles con solo `read` (D4 — el gateo nunca oculta contenido).
    expect(screen.getByText(/gómez, martina/i)).toBeInTheDocument();
  });

  it('con permiso de escritura: "Editar datos" está activable (triangulación)', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    renderConPermiso(
      true,
      <PresupuestoResumen presupuesto={presupuestoMartina} paciente={martina} obraSocial={osecac} onEdit={onEdit} />,
    );

    const editar = screen.getByRole('button', { name: /editar datos/i });
    expect(editar).toBeEnabled();
    await user.click(editar);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

// Reapertura #13 (decisión usuaria 2026-08-16): la modalidad `general` ahora PERSISTE su desglose
// por prestación (`facturacion.presupuesto_linea`, migración 20260816110000). El resumen muestra
// las líneas persistidas, con nombres resueltos contra el catálogo del paciente.
describe('PresupuestoResumen — líneas de modalidad general (reapertura #13)', () => {
  const martinaConPrestaciones: Paciente = {
    ...martina,
    prestaciones: [
      { id: 'prestacion-kine', pacienteId: martina.id, nombre: 'Kinesiología', activa: true },
      { id: 'prestacion-fono', pacienteId: martina.id, nombre: 'Fonoaudiología', activa: true },
    ],
  };

  it('con lineas presentes: muestra el bloque "Líneas" con el nombre de cada prestación y su monto', () => {
    const presupuestoConLineas: Presupuesto = {
      ...presupuestoMartina,
      lineas: [
        { id: 'linea-1', prestacionId: 'prestacion-kine', monto: 100, orden: 1 },
        { id: 'linea-2', prestacionId: 'prestacion-fono', monto: 200, orden: 2 },
      ],
    };

    render(
      <PresupuestoResumen
        presupuesto={presupuestoConLineas}
        paciente={martinaConPrestaciones}
        obraSocial={osecac}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText('Líneas')).toBeInTheDocument();
    expect(screen.getByText('Kinesiología')).toBeInTheDocument();
    expect(screen.getByText('Fonoaudiología')).toBeInTheDocument();
  });

  it('con lineas cuyo id de prestación ya no está en el catálogo del paciente: muestra "Prestación desconocida", sin romper', () => {
    const presupuestoConLineaHuérfana: Presupuesto = {
      ...presupuestoMartina,
      lineas: [{ id: 'linea-1', prestacionId: 'prestacion-inexistente', monto: 100, orden: 1 }],
    };

    render(
      <PresupuestoResumen
        presupuesto={presupuestoConLineaHuérfana}
        paciente={martina}
        obraSocial={osecac}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText('Prestación desconocida')).toBeInTheDocument();
  });

  it('sin lineas: no muestra el bloque "Líneas"', () => {
    render(<PresupuestoResumen presupuesto={presupuestoMartina} paciente={martina} obraSocial={osecac} onEdit={vi.fn()} />);

    expect(screen.queryByText('Líneas')).not.toBeInTheDocument();
  });
});

// presupuestos-vigencia-datos-traslado-vista-previa, tasks.md 8.7, design.md D1/D2/D3.
describe('PresupuestoResumen — vigencia, CD/SD y datos de traslado (tasks.md 8.7)', () => {
  it('vigencia cargada: muestra el rango vigenciaDesde – vigenciaHasta', () => {
    const presupuesto: Presupuesto = { ...presupuestoMartina, vigenciaDesde: '2026-02-01', vigenciaHasta: '2027-01-31' };
    render(<PresupuestoResumen presupuesto={presupuesto} paciente={martina} obraSocial={osecac} onEdit={vi.fn()} />);

    expect(screen.getByText('2026-02-01 – 2027-01-31')).toBeInTheDocument();
  });

  it('sin vigencia cargada: muestra "Sin vigencia cargada", nunca un rango inventado a partir de fechaEmision', () => {
    render(<PresupuestoResumen presupuesto={presupuestoMartina} paciente={martina} obraSocial={osecac} onEdit={vi.fn()} />);

    expect(screen.getByText('Sin vigencia cargada')).toBeInTheDocument();
  });

  it('conDependencia true: muestra "Sí"', () => {
    const presupuesto: Presupuesto = { ...presupuestoMartina, conDependencia: true };
    render(<PresupuestoResumen presupuesto={presupuesto} paciente={martina} obraSocial={osecac} onEdit={vi.fn()} />);

    expect(screen.getByText('Sí')).toBeInTheDocument();
  });

  it('conDependencia false (decisión tomada): muestra "No", nunca confundido con "no cargado"', () => {
    const presupuesto: Presupuesto = { ...presupuestoMartina, conDependencia: false };
    render(<PresupuestoResumen presupuesto={presupuesto} paciente={martina} obraSocial={osecac} onEdit={vi.fn()} />);

    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.queryByText('No cargado')).not.toBeInTheDocument();
  });

  it('conDependencia undefined (nunca se cargó): muestra "No cargado", nunca "No"', () => {
    render(<PresupuestoResumen presupuesto={presupuestoMartina} paciente={martina} obraSocial={osecac} onEdit={vi.fn()} />);

    expect(screen.getByText('No cargado')).toBeInTheDocument();
  });

  it('sin datosTraslado: muestra "Sin datos de traslado", nunca campos vacíos', () => {
    render(<PresupuestoResumen presupuesto={presupuestoMartina} paciente={martina} obraSocial={osecac} onEdit={vi.fn()} />);

    expect(screen.getByText('Sin datos de traslado')).toBeInTheDocument();
  });

  it('con datosTraslado cargado: muestra origen/destino, horarios, km y días de la semana traducidos', () => {
    const presupuesto: Presupuesto = {
      ...presupuestoMartina,
      datosTraslado: {
        origenIda: 'San Martín 123',
        destinoIda: 'Escuela especial',
        horarioEntrada: '08:00',
        kmIda: 10,
        diasSemana: ['lunes', 'miercoles'],
        diasMensuales: 20,
      },
    };

    render(<PresupuestoResumen presupuesto={presupuesto} paciente={martina} obraSocial={osecac} onEdit={vi.fn()} />);

    expect(screen.getByText('Datos de traslado')).toBeInTheDocument();
    expect(screen.getByText('San Martín 123')).toBeInTheDocument();
    expect(screen.getByText('Escuela especial')).toBeInTheDocument();
    expect(screen.getByText('08:00')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Lunes, Miércoles')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('con datosTraslado cargado pero campos individuales sin cargar (ej. solo ida, sin vuelta): muestra "Sin cargar" por campo, no un valor inventado', () => {
    const presupuesto: Presupuesto = {
      ...presupuestoMartina,
      datosTraslado: { origenIda: 'San Martín 123', diasSemana: [] },
    };

    render(<PresupuestoResumen presupuesto={presupuesto} paciente={martina} obraSocial={osecac} onEdit={vi.fn()} />);

    expect(screen.getByText('San Martín 123')).toBeInTheDocument();
    // "Sin cargar" aparece más de una vez (destino/vuelta/horarios/km sin cargar) — no debe romper.
    expect(screen.getAllByText('Sin cargar').length).toBeGreaterThan(1);
  });

  // tasks.md 9.3, design.md §Discrepancias #1: la regla dura del proyecto exige el cartel en las
  // DOS pantallas listadas por el design (PresupuestoForm ya lo tenía desde Fase 8;
  // PresupuestoResumen —la vista de solo lectura de PresupuestoDetail— no lo tenía).
  it('vigencia cargada: muestra el AvisoModeloDatos de vigencia (Discrepancia 1 del design, tasks.md 9.3)', () => {
    const presupuesto: Presupuesto = { ...presupuestoMartina, vigenciaDesde: '2026-02-01', vigenciaHasta: '2027-01-31' };
    render(<PresupuestoResumen presupuesto={presupuesto} paciente={martina} obraSocial={osecac} onEdit={vi.fn()} />);

    const notas = screen.getAllByRole('note');
    const cartel = notas.find((n) => /vigencia/i.test(n.textContent ?? '') && /docx/i.test(n.textContent ?? ''));
    if (!cartel) throw new Error('No se encontró el cartel de vigencia (Discrepancia 1, tasks.md 9.3)');
  });

  // tasks.md 9.3, design.md §Discrepancias #4.
  it('con datosTraslado cargado: muestra el AvisoModeloDatos del bloque de datos de traslado (Discrepancia 4 del design, tasks.md 9.3)', () => {
    const presupuesto: Presupuesto = {
      ...presupuestoMartina,
      datosTraslado: { origenIda: 'San Martín 123', diasSemana: [] },
    };
    render(<PresupuestoResumen presupuesto={presupuesto} paciente={martina} obraSocial={osecac} onEdit={vi.fn()} />);

    const notas = screen.getAllByRole('note');
    const cartel = notas.find((n) => /datos de traslado/i.test(n.textContent ?? '') && /docx/i.test(n.textContent ?? ''));
    if (!cartel) throw new Error('No se encontró el cartel de datos de traslado (Discrepancia 4, tasks.md 9.3)');
  });
});

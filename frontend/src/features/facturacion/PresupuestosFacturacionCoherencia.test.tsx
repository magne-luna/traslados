import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import type { PresupuestoRepository } from '../../shared/lib/presupuestos/PresupuestoRepository';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import type { FacturaRepository } from '../../shared/lib/facturacion/FacturaRepository';
import type { CobroRepository } from '../../shared/lib/facturacion/CobroRepository';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Paciente } from '../../shared/types/paciente';
import type { Presupuesto } from '../../shared/types/presupuesto';
import type { Factura } from '../../shared/types/factura';
import type { MapaPermisos, Usuario } from '../../shared/types/usuario';
import { RequireAuth } from '../../shared/auth/RequireAuth';
import { renderConSesion } from '../../shared/test/renderConSesion';
import { AutorizacionRepositoryProvider } from '../presupuestos/AutorizacionRepositoryContext';
import { PresupuestoRepositoryProvider } from '../presupuestos/PresupuestoRepositoryContext';
import { PresupuestosPage } from '../presupuestos/PresupuestosPage';
import { CobroRepositoryProvider } from './CobroRepositoryContext';
import { FacturaRepositoryProvider } from './FacturaRepositoryContext';
import { FacturacionPage } from './FacturacionPage';

// Coherencia entre /presupuestos y /facturacion — REESCRITO por permisos-modulos-granulares
// (tasks.md, hallazgo durante 5.7): hasta este change (gateo-facturacion, design.md D1, ya
// archivado) las dos rutas resolvían el mismo módulo del backend (`facturacion`, seed_modulos.sql).
// Desde la migración `20260730140000_split_modulos_permisos.sql` y el `APP_ROUTES` nuevo,
// `/presupuestos` resuelve su propio módulo `presupuestos` — las dos pantallas ya NO comparten
// permiso (spec de este change, escenario "Permiso sobre facturación no habilita presupuestos").
// Sigue contra RequireAuth real (no el mecanismo compartido stubeado): un gateo que funcione en
// una ruta y no en la otra es un fallo silencioso. Mismo patrón que
// HojaDeRutaPage.coherencia.test.tsx.

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

const presupuestoMartina: Presupuesto = {
  id: 'presupuesto-martina-1',
  pacienteId: 'paciente-martina',
  obraSocialId: 'osecac',
  monto: 150_000,
  fechaEmision: '2026-06-01',
};

const facturaMartina: Factura = {
  id: 'factura-1',
  pacienteId: 'paciente-martina',
  descripcion: '',
  dias: 10,
  valorKm: 300,
  monto: 3000,
  estado: 'a-facturar',
  fechaInicial: '2026-08-01',
  fechaTope: '2026-08-31',
  tipoComprobante: 'A',
  cantidadKm: 10,
  prestacion: 'Kinesiología',
  mesFacturado: 8,
  anioFacturado: 2026,
  dependenciaYRetorno: '',
  domicilioId: '',
  asistencias: [],
};

function buildFakePacienteRepo(): PacienteRepository {
  return {
    list: vi.fn().mockResolvedValue([martina]),
    listPage: vi.fn(),
    getById: vi.fn().mockResolvedValue(martina),
    create: vi.fn(),
    update: vi.fn(),
  };
}
function buildFakeObraSocialRepo(): ObraSocialRepository {
  return {
    list: vi.fn().mockResolvedValue([osecac]),
    listPage: vi.fn(),
    getById: vi.fn().mockResolvedValue(osecac),
    create: vi.fn(),
    update: vi.fn(),
  };
}
function buildFakePresupuestoRepo(): PresupuestoRepository {
  return {
    list: vi.fn().mockResolvedValue([presupuestoMartina]),
    getById: vi.fn().mockResolvedValue(presupuestoMartina),
    create: vi.fn(),
    update: vi.fn(),
  };
}
function buildFakeAutorizacionRepo(): AutorizacionRepository {
  return { list: vi.fn().mockResolvedValue([]), getById: vi.fn(), getByPresupuestoId: vi.fn().mockResolvedValue(null), create: vi.fn(), update: vi.fn() };
}
function buildFakeFacturaRepo(): FacturaRepository {
  return {
    list: vi.fn().mockResolvedValue([facturaMartina]),
    getById: vi.fn().mockResolvedValue(facturaMartina),
    listByPaciente: vi.fn().mockResolvedValue([facturaMartina]),
    create: vi.fn(),
    update: vi.fn(),
  };
}
function buildFakeCobroRepo(): CobroRepository {
  return { list: vi.fn().mockResolvedValue([]), listByFactura: vi.fn().mockResolvedValue([]), create: vi.fn(), remove: vi.fn() };
}
function buildFakeDocumentoRepo(): DocumentoRepository {
  return {
    listByEntity: vi.fn().mockResolvedValue([]),
    upload: vi.fn(),
    remove: vi.fn(),
    resolverPrevisualizacion: vi.fn().mockResolvedValue(null),
    transferirAgrupacion: vi.fn(),
  };
}

const EMPLEADO: Usuario = { id: 'u-empleado', nombre: 'Juan', apellido: 'Pérez', email: 'juan@x.com', rol: 'empleado' };

function renderAmbasRutas(permisos: MapaPermisos, entrada: '/presupuestos' | '/facturacion') {
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/presupuestos',
            element: (
              <PresupuestoRepositoryProvider repository={buildFakePresupuestoRepo()}>
                <AutorizacionRepositoryProvider repository={buildFakeAutorizacionRepo()}>
                  <PresupuestosPage pacienteRepository={buildFakePacienteRepo()} obraSocialRepository={buildFakeObraSocialRepo()} />
                </AutorizacionRepositoryProvider>
              </PresupuestoRepositoryProvider>
            ),
          },
          {
            path: '/facturacion',
            element: (
              <FacturaRepositoryProvider repository={buildFakeFacturaRepo()}>
                <CobroRepositoryProvider repository={buildFakeCobroRepo()}>
                  <FacturacionPage
                    pacienteRepository={buildFakePacienteRepo()}
                    obraSocialRepository={buildFakeObraSocialRepo()}
                    presupuestoRepository={buildFakePresupuestoRepo()}
                    autorizacionRepository={buildFakeAutorizacionRepo()}
                    documentoRepository={buildFakeDocumentoRepo()}
                    feriados={[]}
                  />
                </CobroRepositoryProvider>
              </FacturaRepositoryProvider>
            ),
          },
        ],
      },
      { path: '/login', element: <div>Login mock</div> },
    ],
    { initialEntries: [entrada] },
  );

  return renderConSesion(<RouterProvider router={router} />, { usuario: EMPLEADO, permisos });
}

describe('/presupuestos y /facturacion resuelven módulos propios e independientes (permisos-modulos-granulares)', () => {
  it('con solo read sobre el módulo propio de cada ruta: las dos pantallas quedan en modo solo lectura', async () => {
    renderAmbasRutas({ presupuestos: 'read' }, '/presupuestos');
    await screen.findByText('Gómez, Martina');
    const notasPresupuestos = screen.getAllByRole('note').map((n) => n.textContent ?? '');
    expect(notasPresupuestos.some((t) => /modo solo lectura/i.test(t))).toBe(true);

    renderAmbasRutas({ facturacion: 'read' }, '/facturacion');
    await screen.findByText('Gómez, Martina', { selector: 'span' });
    const notasFacturacion = screen.getAllByRole('note').map((n) => n.textContent ?? '');
    expect(notasFacturacion.some((t) => /modo solo lectura/i.test(t))).toBe(true);
  });

  it('con write sobre el módulo propio de cada ruta: las dos pantallas quedan habilitadas y sin aviso', async () => {
    renderAmbasRutas({ presupuestos: 'write' }, '/presupuestos');
    await screen.findByText('Gómez, Martina');
    expect(screen.queryByText(/modo solo lectura/i)).not.toBeInTheDocument();

    renderAmbasRutas({ facturacion: 'write' }, '/facturacion');
    await screen.findByText('Gómez, Martina', { selector: 'span' });
    expect(screen.queryByText(/modo solo lectura/i)).not.toBeInTheDocument();
  });

  it('con write solo en pacientes (sin permiso sobre presupuestos ni facturacion): las dos rutas quedan en modo solo lectura', async () => {
    renderAmbasRutas({ pacientes: 'write', presupuestos: 'read' }, '/presupuestos');
    await screen.findByText('Gómez, Martina');
    expect(screen.getAllByText(/modo solo lectura/i).length).toBeGreaterThan(0);

    renderAmbasRutas({ pacientes: 'write', facturacion: 'read' }, '/facturacion');
    await screen.findByText('Gómez, Martina', { selector: 'span' });
    expect(screen.getAllByText(/modo solo lectura/i).length).toBeGreaterThan(0);
  });

  // Spec (permisos-modulo-frontend, escenario "Permiso sobre facturación no habilita
  // presupuestos" / "Permiso sobre presupuestos no habilita facturación"): desde este change,
  // facturacion y presupuestos son módulos independientes — write en uno no habilita el otro.
  it('write sobre facturacion no habilita /presupuestos (y viceversa) — ya no comparten permiso', async () => {
    renderAmbasRutas({ facturacion: 'write', presupuestos: 'read' }, '/presupuestos');
    await screen.findByText('Gómez, Martina');
    expect(screen.getAllByText(/modo solo lectura/i).length).toBeGreaterThan(0);

    renderAmbasRutas({ presupuestos: 'write', facturacion: 'read' }, '/facturacion');
    await screen.findByText('Gómez, Martina', { selector: 'span' });
    expect(screen.getAllByText(/modo solo lectura/i).length).toBeGreaterThan(0);
  });
});

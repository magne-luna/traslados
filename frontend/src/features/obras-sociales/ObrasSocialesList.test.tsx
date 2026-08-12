import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ObraSocial } from '../../shared/types/obraSocial';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { ObrasSocialesList } from './ObrasSocialesList';

const osecac: ObraSocial = {
  id: 'osecac',
  nombre: 'OSECAC',
  cuit: '30-54155200-6',
  modalidadFacturacion: 'general',
  admitePagosParciales: true,
  formatoAfiliado: 'numero-documento',
  checklist: [
    { id: 'item-1', nombre: 'RHC', requerido: true },
    { id: 'item-2', nombre: 'Prescripción médica', requerido: true },
  ],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
};

const swissMedical: ObraSocial = {
  id: 'swiss',
  nombre: 'Swiss Medical',
  cuit: '30-11111111-1',
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
  formatoAfiliado: 'alfanumerico',
  checklist: [],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.dni' },
};

const osde: ObraSocial = {
  id: 'osde',
  nombre: 'OSDE',
  cuit: '30-50110100-3',
  modalidadFacturacion: 'general',
  admitePagosParciales: true,
  formatoAfiliado: 'numero-documento',
  checklist: [
    { id: 'c1', nombre: 'Receta digital', requerido: true },
    { id: 'c2', nombre: 'Orden médica', requerido: true },
    { id: 'c3', nombre: 'Credencial', requerido: false },
    { id: 'c4', nombre: 'Carnet de afiliado', requerido: true },
    { id: 'c5', nombre: 'Historia clínica', requerido: false },
  ],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.dni' },
};

// paginacion-listados, Fase 3 (tasks.md 17.3): `ObrasSocialesList` deja de tener estado propio de
// filtrado (mismo criterio que PacientesList 13.8/ConductoresList 16.3, presentacional puro) —
// `busqueda`/`pagina`/`total`/`tamanio` llegan por props desde `useObrasSocialesPaginado` (vía
// ObraSocialesPage), y `obrasSociales` es SOLO la página actual, no el catálogo completo.
function defaultProps(overrides: Partial<React.ComponentProps<typeof ObrasSocialesList>> = {}): React.ComponentProps<
  typeof ObrasSocialesList
> {
  return {
    obrasSociales: [],
    loading: false,
    error: null,
    onSelect: vi.fn(),
    onCreateNew: vi.fn(),
    busqueda: '',
    onBusquedaChange: vi.fn(),
    pagina: 1,
    tamanio: 20,
    total: 0,
    onCambiarPagina: vi.fn(),
    ...overrides,
  };
}

function renderConPermiso(puedeEscribir: boolean, overrides: Partial<React.ComponentProps<typeof ObrasSocialesList>> = {}) {
  return render(
    <PuedeEscribirContext.Provider value={puedeEscribir}>
      <ObrasSocialesList {...defaultProps(overrides)} />
    </PuedeEscribirContext.Provider>,
  );
}

describe('ObrasSocialesList', () => {
  it('muestra un indicador de carga mientras loading es true', () => {
    render(<ObrasSocialesList {...defaultProps({ loading: true })} />);

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('estado 1/3 — sin obras sociales cargadas: total 0 y sin búsqueda muestra el estado vacío con acción de crear', async () => {
    const user = userEvent.setup();
    const onCreateNew = vi.fn();

    render(<ObrasSocialesList {...defaultProps({ total: 0, busqueda: '', onCreateNew })} />);

    expect(screen.getByText(/no hay obras sociales/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /crear la primera obra social/i }));
    expect(onCreateNew).toHaveBeenCalledTimes(1);
  });

  it('estado 2/3 — búsqueda sin coincidencias: total 0 CON búsqueda muestra un mensaje distinto del vacío inicial', () => {
    render(<ObrasSocialesList {...defaultProps({ total: 0, busqueda: 'zzz-inexistente' })} />);

    expect(screen.getByText(/ninguna obra social coincide con "zzz-inexistente"/i)).toBeInTheDocument();
    expect(screen.queryByText(/no hay obras sociales cargadas/i)).not.toBeInTheDocument();
  });

  it('muestra el error visible sin ocultar el resto de la pantalla', () => {
    render(<ObrasSocialesList {...defaultProps({ error: 'caído' })} />);

    expect(screen.getByRole('alert')).toHaveTextContent('caído');
  });

  it('lista nombre y CUIT de cada obra social', () => {
    render(<ObrasSocialesList {...defaultProps({ obrasSociales: [osecac, swissMedical], total: 2 })} />);

    expect(screen.getByText('OSECAC')).toBeInTheDocument();
    expect(screen.getByText(/30-54155200-6/)).toBeInTheDocument();
    expect(screen.getByText('Swiss Medical')).toBeInTheDocument();
  });

  it('dispara onSelect al hacer click en cualquier parte de la fila', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<ObrasSocialesList {...defaultProps({ obrasSociales: [osecac], total: 1, onSelect })} />);

    await user.click(screen.getByText('OSECAC'));
    expect(onSelect).toHaveBeenCalledWith(osecac);
  });

  it('no duplica la llamada a onSelect cuando el click viene del botón Editar (triangulación)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<ObrasSocialesList {...defaultProps({ obrasSociales: [osecac], total: 1, onSelect })} />);

    await user.click(screen.getByRole('button', { name: /editar osecac/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(osecac);
  });

  it('muestra cantidad de documentos e identificador de factura en la tarjeta', () => {
    render(<ObrasSocialesList {...defaultProps({ obrasSociales: [osecac], total: 1 })} />);

    expect(screen.getByText('2 documentos')).toBeInTheDocument();
    expect(screen.getByText('Nro. de afiliado')).toBeInTheDocument();
  });

  it('trunca el checklist a 3 ítems y muestra un contador de los restantes', () => {
    render(<ObrasSocialesList {...defaultProps({ obrasSociales: [osde], total: 1 })} />);

    expect(screen.getByText('Receta digital')).toBeInTheDocument();
    expect(screen.getByText('Orden médica')).toBeInTheDocument();
    expect(screen.getByText('Credencial')).toBeInTheDocument();
    expect(screen.queryByText('Carnet de afiliado')).not.toBeInTheDocument();
    expect(screen.getByText('+2 más')).toBeInTheDocument();
  });

  // 17.3: el buscador ya no filtra en memoria — alimenta el término del hook vía prop.
  describe('ObrasSocialesList — búsqueda alimenta el hook, no filtra en memoria', () => {
    it('escribir en el buscador llama a onBusquedaChange con el valor crudo (no filtra "obrasSociales" localmente)', async () => {
      const user = userEvent.setup();
      const onBusquedaChange = vi.fn();

      render(
        <ObrasSocialesList {...defaultProps({ obrasSociales: [osecac, swissMedical], total: 2, onBusquedaChange })} />,
      );

      await user.type(screen.getByLabelText(/buscar obra social/i), 'x');
      expect(onBusquedaChange).toHaveBeenCalledWith('x');
      expect(screen.getByText('OSECAC')).toBeInTheDocument();
      expect(screen.getByText('Swiss Medical')).toBeInTheDocument();
    });
  });

  // 17.3: <Paginador> montado con el total que llega por props.
  describe('ObrasSocialesList — <Paginador>', () => {
    it('renderiza el total de resultados que llega por props', () => {
      render(<ObrasSocialesList {...defaultProps({ obrasSociales: [osecac], total: 45, pagina: 2, tamanio: 20 })} />);

      expect(screen.getByText('45 resultados')).toBeInTheDocument();
      expect(screen.getByText(/página 2 de 3/i)).toBeInTheDocument();
    });

    it('click en "Siguiente" invoca onCambiarPagina con pagina + 1', async () => {
      const user = userEvent.setup();
      const onCambiarPagina = vi.fn();

      render(
        <ObrasSocialesList
          {...defaultProps({ obrasSociales: [osecac], total: 45, pagina: 2, tamanio: 20, onCambiarPagina })}
        />,
      );

      await user.click(screen.getByRole('button', { name: /página siguiente/i }));
      expect(onCambiarPagina).toHaveBeenCalledWith(3);
    });

    it('no monta el <Paginador> (fila de navegación) mientras sin resultados', () => {
      render(<ObrasSocialesList {...defaultProps({ total: 0, busqueda: '' })} />);

      expect(screen.queryByText(/resultados/i)).not.toBeInTheDocument();
    });
  });
});

// Gateo de escritura (gateo-obrasocial, design.md D6). "Nueva obra social"/"Crear la primera obra
// social" nunca se ocultan — solo quedan deshabilitados.
describe('ObrasSocialesList — gateo de escritura', () => {
  it('sin permiso de escritura: "Nueva obra social" queda visible y no se puede activar', () => {
    renderConPermiso(false);

    const crear = screen.getByRole('button', { name: /nueva obra social/i });
    expect(crear).toBeInTheDocument();
    expect(crear).toBeVisible();
    expect(crear).toBeDisabled();
  });

  it('con permiso de escritura: "Nueva obra social" está activable (triangulación)', () => {
    renderConPermiso(true);
    expect(screen.getByRole('button', { name: /nueva obra social/i })).toBeEnabled();
  });

  it('sin permiso de escritura: "Editar" por fila queda visible y no se puede activar, y la fila sigue navegando al detalle', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    renderConPermiso(false, { obrasSociales: [osecac], total: 1, onSelect });

    const editar = screen.getByRole('button', { name: /editar osecac/i });
    expect(editar).toBeVisible();
    expect(editar).toBeDisabled();

    await user.click(screen.getByText('OSECAC'));
    expect(onSelect).toHaveBeenCalledWith(osecac);
  });

  it('con permiso de escritura: "Editar" por fila está activable (triangulación)', () => {
    renderConPermiso(true, { obrasSociales: [osecac], total: 1 });
    expect(screen.getByRole('button', { name: /editar osecac/i })).toBeEnabled();
  });
});

// Rol admin sin filas de permisos (design.md D5): el short-circuit ya está probado de punta a
// punta en usePuedeEscribir.test.tsx — acá solo se verifica que ObrasSocialesList consume ese
// resultado, mismo criterio que PacientesList.test.tsx/ConductoresList.test.tsx.
describe('ObrasSocialesList — rol admin sin filas de permisos', () => {
  it('con puedeEscribir true (equivalente al short-circuit de admin sin filas): la acción de alta está activable', () => {
    renderConPermiso(true, { obrasSociales: [], total: 0 });
    expect(screen.getByRole('button', { name: /crear la primera obra social/i })).toBeEnabled();
  });
});

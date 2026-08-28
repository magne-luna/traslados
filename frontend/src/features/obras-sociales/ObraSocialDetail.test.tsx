import { describe, expect, it, vi } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ObraSocial } from '../../shared/types/obraSocial';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { ObraSocialDetail } from './ObraSocialDetail';

// Sombra local de `render` (mismo nombre) para no tocar ninguno de los ~20 call-sites de este
// archivo: todos ya asumían que `render(<ObraSocialDetail .../>)` alcanzaba. Antes envolvía en
// `PrestadorRepositoryProvider` (`ObraSocialDetail` montaba `PrestadoresDeObraSocial`) — removido
// junto con el módulo Prestador (change `sacar-prestadores`).
function render(ui: React.ReactElement) {
  return rtlRender(ui);
}

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

const osecac: ObraSocial = {
  id: 'osecac',
  nombre: 'OSECAC',
  cuit: '30-54155200-6',
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
  formatoAfiliado: 'numero-documento',
  checklist: [{ id: 'i1', nombre: 'RHC', requerido: true }],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
};

describe('ObraSocialDetail — modo alta (obraSocial null)', () => {
  it('solo muestra el formulario general, sin editor de checklist ni de plantilla', () => {
    render(<ObraSocialDetail obraSocial={null} crear={vi.fn()} actualizar={vi.fn()} onCreated={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByLabelText(/^nombre$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/nuevo ítem/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/nueva etiqueta/i)).not.toBeInTheDocument();
  });

  it('al guardar, llama a crear() con checklist vacío y el identificadorOrigen default, y avisa onCreated', async () => {
    const user = userEvent.setup();
    const creada = { ...osecac, id: 'nueva-1', nombre: 'Swiss Medical', checklist: [] };
    const crear = vi.fn().mockResolvedValue(creada);
    const onCreated = vi.fn();

    render(<ObraSocialDetail obraSocial={null} crear={crear} actualizar={vi.fn()} onCreated={onCreated} onBack={vi.fn()} />);

    await user.type(screen.getByLabelText(/^nombre$/i), 'Swiss Medical');
    await user.type(screen.getByLabelText(/cuit/i), '30-11111111-1');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(crear).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Swiss Medical',
        cuit: '30-11111111-1',
        checklist: [],
        plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
      }),
    );
    expect(onCreated).toHaveBeenCalledWith(creada);
  });
});

// Los 4 campos del docx en el resumen de solo lectura (tasks.md 2.7, D9).
describe('ObraSocialDetail — los 4 campos del docx en el resumen (2.7)', () => {
  it('muestra código/dirección/teléfono/condición IVA cuando están completos', () => {
    const conDatos: ObraSocial = {
      ...osecac,
      codigo: 'OS-01',
      direccion: 'Callao 100',
      telefono: '11-1111-2222',
      condicionIva: 'IVA_SUJETO_EXENTO',
    };

    render(<ObraSocialDetail obraSocial={conDatos} crear={vi.fn()} actualizar={vi.fn()} onCreated={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText('OS-01')).toBeInTheDocument();
    expect(screen.getByText('Callao 100')).toBeInTheDocument();
    expect(screen.getByText('11-1111-2222')).toBeInTheDocument();
    expect(screen.getByText('IVA Sujeto Exento')).toBeInTheDocument();
  });

  it('no rompe el resumen cuando los 4 campos están ausentes (obra social vieja del mock v1)', () => {
    render(<ObraSocialDetail obraSocial={osecac} crear={vi.fn()} actualizar={vi.fn()} onCreated={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getAllByText('OSECAC').length).toBeGreaterThan(0);
  });
});

describe('ObraSocialDetail — modo edición', () => {
  it('por defecto muestra un resumen de solo lectura (sin form) junto con el checklist y la plantilla', () => {
    render(
      <ObraSocialDetail obraSocial={osecac} crear={vi.fn()} actualizar={vi.fn()} onCreated={vi.fn()} onBack={vi.fn()} />,
    );

    expect(screen.getAllByText('OSECAC').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/^nombre$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /editar datos/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nuevo ítem/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nueva etiqueta/i)).toBeInTheDocument();
    expect(screen.getAllByText('RHC').length).toBeGreaterThan(0);
  });

  it('al apretar "Editar datos" muestra el form precargado', async () => {
    const user = userEvent.setup();

    render(
      <ObraSocialDetail obraSocial={osecac} crear={vi.fn()} actualizar={vi.fn()} onCreated={vi.fn()} onBack={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /editar datos/i }));

    expect(screen.getByLabelText(/^nombre$/i)).toHaveValue('OSECAC');
  });

  it('al guardar los datos generales, llama a actualizar(id, valores) y vuelve al resumen', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockResolvedValue(osecac);

    render(
      <ObraSocialDetail obraSocial={osecac} crear={vi.fn()} actualizar={actualizar} onCreated={vi.fn()} onBack={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /editar datos/i }));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(actualizar).toHaveBeenCalledWith(
      'osecac',
      expect.objectContaining({ nombre: 'OSECAC', cuit: '30-54155200-6' }),
    );
    expect(await screen.findByRole('button', { name: /editar datos/i })).toBeInTheDocument();
  });

  it('al editar el checklist, persiste el cambio vía actualizar(id, { checklist })', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockResolvedValue(osecac);

    render(
      <ObraSocialDetail obraSocial={osecac} crear={vi.fn()} actualizar={actualizar} onCreated={vi.fn()} onBack={vi.fn()} />,
    );

    await user.type(screen.getByLabelText(/nuevo ítem/i), 'FIM');
    // El botón lleva prefijo "+ " (feedback de usuario: "todos los botones de agregar o crear
    // tengan el +") — match exacto de "+ Agregar" en vez de "Agregar" a secas: esta pantalla
    // también tiene "Agregar campo" (PlantillaFacturaEditor), un botón distinto.
    await user.click(screen.getByRole('button', { name: /^\+ agregar$/i }));

    expect(actualizar).toHaveBeenCalledWith('osecac', {
      checklist: [osecac.checklist[0], expect.objectContaining({ nombre: 'FIM' })],
    });
  });

  it('al editar la plantilla, persiste el cambio vía actualizar(id, { plantillaFactura })', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockResolvedValue(osecac);

    render(
      <ObraSocialDetail obraSocial={osecac} crear={vi.fn()} actualizar={actualizar} onCreated={vi.fn()} onBack={vi.fn()} />,
    );

    await user.selectOptions(screen.getByLabelText(/identificador en la factura/i), 'paciente.dni');

    expect(actualizar).toHaveBeenCalledWith('osecac', {
      plantillaFactura: { campos: [], identificadorOrigen: 'paciente.dni' },
    });
  });

  it('muestra el error del repository si crear/actualizar falla', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockRejectedValue(new Error('nombre duplicado'));

    render(
      <ObraSocialDetail obraSocial={osecac} crear={vi.fn()} actualizar={actualizar} onCreated={vi.fn()} onBack={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /editar datos/i }));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText('nombre duplicado')).toBeInTheDocument();
  });
});

// Carteles de discrepancia (tasks.md 6.2/6.3, D8/D9/D12). Mismo patrón que
// PacienteDetail.test.tsx: escopear con getAllByRole('note').find(...) + toHaveTextContent, nunca
// getByText con regex (el texto usa <strong> y getNodeText solo concatena text nodes directos).
describe('ObraSocialDetail — carteles de discrepancia (6.2/6.3)', () => {
  function encontrarCartel(regex: RegExp): HTMLElement {
    const notas = screen.getAllByRole('note');
    const cartel = notas.find((nota) => regex.test(nota.textContent ?? ''));
    if (!cartel) throw new Error(`No se encontró el cartel que matchea ${String(regex)}`);
    return cartel;
  }

  it('el cartel de facturación dice qué quedó resuelto (D4/D9) y qué sigue abierto (condición IVA, #14)', () => {
    render(<ObraSocialDetail obraSocial={osecac} crear={vi.fn()} actualizar={vi.fn()} onCreated={vi.fn()} onBack={vi.fn()} />);

    const cartel = encontrarCartel(/ya son columnas reales/i);
    expect(cartel).toHaveTextContent(/plazo de cobro/i);
    expect(cartel).toHaveTextContent(/condición frente al iva/i);
    expect(cartel).toHaveTextContent(/no enumera/i);
  });

  it('ningún cartel se duplica al re-renderizar', () => {
    render(<ObraSocialDetail obraSocial={osecac} crear={vi.fn()} actualizar={vi.fn()} onCreated={vi.fn()} onBack={vi.fn()} />);

    const notas = screen.getAllByRole('note');
    const cartelesUnicos = new Set(notas.map((n) => n.textContent));
    expect(cartelesUnicos.size).toBe(notas.length);
  });
});

// Gateo de escritura (gateo-obrasocial, tasks.md 4.2/4.4): "Editar" del detalle queda visible y
// no activable sin permiso `write`; "Volver al listado" (arriba y abajo) sigue operativo siempre.
describe('ObraSocialDetail — gateo de escritura', () => {
  it('sin permiso: "Editar datos" queda visible y no se puede activar', () => {
    renderConPermiso(
      false,
      <ObraSocialDetail obraSocial={osecac} crear={vi.fn()} actualizar={vi.fn()} onCreated={vi.fn()} onBack={vi.fn()} />,
    );

    const editar = screen.getByRole('button', { name: /editar datos/i });
    expect(editar).toBeVisible();
    expect(editar).toBeDisabled();
  });

  it('con permiso write: "Editar datos" está activable', () => {
    renderConPermiso(
      true,
      <ObraSocialDetail obraSocial={osecac} crear={vi.fn()} actualizar={vi.fn()} onCreated={vi.fn()} onBack={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /editar datos/i })).toBeEnabled();
  });

  it('sin permiso: "Volver al listado" (arriba y abajo) sigue operativo', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    renderConPermiso(
      false,
      <ObraSocialDetail obraSocial={osecac} crear={vi.fn()} actualizar={vi.fn()} onCreated={vi.fn()} onBack={onBack} />,
    );

    const enlaces = screen.getAllByRole('button', { name: /volver al listado/i });
    expect(enlaces.length).toBeGreaterThan(0);
    for (const enlace of enlaces) expect(enlace).toBeEnabled();

    await user.click(enlaces[0]!);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

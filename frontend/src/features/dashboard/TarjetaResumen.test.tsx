import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { TarjetaResumen } from './TarjetaResumen';

// tasks.md 6.3, spec dashboard-tarjetas-alertas (Requirement "Presentación uniforme de las
// tarjetas"): conteo total destacado, lista acotada a MAX_ITEMS_TARJETA, enlace al módulo de
// origen, estado vacío afirmativo, estados de carga/error propios, keys por id estable,
// severidad comunicada con texto además del color.

function renderTarjeta(props: Partial<React.ComponentProps<typeof TarjetaResumen>> = {}) {
  return render(
    <MemoryRouter>
      <TarjetaResumen
        titulo="Facturas en mora"
        cargando={false}
        error={null}
        items={[]}
        mensajeVacio="No hay facturas en mora."
        enlace={{ to: '/facturacion', label: 'Ver facturación' }}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('TarjetaResumen', () => {
  it('muestra el conteo total real y la lista acotada, con enlace al módulo de origen', () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ id: `item-${i}`, label: `Ítem ${i}` }));
    renderTarjeta({ items });

    expect(screen.getByText('8')).toBeInTheDocument();
    // MAX_ITEMS_TARJETA = 5: solo los primeros 5 aparecen en la lista.
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByRole('link', { name: 'Ver facturación' })).toHaveAttribute('href', '/facturacion');
  });

  it('muestra un estado vacío explícito y afirmativo cuando no hay ítems', () => {
    renderTarjeta({ items: [] });
    expect(screen.getByText('No hay facturas en mora.')).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('muestra su propio estado de carga', () => {
    renderTarjeta({ cargando: true });
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('muestra su propio estado de error, acotado a la tarjeta', () => {
    renderTarjeta({ error: 'No se pudo cargar.' });
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar.');
  });

  it('comunica la severidad con texto o etiqueta además del color', () => {
    renderTarjeta({ items: [{ id: 'a', label: 'Vencida', severidad: 'critico' }] });
    expect(screen.getByText(/cr[ií]tic/i)).toBeInTheDocument();
  });

  it('usa el id como key estable, no el índice (no rompe al reordenar)', () => {
    const items = [
      { id: 'b', label: 'B' },
      { id: 'a', label: 'A' },
    ];
    renderTarjeta({ items });
    const textos = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(textos[0]).toContain('B');
    expect(textos[1]).toContain('A');
  });
});

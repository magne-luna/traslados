import { useMemo, useState } from 'react';
import { Button, SearchInput } from '../../design-system/components';
import { Alert, EmptyState } from '../../design-system/feedback';
import { Table, Td, Th, Tr } from '../../design-system/table';
import type { Cuenta } from '../../shared/lib/cuentas/CuentaRepository';

interface CuentasListProps {
  cuentas: Cuenta[];
  loading: boolean;
  error: string | null;
  onSelect: (cuenta: Cuenta) => void;
  onRetry: () => void;
}

// Listado de cuentas (design.md D9, tasks.md 7.2): Table del design system, no grid de tarjetas
// (a diferencia de los 5 listados de dominio). Solo email/rol como columnas — nombre y módulos se
// muestran en el detalle (CuentaDetail), no acá, para que la fila quede liviana de escanear.
// "Fila 100% clickeable" (D9) se resuelve con el mismo criterio que las Card interactive de
// listado (ObrasSocialesList y hermanos): el `<Tr interactive>` cablea el click de mouse sobre
// toda la fila, y el email es además un `<button>` real — la vía de accesibilidad por teclado
// (react-best-practices: nunca depender solo de un div/tr con onClick para el foco).
export function CuentasList({ cuentas, loading, error, onSelect, onRetry }: CuentasListProps) {
  const [busqueda, setBusqueda] = useState('');

  // Filtro local por nombre/apellido/email, mismo patrón que ObrasSocialesList (búsqueda cliente,
  // sin concepto de "estado" que amerite un filtro aparte) — busca por nombre/apellido aunque esas
  // columnas ya no se muestren en la tabla, siguen siendo un criterio de búsqueda válido.
  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return cuentas;
    return cuentas.filter(
      (cuenta) =>
        cuenta.nombre.toLowerCase().includes(termino) ||
        cuenta.apellido.toLowerCase().includes(termino) ||
        cuenta.email.toLowerCase().includes(termino),
    );
  }, [busqueda, cuentas]);

  return (
    <div className="flex flex-col gap-lg">
      {error && (
        <Alert tone="danger">
          <div className="flex flex-wrap items-center justify-between gap-sm">
            <span>{error}</span>
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Reintentar
            </Button>
          </div>
        </Alert>
      )}

      {cuentas.length > 0 && (
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar cuenta…" ariaLabel="Buscar cuenta" />
      )}

      {loading ? (
        <p className="font-body text-sm text-muted">Cargando cuentas…</p>
      ) : cuentas.length === 0 ? (
        <EmptyState message="No hay cuentas cargadas todavía." />
      ) : filtradas.length === 0 ? (
        <p className="font-body text-sm text-muted">Ninguna cuenta coincide con "{busqueda}".</p>
      ) : (
        <Table caption="Listado de cuentas del sistema">
          <thead>
            <Tr>
              <Th scope="col" align="left">
                Email
              </Th>
              <Th scope="col" align="left">
                Rol
              </Th>
            </Tr>
          </thead>
          <tbody>
            {filtradas.map((cuenta) => (
              <Tr key={cuenta.id} divided interactive onClick={() => onSelect(cuenta)}>
                <Td>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(cuenta);
                    }}
                    className="cursor-pointer border-none bg-transparent p-0 text-left font-body text-[13px] font-semibold text-primary"
                  >
                    {cuenta.email}
                  </button>
                </Td>
                <Td>{cuenta.rol}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Button } from '../../design-system/components';
import { CuentaDetail } from './CuentaDetail';
import { CuentaForm, type CuentaFormValues } from './CuentaForm';
import { useCuentaRepository } from './CuentaRepositoryContext';
import { CuentasList } from './CuentasList';
import { useCuentas } from './useCuentas';

type View = { kind: 'list' } | { kind: 'detail'; cuentaId: string } | { kind: 'create' };

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
}

// Composición de la pantalla de cuentas (design.md D9, tasks.md 7.7-7.9): igual patrón que
// ObraSocialesPage — resuelve el repository del context, wire de useCuentas, y decide qué vista
// mostrar (listado / detalle / alta). Estados de carga/error/vacío explícitos (frontend-ui-design
// — nunca una pantalla en blanco); los controles de escritura (crear, guardar permisos) se
// deshabilitan mientras su propia operación está en curso (`creando`/`guardando` locales, no el
// `loading` del listado — evita bloquear toda la pantalla por una operación puntual).
export function CuentasPage() {
  const repository = useCuentaRepository();
  const { cuentas, loading, error, recargar, crearCuenta, actualizarPermisos } = useCuentas(repository);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [creando, setCreando] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCrear(values: CuentaFormValues) {
    setCreando(true);
    setCreateError(null);
    try {
      await crearCuenta(values);
      setView({ kind: 'list' });
    } catch (err) {
      setCreateError(toErrorMessage(err));
    } finally {
      setCreando(false);
    }
  }

  if (view.kind === 'create') {
    return (
      <div className="flex flex-col gap-lg py-xxl px-xl">
        <h1 className="m-0 font-heading text-[21px] font-bold text-ink">Nueva cuenta</h1>
        <CuentaForm
          onSubmit={(values) => void handleCrear(values)}
          onCancel={() => {
            setCreateError(null);
            setView({ kind: 'list' });
          }}
          submitting={creando}
          submitError={createError}
        />
      </div>
    );
  }

  // La cuenta seleccionada puede haberse borrado externamente entre la carga y el click (404 de
  // update-permisos, ver design.md D7) — se degrada a "sin selección" en vez de reventar; con el
  // listado siempre montado (layout de dos paneles) alcanza con no encontrar match, sin un branch
  // de return separado como antes.
  const cuentaSeleccionada = view.kind === 'detail' ? (cuentas.find((c) => c.id === view.cuentaId) ?? null) : null;

  return (
    <div className="flex flex-col gap-lg py-xxl px-xl">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <h1 className="m-0 font-heading text-[21px] font-bold text-ink">Cuentas</h1>
        <Button variant="primary" onClick={() => setView({ kind: 'create' })}>
          + Nueva cuenta
        </Button>
      </div>

      <div className="flex flex-col gap-lg md:flex-row md:items-start">
        {/* Panel de listado: en mobile se oculta al seleccionar una cuenta (evita el scroll doble
            de tener listado + detalle apilados); en desktop queda siempre visible al lado del
            detalle (RNF-08, layout maestro-detalle). */}
        <div className={`md:w-90 md:shrink-0 ${cuentaSeleccionada ? 'hidden md:block' : 'block'}`}>
          <CuentasList
            cuentas={cuentas}
            loading={loading}
            error={error}
            onSelect={(cuenta) => setView({ kind: 'detail', cuentaId: cuenta.id })}
            onRetry={() => void recargar()}
          />
        </div>

        <div className={`min-w-0 flex-1 ${cuentaSeleccionada ? 'block' : 'hidden md:block'}`}>
          {cuentaSeleccionada ? (
            <CuentaDetail cuenta={cuentaSeleccionada} onActualizarPermisos={actualizarPermisos} onBack={() => setView({ kind: 'list' })} />
          ) : (
            <div className="flex items-center justify-center rounded-sm border border-dashed border-border py-xxl">
              <p className="font-body text-sm text-muted">Seleccioná una cuenta para ver el detalle.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { AvisoModeloDatos, Chip, Section, VolverAlListadoButton, VolverAlListadoLink } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Card } from '../../design-system/layout';
import type { Cuenta } from '../../shared/lib/cuentas/CuentaRepository';
import type { Permiso } from '../../shared/types/usuario';
import { ETIQUETA_MODULO, ETIQUETA_NIVEL, mapaAFilas, MODULOS, NIVEL_COLOR } from './modulos';
import { MatrizPermisos } from './MatrizPermisos';

interface CuentaDetailProps {
  cuenta: Cuenta;
  onActualizarPermisos: (usuarioId: string, permisos: Permiso[]) => Promise<void>;
  onBack: () => void;
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
}

// Mismo helper que iniciales() de PersonasACargoEditor.tsx — no se extrae a un shared todavía
// (un solo caso más no justifica la abstracción, YAGNI).
function iniciales(cuenta: Pick<Cuenta, 'nombre' | 'apellido'>): string {
  return `${cuenta.nombre.charAt(0)}${cuenta.apellido.charAt(0)}`.toUpperCase();
}

// Detalle de cuenta (design.md D9, tasks.md 7.6): perfil de solo lectura (nombre/email/chip de
// rol/Chips de los 4 módulos — cambiar el rol o el email no entra en este change, ver proposal.md
// Open Questions) + MatrizPermisos wireada contra CuentaRepository.actualizarPermisos. Los 4
// módulos se muestran SIEMPRE (no solo los habilitados) coloreados por NIVEL_COLOR — el color
// comunica qué tipo de acceso tiene la cuenta en cada uno (verde admin, azul escritura, naranja
// lectura, rojo sin acceso), no qué módulo es (a diferencia del ícono de identidad fija en
// PermisosMatrizFields). El manejo de submitting/error de la matriz vive acá (no en
// MatrizPermisos, que es presentacional puro) — mismo criterio que ObraSocialDetail con
// sectionError para ChecklistEditor/PlantillaFacturaEditor.
export function CuentaDetail({ cuenta, onActualizarPermisos, onBack }: CuentaDetailProps) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filasPorModulo = mapaAFilas(cuenta.permisos);

  async function handleGuardarPermisos(permisos: Permiso[]) {
    setGuardando(true);
    setError(null);
    try {
      await onActualizarPermisos(cuenta.id, permisos);
    } catch (err) {
      // No se re-lanza: MatrizPermisos invoca esto vía `void handleGuardar()` (sin propio
      // try/catch), relanzar dejaría una promesa rechazada sin manejar en el click handler.
      setError(toErrorMessage(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col gap-xl py-xxl px-xl">
      <VolverAlListadoLink onClick={onBack} />

      <Section label="Cuenta" title={`${cuenta.nombre} ${cuenta.apellido}`}>
        <Card radius="sm" gap="md">
          <div className="flex flex-wrap items-center gap-md">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-pill bg-border-strong font-body text-[15px] font-bold text-ink">
              {iniciales(cuenta)}
            </span>
            <div className="flex flex-col gap-xs">
              <div className="flex flex-wrap items-center gap-sm">
                <span className="font-body text-[15px] font-semibold text-ink">
                  {cuenta.nombre} {cuenta.apellido}
                </span>
                <span className={`font-body text-[13px] font-semibold capitalize ${cuenta.rol === 'admin' ? 'text-info' : 'text-muted'}`}>
                  {cuenta.rol}
                </span>
              </div>
              <span className="font-mono text-[12px] text-muted">{cuenta.email}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-md">
            {MODULOS.map((modulo) => {
              const nivel = filasPorModulo[modulo];
              return (
                <div key={modulo} className="flex flex-col items-center gap-xs">
                  <Chip kind={NIVEL_COLOR[nivel]}>{ETIQUETA_MODULO[modulo]}</Chip>
                  <span className="font-body text-[12px] text-muted">
                    {nivel === 'sin_acceso' ? 'Sin acceso' : ETIQUETA_NIVEL[nivel]}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </Section>

      <Section label="Permisos" title="Matriz de permisos por módulo">
        {/* tasks.md 1.3 (permisos-modulos-granulares), regla dura del proyecto sobre
            discrepancias docx↔KB: el catálogo de 7 módulos (antes 4) no es un pedido del cliente
            — es una decisión de UX confirmada con la usuaria, documentada también en
            knowledge-base/04_modelo_de_datos.md §Discrepancias y en CHANGES.md. */}
        <AvisoModeloDatos>
          El catálogo pasó de 4 a 7 módulos (se separaron Hojas de Ruta, Presupuestos y Vehículos
          de sus módulos padre). Esto no es un pedido del cliente: es una decisión de UX confirmada
          con la usuaria, pendiente de confirmar con quien mantiene{' '}
          <code>Traslados-Modelo-Datos.docx</code>, que nombra 4 módulos.
        </AvisoModeloDatos>
        {cuenta.rol === 'admin' ? (
          // tienePermiso (shared/lib/auth/permisos.ts) da acceso total a cualquier cuenta admin
          // sin mirar la matriz — no se muestra editable para no confundir (si más adelante se le
          // baja el rol a empleado, la matriz vuelve a aparecer acá con los valores que ya tenía).
          <Alert tone="info">Las cuentas con rol admin tienen acceso completo a todos los módulos — la matriz de permisos no aplica.</Alert>
        ) : (
          <MatrizPermisos permisos={cuenta.permisos} onGuardar={handleGuardarPermisos} guardando={guardando} error={error} />
        )}
      </Section>

      <VolverAlListadoButton onClick={onBack} />
    </div>
  );
}

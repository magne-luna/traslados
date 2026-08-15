import { useId, useState, type FormEvent } from 'react';
import { Button, CamposSoloLectura, InlineIcon } from '../../design-system/components';
import { Field, Input } from '../../design-system/form';
import { Alert } from '../../design-system/feedback';
import { Card } from '../../design-system/layout';
import { iconCalendario, iconMoneda, iconReloj, iconTacho } from '../../design-system/icons';
import type { Cobro, Factura, NuevoCobro } from '../../shared/types/factura';
import type { ObraSocial } from '../../shared/types/obraSocial';
import { saldoFactura } from '../../shared/lib/facturacion/totalesFactura';
import { validateCobroForm, type CobroFormErrors } from './validateCobroForm';

interface CobrosPanelProps {
  factura: Factura;
  cobros: Cobro[];
  loading: boolean;
  error: string | null;
  registrar: (data: NuevoCobro) => Promise<Cobro | void>;
  eliminar: (id: string) => Promise<void>;
  /**
   * Obra social del paciente de esta factura (RF-306: define si admite pagos parciales).
   * `undefined` en casos legacy/dato faltante — se resuelve como si admitiera parciales
   * (fallback seguro, no bloquear si no se sabe con certeza que no admite).
   */
  obraSocial?: ObraSocial;
}

// Campo "Monto" con prefijo `$` superpuesto (`pl-xl` deja lugar al símbolo): mismo caso que
// `AutorizacionForm.tsx:144` documentado en design.md Decisión 9 (requeriría un `prefix` en
// `Input`, composición nueva no cubierta por este change) — el `<input>` sigue nativo, solo el
// wrapper label+error alrededor migra a `Field` (tasks.md 16.3, gobernanza MEDIO reportada).
const fieldClasses =
  'w-full rounded-sm border border-border-strong bg-surface px-md py-2 font-body text-[13px] text-text';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// Formatea una fecha ISO (YYYY-MM-DD) a texto legible ("5 de Agosto, 2026") sin pasar por `Date`
// (evita corrimientos de huso horario al parsear una fecha sin componente horario — el mismo
// motivo por el que el resto del módulo maneja fechas como strings ISO planos).
function formatearFechaLarga(fechaIso: string): string {
  const [anioTexto, mesTexto, diaTexto] = fechaIso.split('-');
  const nombreMes = MESES[Number(mesTexto) - 1] ?? '';
  const nombreMesCapitalizado = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);
  return `${Number(diaTexto)} de ${nombreMesCapitalizado}, ${anioTexto}`;
}

// Panel de cobros y pagos parciales de la factura (tasks.md 9.2), rediseñado siguiendo la
// convención de UI del proyecto: bloques de "Total cobrado"/"Saldo pendiente" destacados con
// ícono y color semántico (success/warning), historial como filas de transacción (ícono + fecha
// legible + monto en verde + botón de quitar), y alta con fecha/monto (con signo $) + botón
// alineados en fila (excepción de botón pegado al input).
// No se ofrece registrar cobros en facturas `a-facturar` — recién tienen sentido una vez emitida
// (design.md Decisión 10: la transición dispara el circuito de cobros).
//
// Migrado a Card/Field/Input/Alert (tasks.md 16.3): contenedor `Card radius="md" padding="lg"
// gap="lg" elevated` reproduce `rounded-md border border-border bg-surface p-lg shadow-sm gap-lg`
// byte a byte (confirmado por comparación de clases, el sitio ya usaba `rounded-md`, no
// `rounded-sm`). Ver el comentario de `fieldClasses` arriba para el caso del campo Monto.
export function CobrosPanel({ factura, cobros, loading, error, registrar, eliminar, obraSocial }: CobrosPanelProps) {
  const [fecha, setFecha] = useState('');
  const [monto, setMonto] = useState('');
  const [errors, setErrors] = useState<CobroFormErrors>({});
  const formId = useId();

  const cobrosOrdenados = [...cobros].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const totalCobrado = cobros.reduce((acumulado, cobro) => acumulado + cobro.montoPagado, 0);
  const saldo = saldoFactura(factura, cobros);
  const pctCobrado = factura.monto > 0 ? Math.round((totalCobrado / factura.monto) * 1000) / 10 : null;
  // RF-306: fallback seguro `true` si no se puede resolver la obra social (caso legacy/dato
  // faltante) — no bloquear si no se sabe con certeza que no admite pagos parciales.
  const admitePagosParciales = obraSocial?.admitePagosParciales ?? true;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const montoNumerico = Number(monto);
    const validationErrors = validateCobroForm({
      montoPagado: montoNumerico,
      fecha,
      montoFactura: factura.monto,
      totalCobradoActual: totalCobrado,
      admitePagosParciales,
    });
    setErrors(validationErrors);
    if (validationErrors.montoPagado || validationErrors.fecha || validationErrors.pagoParcialNoAdmitido) return;
    void registrar({ facturaId: factura.id, fecha, montoPagado: montoNumerico });
    setFecha('');
    setMonto('');
  }

  return (
    <Card radius="md" padding="lg" gap="lg" elevated>
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <div className="flex items-center gap-md rounded-md bg-success-soft p-lg">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
            <InlineIcon size={18}>{iconMoneda}</InlineIcon>
          </span>
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="font-body text-[11px] font-semibold uppercase tracking-[0.06em] text-success">Total cobrado</span>
            <span className="font-heading text-[22px] font-bold text-success">${totalCobrado.toLocaleString('es-AR')}</span>
          </div>
          {pctCobrado !== null && (
            <span className="rounded-pill bg-success/20 px-sm py-0.5 font-body text-[11px] font-semibold text-success">{pctCobrado}%</span>
          )}
        </div>

        <div className="flex items-center gap-md rounded-md bg-warning-soft p-lg">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/20 text-warning">
            <InlineIcon size={18}>{iconReloj}</InlineIcon>
          </span>
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="font-body text-[11px] font-semibold uppercase tracking-[0.06em] text-warning">Saldo pendiente</span>
            <span className="font-heading text-[22px] font-bold text-warning">${saldo.toLocaleString('es-AR')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-lg md:grid-cols-2">
        <div className="flex flex-col gap-sm">
          <h3 className="m-0 font-body text-[14px] font-semibold text-ink">Historial de pagos</h3>
          {loading ? (
            <p className="m-0 font-body text-sm text-muted">Cargando cobros…</p>
          ) : cobrosOrdenados.length === 0 ? (
            <p className="m-0 font-body text-sm text-muted">No hay cobros registrados todavía.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-xs p-0">
              {cobrosOrdenados.map((cobro) => (
                <li key={cobro.id} className="flex flex-wrap items-center justify-between gap-md rounded-md border border-border bg-surface-soft px-md py-sm">
                  <div className="flex items-center gap-md">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted">
                      <InlineIcon size={16}>{iconCalendario}</InlineIcon>
                    </span>
                    <div className="flex flex-col">
                      <span className="font-body text-[13px] font-semibold text-ink">Pago parcial</span>
                      <span className="font-body text-[12px] text-muted">{formatearFechaLarga(cobro.fecha)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-md">
                    <span className="font-body text-[14px] font-semibold text-success">+${cobro.montoPagado.toLocaleString('es-AR')}</span>
                    {/* gateo-facturacion (design.md D2, tasks.md 5.2): "Quitar cobro" es un
                        <button> nativo — el envoltorio de solo lectura lo cubre igual que a
                        "Registrar cobro" más abajo. El historial (texto de arriba) sigue
                        legible con solo `read`. */}
                    <CamposSoloLectura>
                    <button
                      type="button"
                      onClick={() => void eliminar(cobro.id)}
                      aria-label="Quitar cobro"
                      className="cursor-pointer rounded-sm border-none bg-transparent p-xs text-muted transition-colors hover:text-danger"
                    >
                      <InlineIcon size={16}>{iconTacho}</InlineIcon>
                    </button>
                    </CamposSoloLectura>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-sm md:border-l md:border-border md:pl-lg">
          <h3 className="m-0 font-body text-[14px] font-semibold text-ink">Registrar nuevo cobro</h3>
          {factura.estado === 'a-facturar' ? (
            <p className="m-0 font-body text-sm text-muted">Emití la factura para poder registrar cobros.</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-md">
              {/* gateo-facturacion (design.md D2, tasks.md 5.2): registrar un cobro es una
                  escritura no-CRUD gateada al mismo nivel `write` que un Guardar — ninguna
                  acción de dinero requiere `admin` (decisión 5 de la usuaria). Sin `Cancelar`
                  en este alta: el envoltorio cubre campos y submit por igual. */}
              <CamposSoloLectura>
              <Field label="Fecha" htmlFor={`${formId}-fecha`} error={errors.fecha}>
                <Input id={`${formId}-fecha`} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </Field>
              <Field label="Monto" htmlFor={`${formId}-monto`} error={errors.montoPagado ?? errors.pagoParcialNoAdmitido}>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-md flex items-center font-body text-[13px] text-muted">$</span>
                  <input
                    id={`${formId}-monto`}
                    type="number"
                    className={`${fieldClasses} pl-xl`}
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                  />
                </div>
              </Field>
              <div className="flex items-center justify-end gap-md pt-xs">
                {errors.alertaExceso && <span className="font-body text-xs text-warning">{errors.alertaExceso}</span>}
                <Button type="submit" variant="primary">Registrar cobro</Button>
              </div>
              </CamposSoloLectura>
            </form>
          )}
        </div>
      </div>
    </Card>
  );
}

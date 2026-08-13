import { InlineIcon } from '../../design-system/components';
import { Card } from '../../design-system/layout';
import { iconCredencial } from '../../design-system/icons';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Paciente } from '../../shared/types/paciente';

interface ResumenPasoWizardProps {
  paciente: Paciente | undefined;
  obraSocial: ObraSocial | undefined;
  /** Días facturables y total, solo disponibles una vez llegado al Paso 3 (o en edición, donde
   * ya están cargados de entrada) — omitido en los Pasos 1 y 2, donde todavía no existen. */
  datosFactura?: { dias: number; total: number };
  /** Etiqueta de la autorización elegida en el Paso 2 (change `facturacion-seleccion-autorizacion`,
   * design.md D4): reemplaza a `prestadorNombre`/`prestadorDomicilio`, retirados por completo
   * (D5). Ausente mientras no se eligió ninguna autorización. */
  autorizacionLabel?: string;
}

function iniciales(paciente: Paciente): string {
  return `${paciente.nombre[0] ?? ''}${paciente.apellido[0] ?? ''}`.toUpperCase();
}

// Panel de contexto de TODO el flujo de alta/edición (integración del prototipo "Con contexto",
// 2026-08-05, feedback de la usuaria: "el select de todo el ancho me hace pésimo" en los Pasos
// 1-2, y después "el formulario entero" no convencía como flujo — la combinación wizard + vista
// plana con acordeón se sentía como dos formularios distintos). Un mismo panel, cada vez un poco
// más completo, acompaña los tres pasos del wizard Y la vista de edición: en los Pasos 1-2 (y en
// edición antes de que haya días/total) solo muestra paciente/obra social; en el Paso 3 y en
// edición además muestra `datosFactura` — así el mismo concepto de "campos a la izquierda,
// contexto a la derecha" corre de punta a punta, en vez de que el Paso 3 cambie a otro patrón
// (antes: acordeón sin panel). Puramente de lectura: nunca gatea con `CamposSoloLectura` porque no
// hay nada editable adentro.
//
// `prestadorNombre`/`prestadorDomicilio` se retiraron por completo (change
// `facturacion-seleccion-autorizacion`, design.md D5) — la autorización elegida en el Paso 2
// (`autorizacionLabel`) los reemplaza (D4, sección 3).
export function ResumenPasoWizard({ paciente, obraSocial, datosFactura, autorizacionLabel }: ResumenPasoWizardProps) {
  return (
    <Card radius="sm" padding="lg" gap="sm" background="surface-soft">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">Esta factura, hasta ahora</span>
      {!paciente ? (
        <p className="m-0 font-body text-[13px] text-muted">Elegí un paciente para ver acá su obra social y sus datos.</p>
      ) : (
        <div className="flex flex-col gap-md">
          <div className="flex items-center gap-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-softer/40 font-heading text-[14px] font-bold text-primary">
              {iniciales(paciente)}
            </span>
            <div className="flex flex-col">
              <span className="font-body text-[14px] font-semibold text-ink">{paciente.apellido}, {paciente.nombre}</span>
              <span className="font-mono text-[12px] text-muted">DNI {paciente.dni}</span>
            </div>
          </div>

          {obraSocial && (
            <div className="flex items-center gap-xs font-body text-[13px] text-text">
              <InlineIcon size={14}>{iconCredencial}</InlineIcon>
              {obraSocial.nombre}
            </div>
          )}

          {autorizacionLabel && (
            <div className="flex items-center gap-xs font-body text-[13px] text-text">
              <InlineIcon size={14}>{iconCredencial}</InlineIcon>
              {autorizacionLabel}
            </div>
          )}

          {datosFactura && (
            <>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between font-body text-[13px] text-text">
                <span className="text-muted">Días facturables</span>
                <span className="font-semibold">{datosFactura.dias}</span>
              </div>
              <div className="flex items-center justify-between font-body text-[13px] text-text">
                <span className="text-muted">Total</span>
                <span className="font-mono font-semibold">${datosFactura.total.toLocaleString('es-AR')}</span>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

import { chipColors } from '../../design-system/components';
import { etiquetaPeriodoMes } from '../../shared/lib/presupuestos/periodoAutorizacion';
import type { CoherenciaPeriodo } from '../../shared/lib/presupuestos/periodoAutorizacion';

interface AlertaCoherenciaPeriodoProps {
  resultado: CoherenciaPeriodo;
  /** `undefined` = autorización legacy sin período (design.md D3). */
  periodoMes: string | undefined;
  /** 1-12, mismo tipo que `Factura.mesFacturado`. */
  mesFacturado: number;
  anioFacturado: number;
}

function etiquetaMesFacturado(mesFacturado: number, anioFacturado: number): string {
  const mesPadded = String(mesFacturado).padStart(2, '0');
  return etiquetaPeriodoMes(`${anioFacturado}-${mesPadded}-01`);
}

// `autorizacion-mensual` (design.md D7, tasks.md 6b.3, firma G5 en tasks.md 0.3): aviso NO
// bloqueante de coherencia entre el mes facturado (Paso 3) y el `periodoMes` de la autorización
// elegida (Paso 2). Mismo molde persistente que `AlertaMontoAutorizado`/`AlertaCupo` (3 tonos según
// el estado, nunca un toast que se pierde) -- reusa `validarCoherenciaPeriodo`/`coincidePeriodoFacturado`
// de `periodoAutorizacion.ts` (Fase 3), sin reimplementar la comparación acá. NUNCA bloquea el
// submit -- eso lo decide el caller (no bloqueando), esta función solo informa.
export function AlertaCoherenciaPeriodo({ resultado, periodoMes, mesFacturado, anioFacturado }: AlertaCoherenciaPeriodoProps) {
  const tono = resultado === 'no-coincide' ? chipColors.warning : resultado === 'legacy-sin-periodo' ? chipColors.secondary : chipColors.success;

  const mensaje =
    resultado === 'coincide'
      ? `El mes facturado (${etiquetaMesFacturado(mesFacturado, anioFacturado)}) coincide con el mes de esta autorización.`
      : resultado === 'no-coincide'
        ? `El mes facturado (${etiquetaMesFacturado(mesFacturado, anioFacturado)}) no coincide con el mes de esta autorización (${etiquetaPeriodoMes(periodoMes)}). Revisá que sea la autorización correcta antes de guardar -- esto no bloquea el guardado (RN-PA-02 admite facturación retroactiva).`
        : 'Esta autorización no tiene un mes cargado (modelo anterior a este change) -- no hay con qué comparar el mes facturado.';

  return (
    <div className="flex flex-col gap-xs">
      <div
        role="status"
        className={`rounded-sm border ${tono.border} border-l-4 ${tono.borderLeft} ${tono.bg} px-md py-sm font-body text-[13px] ${tono.fg}`}
      >
        {mensaje}
      </div>
    </div>
  );
}

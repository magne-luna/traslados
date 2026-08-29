import { AvisoModeloDatos, Button, Chip, InlineIcon } from '../../design-system/components';
import { Card } from '../../design-system/layout';
import { iconCalendario, iconDocumento, iconMoneda } from '../../design-system/icons';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { PacienteResumen } from '../../shared/types/paciente';
import type { Presupuesto } from '../../shared/types/presupuesto';

/** `vigenciaDesde – vigenciaHasta` (tasks.md 8.7, design.md D1), o "Sin vigencia cargada" —
 * mismo criterio que `PresupuestosList.textoVigencia`, nunca un rango inventado a partir de
 * `fechaEmision`. */
function textoVigencia(presupuesto: Presupuesto): string {
  if (presupuesto.vigenciaDesde === undefined && presupuesto.vigenciaHasta === undefined) {
    return 'Sin vigencia cargada';
  }
  return `${presupuesto.vigenciaDesde ?? 'Sin definir'} – ${presupuesto.vigenciaHasta ?? 'Sin definir'}`;
}

/** "Sí" / "No" / "No cargado" (tasks.md 8.7, design.md D3): `undefined` ≠ `false` — un presupuesto
 * sin este campo cargado NUNCA se muestra como "No" (SD), que sería fabricar una decisión que
 * nunca se tomó. */
function textoConDependencia(conDependencia: boolean | undefined): string {
  if (conDependencia === undefined) return 'No cargado';
  return conDependencia ? 'Sí' : 'No';
}

const DIA_SEMANA_LABEL: Record<string, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

/** Un solo `undefined` = "sin cargar" (tasks.md 8.7, design.md D2): un campo suelto no cargado
 * dentro del bloque, nunca inventado. */
function textoOpcional(valor: string | number | undefined): string {
  return valor === undefined ? 'Sin cargar' : String(valor);
}

interface PresupuestoResumenProps {
  presupuesto: Presupuesto;
  paciente: PacienteResumen | undefined;
  obraSocial: ObraSocial | undefined;
  onEdit: () => void;
}

function nombrePaciente(paciente: PacienteResumen | undefined): string {
  return paciente ? `${paciente.apellido}, ${paciente.nombre}` : 'Paciente desconocido';
}

/** `presupuesto.prestacionId` -> nombre, buscado en el catálogo del paciente (tasks.md 8.8,
 * design.md D1/D5/D9). Un presupuesto viejo puede apuntar a una prestación ya `activa: false`
 * (borrado lógico, D1) — sigue mostrándose igual, nunca "desconocida". */
function nombrePrestacion(paciente: PacienteResumen | undefined, prestacionId: string): string {
  return paciente?.prestaciones?.find((prestacion) => prestacion.id === prestacionId)?.nombre ?? 'Prestación desconocida';
}

/** Nombre de una prestación de las `lineas` del desglose (REAPERTURA #13, 2026-08-16): mismo
 * criterio que `nombrePrestacion` — una línea puede apuntar a una prestación ya borrada del
 * catálogo (borrado lógico) o huérfana por drift; se muestra el fallback, nunca se rompe. */
function nombreLineaPresupuesto(paciente: PacienteResumen | undefined, prestacionId: string): string {
  return nombrePrestacion(paciente, prestacionId);
}

/** Corrección confirmada por la usuaria (2026-08-15): la modalidad del presupuesto (general vs.
 * por-prestación) no era visible de un vistazo — había que inferirla de la presencia o ausencia
 * del stat "Prestación". Reusa el mismo criterio de resolución que ese stat (`prestacionId` contra
 * `paciente.prestaciones`), expuesto acá como chip para que se vea sin tener que interpretar nada. */
function etiquetaModalidad(presupuesto: Presupuesto, paciente: PacienteResumen | undefined): string {
  if (!presupuesto.prestacionId) return 'Presupuesto general';
  return `Presupuesto por prestación: ${nombrePrestacion(paciente, presupuesto.prestacionId)}`;
}

// Resumen de solo lectura del presupuesto, extraído de PresupuestoDetail (mismo criterio que
// PacienteResumen/VehiculoDetail — 08_arquitectura_propuesta.md §Convenciones de UI): grid de
// stats con todos los campos del form (obra social, monto, fecha de emisión, archivo) para no
// obligar a abrir "Editar datos" solo para consultar un dato.
export function PresupuestoResumen({ presupuesto, paciente, obraSocial, onEdit }: PresupuestoResumenProps) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <span className="font-body text-[14px] font-semibold text-ink">{nombrePaciente(paciente)}</span>
        <Chip kind="info">{etiquetaModalidad(presupuesto, paciente)}</Chip>
      </div>

      <div className="grid grid-cols-2 gap-md border-y border-border py-md md:grid-cols-4">
        <div className="flex flex-col gap-0.5">
          <span className="font-body text-[11px] text-muted">Obra social</span>
          <span className="font-body text-[13px] font-semibold text-ink">{obraSocial?.nombre ?? 'Obra social desconocida'}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-xs font-body text-[11px] text-muted">
            <InlineIcon>{iconMoneda}</InlineIcon>
            Monto
          </span>
          <span className="font-mono text-[13px] font-semibold text-ink">${presupuesto.monto.toLocaleString('es-AR')}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-xs font-body text-[11px] text-muted">
            <InlineIcon>{iconCalendario}</InlineIcon>
            Fecha de emisión
          </span>
          <span className="font-body text-[13px] font-semibold text-ink">{presupuesto.fechaEmision}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-xs font-body text-[11px] text-muted">
            <InlineIcon>{iconDocumento}</InlineIcon>
            Archivo
          </span>
          <span className="font-body text-[13px] font-semibold text-ink">
            {presupuesto.archivo ? presupuesto.archivo.nombre : 'Sin archivo'}
          </span>
        </div>

        {/* presupuestos-vigencia-datos-traslado-vista-previa (tasks.md 8.7, design.md D1/D3):
            "Sin vigencia cargada"/"No cargado" en vez de una celda vacía o un dato inventado. */}
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-xs font-body text-[11px] text-muted">
            <InlineIcon>{iconCalendario}</InlineIcon>
            Vigencia
          </span>
          <span className="font-body text-[13px] font-semibold text-ink">{textoVigencia(presupuesto)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-body text-[11px] text-muted">Con dependencia (CD/SD)</span>
          <span className="font-body text-[13px] font-semibold text-ink">{textoConDependencia(presupuesto.conDependencia)}</span>
        </div>

        {/* presupuesto-prestacion (tasks.md 8.8, design.md D1/D9): solo aparece cuando
            prestacionId está presente (modalidad por-prestacion) — sin cambios cuando está
            ausente (modalidad general, sin desglose persistido). */}
        {presupuesto.prestacionId && (
          <div className="flex flex-col gap-0.5">
            <span className="font-body text-[11px] text-muted">Prestación</span>
            <span className="font-body text-[13px] font-semibold text-ink">
              {nombrePrestacion(paciente, presupuesto.prestacionId)}
            </span>
          </div>
        )}
      </div>

      {/* tasks.md 9.3, design.md §Discrepancias #1: el docx original solo modela `Monto` +
          `Archivo` — la vigencia no existe ahí. `PresupuestoForm` ya tiene este cartel desde la
          Fase 8 (`PresupuestoForm.tsx:592`); esta es la mitad de solo-lectura que faltaba
          (design.md exige el cartel en las DOS pantallas, `PresupuestoForm` Y `PresupuestoDetail`). */}
      <AvisoModeloDatos>
        El período de vigencia (desde/hasta) no está en el modelo real (docx original, que solo
        modela <code>Monto</code> + <code>Archivo</code>): registra el período que cubre este
        presupuesto, independiente de cuándo se emitió.
      </AvisoModeloDatos>

      {/* REAPERTURA #13 (decisión usuaria 2026-08-16): la modalidad `general` ahora SÍ persiste
          su desglose por prestación (`facturacion.presupuesto_linea`, migración
          `20260816110000_presupuesto_lineas.sql`). El bloque solo aparece cuando hay líneas
          persistidas — los presupuestos viejos y los de modalidad por-prestacion no cambian. */}
      {presupuesto.lineas !== undefined && presupuesto.lineas.length > 0 && (
        <div className="flex flex-col gap-xs border-y border-border py-md">
          <span className="font-body text-[11px] font-semibold text-muted">Líneas</span>
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {presupuesto.lineas.map((linea) => (
              <li key={linea.id} className="flex flex-wrap items-center justify-between gap-sm font-body text-[13px] text-text">
                <span>{nombreLineaPresupuesto(paciente, linea.prestacionId)}</span>
                <span className="font-mono text-muted">${linea.monto.toLocaleString('es-AR')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* presupuestos-vigencia-datos-traslado-vista-previa (tasks.md 8.7, design.md D2): "Sin
          datos de traslado" en vez de campos vacíos o valores inventados cuando el bloque entero
          no fue cargado. */}
      {presupuesto.datosTraslado === undefined ? (
        <p className="m-0 border-y border-border py-md font-body text-sm text-muted">Sin datos de traslado</p>
      ) : (
        <div className="flex flex-col gap-sm border-y border-border py-md">
          <span className="font-body text-[11px] font-semibold text-muted">Datos de traslado</span>
          {/* tasks.md 9.3, design.md §Discrepancias #4: el bloque completo (10 columnas) no está
              en el docx original — replica el formulario en papel que hoy completa la obra
              social. `PresupuestoForm` ya tiene este cartel desde la Fase 8
              (`PresupuestoForm.tsx:624`, agrupado ahí con CD/SD); acá va solo, porque
              `Con dependencia` en esta pantalla no comparte bloque visual con estos campos. */}
          <AvisoModeloDatos>
            Este bloque de datos de traslado no está en el modelo real (docx original): replica el
            formulario en papel que hoy completa la obra social, para no perder ese dato en el
            sistema.
          </AvisoModeloDatos>
          <div className="grid grid-cols-2 gap-md md:grid-cols-4">
            <div className="flex flex-col gap-0.5">
              <span className="font-body text-[11px] text-muted">Origen (ida)</span>
              <span className="font-body text-[13px] text-ink">{textoOpcional(presupuesto.datosTraslado.origenIda)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-body text-[11px] text-muted">Destino (ida)</span>
              <span className="font-body text-[13px] text-ink">{textoOpcional(presupuesto.datosTraslado.destinoIda)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-body text-[11px] text-muted">Origen (vuelta)</span>
              <span className="font-body text-[13px] text-ink">{textoOpcional(presupuesto.datosTraslado.origenVuelta)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-body text-[11px] text-muted">Destino (vuelta)</span>
              <span className="font-body text-[13px] text-ink">{textoOpcional(presupuesto.datosTraslado.destinoVuelta)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-body text-[11px] text-muted">Horario de entrada</span>
              <span className="font-body text-[13px] text-ink">{textoOpcional(presupuesto.datosTraslado.horarioEntrada)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-body text-[11px] text-muted">Horario de salida</span>
              <span className="font-body text-[13px] text-ink">{textoOpcional(presupuesto.datosTraslado.horarioSalida)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-body text-[11px] text-muted">Km (ida)</span>
              <span className="font-mono text-[13px] text-ink">{textoOpcional(presupuesto.datosTraslado.kmIda)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-body text-[11px] text-muted">Km (vuelta)</span>
              <span className="font-mono text-[13px] text-ink">{textoOpcional(presupuesto.datosTraslado.kmVuelta)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-body text-[11px] text-muted">Días de la semana</span>
              <span className="font-body text-[13px] text-ink">
                {presupuesto.datosTraslado.diasSemana.length > 0
                  ? presupuesto.datosTraslado.diasSemana.map((dia) => DIA_SEMANA_LABEL[dia] ?? dia).join(', ')
                  : 'Sin cargar'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-body text-[11px] text-muted">Días mensuales</span>
              <span className="font-mono text-[13px] text-ink">{textoOpcional(presupuesto.datosTraslado.diasMensuales)}</span>
            </div>
          </div>
        </div>
      )}

      {/* design.md D5 + REAPERTURA #13 (2026-08-16): `prestacion_id` sigue siendo para la
          modalidad por-prestacion (monto único por prestación, sin desglose). En la modalidad
          `general` el desglose sí se persiste (bloque "Líneas" arriba), así que este cartel
          distingue los dos casos — ya no dice que la #13 "no se reabre". */}
      {presupuesto.prestacionId && (
        <AvisoModeloDatos>
          Este presupuesto está vinculado a una prestación puntual del catálogo del paciente
          (obra social con facturación <strong>por prestación</strong>). El campo <strong>monto</strong>{' '}
          es un importe único de este presupuesto — sin desglose persistido. La modalidad{' '}
          <strong>general</strong>, en cambio, sí guarda su desglose por prestación (reapertura de
          la discrepancia #13 de la base de conocimiento, `04_modelo_de_datos.md`).
        </AvisoModeloDatos>
      )}

      <div className="flex justify-end">
        <Button variant="secondary" requiereEscritura onClick={onEdit}>
          Editar datos
        </Button>
      </div>
    </Card>
  );
}

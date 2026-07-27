import { useMemo } from 'react';
import type { ConductorRepository } from '../../shared/lib/conductores/ConductorRepository';
import type { CobroRepository } from '../../shared/lib/facturacion/CobroRepository';
import type { FacturaRepository } from '../../shared/lib/facturacion/FacturaRepository';
import type { HojaDeRutaRepository } from '../../shared/lib/hojas-de-ruta/HojaDeRutaRepository';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import type { VehiculoRepository } from '../../shared/lib/vehiculos/VehiculoRepository';
import { UMBRAL_CUD_DASHBOARD_DIAS } from '../../shared/lib/reportes/constantes';
import { alertasMantenimiento } from '../../shared/lib/reportes/alertasMantenimiento';
import { cudPorVencer } from '../../shared/lib/reportes/cudPorVencer';
import { DashboardAvisoDiscrepancias } from './DashboardAvisoDiscrepancias';
import { FacturadoVsCobradoPanel } from './FacturadoVsCobradoPanel';
import { RecorridosDelDiaPanel } from './RecorridosDelDiaPanel';
import { ResumenAnualPanel } from './ResumenAnualPanel';
import { TarjetasAlertas } from './TarjetasAlertas';
import { useAlertasCud } from './useAlertasCud';
import { useAlertasMantenimiento } from './useAlertasMantenimiento';
import { useConductoresDashboard } from './useConductoresDashboard';
import { useDatosFinancieros } from './useDatosFinancieros';
import { useHojaDeRutaDelDia } from './useHojaDeRutaDelDia';
import { useReportesFinancieros } from './useReportesFinancieros';

export interface DashboardPageProps {
  facturaRepository: FacturaRepository;
  cobroRepository: CobroRepository;
  pacienteRepository: PacienteRepository;
  vehiculoRepository: VehiculoRepository;
  hojaDeRutaRepository: HojaDeRutaRepository;
  conductorRepository: ConductorRepository;
}

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// tasks.md 6.9, spec dashboard-composicion: compone el cartel de discrepancias, el panel del
// día en primer plano, las tres tarjetas de alerta y los dos paneles de reporte financiero, con
// regiones semánticas y encabezados. Carga independiente por bloque (design.md Decisión 7): la
// falla de un bloque no oculta a los demás. Solo lectura — nunca invoca create/update/remove.
export function DashboardPage({
  facturaRepository,
  cobroRepository,
  pacienteRepository,
  vehiculoRepository,
  hojaDeRutaRepository,
  conductorRepository,
}: DashboardPageProps) {
  const hoy = useMemo(hoyIso, []);

  const { facturas, cobros, cargando: cargandoFinanciero, error: errorFinanciero } = useDatosFinancieros(
    facturaRepository,
    cobroRepository,
  );
  const { periodo, setPeriodo, serie, anio, setAnio, aniosDisponibles, resumen, mora } = useReportesFinancieros({
    facturas,
    cobros,
    hoy,
  });

  const { pacientes, cargando: cargandoCud, error: errorCud } = useAlertasCud(pacienteRepository);
  const { vehiculos, cargando: cargandoMantenimiento, error: errorMantenimiento } = useAlertasMantenimiento(vehiculoRepository);
  const { conductores } = useConductoresDashboard(conductorRepository);
  const { hojaDeRuta, cargando: cargandoHoja, error: errorHoja } = useHojaDeRutaDelDia(hojaDeRutaRepository, hoy);

  const listaCud = useMemo(
    () => cudPorVencer({ pacientes, hoy: new Date(hoy), umbralDias: UMBRAL_CUD_DASHBOARD_DIAS }),
    [pacientes, hoy],
  );
  const listaMantenimiento = useMemo(() => alertasMantenimiento({ vehiculos, ahora: new Date(hoy) }), [vehiculos, hoy]);

  const nombrePaciente = useMemo(() => {
    const porId = new Map(pacientes.map((p) => [p.id, `${p.apellido}, ${p.nombre}`]));
    return (pacienteId: string) => porId.get(pacienteId) ?? 'Paciente desconocido';
  }, [pacientes]);

  return (
    <div className="flex flex-col gap-xl py-xxl px-xl">
      <h1 className="m-0 font-heading text-[24px] font-bold text-ink">Dashboard</h1>

      <DashboardAvisoDiscrepancias />

      <RecorridosDelDiaPanel
        cargando={cargandoHoja}
        error={errorHoja}
        hojaDeRuta={hojaDeRuta}
        vehiculos={vehiculos}
        conductores={conductores}
      />

      <TarjetasAlertas
        mora={mora}
        moraCargando={cargandoFinanciero}
        moraError={errorFinanciero}
        nombrePaciente={nombrePaciente}
        cud={listaCud}
        cudCargando={cargandoCud}
        cudError={errorCud}
        mantenimiento={listaMantenimiento}
        mantenimientoCargando={cargandoMantenimiento}
        mantenimientoError={errorMantenimiento}
      />

      <FacturadoVsCobradoPanel
        periodo={periodo}
        onChangePeriodo={setPeriodo}
        serie={serie}
        cargando={cargandoFinanciero}
        error={errorFinanciero}
      />

      <ResumenAnualPanel
        anio={anio}
        onChangeAnio={setAnio}
        aniosDisponibles={aniosDisponibles}
        resumen={resumen}
        cargando={cargandoFinanciero}
        error={errorFinanciero}
      />
    </div>
  );
}

import { useState } from 'react';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { PresupuestoRepository } from '../../shared/lib/presupuestos/PresupuestoRepository';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { Factura } from '../../shared/types/factura';
import { usePacientes } from '../pacientes/usePacientes';
import { useObrasSociales } from '../obras-sociales/useObrasSociales';
import { useCobroRepository } from './CobroRepositoryContext';
import { FacturaDetail } from './FacturaDetail';
import { FacturasList } from './FacturasList';
import { useFacturaRepository } from './FacturaRepositoryContext';
import { useFacturas } from './useFacturas';

type View = { kind: 'list' } | { kind: 'detail'; facturaId: string | null };

interface FacturacionPageProps {
  /** Solo lectura (design.md Decisión 15): puebla el selector de paciente y el filtro del listado. */
  pacienteRepository: PacienteRepository;
  /** Solo lectura: resuelve plantilla, checklist y tipo de comprobante por defecto. */
  obraSocialRepository: ObraSocialRepository;
  /** Solo lectura: resuelve el CupoAutorizado real del paciente (tasks.md 8.2). */
  presupuestoRepository: PresupuestoRepository;
  autorizacionRepository: AutorizacionRepository;
  documentoRepository: DocumentoRepository;
  /** Catálogo de feriados inyectado — ver feriadosFixture.ts. */
  feriados: string[];
}

// Composición raíz de la feature (tasks.md 6.1, 8.1): resuelve FacturaRepository del context,
// wire de useFacturas, reutiliza usePacientes/useObrasSociales (solo lectura, design.md Decisión
// 15) para poblar selectores y resolver nombres, y decide qué pantalla mostrar (listado o
// detalle). Mismo patrón que PresupuestosPage/HojaDeRutaPage.
export function FacturacionPage({
  pacienteRepository,
  obraSocialRepository,
  presupuestoRepository,
  autorizacionRepository,
  documentoRepository,
  feriados,
}: FacturacionPageProps) {
  const facturaRepository = useFacturaRepository();
  const cobroRepository = useCobroRepository();
  const { facturas, loading, error, crear, actualizar } = useFacturas(facturaRepository);
  const { pacientes } = usePacientes(pacienteRepository);
  const { obrasSociales } = useObrasSociales(obraSocialRepository);
  const [view, setView] = useState<View>({ kind: 'list' });

  function nombrePaciente(pacienteId: string): string {
    const paciente = pacientes.find((p) => p.id === pacienteId);
    return paciente ? `${paciente.apellido}, ${paciente.nombre}` : 'Paciente desconocido';
  }

  if (view.kind === 'detail') {
    const factura: Factura | null = view.facturaId === null ? null : (facturas.find((f) => f.id === view.facturaId) ?? null);

    return (
      <FacturaDetail
        factura={factura}
        crear={crear}
        actualizar={actualizar}
        facturasExistentes={facturas}
        pacientes={pacientes}
        obrasSociales={obrasSociales}
        feriados={feriados}
        presupuestoRepository={presupuestoRepository}
        autorizacionRepository={autorizacionRepository}
        cobroRepository={cobroRepository}
        documentoRepository={documentoRepository}
        onCreated={(creada) => setView({ kind: 'detail', facturaId: creada.id })}
        onBack={() => setView({ kind: 'list' })}
      />
    );
  }

  return (
    <FacturasList
      facturas={facturas}
      loading={loading}
      error={error}
      nombrePaciente={nombrePaciente}
      pacientesDisponibles={pacientes.map((p) => ({ id: p.id, nombre: `${p.apellido}, ${p.nombre}` }))}
      onSelect={(factura) => setView({ kind: 'detail', facturaId: factura.id })}
      onCreateNew={() => setView({ kind: 'detail', facturaId: null })}
    />
  );
}

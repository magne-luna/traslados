import { useState } from 'react';
import { AvisoSoloLectura } from '../../design-system/components';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { PresupuestoRepository } from '../../shared/lib/presupuestos/PresupuestoRepository';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import type { EmisionRepository } from '../../shared/lib/facturacion/EmisionRepository';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { Factura } from '../../shared/types/factura';
import { usePacientesCompletos } from '../pacientes/usePacientesCompletos';
import { useObrasSociales } from '../obras-sociales/useObrasSociales';
import { useCobroRepository } from './CobroRepositoryContext';
import { ComprobantesEmitidosList } from './ComprobantesEmitidosList';
import { FacturaDetail } from './FacturaDetail';
import { FacturasList } from './FacturasList';
import { useFacturaRepository } from './FacturaRepositoryContext';
import { useFacturas } from './useFacturas';

type View = { kind: 'list' } | { kind: 'detail'; facturaId: string | null } | { kind: 'comprobantes' };

interface FacturacionPageProps {
  /** Solo lectura (design.md Decisión 15): puebla el selector de paciente y el filtro del listado. */
  pacienteRepository: PacienteRepository;
  /** Solo lectura: resuelve plantilla, checklist y tipo de comprobante por defecto. */
  obraSocialRepository: ObraSocialRepository;
  /** Solo lectura: resuelve el CupoAutorizado real del paciente (tasks.md 8.2). */
  presupuestoRepository: PresupuestoRepository;
  autorizacionRepository: AutorizacionRepository;
  /** Emisión electrónica del comprobante contra ARCA (Edge Function `facturar`). */
  emisionRepository: EmisionRepository;
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
  emisionRepository,
  documentoRepository,
  feriados,
}: FacturacionPageProps) {
  const facturaRepository = useFacturaRepository();
  const cobroRepository = useCobroRepository();
  const { facturas, loading, error, crear, actualizar, recargar } = useFacturas(facturaRepository);
  const { pacientes } = usePacientesCompletos(pacienteRepository);
  const { obrasSociales } = useObrasSociales(obraSocialRepository);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [comprobanteError, setComprobanteError] = useState<string | null>(null);

  function nombrePaciente(pacienteId: string): string {
    const paciente = pacientes.find((p) => p.id === pacienteId);
    return paciente ? `${paciente.apellido}, ${paciente.nombre}` : 'Paciente desconocido';
  }

  // Mismo patrón que FacturaDetail.verComprobante: resuelve la signed URL efímera del PDF y la
  // abre; un fallo (por ejemplo, sin permiso `facturacion: read`) se muestra en la pantalla del
  // listado sin romperla.
  async function verComprobante(factura: Factura): Promise<void> {
    if (!factura.comprobantePdfUrl) return;
    setComprobanteError(null);
    try {
      const url = await emisionRepository.verComprobante(factura.comprobantePdfUrl);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setComprobanteError(err instanceof Error ? err.message : 'No se pudo abrir el comprobante.');
    }
  }

  if (view.kind === 'detail') {
    const factura: Factura | null = view.facturaId === null ? null : (facturas.find((f) => f.id === view.facturaId) ?? null);

    return (
      <>
        <AvisoSoloLectura />
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
          emisionRepository={emisionRepository}
          cobroRepository={cobroRepository}
          documentoRepository={documentoRepository}
          onEmitida={recargar}
          onCreated={(creada) => setView({ kind: 'detail', facturaId: creada.id })}
          onBack={() => setView({ kind: 'list' })}
        />
      </>
    );
  }

  if (view.kind === 'comprobantes') {
    return (
      <>
        <AvisoSoloLectura />
        <ComprobantesEmitidosList
          facturas={facturas}
          nombrePaciente={nombrePaciente}
          onVerComprobante={(factura) => void verComprobante(factura)}
          onSelect={(factura) => setView({ kind: 'detail', facturaId: factura.id })}
          onVolver={() => {
            setComprobanteError(null);
            setView({ kind: 'list' });
          }}
          error={comprobanteError}
        />
      </>
    );
  }

  return (
    <>
      <AvisoSoloLectura />
      <FacturasList
        facturas={facturas}
        loading={loading}
        error={error}
        nombrePaciente={nombrePaciente}
        pacientesDisponibles={pacientes.map((p) => ({ id: p.id, nombre: `${p.apellido}, ${p.nombre}` }))}
        onSelect={(factura) => setView({ kind: 'detail', facturaId: factura.id })}
        onCreateNew={() => setView({ kind: 'detail', facturaId: null })}
        onVerComprobantes={() => setView({ kind: 'comprobantes' })}
      />
    </>
  );
}

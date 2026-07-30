import { useState } from 'react';
import { AvisoModeloDatos, Button, Chip, Section, VolverAlListadoButton, VolverAlListadoLink } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Card } from '../../design-system/layout';
import { generateId } from '../../shared/lib/id';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { estadoHabilitacion } from '../../shared/lib/mantenimiento/estadoHabilitacion';
import { estadoServicePreventivo } from '../../shared/lib/mantenimiento/estadoServicePreventivo';
import type { ActualizacionVehiculo, GastoVehiculo, NuevoVehiculo, Vehiculo } from '../../shared/types/vehiculo';
import { ACCESORIO_MOVILIDAD_LABELS } from './accesorioMovilidadOptions';
import { GastosVehiculo, type NuevoGastoInput } from './GastosVehiculo';
import { HABILITACION_COPY, SERVICE_COPY, TIPO_HABILITACION_LABELS } from './mantenimientoCopy';
import { VehiculoDocumentos } from './VehiculoDocumentos';
import { VehiculoForm, type VehiculoFormValues } from './VehiculoForm';
import { VehiculoMantenimiento } from './VehiculoMantenimiento';

interface VehiculoDetailProps {
  /** null = alta de un vehículo nuevo; el resto de las secciones solo aplica en edición. */
  vehiculo: Vehiculo | null;
  crear: (data: NuevoVehiculo) => Promise<Vehiculo>;
  actualizar: (id: string, data: ActualizacionVehiculo) => Promise<Vehiculo>;
  documentoRepository: DocumentoRepository;
  onCreated: (vehiculo: Vehiculo) => void;
  onBack: () => void;
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
}

// Composición de la pantalla de detalle (tasks.md 5.7, 6.1, 7.2, 8.2): wire de VehiculoForm +
// VehiculoMantenimiento + GastosVehiculo + VehiculoDocumentos contra el hook useVehiculos
// (crear/actualizar), con manejo de error visible y sin loading infinito. Mantenimiento, gastos
// y documentos solo aplican una vez que el vehículo existe (tiene id) — mismo criterio que
// ObraSocialDetail (FE-2).
export function VehiculoDetail({ vehiculo, crear, actualizar, documentoRepository, onCreated, onBack }: VehiculoDetailProps) {
  // Sin resumen posible en alta (vehiculo null): el form arranca visible directamente. En
  // edición arranca colapsado detrás de "Editar datos" para no mezclar edición con el resto del
  // detalle (mantenimiento/gastos/documentos) — decisión de UX pedida explícitamente.
  const [editing, setEditing] = useState(vehiculo === null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);

  async function handleSubmitGeneral(values: VehiculoFormValues) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (vehiculo === null) {
        const creado = await crear({
          ...values,
          // Se asume recién service al alta (sin historial previo): kilometrajeUltimoService
          // arranca igual al kilometraje ingresado y fechaUltimoService es hoy — editable luego
          // desde mantenimiento. Sin habilitaciones/gastos hasta que se carguen (RN-VE-03/04).
          kilometrajeUltimoService: values.kilometraje,
          fechaUltimoService: new Date().toISOString().slice(0, 10),
          habilitaciones: [],
          gastos: [],
        });
        onCreated(creado);
      } else {
        await actualizar(vehiculo.id, values);
        setEditing(false);
      }
    } catch (err) {
      setSubmitError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAgregarGasto(data: NuevoGastoInput) {
    if (vehiculo === null) return;
    setSectionError(null);
    const nuevoGasto: GastoVehiculo = { id: generateId('gasto'), ...data };
    try {
      await actualizar(vehiculo.id, { gastos: [...vehiculo.gastos, nuevoGasto] });
    } catch (err) {
      setSectionError(toErrorMessage(err));
    }
  }

  const serviceCopy =
    vehiculo &&
    SERVICE_COPY[
      estadoServicePreventivo({
        kilometraje: vehiculo.kilometraje,
        kilometrajeUltimoService: vehiculo.kilometrajeUltimoService,
        fechaUltimoService: vehiculo.fechaUltimoService,
        ahora: new Date(),
      })
    ];

  return (
    <div className="flex flex-col gap-xl py-xxl px-xl">
      <VolverAlListadoLink onClick={onBack} />

      <Section label="Vehículo" title={vehiculo?.patente ?? 'Nuevo vehículo'}>
        {vehiculo && !editing ? (
          <Card radius="sm" gap="md">
            <div className="flex flex-wrap items-center gap-md">
              <span className="font-body text-[14px] font-semibold text-ink">{vehiculo.patente}</span>
              <span className="font-body text-[13px] text-muted">
                {vehiculo.modelo} · {vehiculo.tipo}
              </span>
              {vehiculo.estado === 'fuera-de-servicio' ? (
                <Chip kind="danger">Fuera de servicio</Chip>
              ) : (
                <Chip kind="success">Habilitado</Chip>
              )}
            </div>

            <div className="grid grid-cols-2 gap-md border-y border-border py-md md:grid-cols-4">
              <div className="flex flex-col gap-0.5">
                <span className="font-body text-[11px] text-muted">Capacidad</span>
                <span className="font-body text-[13px] font-semibold text-ink">{vehiculo.capacidad} pasajeros</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-body text-[11px] text-muted">Kilometraje</span>
                <span className="font-body text-[13px] font-semibold text-ink">
                  {vehiculo.kilometraje.toLocaleString('es-AR')} km
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-body text-[11px] text-muted">Service preventivo</span>
                {serviceCopy && <Chip kind={serviceCopy.kind}>{serviceCopy.texto}</Chip>}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-body text-[11px] text-muted">Gastos registrados</span>
                <span className="font-body text-[13px] font-semibold text-ink">
                  {vehiculo.gastos.length === 0
                    ? 'Ninguno'
                    : `$${vehiculo.gastos.reduce((total, gasto) => total + gasto.monto, 0).toLocaleString('es-AR')}`}
                </span>
              </div>
            </div>

            {vehiculo.habilitaciones.length > 0 && (
              <div className="flex flex-wrap items-center gap-md">
                {vehiculo.habilitaciones.map((habilitacion) => {
                  const copy = HABILITACION_COPY[estadoHabilitacion({ fechaVencimiento: habilitacion.fechaVencimiento, ahora: new Date() })];
                  return (
                    <span key={habilitacion.tipo} className="flex items-center gap-xs font-body text-[13px] text-muted">
                      {TIPO_HABILITACION_LABELS[habilitacion.tipo]}
                      <Chip kind={copy.kind}>{copy.texto}</Chip>
                    </span>
                  );
                })}
              </div>
            )}

            {vehiculo.accesoriosCompatibles.length > 0 && (
              <div className="flex flex-wrap gap-sm">
                {vehiculo.accesoriosCompatibles.map((accesorio) => (
                  <Chip key={accesorio} kind="info">
                    {ACCESORIO_MOVILIDAD_LABELS[accesorio]}
                  </Chip>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="secondary" requiereEscritura onClick={() => setEditing(true)}>
                Editar datos
              </Button>
            </div>
          </Card>
        ) : (
          <VehiculoForm
            initial={
              vehiculo
                ? {
                    patente: vehiculo.patente,
                    modelo: vehiculo.modelo,
                    tipo: vehiculo.tipo,
                    capacidad: vehiculo.capacidad,
                    kilometraje: vehiculo.kilometraje,
                    estado: vehiculo.estado,
                    accesoriosCompatibles: vehiculo.accesoriosCompatibles,
                  }
                : undefined
            }
            kilometrajeMinimo={vehiculo?.kilometraje}
            onSubmit={handleSubmitGeneral}
            onCancel={vehiculo ? () => setEditing(false) : onBack}
            submitting={submitting}
            submitError={submitError}
          />
        )}
      </Section>

      <AvisoModeloDatos>
        Falta el campo "Notas" que sí existe en Traslados-Modelo-Datos.docx (observaciones sobre el
        vehículo).
      </AvisoModeloDatos>

      {vehiculo && (
        <>
          {sectionError && <Alert tone="danger">{sectionError}</Alert>}

          <Section label="Mantenimiento" title="Service y habilitaciones">
            <AvisoModeloDatos>
              Acá kilometraje/service y las habilitaciones VTV/RTO viven embebidos en el vehículo. En
              el docx el kilometraje y los próximos vencimientos (por fecha o por km) viven en una
              tabla Mantenimiento aparte (un registro por intervención), y VTV/RTO son solo ítems del
              catálogo genérico de documentos vehiculares, sin fecha de vencimiento propia.
            </AvisoModeloDatos>
            <VehiculoMantenimiento vehiculo={vehiculo} />
          </Section>

          <Section label="Gastos" title="Registro de gastos">
            <AvisoModeloDatos>
              En el docx, el acceso a Gastos de Vehículo se controla por el módulo de permisos
              "facturacion", no "conductores" — importa para diseñar las RLS policies.
            </AvisoModeloDatos>
            <GastosVehiculo gastos={vehiculo.gastos} onAgregar={handleAgregarGasto} />
          </Section>

          <Section label="Documentación" title="Checklist documental">
            <VehiculoDocumentos vehiculoId={vehiculo.id} repository={documentoRepository} />
          </Section>
        </>
      )}

      <VolverAlListadoButton onClick={onBack} />
    </div>
  );
}

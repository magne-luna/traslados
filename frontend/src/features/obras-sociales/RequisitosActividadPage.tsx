import { useEffect, useState } from 'react';
import { AvisoModeloDatos, AvisoSoloLectura, Chip } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Card } from '../../design-system/layout';
// Reusa el único punto de verdad de tipo/etiqueta de actividad (mismo criterio que
// `actividadDocumental.ts`: "nunca un catálogo duplicado"). `TIPO_DIRECCION_LABELS` vive en
// `features/pacientes/` porque `TipoDireccion` nació ahí, pero el enum es un concepto compartido
// (`shared/types/paciente.ts`) — reusarlo acá evita un segundo catálogo de tipos/etiquetas que
// pudiera desincronizarse del real.
import { TIPO_DIRECCION_LABELS, TIPO_DIRECCION_OPTIONS } from '../pacientes/direccionOptions';
import type { ChecklistItem } from '../../shared/types/documento';
import { ChecklistEditor } from './ChecklistEditor';
import type { RequisitosActividadRepository, RequisitosPorTipo, TipoActividad } from '../../shared/lib/requisitosActividad/RequisitosActividadRepository';

interface RequisitosActividadPageProps {
  repository: RequisitosActividadRepository;
}

// documentos-checklist-items-por-actividad (tasks.md §5, design.md Checkpoint (d)/(e), veredictos
// 1.5/1.6): pantalla propia de administración de "ítems requeridos por tipo de actividad" —
// capability `checklist-por-tipo-actividad`. `domicilio` queda fuera: no es una actividad
// (`obtenerActividadesConChecklist`, `actividadDocumental.ts`, ya aplica el mismo criterio).
const TIPOS_ACTIVIDAD: TipoActividad[] = TIPO_DIRECCION_OPTIONS.filter((tipo): tipo is TipoActividad => tipo !== 'domicilio');

export function RequisitosActividadPage({ repository }: RequisitosActividadPageProps) {
  const [requisitos, setRequisitos] = useState<RequisitosPorTipo>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoActividad>('escuela');

  useEffect(() => {
    let active = true;
    setLoading(true);
    repository
      .listAll()
      .then((datos) => {
        if (active) setRequisitos(datos);
      })
      .catch(() => {
        if (active) setError('No se pudo cargar la configuración por tipo de actividad.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repository]);

  async function handleChange(items: ChecklistItem[]) {
    // Actualización optimista (mismo criterio de UX que el resto del proyecto: la pantalla no
    // bloquea la edición mientras persiste) — si falla, se revierte y se muestra el error.
    const previo = requisitos;
    setRequisitos((prev) => ({ ...prev, [tipoSeleccionado]: items }));
    setGuardando(true);
    setError(null);
    try {
      const persistido = await repository.actualizar(tipoSeleccionado, items);
      setRequisitos((prev) => ({ ...prev, [tipoSeleccionado]: persistido }));
    } catch (err) {
      setRequisitos(previo);
      setError(err instanceof Error ? err.message : 'No se pudo guardar la configuración de este tipo de actividad.');
    } finally {
      setGuardando(false);
    }
  }

  const itemsDelTipo = requisitos[tipoSeleccionado] ?? [];

  return (
    <div className="flex flex-col gap-lg py-xxl px-xl">
      <AvisoSoloLectura />

      {/* documentos-checklist-items-por-actividad (specs/checklist-por-tipo-actividad/spec.md):
          el aviso sobre el catálogo compartido de nombres ya lo muestra `ChecklistEditor`
          reusado abajo (mismo texto/criterio) — acá solo se agrega lo que es específico de ESTA
          pantalla, para no apilar dos carteles que digan lo mismo (tasks.md 8.4, regla dura:
          "nunca dos carteles que repitan el mismo texto"). */}
      <AvisoModeloDatos>
        Esta lista es <strong>global por tipo de actividad</strong>: se suma a los ítems que ya pide
        la obra social de cada paciente, no los reemplaza. Si un tipo de actividad no tiene ítems
        configurados acá, los bloques de esa actividad siguen mostrando exactamente lo que muestran
        hoy (solo los de la obra social) — no es un estado de error.
      </AvisoModeloDatos>

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <p className="font-body text-sm text-muted">Cargando configuración…</p>
      ) : (
        <div className="flex flex-col gap-lg">
          <div role="tablist" aria-label="Tipo de actividad" className="flex flex-wrap gap-sm">
            {TIPOS_ACTIVIDAD.map((tipo) => {
              const cantidad = requisitos[tipo]?.length ?? 0;
              const activo = tipo === tipoSeleccionado;
              return (
                <button
                  key={tipo}
                  type="button"
                  role="tab"
                  aria-selected={activo}
                  onClick={() => setTipoSeleccionado(tipo)}
                  className={`flex items-center gap-xs rounded-pill border px-md py-xs font-body text-sm transition-colors ${
                    activo ? 'border-primary bg-primary-softer text-ink' : 'border-border bg-surface text-text hover:bg-surface-soft'
                  }`}
                >
                  {TIPO_DIRECCION_LABELS[tipo]}
                  {cantidad > 0 && <Chip kind="secondary">{cantidad}</Chip>}
                </button>
              );
            })}
          </div>

          <Card gap="md">
            <ChecklistEditor items={itemsDelTipo} onChange={handleChange} />
            {guardando && <p className="font-body text-xs text-muted">Guardando…</p>}
          </Card>
        </div>
      )}
    </div>
  );
}

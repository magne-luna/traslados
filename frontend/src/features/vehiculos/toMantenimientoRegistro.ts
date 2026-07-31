import type {
  MantenimientoRegistro,
  SubtipoCorrectivoConocido,
  SubtipoPreventivo,
} from '../../shared/types/vehiculo';
import type { MantenimientoFormInput } from './validateMantenimientoForm';

// `Omit<Union, K>` NO distribuye sobre uniones (colapsa a las propiedades comunes, perdiendo la
// unión discriminada) — se necesita la forma distributiva explícita (`T extends any ? ... :
// never`) para conservar los 4 miembros de `MantenimientoRegistro` sin `id`.
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/** Payload de alta: todo lo de `MantenimientoRegistro` salvo el `id`, que asigna el caller (mismo patrón que `NuevoGastoInput`/`GastoVehiculo` — el id lo genera `VehiculoDetail.handleAgregarMantenimiento`, tasks.md 7.2). */
export type NuevoMantenimientoInput = DistributiveOmit<MantenimientoRegistro, 'id'>;

// Estrecha el input validado (laxo, `MantenimientoFormInput`) al tipo estricto
// `MantenimientoRegistro` (tasks.md 3.6, design.md Decisión 4/Riesgos), sin el `id`. Se asume que
// `input` ya pasó `validateMantenimientoForm` sin errores; esta función no vuelve a validar, solo
// construye el miembro correcto de la unión discriminada.
export function toMantenimientoRegistro(input: MantenimientoFormInput): NuevoMantenimientoInput {
  const base = {
    fecha: input.fecha,
    kilometraje: Number(input.kilometraje),
    ...(input.proximoVencimientoFecha.trim() !== '' ? { proximoVencimientoFecha: input.proximoVencimientoFecha } : {}),
    ...(input.proximoVencimientoKm.trim() !== '' ? { proximoVencimientoKm: Number(input.proximoVencimientoKm) } : {}),
  };

  if (input.tipoIntervencion === 'preventivo') {
    return { ...base, tipoIntervencion: 'preventivo', subtipo: input.subtipo as SubtipoPreventivo };
  }

  if (input.tipoIntervencion === 'correctivo') {
    if (input.subtipo === 'otro') {
      return { ...base, tipoIntervencion: 'correctivo', subtipo: 'otro', detalle: input.detalle };
    }
    return { ...base, tipoIntervencion: 'correctivo', subtipo: input.subtipo as SubtipoCorrectivoConocido };
  }

  return { ...base, tipoIntervencion: 'gasto' };
}

import { Chip } from '../../design-system/components';
import { Td, Tr } from '../../design-system/table';
import type { MantenimientoRegistro } from '../../shared/types/vehiculo';
import { SUBTIPO_LABELS, TIPO_INTERVENCION_CHIP_KIND, TIPO_INTERVENCION_LABELS } from './mantenimientoCategoriaOptions';

function formatoFecha(fechaIso: string): string {
  return new Date(fechaIso).toLocaleDateString('es-AR');
}

// Sub-tipo mostrado con su `detalle` en vez de la etiqueta genérica cuando es 'otro' (spec
// vehiculo-mantenimiento-historial, escenario "Sub-tipo de escape mostrado con su detalle").
function textoSubtipo(registro: MantenimientoRegistro): string {
  if (registro.tipoIntervencion === 'gasto') return '—';
  if (registro.subtipo === 'otro') return registro.detalle;
  return SUBTIPO_LABELS[registro.subtipo] ?? registro.subtipo;
}

function textoProximoVencimiento(registro: MantenimientoRegistro): string {
  const partes: string[] = [];
  if (registro.proximoVencimientoFecha) partes.push(formatoFecha(registro.proximoVencimientoFecha));
  if (registro.proximoVencimientoKm !== undefined) partes.push(`${registro.proximoVencimientoKm.toLocaleString('es-AR')} km`);
  return partes.length > 0 ? partes.join(' · ') : '—';
}

// Fila de la tabla de historial (tasks.md 6.9 — extraída para no inflar HistorialMantenimiento).
// El `switch` implícito vía las funciones de arriba cubre los 4 miembros de la unión
// discriminada (design.md Decisión 4): 'gasto' se renderiza sin sub-tipo (spec, escenario
// "Registro de nivel 1 'gasto' sin sub-tipo").
export function MantenimientoFila({ registro }: { registro: MantenimientoRegistro }) {
  return (
    <Tr>
      <Td padding="md" divided>
        {/* Texto además de color (WCAG AA, design.md Decisión 9) — el label ya es el texto del chip. */}
        <Chip kind={TIPO_INTERVENCION_CHIP_KIND[registro.tipoIntervencion]}>{TIPO_INTERVENCION_LABELS[registro.tipoIntervencion]}</Chip>
      </Td>
      <Td padding="md" divided>
        {textoSubtipo(registro)}
      </Td>
      <Td padding="md" divided>
        {formatoFecha(registro.fecha)}
      </Td>
      <Td padding="md" divided>
        {registro.kilometraje.toLocaleString('es-AR')} km
      </Td>
      <Td padding="md" divided>
        {textoProximoVencimiento(registro)}
      </Td>
    </Tr>
  );
}

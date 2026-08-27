import type { Direccion } from '../../shared/types/hojaDeRuta';
import { TIPO_DIRECCION_LABELS } from '../pacientes/direccionOptions';

// Etiqueta de una dirección del catálogo del paciente dentro de Hojas de Ruta: tipo +
// descripción (si la tiene, para diferenciar dos direcciones del mismo tipo — ej. dos "Terapia")
// + calle. Extraída de PacienteTramoCampos.tsx cuando SelectorRecorridoHabitual necesitó la MISMA
// etiqueta: los <option> del destino habitual y los de origen/destino nombran las mismas
// direcciones, y dos formatos distintos para la misma dirección en la misma fila se leen como dos
// lugares distintos.
export function etiquetaDireccion(direccion: Direccion): string {
  const tipoYDescripcion = direccion.descripcion
    ? `${TIPO_DIRECCION_LABELS[direccion.tipo]} (${direccion.descripcion})`
    : TIPO_DIRECCION_LABELS[direccion.tipo];
  return `${tipoYDescripcion} — ${direccion.calle}`;
}

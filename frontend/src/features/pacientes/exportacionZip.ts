import JSZip from 'jszip';
import type { DocumentoAdjunto, EntidadDocumental } from '../../shared/types/documento';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';

// documentos-transferencia-actividad (tasks.md §12, Checkpoint (b) VEREDICTO REVISADO
// 2026-08-11): "Exportar" arma un `.zip` con los ARCHIVOS REALES de una actividad. La lectura
// operativa que `design.md` ya había anotado como riesgo aceptado ("armar el legajo para
// mandarlo a la obra social") es la que gana acá. (El resumen imprimible que en su momento
// convivía con esta acción, `exportacionDocumental.ts`/"Ver resumen", se sacó por completo —
// REVERTIDO 2026-08-11, decisión de la usuaria. Este archivo no dependía de aquel.)
//
// `documentos` llega YA filtrado a la agrupación de esta actividad — `useDocumentChecklist` ya
// scopea el resultado de `listByEntity(entidad, entidadId, agrupacionId)` (ver
// PacienteDocumentosChecklist.tsx), así que esta función no vuelve a filtrar. El aislamiento
// entre actividades queda garantizado por quien la invoca.

export interface ArmadoZipParams {
  /** Solo necesita `resolverPrevisualizacion` — no todo el contrato — para que el test pueda pasar
   * un mock mínimo sin implementar los otros cuatro métodos que no usa. */
  repository: Pick<DocumentoRepository, 'resolverPrevisualizacion'>;
  entidad: EntidadDocumental;
  entidadId: string;
  pacienteNombre: string;
  actividadLabel: string;
  documentos: DocumentoAdjunto[];
  /** Inyectable para test — nunca golpea la red real en la suite. Default: `fetch` global. */
  fetchImpl?: typeof fetch;
  /** Inyectable para test — nunca depende de la fecha real del sistema en la suite. Default: ahora. */
  ahora?: Date;
}

export interface ArmadoZipResultado {
  blob: Blob;
  nombreArchivo: string;
  /** Documentos que NO se pudieron incluir (no previsualizables o falló el `fetch`), con el motivo
   * en castellano — el mismo texto que se escribe dentro de `_pendientes.txt`. Permite que la UI
   * decida si además quiere avisar algo en pantalla, sin tener que abrir el zip para saberlo. */
  pendientes: string[];
}

const NOMBRE_ARCHIVO_PENDIENTES = '_pendientes.txt';

// Manejo de fallos PARCIAL, no todo-o-nada: un documento no previsualizable o un `fetch` que
// falla saca a ESE documento del zip (nunca aborta el armado completo) y queda listado en
// `_pendientes.txt` — quien arma el legajo se entera de qué falta y por qué, en vez de encontrar
// un zip con menos archivos de los esperados sin ninguna explicación.
export async function armarZipDocumentacionActividad({
  repository,
  entidad,
  entidadId,
  pacienteNombre,
  actividadLabel,
  documentos,
  fetchImpl = fetch,
  ahora = new Date(),
}: ArmadoZipParams): Promise<ArmadoZipResultado> {
  const zip = new JSZip();
  const nombresUsados = new Set<string>();
  const pendientes: string[] = [];

  for (const documento of documentos) {
    let url: string | null;
    try {
      url = await repository.resolverPrevisualizacion(entidad, entidadId, documento.id);
    } catch {
      pendientes.push(`${documento.nombreArchivo}: no se pudo obtener el archivo.`);
      continue;
    }
    if (url === null) {
      pendientes.push(`${documento.nombreArchivo}: no está disponible para incluir en el zip.`);
      continue;
    }

    let contenido: Blob;
    try {
      const respuesta = await fetchImpl(url);
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      contenido = await respuesta.blob();
    } catch {
      pendientes.push(`${documento.nombreArchivo}: no se pudo descargar el archivo.`);
      continue;
    }

    // Colisión de nombre (design.md, tasks.md §12): dos documentos del mismo `itemId` pueden
    // compartir `nombreArchivo` (ej. dos versiones de "DNI.pdf" por vigencia) — nunca se pisa uno
    // con otro dentro del zip, se desambigua con un índice.
    zip.file(nombreSinColision(documento.nombreArchivo, nombresUsados), contenido);
  }

  if (pendientes.length > 0) {
    zip.file(NOMBRE_ARCHIVO_PENDIENTES, pendientes.join('\n'));
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const nombreArchivo = `documentacion-${sanitizarParaNombreArchivo(pacienteNombre)}-${sanitizarParaNombreArchivo(actividadLabel)}-${formatearFecha(ahora)}.zip`;

  return { blob, nombreArchivo, pendientes };
}

function nombreSinColision(nombreOriginal: string, usados: Set<string>): string {
  if (!usados.has(nombreOriginal)) {
    usados.add(nombreOriginal);
    return nombreOriginal;
  }
  const punto = nombreOriginal.lastIndexOf('.');
  const base = punto > 0 ? nombreOriginal.slice(0, punto) : nombreOriginal;
  const extension = punto > 0 ? nombreOriginal.slice(punto) : '';
  let indice = 2;
  let candidato = `${base} (${indice})${extension}`;
  while (usados.has(candidato)) {
    indice += 1;
    candidato = `${base} (${indice})${extension}`;
  }
  usados.add(candidato);
  return candidato;
}

// Sin acentos/espacios/símbolos — nombre de archivo válido en Windows/macOS/Linux por igual.
function sanitizarParaNombreArchivo(texto: string): string {
  const limpio = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return limpio || 'sin-nombre';
}

function formatearFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

// Dispara la descarga del zip ya armado — patrón Blob URL + `<a download>` programático, sin
// librería extra (regla dura: no sumar dependencias para algo que el navegador ya resuelve).
export function dispararDescargaZip(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

import { useCallback, useEffect, useState } from 'react';
import type { ChecklistItem, DocumentoAdjunto, EntidadDocumental } from '../../types/documento';
import type { DocumentoRepository } from './DocumentoRepository';

// Wiring de estado entre <DocumentChecklist /> (presentacional) y un DocumentoRepository
// (mock hoy, Supabase Storage el día de mañana — ver DocumentoRepository.ts).
//
// documentos-checklist-por-actividad (tasks.md 2.6, design.md Checkpoint (b) VEREDICTO opción B):
// `agrupacionId` es el 5.º parámetro, OPCIONAL con default `undefined` — Pacientes lo pasa (el
// `Direccion.id` de la actividad) para instanciar N checklists independientes; los otros 3
// dominios (Vehículos/Conductores/Facturas) no lo pasan y siguen llamando al hook con 4 argumentos
// posicionales, sin ningún cambio de comportamiento. El estado local `documentos` sigue
// **acumulando**, nunca filtra por `itemId` (comportamiento heredado de
// `pacientes-documentos-multiples`) — el filtrado por agrupación ya lo resuelve el repository en
// `listByEntity`/`upload`, el hook solo reenvía el parámetro.
export function useDocumentChecklist(
  entidad: EntidadDocumental,
  entidadId: string,
  items: ChecklistItem[],
  repository: DocumentoRepository,
  agrupacionId?: string,
) {
  const [documentos, setDocumentos] = useState<DocumentoAdjunto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    // documentos-checklist-por-actividad (tasks.md 2.6): llama al repository con exactamente los
    // mismos 2 argumentos posicionales de siempre cuando no hay agrupación — nunca agrega un 3.er
    // argumento `undefined` explícito. No es solo estética: los tests existentes de los otros 3
    // dominios (VehiculoDocumentos.test.tsx, ConductorDocumentos.test.tsx,
    // FacturaDocumentos.test.tsx) verifican `toHaveBeenCalledWith(entidad, entidadId)` con exactitud
    // de aridad — un `undefined` explícito de más los rompe aunque el valor sea equivalente.
    const promesa =
      agrupacionId !== undefined
        ? repository.listByEntity(entidad, entidadId, agrupacionId)
        : repository.listByEntity(entidad, entidadId);
    promesa.then((docs) => {
      if (!active) return;
      setDocumentos(docs);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [entidad, entidadId, agrupacionId, repository]);

  // pacientes-documentos-multiples (tasks.md 3.1): acumula en vez de reemplazar — ya no filtra
  // por itemId antes de agregar el documento nuevo al estado local.
  // documentos-checklist-por-actividad (tasks.md 2.6): mismo criterio de aridad exacta que
  // `listByEntity` arriba — sin agrupación, llama a `repository.upload` con los mismos 4 argumentos
  // de siempre.
  const upload = useCallback(
    async (itemId: string, file: File) => {
      const doc =
        agrupacionId !== undefined
          ? await repository.upload(entidad, entidadId, itemId, file, undefined, agrupacionId)
          : await repository.upload(entidad, entidadId, itemId, file);
      setDocumentos((prev) => [...prev, doc]);
    },
    [entidad, entidadId, agrupacionId, repository],
  );

  // pacientes-documentos-multiples (tasks.md 3.2, design.md D1): filtra por `id` del documento,
  // no por `itemId` — con colección, quitar "el" documento de un ítem deja de tener sentido.
  const remove = useCallback(
    async (documentoId: string) => {
      await repository.remove(entidad, entidadId, documentoId);
      setDocumentos((prev) => prev.filter((d) => d.id !== documentoId));
    },
    [entidad, entidadId, repository],
  );

  // documentos-previsualizacion (tasks.md 4.1, design.md D2): delega directo en el repository, sin
  // guardar la URL en el estado del hook — es un dato efímero que solo importa mientras la ventana
  // de previsualización está abierta (D3: ese estado vive en <DocumentChecklist />, no acá). La
  // promesa se deja rechazar tal cual (tasks.md 4.2): `null` = no previsualizable (caso normal, se
  // resuelve como valor), un throw real (permiso/red/expiración) se propaga sin capturar, para que
  // el `try/finally` de quien la llama pueda apagar su propio estado de "cargando" — el mismo
  // criterio de no dejar nada colgado que ya aplica `usePacientes.ts` con su try/catch/finally.
  const resolverPrevisualizacion = useCallback(
    (documentoId: string): Promise<string | null> => {
      return repository.resolverPrevisualizacion(entidad, entidadId, documentoId);
    },
    [entidad, entidadId, repository],
  );

  // documentos-previsualizacion (tasks.md 4.3): revoca el ObjectURL que `resolverPrevisualizacion`
  // resolvió para mostrarlo en la ventana — distinto del revoke que ya hace el mock en su propio
  // `remove()` (tasks.md 2.3) sobre el store interno del repository. `URL.revokeObjectURL` es un
  // no-op inofensivo si `url` no vino de `URL.createObjectURL` (p. ej. una URL firmada real de
  // `integracion-documentos` el día de mañana), así que es seguro llamarla siempre.
  const revocarPrevisualizacion = useCallback((url: string) => {
    URL.revokeObjectURL(url);
  }, []);

  return { items, documentos, loading, upload, remove, resolverPrevisualizacion, revocarPrevisualizacion };
}

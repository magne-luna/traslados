import { useCallback } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChecklistItem, DocumentoAdjunto, EntidadDocumental } from '../../types/documento';
import type { DocumentoRepository } from './DocumentoRepository';
import { claves } from '../query/claves';
import { FRESCURA } from '../query/frescura';

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
  // documentos-transferencia-actividad (tasks.md 6.7, design.md D6): incluido en las deps del
  // efecto de carga — subir este número fuerza un refetch de `listByEntity` sin remontar el
  // componente ni tocar la identidad de `items` (la "trampa" que design.md D6 advierte
  // explícitamente: cambiar `items` de identidad re-montaría el árbol y re-evaluaría el
  // auto-colapso de `PacienteDocumentosChecklist`). Quien decide cuándo subirlo es
  // `PacienteDocumentos.tsx`, tras una transferencia que afecta a ESTE bloque (origen o destino).
  // Nunca lo pasan los otros 3 dominios (Vehículos/Conductores/Facturas) — `undefined` de sobra.
  refreshToken?: number,
) {
  const queryClient = useQueryClient();
  const clave = claves.documentos.deEntidad(entidad, entidadId, agrupacionId, refreshToken);

  // migracion-react-query, Fase 4. Tres cosas que se preservan tal cual:
  //
  //   1. **Aridad exacta.** Sin agrupación se llama a `listByEntity` con exactamente 2 argumentos,
  //      nunca con un tercero `undefined`. Los tests de Vehículos/Conductores/Facturas verifican
  //      `toHaveBeenCalledWith(entidad, entidadId)` con exactitud de aridad.
  //   2. **`refreshToken` viaja en la CLAVE**, no en las deps de un efecto: subirlo produce una
  //      clave nueva y por lo tanto una relectura, sin remontar el componente ni tocar la identidad
  //      de `items` (la trampa que design.md D6 de documentos-transferencia-actividad advierte).
  //   3. **`upload`/`remove` NO recargan**: mutan la caché con `setQueryData`, igual que antes
  //      mutaban el estado local. Recargar acá sería un cambio de comportamiento y un round-trip
  //      de más.
  const { data, isPending } = useQuery({
    queryKey: clave,
    queryFn: () =>
      agrupacionId !== undefined
        ? repository.listByEntity(entidad, entidadId, agrupacionId)
        : repository.listByEntity(entidad, entidadId),
    staleTime: FRESCURA.transaccional,
    // ⚠️ Sin esto, subir `refreshToken` (o cambiar de agrupación) produce una clave NUEVA cuya
    // caché arranca vacía, y el checklist parpadea a "0 de N documentos" hasta que llega la
    // relectura. La implementación anterior no tenía ese bajón porque el estado local conservaba
    // los documentos viejos mientras el efecto recargaba. `keepPreviousData` restituye exactamente
    // ese comportamiento. Lo detectó el test 6.8 de documentos-transferencia-actividad.
    placeholderData: keepPreviousData,
  });

  const documentos = data ?? [];
  const loading = isPending;

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
      queryClient.setQueryData<DocumentoAdjunto[]>(clave, (prev) => [...(prev ?? []), doc]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entidad, entidadId, agrupacionId, repository, queryClient, JSON.stringify(clave)],
  );

  // pacientes-documentos-multiples (tasks.md 3.2, design.md D1): filtra por `id` del documento,
  // no por `itemId` — con colección, quitar "el" documento de un ítem deja de tener sentido.
  const remove = useCallback(
    async (documentoId: string) => {
      await repository.remove(entidad, entidadId, documentoId);
      queryClient.setQueryData<DocumentoAdjunto[]>(clave, (prev) =>
        (prev ?? []).filter((d) => d.id !== documentoId),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entidad, entidadId, repository, queryClient, JSON.stringify(clave)],
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

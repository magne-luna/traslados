import type { ActualizacionObraSocial, NuevaObraSocial, ObraSocial } from '../../shared/types/obraSocial';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import { claves } from '../../shared/lib/query/claves';
import { FRESCURA } from '../../shared/lib/query/frescura';
import { useListaDeDominio } from '../../shared/lib/query/useListaDeDominio';

export interface UseObrasSocialesResult {
  obrasSociales: ObraSocial[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  crear: (data: NuevaObraSocial) => Promise<ObraSocial>;
  actualizar: (id: string, data: ActualizacionObraSocial) => Promise<ObraSocial>;
}

// Wiring de estado entre las pantallas de Obras Sociales y un ObraSocialRepository.
//
// migracion-react-query, Fase 3: el cuerpo delega en `useListaDeDominio` (el patrón compartido de
// los cuatro dominios de referencia). **`UseObrasSocialesResult` NO cambió** — solo se renombra `datos` a
// `obrasSociales`, que es el nombre que las pantallas ya usan.
export function useObrasSociales(repository: ObraSocialRepository): UseObrasSocialesResult {
  const { datos, ...resto } = useListaDeDominio<ObraSocial, NuevaObraSocial, ActualizacionObraSocial>({
    claveDominio: claves.obrasSociales.todos(),
    claveLista: claves.obrasSociales.lista(),
    cargar: () => repository.list(),
    crear: (data) => repository.create(data),
    actualizar: (id, data) => repository.update(id, data),
    frescuraMs: FRESCURA.referencia,
  });

  return { obrasSociales: datos, ...resto };
}

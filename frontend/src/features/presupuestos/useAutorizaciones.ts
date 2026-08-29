import type { ActualizacionAutorizacion, NuevaAutorizacion, Autorizacion } from '../../shared/types/presupuesto';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import { claves } from '../../shared/lib/query/claves';
import { FRESCURA } from '../../shared/lib/query/frescura';
import { useListaDeDominio } from '../../shared/lib/query/useListaDeDominio';

export interface UseAutorizacionesResult {
  autorizaciones: Autorizacion[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  crear: (data: NuevaAutorizacion) => Promise<Autorizacion>;
  actualizar: (id: string, data: ActualizacionAutorizacion) => Promise<Autorizacion>;
}

// Wiring de estado entre las pantallas de Autorizaciones y un AutorizacionRepository.
//
// migracion-react-query, Fase 4 (dominio TRANSACCIONAL). **`UseAutorizacionesResult` NO cambió.**
//
// ⚠️ `FRESCURA.transaccional` es CERO, y no es un olvido: una autorización habilita o bloquea facturación, y su vigencia cambia dentro de la sesión. Ponerle
// `FRESCURA.referencia` sería el riesgo R2 del change — mostrarle a la usuaria plata
// desactualizada. Con frescura cero se conservan igual la deduplicación de peticiones concurrentes
// y la invalidación automática por mutación; lo único que no se hace es servir un dato viejo desde
// memoria.
export function useAutorizaciones(repository: AutorizacionRepository): UseAutorizacionesResult {
  const { datos, ...resto } = useListaDeDominio<Autorizacion, NuevaAutorizacion, ActualizacionAutorizacion>({
    claveDominio: claves.autorizaciones.todos(),
    claveLista: claves.autorizaciones.lista(),
    cargar: () => repository.list(),
    crear: (data) => repository.create(data),
    actualizar: (id, data) => repository.update(id, data),
    frescuraMs: FRESCURA.transaccional,
  });

  return { autorizaciones: datos, ...resto };
}

import { useQuery } from '@tanstack/react-query';
import type { Paciente } from '../../shared/types/paciente';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import { aMensaje } from '../../shared/lib/query/aMensaje';
import { claves } from '../../shared/lib/query/claves';
import { FRESCURA } from '../../shared/lib/query/frescura';

export interface UsePacientesCompletosResult {
  pacientes: Paciente[];
  loading: boolean;
  error: string | null;
}

// select-liviano-selectores: Facturación es el único consumidor que necesita el paciente ENTERO
// del padrón — usa `obraSocialId` para resolver la obra social y le pasa el paciente completo al
// flujo de emisión (`useEmisionFactura`). Las otras tres pantallas se conforman con
// `PacienteResumen` y por eso `usePacientes` dejó de traer la ficha completa.
//
// ⚠️ Esto es un paso intermedio honesto, no el destino. Lo correcto es que Facturación pida por
// `getById` el ÚNICO paciente de la factura que está viendo, en vez de traerse el padrón entero
// para después hacerle un `find`. Mientras eso no se haga, esta pantalla paga lo mismo que antes;
// las otras tres ya no.
//
// Clave PROPIA (no `claves.pacientes.lista()`): las dos formas son distintas y compartir entrada
// de caché haría que un consumidor reciba la forma del otro. Comparte el prefijo del dominio, así
// que una mutación de pacientes las invalida a las dos.
export function usePacientesCompletos(repository: PacienteRepository): UsePacientesCompletosResult {
  const { data, isPending, error } = useQuery({
    queryKey: claves.pacientes.listaCompleta(),
    queryFn: () => repository.listCompleto(),
    staleTime: FRESCURA.referencia,
  });

  return { pacientes: data ?? [], loading: isPending, error: aMensaje(error) };
}

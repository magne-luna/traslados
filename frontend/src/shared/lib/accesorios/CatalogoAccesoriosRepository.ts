import type { AccesorioCatalogo } from '../../types/catalogoAccesorios';

// Contrato de datos del catálogo global de accesorios de movilidad (design.md D5, plan
// recortado: sin RPC nueva ni Edge Function — lectura/escritura directas con RLS desde el
// frontend). Las pantallas consumen esta interfaz, nunca Supabase directamente.

export interface CambiosAccesorio {
  tipo?: string;
  icono?: string;
}

export interface CatalogoAccesoriosRepository {
  /** Solo `activa = true`, ordenado por tipo — lo consumen los selectores de Pacientes,
   * Vehículos (y futuros de Conductores). Público; la policy de lectura ajustada en la
   * migración `20260816090000` cubre a los módulos consumidores. */
  listarActivos(): Promise<AccesorioCatalogo[]>;
  /** Todos, incluidos los inactivos (para la gestión con tachados). Requiere permiso de
   * escritura sobre `pacientes`; si RLS lo rechaza, `mapearErrorCatalogo` lo traduce. */
  listarTodos(): Promise<AccesorioCatalogo[]>;
  /** Alta con `activa = true`. `tipo` duplicado → error accionable que nombra el tipo. */
  crear(tipo: string, icono: string): Promise<AccesorioCatalogo>;
  editar(id: string, cambios: CambiosAccesorio): Promise<AccesorioCatalogo>;
  /** Baja lógica: `activa = false`. Los registros que ya lo usan no se tocan. */
  desactivar(id: string): Promise<void>;
  reactivar(id: string): Promise<void>;
}
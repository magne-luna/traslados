import { generateId } from '../id';
import type { MapaPermisos, Permiso } from '../../types/usuario';
import type { Cuenta, CuentaRepository, NuevaCuentaInput } from './CuentaRepository';

// Mock configurable de CuentaRepository (design.md D1, mismo criterio que mockAuthRepository):
// en memoria, NO localStorage — a diferencia de los repositorios mock de dominio (ObraSocial,
// Conductor, etc.), este mock existe solo para tests. La implementación de producción
// (SupabaseCuentaRepository) ya está disponible porque el backend de C-02 está desplegado, así
// que `CuentasRoute.tsx` la inyecta siempre — este mock nunca corre en producción (tasks.md 7.8).

export const CUENTAS_FIXTURE: Cuenta[] = [
  {
    id: 'cuenta-admin-1',
    email: 'andrea@traslados.mock',
    nombre: 'Andrea',
    apellido: 'Pastor',
    rol: 'admin',
    permisos: { pacientes: 'admin', obra_social: 'admin', facturacion: 'admin', conductores: 'admin' },
  },
  {
    id: 'cuenta-empleado-1',
    email: 'enzo@traslados.mock',
    nombre: 'Enzo',
    apellido: 'Gómez',
    rol: 'empleado',
    permisos: { pacientes: 'write', conductores: 'read' },
  },
];

export interface MockCuentaRepositoryOptions {
  cuentasIniciales?: Cuenta[];
}

function permisosArrayAMapa(permisos: Permiso[]): MapaPermisos {
  const mapa: MapaPermisos = {};
  for (const permiso of permisos) mapa[permiso.modulo] = permiso.nivelAcceso;
  return mapa;
}

export function createMockCuentaRepository(options: MockCuentaRepositoryOptions = {}): CuentaRepository {
  let cuentas: Cuenta[] = (options.cuentasIniciales ?? CUENTAS_FIXTURE).map((cuenta) => ({
    ...cuenta,
    permisos: { ...cuenta.permisos },
  }));

  return {
    async listarCuentas() {
      return cuentas.map((cuenta) => ({ ...cuenta, permisos: { ...cuenta.permisos } }));
    },

    async crearCuenta(input: NuevaCuentaInput) {
      const nueva: Cuenta = {
        id: generateId('cuenta'),
        email: input.email,
        nombre: input.nombre,
        apellido: input.apellido,
        // Alta siempre crea cuentas empleado — promover a admin no pasa por esta pantalla
        // (fuera de alcance, ver proposal.md Open Questions).
        rol: 'empleado',
        permisos: permisosArrayAMapa(input.permisos ?? []),
      };
      cuentas = [...cuentas, nueva];
    },

    async actualizarPermisos(usuarioId: string, permisos: Permiso[]) {
      const index = cuentas.findIndex((cuenta) => cuenta.id === usuarioId);
      const existente = index === -1 ? undefined : cuentas[index];
      if (!existente) {
        throw new Error(`No existe una cuenta con id "${usuarioId}".`);
      }
      const actualizada: Cuenta = { ...existente, permisos: permisosArrayAMapa(permisos) };
      cuentas = [...cuentas.slice(0, index), actualizada, ...cuentas.slice(index + 1)];
    },
  };
}

/** Instancia lista para usar (fixture de 2 cuentas) cuando no hace falta configurar nada. */
export const mockCuentaRepository: CuentaRepository = createMockCuentaRepository();

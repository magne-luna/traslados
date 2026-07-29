import { describe, expect, it } from 'vitest';
import { tienePermiso } from './permisos';

// Función pura (tasks.md 2.2-2.4, design.md D5): espejo en el cliente de
// modulos.tiene_permiso() del servidor. Jerarquía read < write < admin. NO es una frontera de
// seguridad (ver el comentario de permisos.ts) — es UX, la RLS del servidor es la real.

describe('tienePermiso — jerarquía de niveles (rol empleado)', () => {
  it('un nivel superior satisface un requisito inferior', () => {
    expect(tienePermiso('empleado', { pacientes: 'write' }, 'pacientes', 'read')).toBe(true);
  });

  it('un nivel insuficiente no satisface un requisito superior', () => {
    expect(tienePermiso('empleado', { pacientes: 'read' }, 'pacientes', 'write')).toBe(false);
  });

  it('un módulo sin ninguna fila en el mapa de permisos no da acceso', () => {
    expect(tienePermiso('empleado', {}, 'pacientes', 'read')).toBe(false);
  });

  it('un nivel exactamente igual al mínimo requerido da acceso', () => {
    expect(tienePermiso('empleado', { conductores: 'admin' }, 'conductores', 'admin')).toBe(true);
  });
});

describe('tienePermiso — short-circuit de rol admin', () => {
  it('rol admin da acceso a cualquier módulo y nivel, aunque el mapa de permisos esté vacío', () => {
    expect(tienePermiso('admin', {}, 'facturacion', 'admin')).toBe(true);
  });

  it('rol admin da acceso incluso si el mapa de permisos tiene un nivel menor para ese módulo', () => {
    expect(tienePermiso('admin', { pacientes: 'read' }, 'pacientes', 'write')).toBe(true);
  });
});

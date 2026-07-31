import { describe, expect, it } from 'vitest';
import { derivarHabilitaciones } from '../mantenimiento/derivarHabilitaciones';
import { buildVehiculosFixture } from './vehiculosFixture';

// D3-B (tasks.md 2B.4, spec vehiculo-contract — escenario "El fixture del mock es coherente con
// la derivación"): cada habilitación que el fixture muestra debe tener su fila de mantenimiento
// `preventivo` + `vtv`/`rto` con `proximoVencimientoFecha`, para que el mock y
// `SupabaseVehiculoRepository` (que también deriva) muestren lo mismo en la misma pantalla.

describe('buildVehiculosFixture — coherencia con la derivación de habilitaciones (D3-B)', () => {
  it('cada vehículo del fixture tiene, para cada habilitación que muestra, su fila de mantenimiento correspondiente', () => {
    const vehiculos = buildVehiculosFixture();

    for (const vehiculo of vehiculos) {
      const derivadas = derivarHabilitaciones(vehiculo.mantenimientos);
      expect(derivadas).toEqual(vehiculo.habilitaciones);
    }
  });

  it('al menos un vehículo del fixture muestra una habilitación VTV derivada de su historial', () => {
    const vehiculos = buildVehiculosFixture();

    const conVtv = vehiculos.find((v) => v.habilitaciones.some((h) => h.tipo === 'vtv'));
    expect(conVtv).toBeDefined();
  });
});

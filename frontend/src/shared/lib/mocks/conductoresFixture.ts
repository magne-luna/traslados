import type { Conductor } from '../../types/conductor';

// Fixture inicial de conductores (tasks.md 3.2, 04_modelo_de_datos.md §Conductor): 3 conductores
// de ejemplo. Al menos uno con una restricción de perfil (US-600: "no traslada pacientes que
// requieren carga física por edad"), uno con una AsignacionSemanal a un vehiculoId que existe
// en vehiculosFixture.ts (design.md Risks/Trade-offs — acoplamiento con el fixture de flota:
// 'vehiculo-etios' y 'vehiculo-kangoo' deben existir ahí), y uno en estado 'fuera-de-servicio'
// para cubrir ese caso en el listado/detalle.

export function buildConductoresFixture(): Conductor[] {
  return [
    {
      // Sin restricciones ni asignación: cubre el caso "conductor recién dado de alta".
      id: 'conductor-gonzalez',
      apellido: 'González',
      nombre: 'Marcos',
      documento: '28456789',
      telefono: '11-4444-5555',
      domicilio: 'Av. Rivadavia 4500, CABA',
      cuil: '20-28456789-3',
      estado: 'operando',
      restricciones: [],
      asignaciones: [],
    },
    {
      // Restricción de perfil documentada (US-600) + asignación semanal vigente a un vehículo
      // real del fixture de flota (vehiculo-etios).
      id: 'conductor-perez',
      apellido: 'Pérez',
      nombre: 'Carlos',
      documento: '15789456',
      telefono: '11-5555-6666',
      fechaNacimiento: '1958-03-12',
      domicilio: 'Calle 50 N° 1234, La Plata',
      cuil: '20-15789456-9',
      estado: 'operando',
      restricciones: ['no-carga-fisica'],
      observaciones: 'No trasladar pacientes con silla rígida ni asistencia de carga física.',
      asignaciones: [{ id: 'asignacion-perez-1', vehiculoId: 'vehiculo-etios', semana: '2026-W30' }],
    },
    {
      // Fuera de servicio (licencia médica): sin asignación vigente, sin restricciones.
      id: 'conductor-diaz',
      apellido: 'Díaz',
      nombre: 'Lucía',
      documento: '32112233',
      domicilio: 'Mitre 800, Vicente López',
      cuil: '27-32112233-4',
      estado: 'fuera-de-servicio',
      restricciones: [],
      asignaciones: [{ id: 'asignacion-diaz-1', vehiculoId: 'vehiculo-kangoo', semana: '2026-W30' }],
    },
  ];
}

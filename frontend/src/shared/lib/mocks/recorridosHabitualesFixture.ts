import type { RecorridoHabitual } from '../../types/recorridoHabitual';

// Fixture de siembra de `mockRecorridoHabitualRepository` (RF-110). A diferencia del resto de
// `shared/lib/mocks/*Fixture.ts`, arranca VACÍO a propósito: la tabla real `pacientes.recorridos`
// ya existe en producción y está vacía (sin pantalla que la use todavía) — sembrar destinos
// habituales inventados acá sería un dato de demo que no refleja ningún paciente real. `[]` deja
// el mismo comportamiento de "paciente sin destinos habituales todavía" que tendría la base real.
export function buildRecorridosHabitualesFixture(): RecorridoHabitual[] {
  return [];
}

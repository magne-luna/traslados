## MODIFIED Requirements

> El contrato del dominio (tipos + interfaz `HojaDeRutaRepository`) **no cambia de firma**; el cambio
> es el estatus de las implementaciones que lo cumplen y la normatividad del contrato de errores.

### Requirement: Implementación mock con persistencia en localStorage

El sistema SHALL proveer una implementación mock de `HojaDeRutaRepository` en
`frontend/src/shared/lib/mocks/mockHojaDeRutaRepository.ts` que cumpla la interfaz al pie de la
letra, persista en `localStorage` con un `schemaVersion` y devuelva promesas con latencia simulada,
para ejercitar estados de carga y error reales. El mock SHALL seguir existiendo como doble de test y
para desarrollo sin las otras integraciones encima, **pero SHALL dejar de ser la implementación
inyectada** por el composition root de la feature, que pasa a inyectar la implementación real
(`supabaseHojaDeRutaRepository`). Debe continuar sembrando su fixture coherente (hojas con
recorridos ligados a vehículo/conductor/paciente existentes en los fixtures, coordenadas incluidas,
y el manejo de `schemaVersion` desincronizado re-sembrando en vez de romper la deserialización).
(Previously: era la única implementación inyectada por `HojaDeRutaRoute.tsx`, sin una contraparte
real.)

#### Scenario: Siembra del fixture inicial
- **GIVEN** no hay datos de hojas de ruta en `localStorage`
- **THEN** el mock siembra un fixture coherente: al menos una hoja del día con recorridos ligados a
  `vehiculoId`/`conductorId`/`pacienteId` existentes en los fixtures, con un vehículo habilitado, un
  conductor operando y coordenadas fixture para el mapa

#### Scenario: Persistencia entre recargas
- **WHEN** se crea o actualiza una hoja y luego se relee tras una recarga simulada
- **THEN** el cambio persiste porque quedó en `localStorage`

#### Scenario: Mismatch de schemaVersion
- **WHEN** el payload almacenado tiene un `schemaVersion` distinto al esperado o está corrupto
- **THEN** el mock re-siembra desde el fixture en vez de romper la deserialización

#### Scenario: El mock deja de ser la implementación inyectada
- **GIVEN** `HojaDeRutaRoute.tsx` tras el swap
- **WHEN** se inspecciona el composition root
- **THEN** inyecta `supabaseHojaDeRutaRepository` en lugar de `mockHojaDeRutaRepository`
- **AND** el archivo del mock sobrevive y sus tests siguen pasando, como doble de test (CP0 opción A)

## ADDED Requirements

### Requirement: Contrato de errores normativo entre implementaciones

El sistema SHALL tratar el contrato de errores del repository (semántica de `null` en `getById`/
`getByFecha`, y `Error` con mensaje en castellano para el resto) como **normativo** y coincidente
entre todas las implementaciones de `HojaDeRutaRepository`, porque ahora hay dos (mock y real) que
deben comportarse igual para los mismos datos. La semántica de `getByFecha` → `null` (no lanza) y la
de `update` con clave `recorridos` ausente = "no tocar" (no vaciar) SHALL valer por igual para el
mock y para la implementación real.

#### Scenario: Mock y real coinciden en getByFecha de un día sin hoja
- **GIVEN** una fecha sin hoja de ruta
- **WHEN** se invoca `getByFecha(fecha)` sobre el mock y sobre el repository real
- **THEN** ambas promesas resuelven `null`, sin lanzar

#### Scenario: Mock y real coinciden en no vaciar recorridos ante un update parcial
- **GIVEN** un `update(id, { notas: '...' })` sin la clave `recorridos`
- **WHEN** se ejecuta sobre el mock y sobre el repository real
- **THEN** ninguna de las dos borra ni reemplaza los recorridos existentes

### Requirement: Composición raíz por inyección, un solo punto de cambio

El sistema SHALL hacer el swap en `frontend/src/features/hojas-de-ruta/HojaDeRutaRoute.tsx`, único
archivo de la feature que cambia por la integración. La feature SHALL inyectar
`supabaseHojaDeRutaRepository` y reusar el singleton existente
`supabasePacienteRepository` de `integracion-pacientes` (sin crear uno nuevo). Mientras
`integracion-conductores-vehiculos` siga sin repository real, `mockVehiculoRepository` y
`mockConductorRepository` SHALL seguir inyectados (CP0 opción A recomendada); si la usuaria/Enzo
resuelve bloqueando (CP0 opción B), este requisito queda pendiente de revisión antes del apply.
Ningún hook, componente ni context de `features/hojas-de-ruta/` MUST importar
`SupabaseHojaDeRutaRepository` ni el cliente `supabase` directamente.

#### Scenario: Solo el composition root conoce la implementación real
- **GIVEN** los archivos de `frontend/src/features/hojas-de-ruta/`
- **WHEN** se buscan imports de `SupabaseHojaDeRutaRepository` o `supabaseClient`
- **THEN** la única coincidencia de producción es `HojaDeRutaRoute.tsx`

#### Scenario: Swap parcial documentado en el propio archivo
- **GIVEN** el swap realizado (CP0 opción A)
- **WHEN** se lee el comentario de cabecera de `HojaDeRutaRoute.tsx`
- **THEN** declara que Hoja de Ruta y Paciente son reales y Vehículo/Conductor siguen fixture, citando
  `design.md` Checkpoint 0 y el motivo por el que es transitorio
- **AND** cuando `integracion-conductores-vehiculos` aterrice, el único trabajo pendiente en esta
  feature es cambiar dos imports, sin tocar `HojaDeRutaPage` ni el repository real
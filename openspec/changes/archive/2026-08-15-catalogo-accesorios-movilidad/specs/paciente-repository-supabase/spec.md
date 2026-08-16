# Delta for Paciente Repository Supabase

## MODIFIED Requirements

### Requirement: Mapeo en funciones puras y aisladas

El sistema SHALL implementar toda la traducción entre filas de Postgres y el tipo `Paciente` en
funciones puras exportadas desde `frontend/src/shared/lib/pacientes/pacienteMapping.ts`, sin efectos,
sin lectura de reloj global y sin acceso a red. Las funciones de parseo MUST angostar `unknown` con
type guards explícitos y MUST descartar (no propagar) las filas que no cumplen la forma esperada,
en lugar de romper la operación completa. Para los accesorios, el descarte por "tipo desconocido"
MUST desaparecer: `parseAccesorios` acepta cualquier `tipo` del maestro real (`pacientes.accesorios`)
como valor legítimo de `TipoAccesorio` — el catálogo es la fuente de verdad (cierra la discrepancia
#11); el descarte queda limitado a filas estructuralmente malformadas.
(Previously: los `tipo` de accesorios fuera de la unión cerrada `AccesorioMovilidad` se descartaban
en silencio al mapear.)

#### Scenario: El mapeo se testea sin mockear la red

- GIVEN una fila cruda de `pacientes.paciente` con sus embeds, como objeto literal
- WHEN se invoca la función de parseo directamente en un test
- THEN devuelve un `Paciente` válido sin haber montado ningún fake del cliente Supabase

#### Scenario: Una fila hija malformada no rompe el listado

- GIVEN una respuesta donde una de las direcciones embebidas no tiene la forma esperada
- WHEN se mapea el paciente
- THEN esa dirección se descarta
- AND el resto del paciente (y del listado) se devuelve normalmente

#### Scenario: Nullabilidad invertida se normaliza al leer

- GIVEN una fila con `fecha_nacimiento`, `cuil_titular` o `personas_a_cargo.dni` en `NULL`
- WHEN se mapea a `Paciente`
- THEN esos campos, que el tipo del dominio declara requeridos, se representan como cadena vacía
- AND NO se lanza error ni se descarta el paciente

#### Scenario: El diagnóstico JSONB se normaliza a texto

- GIVEN `clinicos.diagnostico` con un valor JSONB (cadena JSON, objeto o `NULL`)
- WHEN se mapea a `Paciente.diagnostico`
- THEN el resultado es siempre un `string` (cadena vacía si el valor era `NULL`)
- AND al escribir, `diagnostico` se serializa a JSON válido para la columna

#### Scenario: Accesorios desconocidos en el maestro se descartan

- GIVEN una fila de `pacientes.accesorios` con cualquier `tipo` existente en el maestro real
- WHEN se mapea el paciente
- THEN ese accesorio se conserva en `accesorioMovilidad`
- AND no se descarta ninguno por estar fuera de una unión cerrada en TypeScript (ya no existe tal unión; el maestro es la fuente de verdad)
(Previously: un `tipo` fuera de la unión cerrada `AccesorioMovilidad` se descartaba en silencio.)
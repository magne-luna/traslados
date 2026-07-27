## 1. Contrato de datos (tipos)

- [x] 1.1 Crear `frontend/src/shared/types/paciente.ts` con `FormatoAfiliado` (`'numero-documento' | 'alfanumerico' | 'cuil-con-sufijo'`), `IdentificadorAfiliado` (`{ formato, valor }`), `TipoDireccion` (`'domicilio' | 'escuela' | 'terapia' | 'ciset' | 'otro'`), `Tramo` (`'ida' | 'vuelta'`). Sin `any`. **Aceptación:** `tsc --noEmit` compila; ningún `string` libre para `formato` ni `tramo`.
- [x] 1.2 Definir `Cud` (`{ numero, fechaEmision, fechaVencimiento }`), `Direccion` (`{ id, tipo, tramo, calle, localidad, dias?, horario? }`) y `PersonaACargo` (`{ id, nombre, apellido, dni }`). **Aceptación:** cada uno tipado, fechas como ISO string.
- [x] 1.3 Definir la interfaz `Paciente` (id, apellido, nombre, fechaNacimiento, dni, cuilTitular, diagnostico, accesorioMovilidad, obraSocialId, numeroAfiliado, cud, direcciones, personasACargo, telefonoAlternativo, amparoJudicial, amparoJudicialAclaracion?). Reutilizar `AccesorioMovilidad` de `shared/types/vehiculo.ts` (import, no redefinir). `obraSocialId: string | null`. **Aceptación:** `cuilTitular`, `dni` y `numeroAfiliado` son campos distintos (RN-ID-01/02); import de `AccesorioMovilidad` resuelve.
- [x] 1.4 Definir `NuevoPaciente = Omit<Paciente, 'id'>` y `ActualizacionPaciente = Partial<Omit<Paciente, 'id'>>`. **Aceptación:** compila; no permiten cambiar `id`.

## 2. Función pura de estado del CUD (TDD)

- [x] 2.1 Escribir `frontend/src/shared/lib/pacientes/estadoCud.test.ts`: casos `vencido` (vencimiento < hoy), `por-vencer` (dentro del umbral), `vigente` (fuera del umbral), y un caso de borde exactamente en el umbral. **Aceptación:** el test referencia `estadoCud` (aún inexistente) y falla en RED.
- [x] 2.2 Implementar `frontend/src/shared/lib/pacientes/estadoCud.ts`: `estadoCud(cud, hoy, umbralDias = 60): 'vigente' | 'por-vencer' | 'vencido'`, pura, recibe `hoy` por parámetro (no lee reloj global). **Aceptación:** los tests de 2.1 pasan (GREEN); umbral por defecto documentado en comentario.

## 3. Repository, mock y fixture (TDD)

- [x] 3.1 Crear `frontend/src/shared/lib/pacientes/PacienteRepository.ts` con la interfaz: `list()`, `getById(id)` (resuelve `null` si no existe), `create(data)`, `update(id, data)`. **Aceptación:** compila; firmas idénticas en forma a `ObraSocialRepository`.
- [x] 3.2 Crear `frontend/src/shared/lib/mocks/pacientesFixture.ts`: `buildPacientesFixture()` con 2-3 pacientes de formatos de afiliado distintos (`numero-documento`, `alfanumerico`, `cuil-con-sufijo`), al menos uno con `amparoJudicial: true`, direcciones ida/vuelta de ejemplo y un CUD `por-vencer`. **Aceptación:** el fixture cubre los tres formatos y un CUD por vencer.
- [x] 3.3 Escribir `frontend/src/shared/lib/mocks/mockPacienteRepository.test.ts`: `getById` inexistente → `null`; `create` asigna id y persiste; `update` de id inexistente lanza; persistencia entre instancias (localStorage); re-siembra ante payload corrupto/mismatch de `schemaVersion`. **Aceptación:** RED (mock aún no existe); usar un stub de `localStorage` en el entorno de test.
- [x] 3.4 Implementar `frontend/src/shared/lib/mocks/mockPacienteRepository.ts` replicando el patrón de `mockObraSocialRepository` (`STORAGE_KEY`, `SCHEMA_VERSION`, `withLatency`, `readStore/writeStore`, re-siembra desde `buildPacientesFixture`). **Aceptación:** los tests de 3.3 pasan (GREEN); ningún `any`.

## 4. Hook de estado de la feature

- [x] 4.1 Crear `frontend/src/features/pacientes/usePacientes.ts`: hook `usePacientes(repository)` que devuelva un **objeto** `{ pacientes, loading, error, crear, actualizar }`, recargando tras cada mutación (patrón `useDocumentChecklist`). **Aceptación:** devuelve objeto (no array); maneja error del repository sin loading infinito.
- [x] 4.2 Definir el punto de composición de la feature (componente raíz o context) que inyecta `mockPacienteRepository`, `mockObraSocialRepository` y `mockDocumentoRepository`; ninguna pantalla importa un mock directamente. **Aceptación:** grep de los componentes de `features/pacientes/` no importa `mock*Repository`.

## 5. Listado de pacientes

- [x] 5.1 Crear `frontend/src/features/pacientes/PacientesList.tsx`: estados de carga/vacío/error, filas con apellido+nombre, DNI y obra social. **Aceptación:** los tres estados renderizan algo visible (nunca pantalla en blanco); Tailwind utilities, sin `style={{}}`.
- [x] 5.2 Fila completa clickeable abre el detalle; botón "Editar" con `stopPropagation` abre la edición sin togglear el detalle. **Aceptación:** test de comportamiento — click en fila abre detalle; click en Editar no dispara el detalle.

## 6. Ficha completa del paciente (detalle + formulario)

- [x] 6.1 Crear `PacienteDetail.tsx`: resumen del paciente con datos personales, clínicos, accesorio de movilidad, obra social, teléfono alternativo, y el CUD con chip de estado (usa `estadoCud`). Sección CUD y sección personas a cargo aisladas (costura para RLS de FE-8). **Aceptación:** CUD `por-vencer`/`vencido` muestra chip de advertencia/peligro distinto de `vigente`.
- [x] 6.2 Crear `PacienteForm.tsx` (alta/edición): datos personales (apellido, nombre, fechaNacimiento, dni, cuilTitular), diagnóstico, accesorio de movilidad (select de `AccesorioMovilidad`), obra social (select desde `ObraSocialRepository.list()`), teléfono alternativo, flag de amparo judicial + aclaración. **Aceptación:** compila; el select de obra social se puebla desde el repository, no hardcodeado.
- [x] 6.3 Sub-formulario del identificador de afiliado: select de `formato` (los tres literales) + input de `valor`, con formato por defecto editable (constante documentada, no fija en la lógica). **Aceptación:** test — cambiar el formato no borra ni fuerza el valor; el default es editable.
- [x] 6.4 Sub-formulario del CUD (número, emisión, vencimiento). **Aceptación:** al editar la fecha de vencimiento, el chip de estado en el detalle se recomputa vía `estadoCud`.
- [x] 6.5 Validar requeridos (apellido, nombre, DNI) en UI, bloqueando guardado y señalando faltantes; conectar create/update al hook y mostrar el error del repository. **Aceptación:** test — guardar sin DNI se bloquea y señala el campo; error del repository muestra mensaje visible sin loading infinito.

## 7. Editor de personas a cargo

- [x] 7.1 Crear `PersonasACargoEditor.tsx`: alta/baja de personas a cargo (nombre, apellido, DNI), key estable por `id` (nunca índice de array), persistiendo vía `actualizar()`. **Aceptación:** test — agregar y quitar actualiza la lista y persiste; keys por id.

## 8. Editor de direcciones (ida/vuelta independientes)

- [x] 8.1 Crear `DireccionesEditor.tsx`: alta/baja de direcciones con `tipo` y `tramo`, key estable por `id`. **Aceptación:** se pueden registrar varias direcciones de distinto tipo/tramo; persisten vía `actualizar()`.
- [x] 8.2 Garantizar que la vuelta NO se autocompleta desde la ida: cada tramo se edita por separado, sin copiar datos entre tramos (RN-HR-02). **Aceptación (test):** cargar la ida deja el tramo de vuelta en blanco; editar la vuelta no altera la ida; ida y vuelta con datos distintos coexisten sin fusionarse.

## 9. Pestaña de documentos del paciente

- [x] 9.1 Crear `PacienteDocumentos.tsx`: resolver la obra social del paciente (`ObraSocialRepository.getById(obraSocialId)`), tomar su `checklist` y pasarlo a `useDocumentChecklist('paciente', paciente.id, items, documentoRepository)` + `<DocumentChecklist />`. **Aceptación:** reutiliza el componente de FE-1 sin recrear el modelo documental; los ítems y su orden salen del checklist de la obra social.
- [x] 9.2 Estados vacío y de carga: paciente sin obra social o sin checklist → estado vacío explícito; mientras resuelve → loading. **Aceptación (test):** sin obra social muestra empty state, no un checklist genérico ni pantalla en blanco.

## 10. Integración y verificación

- [x] 10.1 Montar la feature de pacientes en el shell/routing existente inyectando los mocks en el punto de composición. **Aceptación:** la ruta de pacientes renderiza el listado con el fixture.
- [x] 10.2 Verificar `tsc --noEmit` sin errores y el linter limpio (sin `any`, sin `style={{}}` inline, imports usados). **Aceptación:** ambos comandos pasan.
- [x] 10.3 Verificación manual del flujo: crear paciente → asignar obra social + identificador de afiliado (probar los tres formatos) → cargar CUD por vencer y ver la alerta → cargar direcciones ida/vuelta distintas → agregar personas a cargo → subir documentos del checklist de la obra social → recargar y confirmar persistencia en localStorage. **NOTA:** confirmada por el usuario en navegador — durante la verificación surgieron discrepancias vs. `Traslados-Modelo-Datos.docx` (ver §11) y un bug de `SCHEMA_VERSION`, ambos resueltos antes de archivar.

## 11. Fix discrepancias confirmadas vs. Traslados-Modelo-Datos.docx

> Durante la revisión manual (10.3) el usuario detectó, vía los carteles `AvisoModeloDatos`, varias
> discrepancias contra `docs/core/Traslados-Modelo-Datos.docx` (detalle en `04_modelo_de_datos.md`
> y en `CHANGES.md` §C-05). Confirmó sumar 4 campos en la primera tanda (11.1 a 11.7) y un quinto
> campo en una segunda tanda (11.8 a 11.12: accesorio de movilidad múltiple). El resto (historial de
> coberturas de obra social/numeroAfiliado, separar Direcciones de Recorridos, CUD "Vigente"
> persistido) queda deliberadamente sin tocar — no forma parte de este change.

- [x] 11.1 (TDD) `segundoNombre` opcional en `Paciente`: test RED en `PacienteForm.test.tsx` (campo
  "Segundo nombre" en el submit, opcional, `undefined` si no se completa) → tipo en
  `shared/types/paciente.ts` + `PacienteFormValues` → input en `PacienteDatosPersonalesFields.tsx`.
  **Aceptación:** el campo es opcional, no rompe el fixture ni pacientes existentes sin el valor.
- [x] 11.2 (TDD) `segundoApellido` opcional en `Paciente`, mismo patrón que 11.1 (test RED/GREEN en
  `PacienteForm.test.tsx`, input en `PacienteDatosPersonalesFields.tsx`). **Aceptación:** ídem 11.1;
  `getByLabelText(/^apellido$/i)` y `/^nombre$/i` en los tests existentes se re-anclan para no
  matchear "Segundo apellido"/"Segundo nombre".
- [x] 11.3 (TDD) `condicion` opcional en `Paciente`, separado de `diagnostico` (no se crea entidad
  "Datos Clínicos" aparte — alcance acotado a agregar el campo). Test RED/GREEN en
  `PacienteForm.test.tsx`; input junto a Diagnóstico en `PacienteDatosPersonalesFields.tsx`; se
  muestra en `PacienteResumen.tsx` junto al diagnóstico.
- [x] 11.4 (TDD) Mover teléfono a Personas a Cargo: test RED en `PersonasACargoEditor.test.tsx`
  (alta con `telefono`/`telefonoAlternativo`, ambos opcionales, se muestran en la fila) → agregar
  ambos campos a `PersonaACargo` → inputs en `PersonasACargoEditor.tsx`. Luego test RED en
  `PacienteForm.test.tsx` (`queryByLabelText(/teléfono/i)` ya no existe) → quitar
  `telefonoAlternativo` de `Paciente`, `PacienteFormValues` y `PacienteCoberturaFields.tsx`.
  **Aceptación:** `tsc --noEmit` detecta y fuerza a migrar todos los fixtures/tests que
  construían un `Paciente`/`NuevoPaciente` literal con `telefonoAlternativo` (excess property);
  se corrigen mecánicamente (no es un cambio de comportamiento en esos tests).
- [x] 11.5 Actualizar `pacientesFixture.ts`: Martina con segundo nombre/apellido + condición +
  persona a cargo con teléfono (caso "con los 4 campos cargados"); Facundo con persona a cargo con
  teléfono + teléfono alternativo pero sin segundo nombre/apellido/condición (caso "sin ellos",
  para ejercitar la opcionalidad); Brisa sin cambios de fondo (ya no tiene `telefonoAlternativo`).
- [x] 11.6 Actualizar carteles `AvisoModeloDatos` en `PacienteDetail.tsx`: el cartel general de
  Paciente pierde la mención a segundo nombre/apellido, Condición y teléfono alternativo (resueltos)
  y conserva solo lo pendiente (accesorio de movilidad múltiple, historial de coberturas de
  numeroAfiliado); el cartel de Personas a Cargo se elimina por completo (su único punto —
  teléfono— quedó resuelto). Los carteles de Direcciones y CUD no se tocan. Tests RED/GREEN en
  `PacienteDetail.test.tsx` verificando ausencia del texto viejo y presencia del texto vigente.
  **Aceptación:** ningún test verifica que el cartel "desapareció sin más" — se verifica que sigue
  mostrando lo que realmente falta.
- [x] 11.7 `tsc --noEmit -p tsconfig.app.json`, `oxlint` y suite completa de Vitest limpios tras el
  cambio. **Aceptación:** 60 archivos de test, 311 tests pasando (296 antes de este fix + 15 tests
  nuevos de este fix, neto de 3 renombrados/reescritos sin sumar assertions nuevas).
- [x] 11.8 (TDD) `Paciente.accesorioMovilidad` pasa de `AccesorioMovilidad | null` a
  `AccesorioMovilidad[]` (docx: tabla de vínculo N a N, igual que Vehiculo-Accesorio en `C-08`).
  Test RED en `PacienteForm.test.tsx` (seleccionar más de un accesorio y verificar el array en el
  submit) → tipo en `shared/types/paciente.ts` (`AccesorioMovilidad[]`, array vacío = ninguno) →
  `PacienteFormValues.accesorioMovilidad` → selector de `PacienteDatosPersonalesFields.tsx` pasa de
  `<select>` único a `<fieldset>` de checkboxes multi-selección. **Aceptación:** compila; togglear
  un checkbox agrega/quita del array (mismo patrón que `toggleAccesorio` de `VehiculoForm.tsx`, sin
  extraer un componente compartido porque tampoco existe uno ahí — YAGNI, se reutiliza el catálogo
  `ACCESORIO_MOVILIDAD_OPTIONS`/`_LABELS` de `accesorioMovilidadOptions.ts` pero no una UI en común).
- [x] 11.9 (TDD) Precarga en modo edición: test en `PacienteForm.test.tsx` con `initial` de 2
  accesorios verifica que ambos checkboxes queden marcados y un tercero no (triangulación, mismo
  patrón que el test equivalente de `VehiculoForm.test.tsx`).
- [x] 11.10 (TDD) `PacienteResumen.tsx` muestra la lista de accesorios como `Chip`s (mismo patrón
  que `VehiculoDetail.tsx` con `accesoriosCompatibles`) en vez de un valor único. Test RED en
  `PacienteDetail.test.tsx` con paciente de 2 accesorios → ambos chips visibles; triangulación con
  paciente de array vacío → no rompe y no muestra chips.
- [x] 11.11 Actualizar `pacientesFixture.ts` para ejercitar los tres casos de cardinalidad: Martina
  con 2 accesorios (`silla-plegable` + `andador`), Brisa con 1 (`andador`), Facundo con 0 (`[]`,
  antes `null`). Sin regla nueva en `validatePacienteForm.ts` (el campo nunca tuvo validación de
  obligatoriedad).
- [x] 11.12 Actualizar el cartel `AvisoModeloDatos` general de `PacienteDetail.tsx`: pierde la
  mención a "accesorio de movilidad admite uno solo" (resuelto) y conserva solo lo pendiente
  (numeroAfiliado sin historial de coberturas). Test RED/GREEN en `PacienteDetail.test.tsx`
  verificando ausencia del texto viejo y presencia del texto vigente (mismo criterio que 11.6).
  **Aceptación:** `tsc --noEmit -p tsconfig.app.json`, `oxlint` y suite completa de Vitest limpios;
  67 archivos de test, 352 tests pasando (311 antes de este fix + 4 tests nuevos de este fix propios
  de `pacientes-ui`, neto de 1 renombrado/dividido en dos sin sumar assertions nuevas — el resto del
  delta hasta 352 corresponde a trabajo concurrente no relacionado de otro change, `presupuestos-ui`,
  corriendo en paralelo sobre el mismo repo). Historial de coberturas (numeroAfiliado), separar
  Direcciones de Recorridos y CUD "Vigente" persistido siguen sin tocar.

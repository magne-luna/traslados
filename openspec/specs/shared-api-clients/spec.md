# Shared API Clients — Specification

## Purpose

Definir los clientes compartidos de API que toda la aplicación frontend consume: un cliente de Supabase listo para usar con la anon key, y un placeholder para Google Maps (cuya API key está diferida).

## Requirements

### Requirement: Cliente Supabase singleton

El sistema MUST exportar un cliente singleton `supabase` desde `frontend/src/shared/lib/supabaseClient.ts`, inicializado con `createClient` de `@supabase/supabase-js` usando `SUPABASE_URL` y `SUPABASE_ANON_KEY` de las variables de entorno.

#### Scenario: Cliente inicializado correctamente

- GIVEN que `SUPABASE_URL` y `SUPABASE_ANON_KEY` están definidas en el entorno
- WHEN se importa `supabase` desde `supabaseClient.ts`
- THEN el objeto exportado es una instancia válida de `SupabaseClient`
- AND puede ejecutar consultas contra el proyecto

#### Scenario: Cliente compila sin env vars

- GIVEN que las env vars no están definidas
- WHEN se ejecuta `tsc -b --noEmit` en `frontend/`
- THEN `supabaseClient.ts` compila sin errores
- AND el cliente se exporta pero puede fallar en runtime si se usa

### Requirement: Placeholder de Google Maps

El sistema MUST exportar un stub tipado desde `frontend/src/shared/lib/googleMapsClient.ts` que contenga únicamente un comentario explicando que la API key de Google Maps está diferida, sin incluir lógica de inicialización ni llamadas de red.

#### Scenario: Stub compila sin errores

- GIVEN el archivo `googleMapsClient.ts` existe
- WHEN se ejecuta `tsc -b --noEmit` en `frontend/`
- THEN el archivo compila sin errores
- AND no se requiere ninguna API key en el entorno

#### Scenario: Stub no realiza conexiones de red

- GIVEN que se importa `googleMapsClient.ts` en un test o componente
- WHEN se inspecciona el módulo
- THEN no contiene llamadas a `fetch`, `XMLHttpRequest` ni inicialización de la API de Google Maps
- AND exporta únicamente una interfaz tipo o un objeto vacío documentado

### Requirement: Archivos libres de errores de tipo

Ambos archivos MUST compilar sin errores bajo el `tsconfig.json` del proyecto en modo estricto (`strict: true`, sin `any`).

#### Scenario: TypeScript strict check

- GIVEN los archivos `supabaseClient.ts` y `googleMapsClient.ts`
- WHEN se ejecuta `tsc -b --noEmit` en `frontend/`
- THEN no se reportan errores de tipo en ninguno de los dos archivos

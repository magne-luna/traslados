# Storage Buckets — Specification

## Purpose

Definir la creación y configuración de los 5 buckets privados de Supabase Storage que almacenan documentos adjuntos a pacientes, vehículos, conductores, facturas y autorizaciones.

## Requirements

### Requirement: Creación de los 5 buckets

El sistema MUST crear 5 buckets con los nombres exactos `documentos-pacientes`, `documentos-vehiculos`, `documentos-conductores`, `documentos-facturas` y `documentos-autorizaciones` mediante migraciones de Supabase. El nuevo bucket `documentos-autorizaciones` SHALL gatearse por el módulo `presupuestos` ya existente, no por un módulo nuevo.

#### Scenario: Buckets creados exitosamente

- GIVEN las migraciones se han aplicado contra el proyecto Supabase
- WHEN se consulta la lista de buckets desde el dashboard o API
- THEN los 5 buckets existen con los nombres especificados
- AND cada bucket corresponde a su entidad (pacientes, vehículos, conductores, facturas, autorizaciones)

#### Scenario: El bucket de autorizaciones se gatea por el módulo `presupuestos`

- GIVEN el bucket `documentos-autorizaciones`
- WHEN se inspeccionan sus policies de `storage.objects`
- THEN todas usan `modulos.tiene_permiso('presupuestos', 'read'|'write')`
- AND no existe ningún módulo `autorizaciones` ni `documentos-autorizaciones` nuevo

### Requirement: Buckets privados

Todos los buckets MUST ser privados (sin acceso público). El sistema SHALL permitir subida/descarga solo mediante operaciones autenticadas con RLS.

#### Scenario: Bucket no expuesto públicamente

- GIVEN un bucket `documentos-{entidad}` existe
- WHEN se verifica su configuración de acceso público
- THEN `public` está en `false`
- AND el bucket no permite acceso anónimo sin autenticación

#### Scenario: Subida autenticada

- GIVEN un usuario autenticado con sesión activa en Supabase
- WHEN intenta subir un archivo a `documentos-pacientes`
- THEN la operación es aceptada (sujeta a políticas RLS futuras en C-02+)

### Requirement: Restricción de tipos de archivo

Cada bucket SHOULD aceptar únicamente imágenes (JPEG, PNG, WebP) y documentos PDF, rechazando otros formatos en la capa de aplicación.

#### Scenario: Archivo válido aceptado

- GIVEN un archivo PDF o imagen (JPEG/PNG/WebP)
- WHEN se intenta subir a cualquier bucket de documentos
- THEN la subida progresa sin rechazo por tipo de archivo

#### Scenario: Formato no soportado rechazado

- GIVEN un archivo con extensión `.exe`, `.zip` o `.docx`
- WHEN se intenta subir a cualquier bucket
- THEN el sistema rechaza la subida con un error de tipo de archivo no soportado

### Requirement: Límite de tamaño por archivo

Cada bucket SHOULD limitar el tamaño máximo por archivo a 10 MB para evitar abusos y controlar costos de storage.

#### Scenario: Archivo dentro del límite

- GIVEN un archivo de 8 MB
- WHEN se intenta subir
- THEN la subida se procesa normalmente

#### Scenario: Archivo que excede el límite

- GIVEN un archivo de 15 MB
- WHEN se intenta subir
- THEN el sistema rechaza la subida con un error de tamaño excedido

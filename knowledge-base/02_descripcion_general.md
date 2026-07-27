# Descripción General

## Stack tecnológico

| Capa | Tecnologías | Notas |
|---|---|---|
| Frontend | React + TypeScript | Diseño responsive (RNF-08), prioriza funcionalidad sobre estética (RNF-05) |
| Backend | Supabase | Autenticación, base de datos y storage de archivos |
| Base de datos | PostgreSQL (vía Supabase) | Centralizada en la nube, con respaldo (RNF-02) |
| Almacenamiento de archivos | Supabase Storage | Carga de imágenes/PDF en Pacientes, Vehículos, Conductores y Facturas (RF-900) |
| Despliegue | Web, sin instalación del lado del cliente | Accesible desde cualquier dispositivo vía navegador (RNF-01) |

## Arquitectura general

Aplicación web de uso interno y exclusivo del personal de la empresa (no es un producto multi-tenant ni de cara al público). Un solo cliente/organización, con múltiples usuarios internos operando de forma concurrente, incluido acceso remoto (ej. facturación trabaja de forma remota).

No maneja roles fijos: cada cuenta de usuario recibe acceso individual a los módulos que la administradora le asigne, de forma flexible (RF-002).

## Integraciones externas

| Servicio | Propósito | Tipo |
|---|---|---|
| Google Maps / Geometry | Geolocalización para sugerir orden de pasajeros por cercanía en la hoja de ruta (RF-701) | API/SDK |
| Google Drive | Vinculación con el Drive de facturación existente, para traer/adjuntar documentos | Integración de archivos |
| ARCA | Generación de comprobantes de factura. Se contempla carga/descarga del comprobante como documento; nivel de integración automática a confirmar (ver preguntas abiertas) | A confirmar (posible API o carga manual) |

## Módulos del sistema

Gestión de usuarios y permisos · Pacientes y fichas clínicas · Presupuestos y autorizaciones · Obras sociales y prestadores · Facturación, asistencias y cobros · Vehículos y mantenimiento · Conductores · Hojas de ruta y recorridos · Panel principal (dashboard) y reportes · Gestión documental transversal.

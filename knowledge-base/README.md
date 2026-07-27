# Traslados (Andrea Pastor) — Base de Conocimiento

Base de conocimiento generada a partir del Documento de Requerimientos Funcionales (DRF) v1.3 de Magne Studios, `docs/DRF-Traslados-v1.3.pdf`, para el Sistema de Gestión Integral del servicio de traslado personalizado de personas con discapacidad operado por Andrea Pastor.

## Índice de Archivos

| Archivo | Contenido |
|---|---|
| [01_vision_y_objetivos.md](01_vision_y_objetivos.md) | Propósito, objetivos por actor, alcance y fuera de alcance de la Fase 1 |
| [02_descripcion_general.md](02_descripcion_general.md) | Stack (React + TypeScript + Supabase), arquitectura general, integraciones externas |
| [03_actores_y_roles.md](03_actores_y_roles.md) | Administradora, Facturación, Operadoras, Conductores; permisos flexibles por módulo |
| [04_modelo_de_datos.md](04_modelo_de_datos.md) | Entidades (Paciente, ObraSocial, Factura, Vehículo, Conductor, HojaDeRuta, etc.) y ERD |
| [05_reglas_de_negocio.md](05_reglas_de_negocio.md) | Reglas codificadas RN-ID, RN-PA, RN-FA, RN-VE, RN-HR, RN-GL |
| [06_funcionalidades.md](06_funcionalidades.md) | 10 épicas con historias de usuario y criterios de aceptación |
| [07_flujos_principales.md](07_flujos_principales.md) | Alta de paciente, hoja de ruta diaria, ciclo de facturación/cobro, mantenimiento de flota |
| [08_arquitectura_propuesta.md](08_arquitectura_propuesta.md) | Patrones, estructura de directorios propuesta, seguridad, variables de entorno |
| [09_decisiones_y_supuestos.md](09_decisiones_y_supuestos.md) | Decisiones de stack/diseño documentadas + supuestos inferidos a validar |
| [10_preguntas_abiertas.md](10_preguntas_abiertas.md) | Inconsistencias detectadas + preguntas abiertas priorizadas + insumos pendientes del cliente |

## Quick Start para Desarrolladores

1. Entender el dominio → [01](01_vision_y_objetivos.md), [03](03_actores_y_roles.md)
2. Entender los datos → [04](04_modelo_de_datos.md)
3. Entender las reglas → [05](05_reglas_de_negocio.md)
4. Entender la arquitectura → [02](02_descripcion_general.md), [08](08_arquitectura_propuesta.md)
5. Implementar → [07](07_flujos_principales.md), [06](06_funcionalidades.md)
6. Antes de codificar → [10](10_preguntas_abiertas.md) — hay varios puntos de alta prioridad sin confirmar por el cliente

## Resumen Ejecutivo

Sistema web interno (React + TypeScript + Supabase) para centralizar la gestión de pacientes, obras sociales, presupuestos/autorizaciones, facturación y cobros, vehículos, conductores y hojas de ruta de un servicio de traslado personalizado para personas con discapacidad, hoy operado con planillas y carpetas dispersas. El DRF (v1.3, en validación) está muy completo en requerimientos funcionales, pero deja explícitamente abiertos varios puntos críticos (identificación fiscal CUIL/CUIT, checklists de otras obras sociales, integración con ARCA, plazos de cobro) que conviene cerrar con el cliente antes de fijar el modelo de datos definitivo. Plazo estimado de desarrollo: 45 días, con una primera etapa de discovery y validación (días 1-7).

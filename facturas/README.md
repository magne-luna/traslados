# arca-miniserver

Proxy de facturación electrónica ARCA (ex AFIP) para Supabase EF. Recibe peticiones HTTP con la identidad fiscal y los datos del comprobante, y emite facturas contra WSAA + WSFE usando Node.js (donde `node-forge` firma el CMS correctamente).

**Multi-titular**: cada petición transporta el CUIT, el certificado y la clave privada del emisor. No se configura identidad en el servidor: **cualquier proyecto puede facturar con su propio CUIT contra este mismo miniserver**.

---

## Requisitos y configuración

| Variable | Requerida | Descripción |
|---|---|---|
| `ARCA_MINISERVER_KEY` | **Sí** | API key que cada cliente debe mandar en el header `X-Api-Key`. Sin ella el servidor no arranca. |
| `PORT` | No | Puerto de escucha (default `3001`). |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | No | Persisten el Ticket de Acceso (TA) en la tabla `arca_ta_cache` para sobrevivir reinicios. |
| `TA_CACHE_DIR` | No | Directorio del caché local de TA (default `./data`). |

> **Seguridad obligatoria**: las peticiones transportan la clave privada del titular. El servidor **debe** estar detrás de HTTPS (reverse proxy tipo Caddy/Nginx/Cloudflare o el TLS del host). Sin TLS, cualquiera en la red puede leer las claves en tránsito.

---

## Endpoints

### `GET /health`

Health check. Requiere `X-Api-Key`.

Respuesta `200`:

```json
{ "ok": true, "titulares_cacheados": 0 }
```

### `POST /facturar`

Emite un comprobante. Requiere `X-Api-Key` + `Content-Type: application/json`.

#### Headers

```
X-Api-Key: <tu api key>
Content-Type: application/json
```

#### Body — identidad fiscal (emisor)

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `cuit` | number | **Sí** | CUIT del emisor (11 dígitos). |
| `certB64` | string | **Sí*** | Certificado X.509 del emisor en PEM, codificado en base64. |
| `keyB64` | string | **Sí*** | Clave privada del emisor en PEM, codificada en base64. |
| `environment` | string | No | `"production"` o `"homologacion"` (default `"homologacion"`). |

\* Alternativa: se aceptan `cert` y `key` con el PEM crudo (sin base64).

#### Body — comprobante

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `ptoVta` | number | **Sí** | Punto de venta. |
| `cbteTipo` | string | **Sí** | `FACTURA_A` o `FACTURA_B`. |
| `items` | array | **Sí** | Ítems del comprobante, ver abajo. |
| `docTipo` | string | Según tipo | `CUIT`, `DNI` o `CUIL` del receptor. **Obligatorio en Factura A.** |
| `docNro` | number | Según tipo | Número de documento del receptor. **Obligatorio en Factura A.** |
| `condicionIva` | string/number | Según tipo | Condición ante IVA del receptor. **Obligatorio en Factura A.** Ver valores abajo. |
| `servicio` | object | No | Período de servicio: `{ desde, hasta, vtoPago }`. |

**`items[]`**:

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `neto` | number | **Sí** | Importe neto. |
| `iva` | string | **Sí** | `IVA_21`, `IVA_10_5`, `IVA_0` o `IVA_27`. |
| `exento` | boolean | No | Marca el ítem como exento. |

**`condicionIva`** — valores soportados:

```
IVA_RESPONSABLE_INSCRIPTO, IVA_SUJETO_EXENTO, CONSUMIDOR_FINAL,
IVA_RESPONSABLE_MONOTRIBUTO, MONOTRIBUTO, PROVEEDOR_DEL_EXTERIOR,
CLIENTE_DEL_EXTERIOR, IVA_LIBERADO
```

> También se acepta el código numérico directo de ARCA.
> En **Factura B** sin receptor, la librería autocompleta consumidor final.

#### Respuestas

| Código | Caso | Cuerpo |
|---|---|---|
| `200` | Factura emitida | `{ aprobada, cae, caeVencimiento, cbteNro, importes: { neto, iva, total } }` |
| `400` | Faltan campos o identidad inválida | `{ error }` |
| `401` | API key inválida / error de autenticación ARCA (TA o WSAA) | `{ error: "Unauthorized" }` o `{ aprobada: false, error: "ARCA_AUTH_ERROR", detalles }` |
| `422` | ARCA rechazó el comprobante | `{ aprobada: false, error: "ARCA_RECHAZO", cbteNro, observaciones }` o `{ error: "ARCA_REJECTION", detalles }` |

En `200`, `aprobada` viene `true` y el `cae` + `caeVencimiento` son el comprobante fiscal.

---

## Ejemplos

### Factura B con consumidor final (homologación)

```bash
curl -X POST https://TU-SERVIDOR/facturar \
  -H "X-Api-Key: TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "cuit": 20123456789,
    "certB64": "LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t...",
    "keyB64": "LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0t...",
    "environment": "homologacion",
    "ptoVta": 1,
    "cbteTipo": "FACTURA_B",
    "items": [{ "neto": 10000, "iva": "IVA_21" }]
  }'
```

```json
{
  "aprobada": true,
  "cae": "72469274958552",
  "caeVencimiento": "2026-08-14",
  "cbteNro": 45,
  "importes": { "neto": 10000, "iva": 2100, "total": 12100 }
}
```

### Factura A con receptor responsable inscripto

```bash
curl -X POST https://TU-SERVIDOR/facturar \
  -H "X-Api-Key: TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "cuit": 20123456789,
    "certB64": "LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t...",
    "keyB64": "LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0t...",
    "environment": "production",
    "ptoVta": 3,
    "cbteTipo": "FACTURA_A",
    "docTipo": "CUIT",
    "docNro": 30111222333,
    "condicionIva": "IVA_RESPONSABLE_INSCRIPTO",
    "items": [{ "neto": 50000, "iva": "IVA_21" }],
    "servicio": { "desde": "2026-08-01", "hasta": "2026-08-31", "vtoPago": "2026-09-10" }
  }'
```

---

## Notas operativas

- **Ticket de Acceso (TA)**: se obtiene de ARCA (WSAA) una vez por identidad y se cachea por titular en `data/ta_cache_<hash>.json` (y en Supabase si está configurado). Un TA válido evita re-login en cada factura. Si un TA cacheado se invalida, el servidor reintenta con login fresco automáticamente.
- **Identidad nueva** (CUIT distinto, o cert/key rotados) = nueva entrada de caché. Las instancias inactivas se descartan tras 10 minutos sin uso.
- **Cold start**: el arranque tarda ~10 s en cargar dependencias (forge, express, supabase). Si el host hace health checks, que no sean impacientes.
- El servidor **no loguea cuerpos de petición** — solo método, ruta, status, duración y (en rechazos) el CBTE número / CUIT.

## Migración desde la versión con `.env`

La versión anterior leía `ARCA_CERT`, `ARCA_KEY` y `ARCA_CUIT` del entorno. Ahora el emisor se pasa por petición. Para migrar un cliente:

1. Codificar el certificado y la clave a base64.
2. Agregar `cuit`, `certB64`, `keyB64` (y `environment` si factura en producción) a cada `POST /facturar`.
3. La API key (`X-Api-Key`) pasó a ser obligatoria.
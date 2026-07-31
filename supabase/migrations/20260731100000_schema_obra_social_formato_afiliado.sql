-- Migration: schema_obra_social_formato_afiliado
-- Description: RN-ID-02 (RF-106): el identificador de afiliado en la ficha del paciente "varía
-- según la obra social" (documento / alfanumérico / CUIL del titular con sufijo) -- es una
-- propiedad de la obra social, no un dato que el usuario elige por paciente. Mismo patrón que
-- identificador_origen (20260729110000_schema_obra_social_facturacion_config.sql): ese resuelve
-- "qué campo de la ficha alimenta el identificador de la factura", este resuelve "qué forma tiene
-- el valor de numeroAfiliado" -- ambos viven en obra_social.obra_social, no en el paciente.
-- knowledge-base/10_preguntas_abiertas.md IN-01 ("Hueco de esquema confirmado") ya documenta el
-- hueco: obra_social.coberturas_paciente.num_afiliado es TEXT libre sin columna de formato -- hoy
-- el formato vive solo en el frontend (numeroAfiliado.formato, editable por paciente) y no
-- persiste, resetea al default en cada reload.

CREATE TYPE obra_social.formato_afiliado AS ENUM ('documento', 'alfanumerico', 'cuil_sufijo');

ALTER TABLE obra_social.obra_social
  ADD COLUMN formato_afiliado obra_social.formato_afiliado NOT NULL DEFAULT 'documento';

-- RLS de obra_social.obra_social ya cubre la tabla completa (policies "Read obra_social" /
-- "Write obra_social" de 20260724100003_schema_obra_social.sql) -- agregar una columna no
-- requiere policies nuevas.

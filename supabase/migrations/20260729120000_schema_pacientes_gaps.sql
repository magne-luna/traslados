-- Migration: schema_pacientes_gaps
-- Description: C-05 pacientes-fichas-clinicas, cerrando 3 gaps chicos contra el contrato ya
-- construido/testeado en frontend/src/shared/types/paciente.ts. El grueso de C-05 (paciente,
-- cud, clinicos, direcciones, personas_a_cargo, recorridos, historial_recorridos, documentos,
-- coberturas_paciente) ya existia de antes (revisado durante C-02).

-- 1) Amparo judicial: el frontend ya modela una aclaracion opcional junto al flag booleano.
ALTER TABLE pacientes.paciente
  ADD COLUMN amparo_judicial_aclaracion TEXT;

-- 2) RN-ID-02: el identificador de afiliado necesita valor + formato (no solo valor). El docx
-- modela el numero de afiliado como historico en "Cobertura del Paciente" (coberturas_paciente
-- ya existe con ese shape) -- faltaba el formato, resolviendo la discrepancia que CHANGES.md
-- dejaba pendiente para el backend.
CREATE TYPE obra_social.formato_afiliado AS ENUM ('numero-documento', 'alfanumerico', 'cuil-con-sufijo');

ALTER TABLE obra_social.coberturas_paciente
  ADD COLUMN formato_afiliado obra_social.formato_afiliado NOT NULL;

-- 3) Direcciones: faltaban localidad/dias/horario del contrato del frontend, y tipo_lugar
-- deberia ser un conjunto cerrado (RF-113), no texto libre.
CREATE TYPE pacientes.tipo_direccion AS ENUM ('domicilio', 'escuela', 'terapia', 'ciset', 'otro');

-- Tabla vacia (nada pusheado la usa todavia) -- NOT NULL directo, sin default temporal.
ALTER TABLE pacientes.direcciones
  ADD COLUMN localidad TEXT NOT NULL,
  ADD COLUMN dias TEXT,
  ADD COLUMN horario TEXT;

ALTER TABLE pacientes.direcciones
  ALTER COLUMN tipo_lugar TYPE pacientes.tipo_direccion USING tipo_lugar::pacientes.tipo_direccion;

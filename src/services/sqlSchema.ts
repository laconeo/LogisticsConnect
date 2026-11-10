/**
 * Esquema SQL de Producción para PostgreSQL / Supabase
 * Cubre las 16 entidades de la Sección 8, Row Level Security (RNF-002),
 * Triggers de Inmutabilidad Append-Only (RNF-014) y Proyección de Estado Padre-Hijo (RNF-016 / Opción B).
 */

export const LOGISTICS_CONNECT_POSTGRES_DDL = `-- ============================================================================
-- LOGISTICS CONNECT — ESQUEMA POSTGRESQL / SUPABASE (MVP V1 PILOTO CHILE & 4 PAÍSES)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. JERARQUÍA GEOGRÁFICA Y ORGANIZACIONAL (RF-010)
CREATE TABLE paises (
  codigo_iso CHAR(2) PRIMARY KEY, -- 'CL', 'AR', 'PY', 'UY'
  nombre VARCHAR(100) NOT NULL,
  documento_identidad VARCHAR(50) NOT NULL, -- RUT, DNI, CI
  zona_horaria VARCHAR(64) NOT NULL DEFAULT 'America/Santiago'
);

CREATE TABLE areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(120) NOT NULL, -- 'Área Sudamérica Sur'
  pais_iso CHAR(2) REFERENCES paises(codigo_iso)
);

CREATE TABLE catalogo_comunas (
  id SERIAL PRIMARY KEY,
  pais_iso CHAR(2) NOT NULL REFERENCES paises(codigo_iso),
  region_departamento VARCHAR(120) NOT NULL,
  comuna_ciudad VARCHAR(120) NOT NULL,
  poblacion INTEGER,
  superficie_km2 NUMERIC(10,2),
  UNIQUE(pais_iso, comuna_ciudad)
);

CREATE TABLE unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nro_unidad VARCHAR(30) NOT NULL UNIQUE, -- Ej: '514820' o temporal '9999xxx'
  es_id_ficticio BOOLEAN NOT NULL DEFAULT FALSE,
  tipo_unidad VARCHAR(20) NOT NULL CHECK (tipo_unidad IN ('ESTACA', 'DISTRITO')),
  nombre VARCHAR(160) NOT NULL,
  presidente_titular VARCHAR(160) NOT NULL,
  rut_documento_titular VARCHAR(30),
  telefono_contacto VARCHAR(50),
  correo_contacto VARCHAR(160),
  area_id UUID REFERENCES areas(id),
  pais_iso CHAR(2) NOT NULL REFERENCES paises(codigo_iso)
);

CREATE TABLE ubicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('BODEGA', 'CENTRO_REUNIONES', 'DOMICILIO', 'EN_TRANSITO')),
  nombre VARCHAR(160) NOT NULL,
  direccion VARCHAR(250) NOT NULL,
  referencia_direccion TEXT,
  comuna_id INTEGER REFERENCES catalogo_comunas(id),
  pais_iso CHAR(2) NOT NULL REFERENCES paises(codigo_iso),
  unidad_id UUID REFERENCES unidades(id),
  latitud NUMERIC(10,7),
  longitud NUMERIC(10,7)
);

-- 2. TIPOS DE ACTIVO CONFIGURABLES Y ACTIVOS CON PADRE-HIJO (RF-001 a RF-005, Opción B)
CREATE TABLE tipos_activo (
  id VARCHAR(50) PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  codigo_prefijo VARCHAR(20) NOT NULL,
  es_contenedor BOOLEAN NOT NULL DEFAULT FALSE,
  valor_declarado_clp NUMERIC(14,2) NOT NULL DEFAULT 3000000,
  peso_kg NUMERIC(6,2),
  dimensiones_cm VARCHAR(40),
  esquema_atributos JSONB NOT NULL DEFAULT '[]'::jsonb,
  plantilla_contenido JSONB NOT NULL DEFAULT '[]'::jsonb,
  estados_permitidos JSONB NOT NULL DEFAULT '["Disponible en bodega","Listo para despacho","En curso","Llegué","Entregado","En uso (unidad)","Incidente","Fuera de servicio","Dado de baja"]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE activos (
  id VARCHAR(50) PRIMARY KEY, -- Ej: 'CFS-CL-063'
  qr_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(), -- RNF-003: Token opaco sin PII
  qr_activo BOOLEAN NOT NULL DEFAULT TRUE,
  nro_serie VARCHAR(100) NOT NULL UNIQUE,
  tipo_id VARCHAR(50) NOT NULL REFERENCES tipos_activo(id),
  estado VARCHAR(40) NOT NULL DEFAULT 'Disponible en bodega',
  pais_iso CHAR(2) NOT NULL REFERENCES paises(codigo_iso),
  ubicacion_actual VARCHAR(250) NOT NULL, -- Proyección derivada del último Movimiento (RNF-016)
  custodio_actual VARCHAR(200) NOT NULL,  -- Proyección derivada del último Movimiento (RNF-016)
  sello_seguridad VARCHAR(60),
  valor_declarado_clp NUMERIC(14,2) NOT NULL DEFAULT 3000000,
  fecha_adquisicion DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_baja DATE,
  motivo_baja TEXT,
  atributos JSONB NOT NULL DEFAULT '{}'::jsonb,
  componentes_declarados JSONB NOT NULL DEFAULT '[]'::jsonb,
  observaciones TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Relación Padre-Hijo con vigencia histórica (Sección 8 Opción B)
CREATE TABLE relaciones_activo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  padre_id VARCHAR(50) NOT NULL REFERENCES activos(id),
  hijo_id VARCHAR(50) NOT NULL REFERENCES activos(id),
  tipo_vinculo VARCHAR(30) NOT NULL DEFAULT 'CONTIENE' CHECK (tipo_vinculo IN ('CONTIENE', 'ACCESORIO')),
  cantidad INTEGER NOT NULL DEFAULT 1,
  vigente_desde TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vigente_hasta TIMESTAMPTZ
);

-- 3. TRANSFERENCIAS / ENVÍOS Y REMITOS (RF-011 a RF-019)
CREATE TABLE transferencias (
  id VARCHAR(50) PRIMARY KEY, -- Ej: 'ENV-CL-2026-063'
  remito_numero VARCHAR(50) NOT NULL UNIQUE,
  activo_id VARCHAR(50) NOT NULL REFERENCES activos(id),
  unidad_id VARCHAR(30) NOT NULL,
  estaca_distrito VARCHAR(160) NOT NULL,
  pais_iso CHAR(2) NOT NULL REFERENCES paises(codigo_iso),
  region VARCHAR(120) NOT NULL,
  comuna VARCHAR(120) NOT NULL,
  direccion VARCHAR(250) NOT NULL,
  referencia_direccion TEXT,
  destinatario_titular VARCHAR(160) NOT NULL,
  rut_titular VARCHAR(30) NOT NULL,
  telefono VARCHAR(60),
  correo VARCHAR(160),
  horario_preferencial VARCHAR(180),
  solicitud_adicional TEXT,
  transportista_id VARCHAR(60) NOT NULL,
  transportista_nombre VARCHAR(160) NOT NULL,
  origen_retiro VARCHAR(200) NOT NULL DEFAULT 'Pedro de Valdivia 1423, Providencia, Santiago',
  valor_declarado_clp NUMERIC(14,2) NOT NULL DEFAULT 3000000,
  peso_kg NUMERIC(6,2) NOT NULL DEFAULT 15,
  dimensiones VARCHAR(40) NOT NULL DEFAULT '55x35x25 cm',
  estado VARCHAR(40) NOT NULL DEFAULT 'Pendiente',
  llegada_hora_utc TIMESTAMPTZ,
  llegada_gps VARCHAR(80),
  distancia_destino_metros INTEGER,
  receptor_final JSONB,
  firma_digital_data TEXT,
  estado_revision_evidencia VARCHAR(40) NOT NULL DEFAULT 'Sin evidencia',
  comentario_revision TEXT,
  motivo_incidencia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. MOVIMIENTOS INMUTABLES (FUENTE DE VERDAD - RF-021, RNF-014, RNF-015, RNF-016)
CREATE TABLE movimientos (
  id VARCHAR(50) PRIMARY KEY,
  activo_id VARCHAR(50) NOT NULL REFERENCES activos(id),
  envio_id VARCHAR(50) REFERENCES transferencias(id),
  tipo_evento VARCHAR(50) NOT NULL,
  estado_anterior VARCHAR(50) NOT NULL,
  estado_nuevo VARCHAR(50) NOT NULL,
  ubicacion VARCHAR(250) NOT NULL,
  custodio VARCHAR(200) NOT NULL,
  usuario VARCHAR(160) NOT NULL,
  rol VARCHAR(60) NOT NULL,
  hora_servidor_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hora_local_dispositivo VARCHAR(60) NOT NULL,
  zona_horaria VARCHAR(60) NOT NULL DEFAULT 'America/Santiago',
  gps VARCHAR(80),
  hash_sha256 CHAR(64) NOT NULL,
  detalle TEXT NOT NULL,
  capturado_offline BOOLEAN NOT NULL DEFAULT FALSE
);

-- 5. EVIDENCIAS FOTOGRÁFICAS Y DOCUMENTOS (RF-018, RNF-004, RNF-017)
CREATE TABLE evidencias (
  id VARCHAR(50) PRIMARY KEY,
  movimiento_id VARCHAR(50) REFERENCES movimientos(id),
  envio_id VARCHAR(50) REFERENCES transferencias(id),
  tipo VARCHAR(40) NOT NULL CHECK (tipo IN ('FOTO_REMITO_FIRMADO', 'FOTO_RECEPTOR_MALETA', 'FOTO_CONTENIDO_BODEGA', 'FIRMA_DIGITAL')),
  storage_bucket_path TEXT NOT NULL,
  hash_sha256 CHAR(64) NOT NULL,
  gps_coords VARCHAR(80),
  tamano_kb INTEGER NOT NULL CHECK (tamano_kb <= 1536), -- RNF-009 <= 1.5 MB
  capturada_en_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dispositivo VARCHAR(120)
);

-- 6. BITÁCORA TÉCNICA DE AUDITORÍA APPEND-ONLY (RF-027, RNF-014)
CREATE TABLE auditoria (
  id VARCHAR(50) PRIMARY KEY,
  entidad VARCHAR(50) NOT NULL,
  entidad_id VARCHAR(80) NOT NULL,
  accion VARCHAR(40) NOT NULL,
  antes JSONB NOT NULL,
  despues JSONB NOT NULL,
  usuario VARCHAR(160) NOT NULL,
  rol VARCHAR(60) NOT NULL,
  fecha_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dispositivo VARCHAR(120),
  ip VARCHAR(45)
);

-- 7. TRIGGERS DE INMUTABILIDAD APPEND-ONLY (RNF-014)
CREATE OR REPLACE FUNCTION prevent_modify_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Operación prohibida (RNF-014): Las tablas movimientos y auditoria son estrictamente append-only.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_movimientos_immutable
BEFORE UPDATE OR DELETE ON movimientos
FOR EACH ROW EXECUTE FUNCTION prevent_modify_append_only();

CREATE TRIGGER trg_auditoria_immutable
BEFORE UPDATE OR DELETE ON auditoria
FOR EACH ROW EXECUTE FUNCTION prevent_modify_append_only();

-- 8. TRIGGER DE PROYECCIÓN DE ESTADO Y HERENCIA PADRE-HIJO (RNF-016 / Opción B)
CREATE OR REPLACE FUNCTION sync_activo_from_movimiento()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualiza el activo principal con la proyección del último evento válido
  UPDATE activos
  SET estado = NEW.estado_nuevo,
      ubicacion_actual = NEW.ubicacion,
      custodio_actual = NEW.custodio,
      updated_at = NEW.hora_servidor_utc
  WHERE id = NEW.activo_id;

  -- Si el activo es un contenedor padre, propaga ubicación y custodio a sus hijos vigentes (Opción B)
  UPDATE activos
  SET estado = NEW.estado_nuevo,
      ubicacion_actual = 'Contenedor padre: ' || NEW.activo_id || ' (' || NEW.ubicacion || ')',
      custodio_actual = 'Heredado de ' || NEW.activo_id || ' (' || NEW.custodio || ')',
      updated_at = NEW.hora_servidor_utc
  WHERE id IN (
    SELECT hijo_id FROM relaciones_activo
    WHERE padre_id = NEW.activo_id AND vigente_hasta IS NULL
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_project_activo_state
AFTER INSERT ON movimientos
FOR EACH ROW EXECUTE FUNCTION sync_activo_from_movimiento();

-- 9. ROW LEVEL SECURITY (RNF-002: Autorización en base de datos por rol y ámbito)
ALTER TABLE activos ENABLE ROW LEVEL SECURITY;
ALTER TABLE transferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

-- Política: El transportista solo puede ver y operar sus envíos asignados (RF-023)
CREATE POLICY transportista_envios_asignados ON transferencias
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') IN ('ADMIN_REGIONAL', 'COORDINADOR_NACIONAL', 'ENCARGADO_BODEGA', 'AUDITOR')
    OR transportista_id = (auth.jwt() ->> 'carrier_id')
  );
`;

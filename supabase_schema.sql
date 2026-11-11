-- ============================================================================
-- LOGISTICS CONNECT — ESQUEMA POSTGRESQL / SUPABASE (MVP V1 PILOTO CHILE & 4 PAÍSES)
-- ============================================================================
-- Pega este script en el SQL Editor de tu proyecto en Supabase y presiona "RUN".

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. JERARQUÍA GEOGRÁFICA Y ORGANIZACIONAL (RF-010)
CREATE TABLE IF NOT EXISTS paises (
  codigo_iso CHAR(2) PRIMARY KEY, -- 'CL', 'AR', 'PY', 'UY'
  nombre VARCHAR(100) NOT NULL,
  documento_identidad VARCHAR(50) NOT NULL, -- RUT, DNI, CI
  zona_horaria VARCHAR(64) NOT NULL DEFAULT 'America/Santiago'
);

CREATE TABLE IF NOT EXISTS areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(120) NOT NULL, -- 'Área Sudamérica Sur'
  pais_iso CHAR(2) REFERENCES paises(codigo_iso)
);

CREATE TABLE IF NOT EXISTS catalogo_comunas (
  id SERIAL PRIMARY KEY,
  pais_iso CHAR(2) NOT NULL REFERENCES paises(codigo_iso),
  region_departamento VARCHAR(120) NOT NULL,
  comuna_ciudad VARCHAR(120) NOT NULL,
  poblacion INTEGER,
  superficie_km2 NUMERIC(10,2),
  UNIQUE(pais_iso, comuna_ciudad)
);

CREATE TABLE IF NOT EXISTS unidades (
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

-- 2. TIPOLOGÍA Y CATÁLOGO DE ACTIVOS (RF-001)
CREATE TABLE IF NOT EXISTS tipos_activos (
  id VARCHAR(40) PRIMARY KEY, -- 'centro_movil', 'laptop', 'proyector', etc.
  nombre VARCHAR(100) NOT NULL,
  es_contenedor BOOLEAN NOT NULL DEFAULT FALSE,
  requiere_componentes BOOLEAN NOT NULL DEFAULT FALSE,
  cantidad_componentes_esperada INTEGER DEFAULT 0,
  icono VARCHAR(50) DEFAULT 'Package',
  descripcion TEXT
);

CREATE TABLE IF NOT EXISTS activos (
  id VARCHAR(64) PRIMARY KEY, -- Ej: 'CFS-CL-064'
  tipo_id VARCHAR(40) NOT NULL REFERENCES tipos_activos(id),
  nombre VARCHAR(160) NOT NULL,
  pais_iso CHAR(2) NOT NULL REFERENCES paises(codigo_iso),
  ubicacion_actual VARCHAR(160) NOT NULL,
  estado_operativo VARCHAR(30) NOT NULL CHECK (
    estado_operativo IN ('Operativo', 'Incidente', 'En Mantención', 'En Tránsito', 'De Baja')
  ),
  custodio_actual VARCHAR(160) NOT NULL,
  total_componentes INTEGER NOT NULL DEFAULT 0,
  componentes_operativos INTEGER NOT NULL DEFAULT 0,
  valor_declarado_clp NUMERIC(12,2) NOT NULL DEFAULT 0,
  qr_token VARCHAR(128) NOT NULL UNIQUE,
  ultimo_movimiento TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS componentes_activos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activo_padre_id VARCHAR(64) NOT NULL REFERENCES activos(id) ON DELETE CASCADE,
  numero_serie VARCHAR(120) NOT NULL,
  tipo VARCHAR(60) NOT NULL, -- 'Laptop', 'Cargador', 'Maleta', 'Mouse'
  marca_modelo VARCHAR(120) NOT NULL,
  estado VARCHAR(30) NOT NULL CHECK (estado IN ('Operativo', 'Falla', 'Faltante')),
  observaciones TEXT
);

-- 3. GESTIÓN DE ACCESO Y ROLES (RF-012, RNF-002)
CREATE TABLE IF NOT EXISTS usuarios (
  id VARCHAR(64) PRIMARY KEY,
  nombre VARCHAR(160) NOT NULL,
  correo VARCHAR(160) NOT NULL UNIQUE,
  rol VARCHAR(40) NOT NULL CHECK (
    rol IN ('ADMIN_REGIONAL', 'GESTOR_LOGISTICO', 'OPERADOR_BODEGA', 'LIDER_LOCAL', 'AUDITOR')
  ),
  pais_iso VARCHAR(10) NOT NULL, -- 'ALL', 'CL', 'AR', etc.
  unidad_asignada VARCHAR(160),
  telefono VARCHAR(50),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transportistas (
  id VARCHAR(40) PRIMARY KEY, -- 'chilexpress', 'starken', 'bluexpress'
  nombre VARCHAR(120) NOT NULL,
  pais_iso CHAR(2) NOT NULL REFERENCES paises(codigo_iso),
  url_tracking_template TEXT
);

-- 4. DESPACHO Y RECEPCIÓN INMUTABLE (RF-003, RF-004, RF-005, RF-008)
CREATE TABLE IF NOT EXISTS ordenes_envio (
  id VARCHAR(64) PRIMARY KEY, -- 'ENV-2026-001'
  remito_numero VARCHAR(64) NOT NULL UNIQUE,
  activo_id VARCHAR(64) NOT NULL REFERENCES activos(id),
  qr_token VARCHAR(128) NOT NULL,
  pais_iso CHAR(2) NOT NULL REFERENCES paises(codigo_iso),
  unidad_id VARCHAR(30) NOT NULL,
  estaca_distrito VARCHAR(160) NOT NULL,
  comuna VARCHAR(120) NOT NULL,
  region VARCHAR(120) NOT NULL,
  direccion TEXT NOT NULL,
  destinatario_titular VARCHAR(160) NOT NULL,
  rut_titular VARCHAR(30) NOT NULL,
  telefono_titular VARCHAR(50) NOT NULL,
  transportista_id VARCHAR(40) REFERENCES transportistas(id),
  transportista_nombre VARCHAR(120) NOT NULL,
  nro_seguimiento VARCHAR(100),
  bultos_declarados INTEGER NOT NULL DEFAULT 1,
  valor_declarado_clp NUMERIC(12,2) NOT NULL,
  estado VARCHAR(30) NOT NULL CHECK (
    estado IN ('Borrador', 'En Preparación', 'Despachado', 'En Tránsito', 'Entregado Conforme', 'Entregado con Observación', 'Extraviado / Siniestro')
  ),
  fecha_despacho TIMESTAMP WITH TIME ZONE,
  fecha_estimada_entrega TIMESTAMP WITH TIME ZONE,
  fecha_entrega_real TIMESTAMP WITH TIME ZONE,
  estado_revision_evidencia VARCHAR(30) DEFAULT 'Pendiente' CHECK (
    estado_revision_evidencia IN ('Pendiente', 'Aprobada', 'Rechazada')
  ),
  receptor_nombre VARCHAR(160),
  receptor_rut VARCHAR(30),
  receptor_parentesco VARCHAR(50),
  observaciones_entrega TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. EVENTOS DE MOVIMIENTO APPEND-ONLY (RNF-014, RF-007)
CREATE TABLE IF NOT EXISTS eventos_movimiento (
  id VARCHAR(64) PRIMARY KEY,
  activo_id VARCHAR(64) NOT NULL REFERENCES activos(id),
  envio_id VARCHAR(64) REFERENCES ordenes_envio(id),
  tipo_evento VARCHAR(50) NOT NULL,
  origen VARCHAR(160) NOT NULL,
  destino VARCHAR(160) NOT NULL,
  custodio_anterior VARCHAR(160),
  custodio_nuevo VARCHAR(160),
  responsable VARCHAR(160) NOT NULL,
  fecha_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  observaciones TEXT
);

-- Trigger de Inmutabilidad para Eventos de Movimiento (Append-Only)
CREATE OR REPLACE FUNCTION prevenir_modificacion_movimientos()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'LOGISTICS CONNECT: Los registros de la tabla eventos_movimiento son inmutables (Append-Only). No se permite UPDATE ni DELETE.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proteger_movimientos ON eventos_movimiento;
CREATE TRIGGER trg_proteger_movimientos
BEFORE UPDATE OR DELETE ON eventos_movimiento
FOR EACH ROW
EXECUTE FUNCTION prevenir_modificacion_movimientos();

-- 6. EVIDENCIAS FOTOGRÁFICAS Y REMITO CON HASH SHA-256 (RF-004, RNF-001)
CREATE TABLE IF NOT EXISTS evidencias_entrega (
  id VARCHAR(64) PRIMARY KEY,
  envio_id VARCHAR(64) NOT NULL REFERENCES ordenes_envio(id),
  activo_id VARCHAR(64) NOT NULL REFERENCES activos(id),
  tipo_evidencia VARCHAR(50) NOT NULL, -- 'REMITO_FIRMADO', 'ACTIVO_EN_SITIO', 'DAÑO'
  foto_url TEXT NOT NULL,
  foto_sha256 CHAR(64) NOT NULL,
  tamano_kb INTEGER NOT NULL,
  latitud NUMERIC(10,7),
  longitud NUMERIC(10,7),
  precision_gps_m NUMERIC(6,2),
  fecha_captura_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  capturado_por VARCHAR(160) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger de Inmutabilidad para Evidencias de Entrega
CREATE OR REPLACE FUNCTION prevenir_modificacion_evidencias()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'LOGISTICS CONNECT: Las evidencias fotográficas y hashes SHA-256 son inmutables para fines de auditoría forense.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proteger_evidencias ON evidencias_entrega;
CREATE TRIGGER trg_proteger_evidencias
BEFORE UPDATE OR DELETE ON evidencias_entrega
FOR EACH ROW
EXECUTE FUNCTION prevenir_modificacion_evidencias();

-- 7. AUDITORÍA FORENSE APPEND-ONLY (RF-009)
CREATE TABLE IF NOT EXISTS logs_auditoria (
  id VARCHAR(64) PRIMARY KEY,
  fecha_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  usuario_id VARCHAR(64) NOT NULL,
  usuario_nombre VARCHAR(160) NOT NULL,
  accion VARCHAR(80) NOT NULL,
  entidad_afectada VARCHAR(60) NOT NULL,
  entidad_id VARCHAR(64) NOT NULL,
  detalles JSONB,
  ip_origen VARCHAR(64),
  pais_iso CHAR(2) DEFAULT 'CL'
);

DROP TRIGGER IF EXISTS trg_proteger_auditoria ON logs_auditoria;
CREATE TRIGGER trg_proteger_auditoria
BEFORE UPDATE OR DELETE ON logs_auditoria
FOR EACH ROW
EXECUTE FUNCTION prevenir_modificacion_movimientos();

-- 8. CONTROL DE INVENTARIO EN TERRENO (RF-006)
CREATE TABLE IF NOT EXISTS campanas_inventario (
  id VARCHAR(64) PRIMARY KEY,
  nombre VARCHAR(160) NOT NULL,
  ubicacion_objetivo VARCHAR(160) NOT NULL,
  pais_iso CHAR(2) NOT NULL REFERENCES paises(codigo_iso),
  responsable VARCHAR(160) NOT NULL,
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_cierre DATE,
  estado VARCHAR(30) NOT NULL CHECK (estado IN ('Borrador', 'En curso', 'Conciliada y Cerrada')),
  observaciones_conciliacion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items_inventario_escaneo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campana_id VARCHAR(64) NOT NULL REFERENCES campanas_inventario(id) ON DELETE CASCADE,
  activo_id VARCHAR(64) NOT NULL REFERENCES activos(id),
  tipo_resultado VARCHAR(30) NOT NULL CHECK (
    tipo_resultado IN ('ESPERADO_Y_ENCONTRADO', 'HALLAZGO_OTRA_UBICACION', 'NO_ENCONTRADO')
  ),
  latitud NUMERIC(10,7),
  longitud NUMERIC(10,7),
  escaneado_por VARCHAR(160) NOT NULL,
  fecha_escaneo_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. INCIDENTES Y CONDICIÓN (RF-008)
CREATE TABLE IF NOT EXISTS incidentes_activos (
  id VARCHAR(64) PRIMARY KEY,
  activo_id VARCHAR(64) NOT NULL REFERENCES activos(id),
  afecta_a VARCHAR(30) NOT NULL CHECK (afecta_a IN ('TODO_EL_ACTIVO', 'SOLO_COMPONENTE')),
  componente_detalle VARCHAR(160),
  tipo_incidente VARCHAR(60) NOT NULL,
  estado_resultante VARCHAR(30) NOT NULL,
  descripcion TEXT NOT NULL,
  reportado_por VARCHAR(160) NOT NULL,
  fecha_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  estado_gestion VARCHAR(30) NOT NULL DEFAULT 'Reportado' CHECK (
    estado_gestion IN ('Reportado', 'En reparación', 'Resuelto', 'Dado de baja')
  )
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) — ACTIVACIÓN
-- ============================================================================
ALTER TABLE paises ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE activos ENABLE ROW LEVEL SECURITY;
ALTER TABLE componentes_activos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_envio ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_movimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidencias_entrega ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanas_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidentes_activos ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura anónima/autenticada para la app pública
CREATE POLICY "Permitir lectura de paises" ON paises FOR SELECT USING (true);
CREATE POLICY "Permitir lectura de unidades" ON unidades FOR SELECT USING (true);
CREATE POLICY "Permitir lectura de tipos_activos" ON tipos_activos FOR SELECT USING (true);
CREATE POLICY "Permitir lectura y actualizacion de activos" ON activos FOR ALL USING (true);
CREATE POLICY "Permitir lectura de componentes" ON componentes_activos FOR ALL USING (true);
CREATE POLICY "Permitir gestión de ordenes_envio" ON ordenes_envio FOR ALL USING (true);
CREATE POLICY "Permitir inserción de movimientos" ON eventos_movimiento FOR ALL USING (true);
CREATE POLICY "Permitir gestión de evidencias" ON evidencias_entrega FOR ALL USING (true);
CREATE POLICY "Permitir inserción y lectura de logs" ON logs_auditoria FOR ALL USING (true);
CREATE POLICY "Permitir campañas de inventario" ON campanas_inventario FOR ALL USING (true);
CREATE POLICY "Permitir items de escaneo" ON items_inventario_escaneo FOR ALL USING (true);
CREATE POLICY "Permitir incidentes" ON incidentes_activos FOR ALL USING (true);

-- ============================================================================
-- DATOS INICIALES SEMILLA (SEED DATA CHILE)
-- ============================================================================
INSERT INTO paises (codigo_iso, nombre, documento_identidad, zona_horaria)
VALUES 
  ('CL', 'Chile', 'RUT (Rol Único Tributario)', 'America/Santiago'),
  ('AR', 'Argentina', 'DNI (Doc. Nacional de Identidad)', 'America/Argentina/Buenos_Aires'),
  ('PY', 'Paraguay', 'CI (Cédula de Identidad)', 'America/Asuncion'),
  ('UY', 'Uruguay', 'CI (Cédula de Identidad)', 'America/Montevideo')
ON CONFLICT (codigo_iso) DO NOTHING;

INSERT INTO tipos_activos (id, nombre, es_contenedor, requiere_componentes, cantidad_componentes_esperada, icono, descripcion)
VALUES
  ('centro_movil', 'Centro Móvil CFS (Maleta Pelicase + 6 Laptops)', true, true, 7, 'Laptop', 'Contenedor robusto con 6 computadores Lenovo y 6 cargadores para capacitación.'),
  ('laptop_individual', 'Laptop Administrativa Individual', false, true, 2, 'Laptop', 'Equipo portátil individual con cargador.'),
  ('proyector_multimedia', 'Proyector Multimedia Epson', false, true, 3, 'Tv', 'Proyector, control remoto y cable HDMI.'),
  ('kit_red_satelital', 'Kit Conectividad y Red Starlink', true, true, 4, 'Wifi', 'Antena, router Wi-Fi y cables de alimentación.')
ON CONFLICT (id) DO NOTHING;

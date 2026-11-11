-- ============================================================================
-- LOGISTICS CONNECT — ACTUALIZACIÓN DE RESTRICCIONES (COMPATIBILIDAD FRONTEND)
-- ============================================================================
-- Ejecuta este script en el SQL Editor de Supabase para habilitar los roles
-- y estados de la aplicación en las tablas relacionales.

-- 1. Ampliar roles permitidos en tabla 'usuarios'
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check CHECK (
  rol IN ('ADMIN_REGIONAL', 'COORDINADOR_NACIONAL', 'ENCARGADO_BODEGA', 'TRANSPORTISTA', 'AUDITOR', 'GESTOR_LOGISTICO', 'OPERADOR_BODEGA', 'LIDER_LOCAL')
);

-- 2. Ampliar estados operativos permitidos en tabla 'activos'
ALTER TABLE activos DROP CONSTRAINT IF EXISTS activos_estado_operativo_check;
ALTER TABLE activos ADD CONSTRAINT activos_estado_operativo_check CHECK (
  estado_operativo IN ('Disponible en bodega', 'Listo para despacho', 'En curso', 'Llegué', 'Entregado', 'En uso (unidad)', 'Incidente', 'Fuera de servicio', 'Dado de baja', 'Operativo', 'En Mantención', 'En Tránsito', 'De Baja')
);

-- 3. Ampliar estados de despacho permitidos en tabla 'ordenes_envio'
ALTER TABLE ordenes_envio DROP CONSTRAINT IF EXISTS ordenes_envio_estado_check;
ALTER TABLE ordenes_envio ADD CONSTRAINT ordenes_envio_estado_check CHECK (
  estado IN ('Pendiente', 'Listo para despacho', 'En curso', 'Llegué', 'Entregado', 'Incidencia', 'Borrador', 'En Preparación', 'Despachado', 'En Tránsito', 'Entregado Conforme', 'Entregado con Observación', 'Extraviado / Siniestro')
);

-- 4. Ampliar estados de revisión de evidencias en tabla 'ordenes_envio'
ALTER TABLE ordenes_envio DROP CONSTRAINT IF EXISTS ordenes_envio_estado_revision_evidencia_check;
ALTER TABLE ordenes_envio ADD CONSTRAINT ordenes_envio_estado_revision_evidencia_check CHECK (
  estado_revision_evidencia IN ('Sin evidencia', 'Pendiente de revisión', 'Aprobada', 'Reintento solicitado', 'Pendiente', 'Rechazada')
);

-- 5. Agregar columnas auxiliares de respaldo si hiciera falta
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS organizacion VARCHAR(160);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS transportista_id VARCHAR(40);


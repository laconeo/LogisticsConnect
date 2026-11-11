export type CountryCode = 'CL' | 'AR' | 'PY' | 'UY';

export type UserRole =
  | 'ADMIN_REGIONAL'
  | 'COORDINADOR_NACIONAL'
  | 'ENCARGADO_BODEGA'
  | 'TRANSPORTISTA'
  | 'AUDITOR';

export interface UserAccount {
  id: string;
  nombre: string;
  correo: string;
  rol: UserRole;
  rol_etiqueta: string;
  pais: CountryCode;
  ambito: string;
  organizacion: string;
  transportista_id?: string;
  activo: boolean;
  password?: string;
}

export type AssetStatus =
  | 'Disponible en bodega'
  | 'Listo para despacho'
  | 'En curso'
  | 'Llegué'
  | 'Entregado'
  | 'En uso (unidad)'
  | 'Incidente'
  | 'Fuera de servicio'
  | 'Dado de baja';

export type ShipmentStatus =
  | 'Pendiente'
  | 'Listo para despacho'
  | 'En curso'
  | 'Llegué'
  | 'Entregado'
  | 'Incidencia';

export type EvidenceReviewStatus =
  | 'Sin evidencia'
  | 'Pendiente de revisión'
  | 'Aprobada'
  | 'Reintento solicitado';

export type RelationType =
  | 'Titular'
  | 'Esposa'
  | 'Hijo'
  | 'Hija'
  | 'Consejero'
  | 'Secretario'
  | 'Otro';

export interface DynamicAttributeDef {
  key: string;
  label: string;
  type: 'texto' | 'numero' | 'fecha' | 'lista' | 'serie';
  required: boolean;
  options?: string[];
}

export interface ComponentTemplateItem {
  nombre: string;
  tipo: 'notebook' | 'accesorio' | 'energia';
  cantidad_esperada: number;
}

export interface AssetTypeConfig {
  id: string;
  nombre: string;
  codigo_prefijo: string;
  es_contenedor: boolean;
  valor_declarado_clp: number;
  peso_kg?: number;
  dimensiones_cm?: string;
  atributos_esquema: DynamicAttributeDef[];
  plantilla_contenido: ComponentTemplateItem[];
}

export interface ChildComponentRecord {
  id: string;
  nombre: string;
  serial?: string;
  cantidad: number;
  verificado: boolean;
}

export interface AssetItem {
  id: string;
  qr_token: string;
  serial: string;
  tipo_id: string;
  tipo_nombre: string;
  es_contenedor: boolean;
  estado: AssetStatus;
  pais: CountryCode;
  ubicacion_actual: string;
  custodio_actual: string;
  fecha_adquisicion: string;
  fecha_baja?: string;
  motivo_baja?: string;
  valor_declarado_clp: number;
  sello_seguridad?: string;
  atributos: Record<string, string | number>;
  componentes: ChildComponentRecord[];
  observaciones: string;
}

export interface ReceiverInfo {
  es_titular: boolean;
  parentesco_rol: RelationType;
  nombre_completo: string;
  rut: string;
  consentimiento_datos: boolean;
  fecha_recepcion_utc: string;
  fecha_recepcion_local: string;
}

export interface EvidencePhoto {
  id: string;
  tipo: 'FOTO_REMITO_FIRMADO' | 'FOTO_RECEPTOR_MALETA' | 'FOTO_CONTENIDO_BODEGA';
  titulo: string;
  capturada_en_utc: string;
  capturada_en_local: string;
  gps_coords: string;
  hash_sha256: string;
  tamano_kb: number;
  dispositivo: string;
  preview_data_url?: string;
}

export interface ShipmentOrder {
  id: string;
  remito_numero: string;
  activo_id: string;
  qr_token: string;
  nro_cfs_movil: string;
  unidad_id: string;
  estaca_distrito: string;
  pais: CountryCode;
  region: string;
  comuna: string;
  direccion: string;
  referencia_direccion?: string;
  destinatario_titular: string;
  rut_titular: string;
  telefono: string;
  correo: string;
  horario_preferencial?: string;
  solicitud_adicional?: string;
  transportista_id: string;
  transportista_nombre: string;
  origen_retiro: string;
  valor_declarado_clp: number;
  peso_kg: number;
  dimensiones: string;
  estado: ShipmentStatus;
  fecha_creacion: string;
  llegada_hora_local?: string;
  llegada_gps?: string;
  distancia_destino_metros?: number;
  receptor_final?: ReceiverInfo;
  foto_contenido_bodega?: EvidencePhoto;
  foto_remito_firmado?: EvidencePhoto;
  foto_receptor_maleta?: EvidencePhoto;
  firma_digital_trazo?: string;
  firma_digital_imagen?: string;
  estado_revision_evidencia: EvidenceReviewStatus;
  comentario_revision?: string;
  motivo_incidencia?: string;
}

export interface MovementEvent {
  id: string;
  activo_id: string;
  envio_id?: string;
  tipo_evento:
    | 'ALTA_ACTIVO'
    | 'ARMADO_CONTENEDOR'
    | 'DESPACHO_REMITO'
    | 'LLEGADA_DESTINO'
    | 'ENTREGA_CONFIRMADA'
    | 'REVISION_EVIDENCIA'
    | 'INCIDENCIA_REPORTADA'
    | 'INVENTARIO_FISICO'
    | 'TRANSFERENCIA_CUSTODIO'
    | 'BAJA_ACTIVO';
  estado_anterior: string;
  estado_nuevo: string;
  ubicacion: string;
  custodio: string;
  usuario: string;
  rol: string;
  hora_servidor_utc: string;
  hora_local_dispositivo: string;
  zona_horaria: string;
  gps: string;
  hash_sha256: string;
  detalle: string;
  capturado_offline?: boolean;
}

export interface AuditLogEntry {
  id: string;
  entidad:
    | 'Activo'
    | 'Transferencia'
    | 'TipoActivo'
    | 'ImportacionMasiva'
    | 'Evidencia'
    | 'Inventario'
    | 'Incidente'
    | 'Usuario';
  entidad_id: string;
  accion:
    | 'INSERT'
    | 'UPDATE'
    | 'STATUS_TRANSITION'
    | 'VERIFY_EVIDENCE'
    | 'RECONCILE_INVENTORY'
    | 'DECOMMISSION';
  antes: string;
  despues: string;
  usuario: string;
  rol: string;
  fecha_utc: string;
  dispositivo: string;
  ip: string;
}

export interface ExcelImportRow {
  fila: number;
  nro_unidad: string;
  estaca_distrito: string;
  destinatario: string;
  rut: string;
  telefono: string;
  correo: string;
  direccion: string;
  comuna_raw: string;
  ciudad: string;
  comentario_planilla?: string;
  excluida?: boolean;
}

export interface ExcelRowValidation {
  fila: number;
  es_valida: boolean;
  errores: string[];
  advertencias: string[];
  comuna_sugerida?: string;
  rut_normalizado?: string;
}

export interface CountryDeploymentSummary {
  codigo: CountryCode;
  nombre: string;
  documento_id: string;
  zona_horaria: string;
  centros_totales_2026: number;
  centros_entregados: number;
  centros_pendientes: number;
  notebooks_desplegados: number;
}

export interface InventoryCampaign {
  id: string;
  nombre: string;
  ubicacion_objetivo: string;
  pais: CountryCode;
  responsable: string;
  fecha_inicio: string;
  fecha_cierre?: string;
  estado: 'En curso' | 'Conciliada y Cerrada';
  activos_esperados_ids: string[];
  activos_escaneados_ids: string[];
  hallazgos_otra_ubicacion_ids: string[];
  observaciones_conciliacion?: string;
}

export interface AssetIncidentRecord {
  id: string;
  activo_id: string;
  afecta_a: 'CONTENEDOR_COMPLETO' | 'SOLO_COMPONENTE';
  componente_detalle?: string;
  tipo_incidente:
    | 'Extravío'
    | 'Daño físico'
    | 'Robo con denuncia'
    | 'Falla técnica'
    | 'Entrega fallida';
  estado_resultante: 'Incidente' | 'Fuera de servicio';
  descripcion: string;
  reportado_por: string;
  fecha_utc: string;
  estado_gestion: 'Abierto' | 'En reparación' | 'Cerrado';
}

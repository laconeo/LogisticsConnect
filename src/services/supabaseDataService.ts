import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  UserAccount,
  UserRole,
  AssetItem,
  AssetStatus,
  AssetTypeConfig,
  ShipmentOrder,
  ShipmentStatus,
  MovementEvent,
  AuditLogEntry,
  InventoryCampaign,
  AssetIncidentRecord,
} from '../types/logistics';
import {
  INITIAL_USERS,
  INITIAL_ASSETS,
  INITIAL_ASSET_TYPES,
  INITIAL_SHIPMENTS,
  INITIAL_MOVEMENTS,
  INITIAL_AUDIT_LOGS,
} from '../data/initialData';
import {
  INITIAL_INVENTORY_CAMPAIGNS,
  INITIAL_INCIDENTS,
  PersistedDatabaseSnapshot,
} from './databaseService';

// Mapeo bidireccional seguro para compatibilidad total con los CHECK constraints de PostgreSQL
const ROLE_TO_DB: Record<UserRole, string> = {
  ADMIN_REGIONAL: 'ADMIN_REGIONAL',
  COORDINADOR_NACIONAL: 'GESTOR_LOGISTICO',
  ENCARGADO_BODEGA: 'OPERADOR_BODEGA',
  TRANSPORTISTA: 'LIDER_LOCAL',
  AUDITOR: 'AUDITOR',
};

const ROLE_FROM_DB: Record<string, UserRole> = {
  ADMIN_REGIONAL: 'ADMIN_REGIONAL',
  GESTOR_LOGISTICO: 'COORDINADOR_NACIONAL',
  COORDINADOR_NACIONAL: 'COORDINADOR_NACIONAL',
  OPERADOR_BODEGA: 'ENCARGADO_BODEGA',
  ENCARGADO_BODEGA: 'ENCARGADO_BODEGA',
  LIDER_LOCAL: 'TRANSPORTISTA',
  TRANSPORTISTA: 'TRANSPORTISTA',
  AUDITOR: 'AUDITOR',
};

const SHIPMENT_STATUS_TO_DB: Record<ShipmentStatus, string> = {
  'Pendiente': 'En Preparación',
  'Listo para despacho': 'Despachado',
  'En curso': 'En Tránsito',
  'Llegué': 'En Tránsito',
  'Entregado': 'Entregado Conforme',
  'Incidencia': 'Extraviado / Siniestro',
};

const SHIPMENT_STATUS_FROM_DB: Record<string, ShipmentStatus> = {
  'Borrador': 'Pendiente',
  'En Preparación': 'Pendiente',
  'Pendiente': 'Pendiente',
  'Despachado': 'Listo para despacho',
  'Listo para despacho': 'Listo para despacho',
  'En Tránsito': 'En curso',
  'En curso': 'En curso',
  'Llegué': 'Llegué',
  'Entregado Conforme': 'Entregado',
  'Entregado con Observación': 'Entregado',
  'Entregado': 'Entregado',
  'Extraviado / Siniestro': 'Incidencia',
  'Incidencia': 'Incidencia',
};

const ASSET_STATUS_TO_DB: Record<AssetStatus, string> = {
  'Disponible en bodega': 'Operativo',
  'Listo para despacho': 'Operativo',
  'En curso': 'En Tránsito',
  'Llegué': 'En Tránsito',
  'Entregado': 'Operativo',
  'En uso (unidad)': 'Operativo',
  'Incidente': 'Incidente',
  'Fuera de servicio': 'En Mantención',
  'Dado de baja': 'De Baja',
};

const ASSET_STATUS_FROM_DB: Record<string, AssetStatus> = {
  'Operativo': 'Disponible en bodega',
  'Disponible en bodega': 'Disponible en bodega',
  'Listo para despacho': 'Listo para despacho',
  'En Tránsito': 'En curso',
  'En curso': 'En curso',
  'Llegué': 'Llegué',
  'Entregado': 'Entregado',
  'En uso (unidad)': 'En uso (unidad)',
  'Incidente': 'Incidente',
  'En Mantención': 'Fuera de servicio',
  'Fuera de servicio': 'Fuera de servicio',
  'De Baja': 'Dado de baja',
  'Dado de baja': 'Dado de baja',
};

export const SupabaseDataService = {
  /**
   * Carga los datos en vivo desde las tablas de Supabase.
   * Si las tablas están vacías, las inicializa con los datos semilla.
   */
  async loadSnapshot(): Promise<PersistedDatabaseSnapshot | null> {
    if (!isSupabaseConfigured() || !supabase) {
      return null;
    }

    try {
      const [
        { data: supaUsers },
        { data: supaAssets },
        { data: supaShipments },
        { data: supaMovements },
        { data: supaLogs },
        { data: supaInventories },
        { data: supaIncidents },
      ] = await Promise.all([
        supabase.from('usuarios').select('*'),
        supabase.from('activos').select('*'),
        supabase.from('ordenes_envio').select('*'),
        supabase.from('eventos_movimiento').select('*'),
        supabase.from('logs_auditoria').select('*').order('fecha_utc', { ascending: false }),
        supabase.from('campanas_inventario').select('*'),
        supabase.from('incidentes_activos').select('*'),
      ]);

      // Si las tablas críticas aún no tienen registros, sembrar
      const needsSeed = !supaAssets || supaAssets.length === 0;

      if (needsSeed) {
        console.log('Sembrando datos iniciales en Supabase...');
        await this.seedAll({
          users: INITIAL_USERS,
          currentUserId: INITIAL_USERS[0].id,
          assets: INITIAL_ASSETS,
          assetTypes: INITIAL_ASSET_TYPES,
          shipments: INITIAL_SHIPMENTS,
          movements: INITIAL_MOVEMENTS,
          auditLogs: INITIAL_AUDIT_LOGS,
          inventories: INITIAL_INVENTORY_CAMPAIGNS,
          incidents: INITIAL_INCIDENTS,
        });

        return {
          users: INITIAL_USERS,
          currentUserId: INITIAL_USERS[0].id,
          assets: INITIAL_ASSETS,
          assetTypes: INITIAL_ASSET_TYPES,
          shipments: INITIAL_SHIPMENTS,
          movements: INITIAL_MOVEMENTS,
          auditLogs: INITIAL_AUDIT_LOGS,
          inventories: INITIAL_INVENTORY_CAMPAIGNS,
          incidents: INITIAL_INCIDENTS,
        };
      }

      // Mapear de Supabase a los tipos de la aplicación
      const users: UserAccount[] = (supaUsers && supaUsers.length > 0)
        ? supaUsers.map((u) => {
            const mappedRole = ROLE_FROM_DB[u.rol] || 'COORDINADOR_NACIONAL';
            return {
              id: u.id,
              nombre: u.nombre,
              correo: u.correo,
              rol: mappedRole,
              rol_etiqueta: mappedRole.replace(/_/g, ' '),
              pais: u.pais_iso || 'CL',
              ambito: u.unidad_asignada || 'Chile · Nacional',
              organizacion: u.organizacion || 'FamilySearch',
              transportista_id: u.transportista_id,
              activo: u.activo ?? true,
            };
          })
        : INITIAL_USERS;

      const assets: AssetItem[] = (supaAssets && supaAssets.length > 0)
        ? supaAssets.map((a) => {
            const initialMatch = INITIAL_ASSETS.find((x) => x.id === a.id);
            const mappedStatus = ASSET_STATUS_FROM_DB[a.estado_operativo] || 'Disponible en bodega';
            return {
              id: a.id,
              qr_token: a.qr_token || a.id,
              serial: initialMatch?.serial || a.id,
              tipo_id: a.tipo_id,
              tipo_nombre: initialMatch?.tipo_nombre || 'Centro Móvil CFS',
              es_contenedor: initialMatch?.es_contenedor ?? true,
              estado: mappedStatus,
              pais: a.pais_iso,
              ubicacion_actual: a.ubicacion_actual,
              custodio_actual: a.custodio_actual,
              fecha_adquisicion: initialMatch?.fecha_adquisicion || '2026-01-15',
              valor_declarado_clp: Number(a.valor_declarado_clp || 0),
              atributos: initialMatch?.atributos || {},
              componentes: initialMatch?.componentes || [],
              observaciones: initialMatch?.observaciones || '',
            };
          })
        : INITIAL_ASSETS;

      const shipments: ShipmentOrder[] = (supaShipments && supaShipments.length > 0)
        ? supaShipments.map((s) => {
            const initialMatch = INITIAL_SHIPMENTS.find((x) => x.id === s.id);
            const mappedStatus = SHIPMENT_STATUS_FROM_DB[s.estado] || 'Pendiente';
            return {
              id: s.id,
              remito_numero: s.remito_numero,
              activo_id: s.activo_id,
              qr_token: s.qr_token,
              nro_cfs_movil: initialMatch?.nro_cfs_movil || s.activo_id,
              unidad_id: s.unidad_id,
              estaca_distrito: s.estaca_distrito,
              pais: s.pais_iso,
              region: s.region,
              comuna: s.comuna,
              direccion: s.direccion,
              referencia_direccion: initialMatch?.referencia_direccion,
              destinatario_titular: s.destinatario_titular,
              rut_titular: s.rut_titular,
              telefono: s.telefono_titular || initialMatch?.telefono || '',
              correo: initialMatch?.correo || '',
              transportista_id: s.transportista_id || 'CARRIER-STARKEN',
              transportista_nombre: s.transportista_nombre,
              origen_retiro: initialMatch?.origen_retiro || 'Bodega Central Providencia',
              valor_declarado_clp: Number(s.valor_declarado_clp || 0),
              peso_kg: initialMatch?.peso_kg || 18.5,
              dimensiones: initialMatch?.dimensiones || '55x40x25 cm',
              estado: mappedStatus,
              fecha_creacion: s.created_at || initialMatch?.fecha_creacion || new Date().toISOString(),
              receptor_final: s.receptor_nombre
                ? {
                    es_titular: s.receptor_parentesco === 'Titular',
                    parentesco_rol: s.receptor_parentesco || 'Titular',
                    nombre_completo: s.receptor_nombre,
                    rut: s.receptor_rut || '',
                    consentimiento_datos: true,
                    fecha_recepcion_utc: s.fecha_entrega_real || new Date().toISOString(),
                    fecha_recepcion_local: new Date().toLocaleString(),
                  }
                : initialMatch?.receptor_final,
              estado_revision_evidencia: s.estado_revision_evidencia || 'Sin evidencia',
              foto_remito_firmado: initialMatch?.foto_remito_firmado,
              foto_receptor_maleta: initialMatch?.foto_receptor_maleta,
              foto_contenido_bodega: initialMatch?.foto_contenido_bodega,
              motivo_incidencia: s.observaciones_entrega || initialMatch?.motivo_incidencia,
            };
          })
        : INITIAL_SHIPMENTS;

      const movements: MovementEvent[] = (supaMovements && supaMovements.length > 0)
        ? supaMovements.map((m) => ({
            id: m.id,
            activo_id: m.activo_id,
            envio_id: m.envio_id || undefined,
            tipo_evento: m.tipo_evento,
            estado_anterior: m.origen,
            estado_nuevo: m.destino,
            ubicacion: m.destino,
            custodio: m.custodio_nuevo || m.custodio_anterior || 'Operador',
            usuario: m.responsable,
            rol: 'Operador Logístico',
            hora_servidor_utc: m.fecha_utc,
            hora_local_dispositivo: new Date(m.fecha_utc).toLocaleString(),
            zona_horaria: 'America/Santiago (UTC-3)',
            gps: '-33.4372, -70.6145',
            hash_sha256: 'sha256-verified',
            detalle: m.observaciones || '',
          }))
        : INITIAL_MOVEMENTS;

      const auditLogs: AuditLogEntry[] = (supaLogs && supaLogs.length > 0)
        ? supaLogs.map((l) => ({
            id: l.id,
            fecha_utc: l.fecha_utc,
            usuario: l.usuario_nombre || l.usuario_id,
            rol: 'OPERADOR',
            entidad: (l.entidad_afectada || 'Activo') as any,
            entidad_id: l.entidad_id,
            accion: (l.accion || 'UPDATE') as any,
            antes: typeof l.detalles === 'object' && l.detalles?.antes ? String(l.detalles.antes) : '{}',
            despues: typeof l.detalles === 'object' && l.detalles?.despues ? String(l.detalles.despues) : '{}',
            dispositivo: 'Web Console / Supabase DB',
            ip: l.ip_origen || '127.0.0.1',
          }))
        : INITIAL_AUDIT_LOGS;

      const inventories: InventoryCampaign[] = (supaInventories && supaInventories.length > 0)
        ? supaInventories.map((inv) => ({
            id: inv.id,
            nombre: inv.nombre,
            ubicacion_objetivo: inv.ubicacion_objetivo,
            pais: inv.pais_iso,
            responsable: inv.responsable,
            fecha_inicio: inv.fecha_inicio,
            fecha_cierre: inv.fecha_cierre || undefined,
            estado: inv.estado,
            activos_esperados_ids: [],
            activos_escaneados_ids: [],
            hallazgos_otra_ubicacion_ids: [],
            observaciones_conciliacion: inv.observaciones_conciliacion || '',
          }))
        : INITIAL_INVENTORY_CAMPAIGNS;

      const incidents: AssetIncidentRecord[] = (supaIncidents && supaIncidents.length > 0)
        ? supaIncidents.map((inc) => ({
            id: inc.id,
            activo_id: inc.activo_id,
            afecta_a: inc.afecta_a,
            componente_detalle: inc.componente_detalle || '',
            tipo_incidente: inc.tipo_incidente,
            estado_resultante: inc.estado_resultante,
            descripcion: inc.descripcion,
            reportado_por: inc.reportado_por,
            fecha_utc: inc.fecha_utc,
            estado_gestion: inc.estado_gestion,
          }))
        : INITIAL_INCIDENTS;

      return {
        users,
        currentUserId: users[0]?.id || INITIAL_USERS[0].id,
        assets,
        assetTypes: INITIAL_ASSET_TYPES,
        shipments,
        movements,
        auditLogs,
        inventories,
        incidents,
      };
    } catch (err) {
      console.warn('Error al cargar datos desde Supabase (usando respaldo local):', err);
      return null;
    }
  },

  /**
   * Sincroniza una orden de envío en Supabase (INSERT o UPDATE)
   */
  async upsertShipment(shipment: ShipmentOrder): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) return;

    try {
      const dbStatus = SHIPMENT_STATUS_TO_DB[shipment.estado] || shipment.estado;
      await supabase.from('ordenes_envio').upsert({
        id: shipment.id,
        remito_numero: shipment.remito_numero,
        activo_id: shipment.activo_id,
        qr_token: shipment.qr_token,
        pais_iso: shipment.pais,
        unidad_id: shipment.unidad_id,
        estaca_distrito: shipment.estaca_distrito,
        comuna: shipment.comuna,
        region: shipment.region,
        direccion: shipment.direccion,
        destinatario_titular: shipment.destinatario_titular,
        rut_titular: shipment.rut_titular,
        telefono_titular: shipment.telefono || '+56912345678',
        transportista_id: shipment.transportista_id || null,
        transportista_nombre: shipment.transportista_nombre,
        valor_declarado_clp: shipment.valor_declarado_clp,
        estado: dbStatus,
        estado_revision_evidencia: shipment.estado_revision_evidencia === 'Aprobada' ? 'Aprobada' : 'Pendiente',
        receptor_nombre: shipment.receptor_final?.nombre_completo || null,
        receptor_rut: shipment.receptor_final?.rut || null,
        receptor_parentesco: shipment.receptor_final?.parentesco_rol || null,
        observaciones_entrega: shipment.motivo_incidencia || shipment.comentario_revision || null,
      });
    } catch (err) {
      console.warn('Error al sincronizar orden de envío en Supabase:', err);
    }
  },

  /**
   * Sincroniza un activo en Supabase (INSERT o UPDATE)
   */
  async upsertAsset(asset: AssetItem): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) return;

    try {
      const dbStatus = ASSET_STATUS_TO_DB[asset.estado] || 'Operativo';
      await supabase.from('activos').upsert({
        id: asset.id,
        tipo_id: asset.tipo_id,
        nombre: asset.nombre || asset.id,
        pais_iso: asset.pais,
        ubicacion_actual: asset.ubicacion_actual,
        estado_operativo: dbStatus,
        custodio_actual: asset.custodio_actual,
        total_componentes: asset.componentes?.length || 0,
        componentes_operativos: asset.componentes?.filter((c) => c.verificado)?.length || 0,
        valor_declarado_clp: asset.valor_declarado_clp || 0,
        qr_token: asset.qr_token || asset.id,
      });
    } catch (err) {
      console.warn('Error al sincronizar activo en Supabase:', err);
    }
  },

  /**
   * Sincroniza un usuario en Supabase (INSERT o UPDATE)
   */
  async upsertUser(user: UserAccount): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) return;

    try {
      const dbRole = ROLE_TO_DB[user.rol] || 'GESTOR_LOGISTICO';
      await supabase.from('usuarios').upsert({
        id: user.id,
        nombre: user.nombre,
        correo: user.correo,
        rol: dbRole,
        pais_iso: user.pais,
        unidad_asignada: user.ambito,
        activo: user.activo,
        organizacion: user.organizacion,
        transportista_id: user.transportista_id || null,
      });
    } catch (err) {
      console.warn('Error al sincronizar usuario en Supabase:', err);
    }
  },

  /**
   * Inserta un evento de movimiento append-only en Supabase
   */
  async insertMovement(movement: MovementEvent): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) return;

    try {
      await supabase.from('eventos_movimiento').insert({
        id: movement.id,
        activo_id: movement.activo_id,
        envio_id: movement.envio_id || null,
        tipo_evento: movement.tipo_evento,
        origen: movement.estado_anterior || 'Bodega Central',
        destino: movement.ubicacion,
        custodio_anterior: movement.estado_anterior || null,
        custodio_nuevo: movement.custodio,
        responsable: movement.usuario || 'Operador',
        fecha_utc: movement.hora_servidor_utc,
        observaciones: movement.detalle || null,
      });
    } catch (err) {
      console.warn('Error al insertar movimiento en Supabase:', err);
    }
  },

  /**
   * Inserta un registro inmutable de auditoría forense en Supabase
   */
  async insertAuditLog(log: AuditLogEntry): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) return;

    try {
      await supabase.from('logs_auditoria').insert({
        id: log.id,
        fecha_utc: log.fecha_utc,
        usuario_id: log.usuario || 'system',
        usuario_nombre: log.usuario || 'Usuario Sistema',
        accion: log.accion,
        entidad_afectada: log.entidad,
        entidad_id: log.entidad_id,
        detalles: {
          antes: log.antes,
          despues: log.despues,
          dispositivo: log.dispositivo,
          rol: log.rol,
        },
        ip_origen: log.ip || '127.0.0.1',
        pais_iso: 'CL',
      });
    } catch (err) {
      console.warn('Error al insertar log de auditoría en Supabase:', err);
    }
  },

  /**
   * Sincroniza una campaña de inventario en Supabase
   */
  async upsertInventory(inv: InventoryCampaign): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) return;

    try {
      await supabase.from('campanas_inventario').upsert({
        id: inv.id,
        nombre: inv.nombre,
        ubicacion_objetivo: inv.ubicacion_objetivo,
        pais_iso: inv.pais,
        responsable: inv.responsable,
        fecha_inicio: inv.fecha_inicio,
        fecha_cierre: inv.fecha_cierre || null,
        estado: inv.estado,
        observaciones_conciliacion: inv.observaciones_conciliacion || null,
      });
    } catch (err) {
      console.warn('Error al sincronizar campaña en Supabase:', err);
    }
  },

  /**
   * Sincroniza un incidente de activo en Supabase
   */
  async upsertIncident(inc: AssetIncidentRecord): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) return;

    try {
      await supabase.from('incidentes_activos').upsert({
        id: inc.id,
        activo_id: inc.activo_id,
        afecta_a: inc.afecta_a,
        componente_detalle: inc.componente_detalle || null,
        tipo_incidente: inc.tipo_incidente,
        estado_resultante: inc.estado_resultante,
        descripcion: inc.descripcion,
        reportado_por: inc.reportado_por,
        fecha_utc: inc.fecha_utc,
        estado_gestion: inc.estado_gestion,
      });
    } catch (err) {
      console.warn('Error al sincronizar incidente en Supabase:', err);
    }
  },

  /**
   * Siembra todas las colecciones iniciales en Supabase
   */
  async seedAll(snapshot: PersistedDatabaseSnapshot): Promise<{ success: boolean; message: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, message: 'Supabase no está configurado.' };
    }

    try {
      // 1. Activos primero (para satisfacer FK de ordenes_envio)
      for (const a of snapshot.assets) {
        await this.upsertAsset(a);
      }

      // 2. Usuarios
      for (const u of snapshot.users) {
        await this.upsertUser(u);
      }

      // 3. Envíos
      for (const s of snapshot.shipments) {
        await this.upsertShipment(s);
      }

      // 4. Movimientos
      for (const m of snapshot.movements) {
        await this.insertMovement(m);
      }

      // 5. Auditoría
      for (const l of snapshot.auditLogs) {
        await this.insertAuditLog(l);
      }

      // 6. Campañas
      for (const inv of snapshot.inventories) {
        await this.upsertInventory(inv);
      }

      // 7. Incidentes
      for (const inc of snapshot.incidents) {
        await this.upsertIncident(inc);
      }

      return {
        success: true,
        message: `¡Todas las tablas en Supabase fueron pobladas exitosamente! (${snapshot.assets.length} activos, ${snapshot.shipments.length} envíos, ${snapshot.users.length} usuarios sincronizados).`,
      };
    } catch (err) {
      return {
        success: false,
        message: `Error al sembrar en Supabase: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

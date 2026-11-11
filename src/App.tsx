import React, { useState, useMemo, useEffect } from 'react';
import {
  Truck,
  Package,
  QrCode,
  FileSpreadsheet,
  Smartphone,
  ShieldCheck,
  Search,
  MapPin,
  Clock,
  CheckCircle2,
  Plus,
  FileText,
  Printer,
  ChevronRight,
  Database,
  Layers,
  ClipboardCheck,
  Download,
  LogOut,
  UserCheck,
  UserPlus,
  X,
  Menu,
  Phone,
  Lock,
  Eye,
} from 'lucide-react';
import {
  CountryCode,
  ShipmentOrder,
  ShipmentStatus,
  ExcelImportRow,
  AssetItem,
  AssetTypeConfig,
  MovementEvent,
  AuditLogEntry,
  InventoryCampaign,
  AssetIncidentRecord,
  UserAccount,
  UserRole,
  EvidencePhoto,
  RelationType,
} from './types/logistics';
import {
  COUNTRY_SUMMARIES,
  INITIAL_EXCEL_IMPORT_ROWS,
  CHILE_COMUNAS_CATALOG,
  INITIAL_USERS,
  CARRIERS,
  normalizeAndValidateRut,
  validateExcelRow,
} from './data/initialData';
import {
  DatabaseRepository,
  PersistedDatabaseSnapshot,
  downloadShipmentsCsv,
  computeSha256Hex,
} from './services/databaseService';
import { MobileFieldSimulator } from './components/MobileFieldSimulator';
import { ExcelImportModule } from './components/ExcelImportModule';
import { RemitoPdfModal, QrBatchModal } from './components/RemitoAndQrModal';
import { AssetsAndCatalogModule } from './components/AssetsAndCatalogModule';
import { TraceabilityAndAuditModule } from './components/TraceabilityAndAuditModule';
import { InventoryAndIncidentsModule } from './components/InventoryAndIncidentsModule';
import { DatabaseConfigModal } from './components/DatabaseConfigModal';
import { LoginScreen } from './components/LoginScreen';
import { UserManagementModal } from './components/UserManagementModal';
import { SupabaseDataService } from './services/supabaseDataService';

type ActiveModule =
  | 'torre_control'
  | 'activos_catalogo'
  | 'inventario_incidentes'
  | 'importador_excel'
  | 'app_terreno'
  | 'trazabilidad_auditoria';

/**
 * Matriz de Permisos por Rol (RBAC) — Define qué pantallas ve cada rol y cuál es su pantalla de inicio
 */
const ROLE_PERMISSIONS: Record<
  UserRole,
  {
    defaultModule: ActiveModule;
    allowedModules: ActiveModule[];
    canSwitchCountries: boolean;
    canCreateShipment: boolean;
    canReassignCarrier: boolean;
    canManageDb: boolean;
    description: string;
  }
> = {
  ADMIN_REGIONAL: {
    defaultModule: 'torre_control',
    allowedModules: [
      'activos_catalogo',
      'importador_excel',
      'torre_control',
      'app_terreno',
      'inventario_incidentes',
      'trazabilidad_auditoria',
    ],
    canSwitchCountries: true,
    canCreateShipment: true,
    canReassignCarrier: true,
    canManageDb: true,
    description:
      'Acceso total a las 6 instancias logísticas y a los 4 países del Área Sudamérica Sur (CL · AR · PY · UY).',
  },
  COORDINADOR_NACIONAL: {
    defaultModule: 'torre_control',
    allowedModules: [
      'activos_catalogo',
      'importador_excel',
      'torre_control',
      'app_terreno',
      'inventario_incidentes',
      'trazabilidad_auditoria',
    ],
    canSwitchCountries: false,
    canCreateShipment: true,
    canReassignCarrier: true,
    canManageDb: true,
    description:
      'Gestión nacional completa (6 instancias) restringida a su país asignado (Chile).',
  },
  ENCARGADO_BODEGA: {
    defaultModule: 'activos_catalogo',
    allowedModules: [
      'activos_catalogo',
      'app_terreno',
      'inventario_incidentes',
      'torre_control',
    ],
    canSwitchCountries: false,
    canCreateShipment: false,
    canReassignCarrier: false,
    canManageDb: false,
    description:
      'Operación de Bodega Central: Alta de activos, etiquetas QR, armado/sellado de contenedores e inventario físico.',
  },
  TRANSPORTISTA: {
    defaultModule: 'app_terreno',
    allowedModules: ['app_terreno', 'torre_control'],
    canSwitchCountries: false,
    canCreateShipment: false,
    canReassignCarrier: false,
    canManageDb: false,
    description:
      'Terminal exclusiva de Terreno y Ruta: Solo ve y opera los envíos asignados a su empresa transportista.',
  },
  AUDITOR: {
    defaultModule: 'trazabilidad_auditoria',
    allowedModules: [
      'trazabilidad_auditoria',
      'torre_control',
      'inventario_incidentes',
    ],
    canSwitchCountries: true,
    canCreateShipment: false,
    canReassignCarrier: false,
    canManageDb: false,
    description:
      'Modo Solo Lectura Regional: Inspección de remitos, evidencias fotográficas, hashes SHA-256 y bitácora inmutable.',
  },
};

export default function App() {
  const initialDb = useMemo(() => DatabaseRepository.loadSnapshot(), []);

  // Auth & Users State
  const [users, setUsers] = useState<UserAccount[]>(initialDb.users);
  const [currentUserId, setCurrentUserId] = useState<string>(
    initialDb.currentUserId || INITIAL_USERS[0].id
  );
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return (
      localStorage.getItem('lc_auth_logged_in') === 'true' ||
      sessionStorage.getItem('lc_auth_logged_in') === 'true'
    );
  });
  const [showUserModal, setShowUserModal] = useState<boolean>(false);

  // Navigation & Mobile Drawer State
  const [activeModule, setActiveModule] = useState<ActiveModule>('torre_control');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>('CL');
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<ShipmentStatus | 'TODOS'>('TODOS');

  // Persisted Operational State
  const [shipments, setShipments] = useState<ShipmentOrder[]>(initialDb.shipments);
  const [assets, setAssets] = useState<AssetItem[]>(initialDb.assets);
  const [assetTypes, setAssetTypes] = useState<AssetTypeConfig[]>(initialDb.assetTypes);
  const [movements, setMovements] = useState<MovementEvent[]>(initialDb.movements);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(initialDb.auditLogs);
  const [inventories, setInventories] = useState<InventoryCampaign[]>(initialDb.inventories);
  const [incidents, setIncidents] = useState<AssetIncidentRecord[]>(initialDb.incidents);
  const [excelRows, setExcelRows] = useState<ExcelImportRow[]>(INITIAL_EXCEL_IMPORT_ROWS);

  // Selected Shipment for Field Terminal
  const [selectedFieldShipmentId, setSelectedFieldShipmentId] = useState<string>(
    initialDb.shipments[0]?.id || 'ENV-CL-2026-063'
  );

  // Modals
  const [remitoModalShipment, setRemitoModalShipment] = useState<ShipmentOrder | null>(null);
  const [qrBatchModalAssets, setQrBatchModalAssets] = useState<AssetItem[] | null>(null);
  const [selectedShipmentDetail, setSelectedShipmentDetail] = useState<ShipmentOrder | null>(null);
  const [showNewShipmentModal, setShowNewShipmentModal] = useState(false);
  const [showDbModal, setShowDbModal] = useState(false);

  // New Shipment Form
  const [newOrderAssetId, setNewOrderAssetId] = useState(
    initialDb.assets.find((a) => a.es_contenedor)?.id || 'CFS-CL-065'
  );
  const [newOrderUnidadId, setNewOrderUnidadId] = useState('529100');
  const [newOrderEstaca, setNewOrderEstaca] = useState('Estaca Santiago Las Condes');
  const [newOrderDireccion, setNewOrderDireccion] = useState('Av. Presidente Riesco 6420');
  const [newOrderComuna, setNewOrderComuna] = useState('Las Condes');
  const [newOrderTitular, setNewOrderTitular] = useState('Pdte. Cristián Undurraga');
  const [newOrderRut, setNewOrderRut] = useState('12.345.678-5');
  const [newOrderTelefono, setNewOrderTelefono] = useState('+56 9 8712 4400');
  const [newOrderCorreo, setNewOrderCorreo] = useState('cundurraga@iglesiajesucristo.org');
  const [newOrderCarrierId, setNewOrderCarrierId] = useState(CARRIERS[0].id);

  const currentUser = useMemo(
    () => users.find((u) => u.id === currentUserId) || users[0],
    [users, currentUserId]
  );

  const activeRolePerms = useMemo(
    () => ROLE_PERMISSIONS[currentUser.rol],
    [currentUser.rol]
  );

  // Handle User Switch: Automatically navigate to the role's primary screen and enforce country scope
  const handleSelectUserAccount = (newUserId: string) => {
    const targetUser = users.find((u) => u.id === newUserId);
    if (!targetUser) return;
    setCurrentUserId(targetUser.id);
    const perms = ROLE_PERMISSIONS[targetUser.rol];
    if (!perms.canSwitchCountries) {
      setSelectedCountry(targetUser.pais);
    }
    // Switch screen automatically to the role's default workspace (or keep current if allowed & appropriate)
    setActiveModule(perms.defaultModule);
    setMobileMenuOpen(false);
  };

  // Cargar datos en vivo desde Supabase al iniciar la aplicación
  useEffect(() => {
    let isMounted = true;
    async function initSupabaseData() {
      try {
        const supaSnapshot = await SupabaseDataService.loadSnapshot();
        if (supaSnapshot && isMounted) {
          if (supaSnapshot.users.length > 0) setUsers(supaSnapshot.users);
          if (supaSnapshot.assets.length > 0) setAssets(supaSnapshot.assets);
          if (supaSnapshot.shipments.length > 0) setShipments(supaSnapshot.shipments);
          if (supaSnapshot.movements.length > 0) setMovements(supaSnapshot.movements);
          if (supaSnapshot.auditLogs.length > 0) setAuditLogs(supaSnapshot.auditLogs);
          if (supaSnapshot.inventories.length > 0) setInventories(supaSnapshot.inventories);
          if (supaSnapshot.incidents.length > 0) setIncidents(supaSnapshot.incidents);
          console.log('✅ LogisticsConnect sincronizado con Supabase.');
        }
      } catch (err) {
        console.warn('Nota: Usando caché local (Supabase offline o error):', err);
      }
    }
    initSupabaseData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Persist changes automatically in local storage as reliable fallback
  useEffect(() => {
    DatabaseRepository.saveUsers(users);
    DatabaseRepository.saveCurrentUserId(currentUserId);
    DatabaseRepository.saveAssets(assets);
    DatabaseRepository.saveAssetTypes(assetTypes);
    DatabaseRepository.saveShipments(shipments);
    DatabaseRepository.saveMovements(movements);
    DatabaseRepository.saveAuditLogs(auditLogs);
    DatabaseRepository.saveInventories(inventories);
    DatabaseRepository.saveIncidents(incidents);
  }, [
    users,
    currentUserId,
    assets,
    assetTypes,
    shipments,
    movements,
    auditLogs,
    inventories,
    incidents,
  ]);

  const recordMovementAndAudit = async (params: {
    activoId: string;
    envioId?: string;
    tipoEvento: MovementEvent['tipo_evento'];
    estadoAnterior: string;
    estadoNuevo: string;
    ubicacion: string;
    custodio: string;
    gps?: string;
    detalle: string;
    capturadoOffline?: boolean;
    auditEntidad: AuditLogEntry['entidad'];
    auditEntidadId: string;
    auditAccion: AuditLogEntry['accion'];
    antesJson: Record<string, unknown>;
    despuesJson: Record<string, unknown>;
  }) => {
    const nowUtc = new Date().toISOString();
    const nowLocal = new Date().toLocaleString('es-CL', {
      timeZone: 'America/Santiago',
    });
    const sha256 = await computeSha256Hex(
      `${params.activoId}-${params.tipoEvento}-${nowUtc}`
    );

    const newMov: MovementEvent = {
      id: `MOV-${9000 + movements.length + 1}`,
      activo_id: params.activoId,
      envio_id: params.envioId,
      tipo_evento: params.tipoEvento,
      estado_anterior: params.estadoAnterior,
      estado_nuevo: params.estadoNuevo,
      ubicacion: params.ubicacion,
      custodio: params.custodio,
      usuario: currentUser.correo,
      rol: currentUser.rol_etiqueta,
      hora_servidor_utc: nowUtc,
      hora_local_dispositivo: nowLocal,
      zona_horaria: 'America/Santiago (UTC-3)',
      gps: params.gps || '-33.4372, -70.6145',
      hash_sha256: sha256,
      detalle: params.detalle,
      capturado_offline: params.capturadoOffline,
    };

    const newAud: AuditLogEntry = {
      id: `AUD-${500 + auditLogs.length + 1}`,
      entidad: params.auditEntidad,
      entidad_id: params.auditEntidadId,
      accion: params.auditAccion,
      antes: JSON.stringify(params.antesJson),
      despues: JSON.stringify(params.despuesJson),
      usuario: currentUser.correo,
      rol: currentUser.rol,
      fecha_utc: nowUtc,
      dispositivo: 'Web Console / Terminal Operativa',
      ip: '190.162.84.112',
    };

    setMovements((prev) => [newMov, ...prev]);
    setAuditLogs((prev) => [newAud, ...prev]);
    // Sincronizar en tiempo real con Supabase
    SupabaseDataService.insertMovement(newMov);
    SupabaseDataService.insertAuditLog(newAud);
  };

  // Country & Role Filtering
  const currentCountrySummary = useMemo(
    () =>
      COUNTRY_SUMMARIES.find((c) => c.codigo === selectedCountry) ||
      COUNTRY_SUMMARIES[0],
    [selectedCountry]
  );

  const visibleShipments = useMemo(() => {
    return shipments.filter((s) => {
      if (s.pais !== selectedCountry) return false;
      if (
        currentUser.rol === 'TRANSPORTISTA' &&
        currentUser.transportista_id &&
        s.transportista_id !== currentUser.transportista_id
      ) {
        return false;
      }
      if (stateFilter !== 'TODOS' && s.estado !== stateFilter) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        s.id.toLowerCase().includes(q) ||
        s.activo_id.toLowerCase().includes(q) ||
        s.remito_numero.toLowerCase().includes(q) ||
        s.estaca_distrito.toLowerCase().includes(q) ||
        s.comuna.toLowerCase().includes(q) ||
        s.destinatario_titular.toLowerCase().includes(q)
      );
    });
  }, [shipments, selectedCountry, currentUser, stateFilter, searchQuery]);

  // All 6 Logistics Instances, filtered dynamically by the active User Role!
  const allLogisticsStages: {
    id: ActiveModule;
    step: string;
    title: string;
    shortTitle: string;
    subtitle: string;
    badge: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
      {
        id: 'activos_catalogo',
        step: 'Instancia 1',
        title: '1. Activos y QR',
        shortTitle: 'Activos',
        subtitle: 'Alta de maletas y etiquetas QR',
        badge: `${assets.length}`,
        icon: Layers,
      },
      {
        id: 'importador_excel',
        step: 'Instancia 2',
        title: '2. Carga Excel',
        shortTitle: 'Excel',
        subtitle: 'Importación y validador RUT',
        badge: `${excelRows.length} filas`,
        icon: FileSpreadsheet,
      },
      {
        id: 'torre_control',
        step: 'Instancia 3',
        title:
          currentUser.rol === 'TRANSPORTISTA'
            ? 'Mis Envíos Asignados'
            : '3. Torre de Despachos',
        shortTitle: 'Despachos',
        subtitle:
          currentUser.rol === 'TRANSPORTISTA'
            ? `Asignados a ${currentUser.organizacion}`
            : 'Órdenes, rutas y Remitos PDF',
        badge: `${visibleShipments.length}`,
        icon: Package,
      },
      {
        id: 'app_terreno',
        step: 'Instancia 4',
        title:
          currentUser.rol === 'ENCARGADO_BODEGA'
            ? '4. Armado en Bodega'
            : '4. Terreno y Entrega',
        shortTitle: 'Terreno QR',
        subtitle: 'Armado, GPS Llegué, Fotos y Firma',
        badge: 'Móvil / QR',
        icon: Smartphone,
      },
      {
        id: 'inventario_incidentes',
        step: 'Instancia 5',
        title: '5. Inventario y Fallas',
        shortTitle: 'Inventario',
        subtitle: 'Auditoría QR en bodega e incidentes',
        badge: `${inventories.length}`,
        icon: ClipboardCheck,
      },
      {
        id: 'trazabilidad_auditoria',
        step: 'Instancia 6',
        title: '6. Validación y Logs',
        shortTitle: 'Auditoría',
        subtitle: 'Aprobación de fotos y bitácora',
        badge: `${auditLogs.length}`,
        icon: ShieldCheck,
      },
    ];

  const allowedLogisticsStages = useMemo(
    () =>
      allLogisticsStages.filter((st) =>
        activeRolePerms.allowedModules.includes(st.id)
      ),
    [allLogisticsStages, activeRolePerms]
  );

  // Operational Handlers for Field & Warehouse Terminal
  const handlePackContainer = (shipmentId: string, sealCode: string) => {
    const target = shipments.find((s) => s.id === shipmentId);
    if (!target) return;

    setShipments((prev) =>
      prev.map((s) =>
        s.id === shipmentId ? { ...s, estado: 'Listo para despacho' } : s
      )
    );
    SupabaseDataService.upsertShipment({ ...target, estado: 'Listo para despacho' });
    setAssets((prev) =>
      prev.map((a) =>
        a.id === target.activo_id
          ? {
            ...a,
            estado: 'Listo para despacho',
            sello_seguridad: sealCode,
            componentes: a.componentes.map((c) => ({ ...c, verificado: true })),
          }
          : a
      )
    );

    recordMovementAndAudit({
      activoId: target.activo_id,
      envioId: target.id,
      tipoEvento: 'ARMADO_CONTENEDOR',
      estadoAnterior: target.estado,
      estadoNuevo: 'Listo para despacho',
      ubicacion: target.origen_retiro,
      custodio: currentUser.nombre,
      detalle: `Contenedor verificado (6 notebooks, 6 mouses, 6 cargadores, 1 zapatilla) y sellado con ${sealCode}.`,
      auditEntidad: 'Transferencia',
      auditEntidadId: target.id,
      auditAccion: 'STATUS_TRANSITION',
      antesJson: { estado: target.estado },
      despuesJson: { estado: 'Listo para despacho', sello: sealCode },
    });
  };

  const handleStartDeliveryAndRemito = (shipmentId: string) => {
    const target = shipments.find((s) => s.id === shipmentId);
    if (!target) return;

    setShipments((prev) =>
      prev.map((s) => (s.id === shipmentId ? { ...s, estado: 'En curso' } : s))
    );
    SupabaseDataService.upsertShipment({ ...target, estado: 'En curso' });
    setAssets((prev) =>
      prev.map((a) =>
        a.id === target.activo_id
          ? {
            ...a,
            estado: 'En curso',
            ubicacion_actual: `En tránsito → ${target.estaca_distrito} (${target.comuna})`,
            custodio_actual: target.transportista_nombre,
          }
          : a
      )
    );

    recordMovementAndAudit({
      activoId: target.activo_id,
      envioId: target.id,
      tipoEvento: 'DESPACHO_REMITO',
      estadoAnterior: target.estado,
      estadoNuevo: 'En curso',
      ubicacion: `En tránsito → ${target.estaca_distrito}`,
      custodio: target.transportista_nombre,
      detalle: `Retiro en bodega e inicio de ruta con Remito ${target.remito_numero}.`,
      auditEntidad: 'Transferencia',
      auditEntidadId: target.id,
      auditAccion: 'STATUS_TRANSITION',
      antesJson: { estado: target.estado },
      despuesJson: { estado: 'En curso', remito: target.remito_numero },
    });
  };

  const handleMarkArrived = (
    shipmentId: string,
    gps: string,
    distanceMeters: number
  ) => {
    const target = shipments.find((s) => s.id === shipmentId);
    if (!target) return;

    const nowLocal = new Date().toLocaleString('es-CL', {
      timeZone: 'America/Santiago',
    });

    setShipments((prev) =>
      prev.map((s) =>
        s.id === shipmentId
          ? {
            ...s,
            estado: 'Llegué',
            llegada_hora_local: nowLocal,
            llegada_gps: gps,
            distancia_destino_metros: distanceMeters,
          }
          : s
      )
    );
    SupabaseDataService.upsertShipment({
      ...target,
      estado: 'Llegué',
      llegada_hora_local: nowLocal,
      llegada_gps: gps,
      distancia_destino_metros: distanceMeters,
    });
    setAssets((prev) =>
      prev.map((a) =>
        a.id === target.activo_id
          ? {
            ...a,
            estado: 'Llegué',
            ubicacion_actual: `${target.estaca_distrito} (${target.direccion}, ${target.comuna})`,
          }
          : a
      )
    );

    recordMovementAndAudit({
      activoId: target.activo_id,
      envioId: target.id,
      tipoEvento: 'LLEGADA_DESTINO',
      estadoAnterior: target.estado,
      estadoNuevo: 'Llegué',
      ubicacion: `${target.direccion}, ${target.comuna}`,
      custodio: target.transportista_nombre,
      gps,
      detalle: `Llegada registrada en destino (${gps}, precisión ±${distanceMeters}m).`,
      auditEntidad: 'Transferencia',
      auditEntidadId: target.id,
      auditAccion: 'STATUS_TRANSITION',
      antesJson: { estado: target.estado },
      despuesJson: { estado: 'Llegué', gps },
    });
  };

  const handleConfirmDelivery = (
    shipmentId: string,
    receiver: {
      es_titular: boolean;
      parentesco_rol: RelationType;
      nombre_completo: string;
      rut: string;
      consentimiento_datos: boolean;
    },
    fotoRemito: EvidencePhoto,
    fotoReceptor: EvidencePhoto,
    firmaDigitalTexto: string,
    firmaDigitalImagen: string | undefined,
    wasOffline: boolean
  ) => {
    const target = shipments.find((s) => s.id === shipmentId);
    if (!target) return;

    const nowUtc = new Date().toISOString();
    const nowLocal = new Date().toLocaleString('es-CL', {
      timeZone: 'America/Santiago',
    });

    setShipments((prev) =>
      prev.map((s) =>
        s.id === shipmentId
          ? {
            ...s,
            estado: 'Entregado',
            receptor_final: {
              ...receiver,
              fecha_recepcion_utc: nowUtc,
              fecha_recepcion_local: nowLocal,
            },
            foto_remito_firmado: fotoRemito,
            foto_receptor_maleta: fotoReceptor,
            firma_digital_trazo: firmaDigitalTexto,
            firma_digital_imagen: firmaDigitalImagen,
            estado_revision_evidencia: 'Pendiente de revisión',
          }
          : s
      )
    );

    SupabaseDataService.upsertShipment({
      ...target,
      estado: 'Entregado',
      receptor_final: {
        ...receiver,
        fecha_recepcion_utc: nowUtc,
        fecha_recepcion_local: nowLocal,
      },
      foto_remito_firmado: fotoRemito,
      foto_receptor_maleta: fotoReceptor,
      firma_digital_trazo: firmaDigitalTexto,
      firma_digital_imagen: firmaDigitalImagen,
      estado_revision_evidencia: 'Pendiente de revisión',
    });

    setAssets((prev) =>
      prev.map((a) =>
        a.id === target.activo_id
          ? {
            ...a,
            estado: 'Entregado',
            ubicacion_actual: `${target.estaca_distrito} (${target.direccion}, ${target.comuna})`,
            custodio_actual: `${target.estaca_distrito} — ${receiver.nombre_completo} (${receiver.parentesco_rol})`,
          }
          : a
      )
    );

    recordMovementAndAudit({
      activoId: target.activo_id,
      envioId: target.id,
      tipoEvento: 'ENTREGA_CONFIRMADA',
      estadoAnterior: 'Llegué',
      estadoNuevo: 'Entregado',
      ubicacion: `${target.estaca_distrito} (${target.comuna})`,
      custodio: `${receiver.nombre_completo} (RUT ${receiver.rut})`,
      gps: fotoRemito.gps_coords,
      detalle: `Entrega confirmada a ${receiver.nombre_completo} (${receiver.parentesco_rol}) con 2 fotografías verificadas y firma digital.`,
      capturadoOffline: wasOffline,
      auditEntidad: 'Transferencia',
      auditEntidadId: target.id,
      auditAccion: 'STATUS_TRANSITION',
      antesJson: { estado: 'Llegué' },
      despuesJson: {
        estado: 'Entregado',
        receptor_rut: receiver.rut,
        parentesco: receiver.parentesco_rol,
      },
    });
  };

  const handleReportShipmentIncident = (shipmentId: string, motivo: string) => {
    const target = shipments.find((s) => s.id === shipmentId);
    if (!target) return;

    setShipments((prev) =>
      prev.map((s) =>
        s.id === shipmentId
          ? { ...s, estado: 'Incidencia', motivo_incidencia: motivo }
          : s
      )
    );
    SupabaseDataService.upsertShipment({ ...target, estado: 'Incidencia', motivo_incidencia: motivo });
    setAssets((prev) =>
      prev.map((a) =>
        a.id === target.activo_id ? { ...a, estado: 'Incidente' } : a
      )
    );

    recordMovementAndAudit({
      activoId: target.activo_id,
      envioId: target.id,
      tipoEvento: 'INCIDENCIA_REPORTADA',
      estadoAnterior: target.estado,
      estadoNuevo: 'Incidencia',
      ubicacion: `${target.direccion}, ${target.comuna}`,
      custodio: target.transportista_nombre,
      detalle: `Incidencia en ruta/destino: ${motivo}`,
      auditEntidad: 'Transferencia',
      auditEntidadId: target.id,
      auditAccion: 'STATUS_TRANSITION',
      antesJson: { estado: target.estado },
      despuesJson: { estado: 'Incidencia', motivo },
    });
  };

  // Asset & Catalog Handlers
  const handleRegisterAsset = (newAsset: AssetItem) => {
    setAssets((prev) => [newAsset, ...prev]);
    SupabaseDataService.upsertAsset(newAsset);
    recordMovementAndAudit({
      activoId: newAsset.id,
      tipoEvento: 'ALTA_ACTIVO',
      estadoAnterior: '—',
      estadoNuevo: newAsset.estado,
      ubicacion: newAsset.ubicacion_actual,
      custodio: newAsset.custodio_actual,
      detalle: `Alta en inventario e impresión de etiqueta QR (${newAsset.qr_token}).`,
      auditEntidad: 'Activo',
      auditEntidadId: newAsset.id,
      auditAccion: 'INSERT',
      antesJson: {},
      despuesJson: { id: newAsset.id, serial: newAsset.serial },
    });
  };

  const handleEditAssetWithReason = (
    assetId: string,
    newLocation: string,
    newObservations: string,
    reason: string
  ) => {
    const target = assets.find((a) => a.id === assetId);
    if (!target) return;
    setAssets((prev) =>
      prev.map((a) =>
        a.id === assetId
          ? {
            ...a,
            ubicacion_actual: newLocation,
            observaciones: newObservations,
          }
          : a
      )
    );
    SupabaseDataService.upsertAsset({ ...target, ubicacion_actual: newLocation, observaciones: newObservations });
    recordMovementAndAudit({
      activoId: assetId,
      tipoEvento: 'TRANSFERENCIA_CUSTODIO',
      estadoAnterior: target.estado,
      estadoNuevo: target.estado,
      ubicacion: newLocation,
      custodio: target.custodio_actual,
      detalle: `Actualización de ficha (${reason}): ${newObservations}`,
      auditEntidad: 'Activo',
      auditEntidadId: assetId,
      auditAccion: 'UPDATE',
      antesJson: { observaciones: target.observaciones },
      despuesJson: { observaciones: newObservations, motivo: reason },
    });
  };

  const handleDecommissionAsset = (assetId: string, reason: string) => {
    const target = assets.find((a) => a.id === assetId);
    if (!target) return;
    const today = new Date().toISOString().slice(0, 10);
    setAssets((prev) =>
      prev.map((a) =>
        a.id === assetId
          ? {
            ...a,
            estado: 'Dado de baja',
            fecha_baja: today,
            motivo_baja: reason,
          }
          : a
      )
    );
    SupabaseDataService.upsertAsset({ ...target, estado: 'Dado de baja', fecha_baja: today, motivo_baja: reason });
    recordMovementAndAudit({
      activoId: assetId,
      tipoEvento: 'BAJA_ACTIVO',
      estadoAnterior: target.estado,
      estadoNuevo: 'Dado de baja',
      ubicacion: target.ubicacion_actual,
      custodio: 'Archivo de Bajas',
      detalle: `Baja definitiva e inactivación de QR. Motivo: ${reason}`,
      auditEntidad: 'Activo',
      auditEntidadId: assetId,
      auditAccion: 'DECOMMISSION',
      antesJson: { estado: target.estado },
      despuesJson: { estado: 'Dado de baja', motivo: reason },
    });
  };

  const handleCreateAssetType = (newType: AssetTypeConfig) => {
    setAssetTypes((prev) => [...prev, newType]);
  };

  // Evidence Verification
  const handleVerifyEvidence = (
    shipmentId: string,
    decision: 'Aprobada' | 'Reintento solicitado',
    comment: string
  ) => {
    const target = shipments.find((s) => s.id === shipmentId);
    if (!target) return;

    setShipments((prev) =>
      prev.map((s) =>
        s.id === shipmentId
          ? {
            ...s,
            estado_revision_evidencia: decision,
            comentario_revision: comment,
          }
          : s
      )
    );
    SupabaseDataService.upsertShipment({ ...target, estado_revision_evidencia: decision, comentario_revision: comment });

    if (decision === 'Aprobada') {
      setAssets((prev) =>
        prev.map((a) =>
          a.id === target.activo_id ? { ...a, estado: 'En uso (unidad)' } : a
        )
      );
    }

    recordMovementAndAudit({
      activoId: target.activo_id,
      envioId: target.id,
      tipoEvento: 'REVISION_EVIDENCIA',
      estadoAnterior: target.estado,
      estadoNuevo: decision === 'Aprobada' ? 'En uso (unidad)' : target.estado,
      ubicacion: `${target.estaca_distrito} (${target.comuna})`,
      custodio: target.receptor_final?.nombre_completo || target.destinatario_titular,
      detalle: `Revisión de evidencias: ${decision}. ${comment}`,
      auditEntidad: 'Evidencia',
      auditEntidadId: target.id,
      auditAccion: 'VERIFY_EVIDENCE',
      antesJson: { estado_revision: target.estado_revision_evidencia },
      despuesJson: { estado_revision: decision, comentario: comment },
    });
  };

  // Excel Batch Handlers
  const handleUpdateExcelRow = (updatedRow: ExcelImportRow) => {
    setExcelRows((prev) =>
      prev.map((r) => (r.fila === updatedRow.fila ? updatedRow : r))
    );
  };

  const handleAutoNormalizeExcel = () => {
    setExcelRows((prev) =>
      prev.map((row) => {
        const v = validateExcelRow(row);
        const cleanEmail = row.correo.includes('@')
          ? row.correo
          : row.correo.replace('.iglesia.org', '@iglesiajesucristo.org');
        return {
          ...row,
          comuna_raw: v.comuna_sugerida || row.comuna_raw,
          rut: v.rut_normalizado || row.rut,
          correo: cleanEmail,
        };
      })
    );
  };

  const handleCommitValidExcelRows = (validRows: ExcelImportRow[]) => {
    const baseNum = shipments.length + 66;
    const newShipments: ShipmentOrder[] = [];
    const newAssets: AssetItem[] = [];

    validRows.forEach((row, idx) => {
      const num = baseNum + idx;
      const assetId = `CFS-CL-0${num}`;
      const qrToken = `qr_op_${Math.random().toString(16).slice(2, 10)}-4a9c-0${num}`;
      const comunaObj =
        CHILE_COMUNAS_CATALOG.find(
          (c) => c.comuna.toLowerCase() === row.comuna_raw.trim().toLowerCase()
        ) || CHILE_COMUNAS_CATALOG[0];

      newAssets.push({
        id: assetId,
        qr_token: qrToken,
        serial: `SN-CFS2026-0${num}`,
        tipo_id: 'TYPE-CFS-MALETA',
        tipo_nombre: 'Maleta Centro Móvil (CFS)',
        es_contenedor: true,
        estado: 'Disponible en bodega',
        pais: 'CL',
        ubicacion_actual: 'Bodega Central — Pedro de Valdivia 1423, Providencia',
        custodio_actual: 'Rodrigo Soto (Bodega Central)',
        fecha_adquisicion: new Date().toISOString().slice(0, 10),
        valor_declarado_clp: 3000000,
        atributos: {
          modelo_maleta: 'Pelican Storm Case iM2720 Acolchada',
          poliza_seguro: 'POL-CHILE-2026-9914',
          lote_despliegue: 'Chile 2026',
        },
        componentes: [
          {
            id: `CMP-${num}-1`,
            nombre: 'Notebook Lenovo ThinkPad 14" + Funda protectora',
            cantidad: 6,
            verificado: true,
          },
          {
            id: `CMP-${num}-2`,
            nombre: 'Mouse óptico USB ergonómico',
            cantidad: 6,
            verificado: true,
          },
          {
            id: `CMP-${num}-3`,
            nombre: 'Cargador original Lenovo 65W USB-C',
            cantidad: 6,
            verificado: true,
          },
          {
            id: `CMP-${num}-4`,
            nombre: 'Zapatilla eléctrica certificada SEC (6 tomas)',
            cantidad: 1,
            verificado: true,
          },
        ],
        observaciones: row.comentario_planilla || 'Importado desde planilla Excel.',
      });

      newShipments.push({
        id: `ENV-CL-2026-0${num}`,
        remito_numero: `REM-CL-2026-00${num}`,
        activo_id: assetId,
        qr_token: qrToken,
        nro_cfs_movil: `CFS Móvil #${num}`,
        unidad_id: row.nro_unidad,
        estaca_distrito: row.estaca_distrito,
        pais: 'CL',
        region: comunaObj.region,
        comuna: comunaObj.comuna,
        direccion: row.direccion,
        destinatario_titular: row.destinatario,
        rut_titular: normalizeAndValidateRut(row.rut).formatted,
        telefono: row.telefono,
        correo: row.correo,
        solicitud_adicional: row.comentario_planilla,
        transportista_id: CARRIERS[0].id,
        transportista_nombre: CARRIERS[0].nombre,
        origen_retiro: 'Pedro de Valdivia 1423, Providencia, Santiago',
        valor_declarado_clp: 3000000,
        peso_kg: 15,
        dimensiones: '55×35×25 cm',
        estado: 'Pendiente',
        fecha_creacion: new Date().toISOString().slice(0, 10),
        estado_revision_evidencia: 'Sin evidencia',
      });
    });

    setAssets((prev) => [...newAssets, ...prev]);
    setShipments((prev) => [...newShipments, ...prev]);
    newAssets.forEach((a) => SupabaseDataService.upsertAsset(a));
    newShipments.forEach((s) => SupabaseDataService.upsertShipment(s));
    setActiveModule('torre_control');
  };

  // Inventory & Incidents Handlers
  const handleStartInventoryCampaign = (
    nombre: string,
    ubicacionObjetivo: string
  ) => {
    const expected = assets
      .filter((a) =>
        a.ubicacion_actual
          .toLowerCase()
          .includes(ubicacionObjetivo.split(' ')[0].toLowerCase())
      )
      .map((a) => a.id);

    const newCamp: InventoryCampaign = {
      id: `INV-${selectedCountry}-2026-0${inventories.length + 1}`,
      nombre,
      ubicacion_objetivo: ubicacionObjetivo,
      pais: selectedCountry,
      responsable: currentUser.nombre,
      fecha_inicio: new Date().toISOString().slice(0, 10),
      estado: 'En curso',
      activos_esperados_ids:
        expected.length > 0 ? expected : assets.slice(0, 3).map((a) => a.id),
      activos_escaneados_ids: [],
      hallazgos_otra_ubicacion_ids: [],
    };
    setInventories((prev) => [newCamp, ...prev]);
    SupabaseDataService.upsertInventory(newCamp);
  };

  const handleScanAssetInCampaign = (
    campaignId: string,
    scannedAssetId: string
  ) => {
    setInventories((prev) =>
      prev.map((inv) => {
        if (inv.id !== campaignId) return inv;
        if (inv.activos_escaneados_ids.includes(scannedAssetId)) return inv;
        const isExpected = inv.activos_esperados_ids.includes(scannedAssetId);
        return {
          ...inv,
          activos_escaneados_ids: [
            ...inv.activos_escaneados_ids,
            scannedAssetId,
          ],
          hallazgos_otra_ubicacion_ids: isExpected
            ? inv.hallazgos_otra_ubicacion_ids
            : [...inv.hallazgos_otra_ubicacion_ids, scannedAssetId],
        };
      })
    );
  };

  const handleCloseInventoryCampaign = (
    campaignId: string,
    observaciones: string
  ) => {
    const targetCamp = inventories.find((i) => i.id === campaignId);
    if (targetCamp) {
      SupabaseDataService.upsertInventory({
        ...targetCamp,
        estado: 'Conciliada y Cerrada',
        fecha_cierre: new Date().toISOString().slice(0, 10),
        observaciones_conciliacion: observaciones,
      });
    }

    setInventories((prev) =>
      prev.map((inv) =>
        inv.id === campaignId
          ? {
            ...inv,
            estado: 'Conciliada y Cerrada',
            fecha_cierre: new Date().toISOString().slice(0, 10),
            observaciones_conciliacion: observaciones,
          }
          : inv
      )
    );
  };

  const handleCreateIncident = (incident: AssetIncidentRecord) => {
    setIncidents((prev) => [incident, ...prev]);
    SupabaseDataService.upsertIncident(incident);
    setAssets((prev) =>
      prev.map((a) =>
        a.id === incident.activo_id
          ? { ...a, estado: incident.estado_resultante }
          : a
      )
    );
  };

  const handleResolveIncident = (incidentId: string) => {
    const target = incidents.find((i) => i.id === incidentId);
    setIncidents((prev) =>
      prev.map((i) =>
        i.id === incidentId ? { ...i, estado_gestion: 'Cerrado' } : i
      )
    );
    if (target) {
      SupabaseDataService.upsertIncident({ ...target, estado_gestion: 'Cerrado' });
      setAssets((prev) =>
        prev.map((a) =>
          a.id === target.activo_id ? { ...a, estado: 'Disponible en bodega' } : a
        )
      );
    }
  };

  // Manual Order Creation
  const handleCreateManualShipment = (e: React.FormEvent) => {
    e.preventDefault();
    const assetObj =
      assets.find((a) => a.id === newOrderAssetId) || assets[0];
    const comunaObj =
      CHILE_COMUNAS_CATALOG.find((c) => c.comuna === newOrderComuna) ||
      CHILE_COMUNAS_CATALOG[0];
    const carrierObj =
      CARRIERS.find((c) => c.id === newOrderCarrierId) || CARRIERS[0];

    const nextNum = shipments.length + 66;
    const newOrder: ShipmentOrder = {
      id: `ENV-${selectedCountry}-2026-0${nextNum}`,
      remito_numero: `REM-${selectedCountry}-2026-00${nextNum}`,
      activo_id: assetObj.id,
      qr_token: assetObj.qr_token,
      nro_cfs_movil: `CFS Móvil #${nextNum}`,
      unidad_id: newOrderUnidadId,
      estaca_distrito: newOrderEstaca,
      pais: selectedCountry,
      region: comunaObj.region,
      comuna: comunaObj.comuna,
      direccion: newOrderDireccion,
      destinatario_titular: newOrderTitular,
      rut_titular: normalizeAndValidateRut(newOrderRut).formatted,
      telefono: newOrderTelefono,
      correo: newOrderCorreo,
      transportista_id: carrierObj.id,
      transportista_nombre: carrierObj.nombre,
      origen_retiro: 'Pedro de Valdivia 1423, Providencia, Santiago',
      valor_declarado_clp: 3000000,
      peso_kg: 15,
      dimensiones: '55×35×25 cm',
      estado: 'Pendiente',
      fecha_creacion: new Date().toISOString().slice(0, 10),
      estado_revision_evidencia: 'Sin evidencia',
    };

    setShipments((prev) => [newOrder, ...prev]);
    SupabaseDataService.upsertShipment(newOrder);
    setShowNewShipmentModal(false);
    setRemitoModalShipment(newOrder);
  };

  const handleReassignCarrier = (shipmentId: string, carrierId: string) => {
    const carrier = CARRIERS.find((c) => c.id === carrierId) || CARRIERS[0];
    const target = shipments.find((s) => s.id === shipmentId);
    if (target) {
      SupabaseDataService.upsertShipment({
        ...target,
        transportista_id: carrier.id,
        transportista_nombre: carrier.nombre,
      });
    }
    setShipments((prev) =>
      prev.map((s) =>
        s.id === shipmentId
          ? {
            ...s,
            transportista_id: carrier.id,
            transportista_nombre: carrier.nombre,
          }
          : s
      )
    );
    setSelectedShipmentDetail(null);
  };

  const handleImportSnapshot = (data: PersistedDatabaseSnapshot) => {
    setUsers(data.users || INITIAL_USERS);
    setAssets(data.assets);
    setAssetTypes(data.assetTypes);
    setShipments(data.shipments);
    setMovements(data.movements);
    setAuditLogs(data.auditLogs);
    setInventories(data.inventories);
    setIncidents(data.incidents);
    setShowDbModal(false);
  };

  const handleResetFactory = () => {
    const fresh = DatabaseRepository.resetToSeedData();
    setUsers(fresh.users);
    setCurrentUserId(fresh.currentUserId || INITIAL_USERS[0].id);
    setAssets(fresh.assets);
    setAssetTypes(fresh.assetTypes);
    setShipments(fresh.shipments);
    setMovements(fresh.movements);
    setAuditLogs(fresh.auditLogs);
    setInventories(fresh.inventories);
    setIncidents(fresh.incidents);
    setShowDbModal(false);
  };

  const handleLogin = (user: UserAccount, remember: boolean) => {
    handleSelectUserAccount(user.id);
    setIsLoggedIn(true);
    if (remember) {
      localStorage.setItem('lc_auth_logged_in', 'true');
      localStorage.setItem('lc_auth_user_id', user.id);
    } else {
      sessionStorage.setItem('lc_auth_logged_in', 'true');
      sessionStorage.setItem('lc_auth_user_id', user.id);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('lc_auth_logged_in');
    localStorage.removeItem('lc_auth_user_id');
    sessionStorage.removeItem('lc_auth_logged_in');
    sessionStorage.removeItem('lc_auth_user_id');
  };

  const handleAddUser = (newUser: UserAccount) => {
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    DatabaseRepository.saveUsers(updatedUsers);
    SupabaseDataService.upsertUser(newUser);

    // Registro inmutable de auditoría forense
    const auditEntry: AuditLogEntry = {
      id: `AUD-${Date.now()}`,
      fecha_utc: new Date().toISOString(),
      usuario_id: currentUser.id,
      usuario_nombre: currentUser.nombre,
      accion: 'ALTA_USUARIO',
      entidad_afectada: 'USUARIO',
      entidad_id: newUser.id,
      detalles: {
        nombre: newUser.nombre,
        correo: newUser.correo,
        rol: newUser.rol,
        rol_etiqueta: newUser.rol_etiqueta,
        pais: newUser.pais,
        organizacion: newUser.organizacion,
        ambito: newUser.ambito,
        administrador_autorizante: currentUser.nombre,
      },
      ip_origen: '127.0.0.1',
      pais_iso: currentUser.pais,
    };
    setAuditLogs((prev) => [auditEntry, ...prev]);
  };

  const handleToggleUserStatus = (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;
    const updatedUsers = users.map((u) =>
      u.id === userId ? { ...u, activo: !u.activo } : u
    );
    setUsers(updatedUsers);
    DatabaseRepository.saveUsers(updatedUsers);
    SupabaseDataService.upsertUser({ ...targetUser, activo: !targetUser.activo });

    const auditEntry: AuditLogEntry = {
      id: `AUD-${Date.now()}`,
      fecha_utc: new Date().toISOString(),
      usuario_id: currentUser.id,
      usuario_nombre: currentUser.nombre,
      accion: targetUser.activo ? 'DESACTIVAR_USUARIO' : 'ACTIVAR_USUARIO',
      entidad_afectada: 'USUARIO',
      entidad_id: targetUser.id,
      detalles: {
        usuario_modificado: targetUser.nombre,
        estado_nuevo: !targetUser.activo ? 'ACTIVO' : 'INACTIVO',
      },
      ip_origen: '127.0.0.1',
      pais_iso: currentUser.pais,
    };
    setAuditLogs((prev) => [auditEntry, ...prev]);
  };

  const renderStateIndicator = (state: ShipmentStatus) => {
    switch (state) {
      case 'Entregado':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            Entregado
          </span>
        );
      case 'Llegué':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700">
            <span className="w-2 h-2 rounded-full bg-teal-600" />
            En Destino (Llegué)
          </span>
        );
      case 'En curso':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            En Curso (En Tránsito)
          </span>
        );
      case 'Listo para despacho':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Listo para Despacho
          </span>
        );
      case 'Pendiente':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            Pendiente en Bodega
          </span>
        );
      case 'Incidencia':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700">
            <span className="w-2 h-2 rounded-full bg-rose-600" />
            Incidencia
          </span>
        );
    }
  };

  if (!isLoggedIn) {
    return <LoginScreen users={users} onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans antialiased pb-20 md:pb-6">
      {/* =====================================================================
          HEADER DE NAVEGACIÓN EN 2 NIVELES CON FILTRADO ESTRICTO POR ROL (RBAC)
      ===================================================================== */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white border-b border-slate-800 shadow-sm">
        {/* Nivel 1: Marca, País (según ámbito del rol), Selector de Rol y Herramientas */}
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          {/* Izquierda: Botón Menú Móvil + Identidad + Selector País */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 -ml-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center shrink-0"
              aria-label="Abrir menú de navegación"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center font-bold text-white shadow-xs">
                <Truck className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <span className="font-bold text-xs sm:text-sm tracking-tight text-white block">
                  LOGISTICS CONNECT
                </span>
                <span className="text-[10px] text-slate-400 hidden sm:block">
                  Vista adaptada al rol: {currentUser.rol_etiqueta}
                </span>
              </div>
            </div>

            <div className="h-4 w-px bg-slate-800 hidden sm:block" />

            {/* Selector de País (Bloquea otros países si el rol es de ámbito nacional/local) */}
            <div className="flex items-center gap-1 bg-slate-800/90 p-0.5 rounded-md border border-slate-700/80">
              {COUNTRY_SUMMARIES.map((c) => {
                const isAllowedCountry =
                  activeRolePerms.canSwitchCountries ||
                  c.codigo === currentUser.pais;
                return (
                  <button
                    key={c.codigo}
                    disabled={!isAllowedCountry}
                    onClick={() => isAllowedCountry && setSelectedCountry(c.codigo)}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${selectedCountry === c.codigo
                        ? 'bg-blue-600 text-white cursor-pointer'
                        : isAllowedCountry
                          ? 'text-slate-400 hover:text-white cursor-pointer'
                          : 'text-slate-600 cursor-not-allowed opacity-50'
                      }`}
                    title={
                      isAllowedCountry
                        ? c.nombre
                        : `Su rol (${currentUser.rol_etiqueta}) tiene alcance exclusivo en ${currentUser.pais}`
                    }
                  >
                    {!isAllowedCountry && <Lock className="w-2.5 h-2.5" />}
                    {c.codigo}
                    <span className="hidden lg:inline"> · {c.nombre}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Derecha: Usuario/Rol Activo + Exportación Datos + Salir */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-slate-800 border border-blue-500/60 rounded-md px-2.5 py-1">
              <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <select
                value={currentUserId}
                onChange={(e) => handleSelectUserAccount(e.target.value)}
                aria-label="Cambiar cuenta o rol operativo"
                className="bg-transparent text-[11px] sm:text-xs font-semibold text-white focus:outline-none cursor-pointer max-w-[140px] sm:max-w-[250px] truncate"
              >
                {users.map((u) => (
                  <option
                    key={u.id}
                    value={u.id}
                    className="bg-slate-900 text-white"
                  >
                    {u.nombre} — {u.rol_etiqueta}
                  </option>
                ))}
              </select>
            </div>

            {currentUser.rol === 'ADMIN_REGIONAL' && (
              <button
                onClick={() => setShowUserModal(true)}
                className="px-2.5 py-1.5 rounded-md border border-rose-500/60 bg-rose-950/70 hover:bg-rose-900 text-xs font-semibold text-rose-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
                title="Gestión y Alta de Usuarios (Módulo exclusivo Administrador Regional)"
              >
                <UserPlus className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Alta Usuarios</span>
              </button>
            )}

            {activeRolePerms.canManageDb && (
              <button
                onClick={() => setShowDbModal(true)}
                className="px-2.5 py-1.5 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                title="Administración de Datos y Exportación CSV/SQL"
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Datos / SQL</span>
              </button>
            )}

            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Nivel 2: MENÚ DE INSTANCIAS AUTORIZADAS PARA EL ROL ACTIVO */}
        <div className="bg-slate-950/90 border-t border-slate-800/90">
          <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-2">
            <div
              className={`flex md:grid gap-2 overflow-x-auto no-scrollbar pb-0.5 ${allowedLogisticsStages.length === 2
                  ? 'md:grid-cols-2 max-w-2xl'
                  : allowedLogisticsStages.length === 3
                    ? 'md:grid-cols-3 max-w-4xl'
                    : allowedLogisticsStages.length === 4
                      ? 'md:grid-cols-4'
                      : 'md:grid-cols-6'
                }`}
            >
              {allowedLogisticsStages.map((stage) => {
                const Icon = stage.icon;
                const isActive = activeModule === stage.id;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => {
                      setActiveModule(stage.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`group text-left px-3 py-2 rounded-lg border transition-all shrink-0 min-w-[165px] md:min-w-0 cursor-pointer flex flex-col justify-between ${isActive
                        ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                        : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 w-full">
                      <span
                        className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${isActive ? 'text-blue-100' : 'text-blue-400'
                          }`}
                      >
                        {stage.step}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isActive
                            ? 'bg-blue-700 text-white'
                            : 'bg-slate-800 text-slate-300'
                          }`}
                      >
                        {stage.badge}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1">
                      <Icon
                        className={`w-3.5 h-3.5 shrink-0 ${isActive
                            ? 'text-white'
                            : 'text-slate-400 group-hover:text-white'
                          }`}
                      />
                      <span className="text-xs font-bold truncate">
                        {stage.title}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] truncate mt-0.5 hidden lg:block ${isActive ? 'text-blue-100' : 'text-slate-400'
                        }`}
                    >
                      {stage.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Menú Desplegable Móvil */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-t border-slate-800 px-4 py-4 space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Pantallas Habilitadas para {currentUser.rol_etiqueta}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {allowedLogisticsStages.map((stage) => {
                const Icon = stage.icon;
                const isActive = activeModule === stage.id;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => {
                      setActiveModule(stage.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full p-3 rounded-lg border text-left flex items-center justify-between ${isActive
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-slate-800/80 text-slate-200 border-slate-700'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 shrink-0" />
                      <div>
                        <div className="text-xs font-bold">{stage.title}</div>
                        <div
                          className={`text-[11px] ${isActive ? 'text-blue-100' : 'text-slate-400'
                            }`}
                        >
                          {stage.subtitle}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold">
                      {stage.badge}
                    </span>
                  </button>
                );
              })}

              {currentUser.rol === 'ADMIN_REGIONAL' && (
                <button
                  type="button"
                  onClick={() => {
                    setShowUserModal(true);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full p-3 rounded-lg border border-rose-800 bg-rose-950/70 hover:bg-rose-900/80 text-rose-200 text-left flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <UserPlus className="w-4 h-4 text-rose-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Gestión y Alta de Usuarios</div>
                      <div className="text-[11px] text-rose-300">
                        Solo perfil Administrador Regional
                      </div>
                    </div>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Banner de Permisos y Ámbito del Rol Activo */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-slate-700">
            <span className="font-mono font-bold text-blue-700 uppercase">
              [{currentUser.rol_etiqueta}]
            </span>
            <span className="font-semibold text-slate-900">
              {currentUser.nombre} ({currentUser.organizacion})
            </span>
            <span className="text-slate-300 hidden md:inline">·</span>
            <span className="text-slate-500 text-[11px] hidden md:inline">
              {activeRolePerms.description}
            </span>
          </div>

          <div className="flex items-center gap-3 text-slate-500 font-mono text-[11px]">
            <span>
              Pantallas activas:{' '}
              <strong className="text-slate-900">
                {allowedLogisticsStages.length} de 6
              </strong>
            </span>
            <span>·</span>
            <span>
              Ámbito: <strong className="text-slate-900">{currentUser.ambito}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5">
        {activeModule === 'torre_control' && (
          <>
            {/* KPI Metric Strip — 2x2 on mobile, 4 in a row on desktop */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white border border-slate-200/80 rounded-lg p-3.5 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {currentUser.rol === 'TRANSPORTISTA'
                      ? 'Mis Envíos Asignados'
                      : `Centros (${currentCountrySummary.codigo})`}
                  </span>
                  <Package className="w-4 h-4 text-blue-600 shrink-0" />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-1">
                  <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {currentUser.rol === 'TRANSPORTISTA'
                      ? visibleShipments.length
                      : currentCountrySummary.centros_totales_2026}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 tabular-nums truncate">
                    {currentUser.rol === 'TRANSPORTISTA'
                      ? currentUser.organizacion
                      : `${currentCountrySummary.notebooks_desplegados} equipos`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 hidden sm:block">
                  Maletas con 6 notebooks + 6 mouses + 6 cargadores + 1 zapatilla
                </p>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-lg p-3.5 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Entregas Listas
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-1">
                  <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {currentUser.rol === 'TRANSPORTISTA'
                      ? visibleShipments.filter((s) => s.estado === 'Entregado')
                        .length
                      : `${currentCountrySummary.centros_entregados}/${currentCountrySummary.centros_totales_2026}`}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 tabular-nums">
                    Con respaldo
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 hidden sm:block">
                  Con Remito firmado, foto de receptor y RUT verificado
                </p>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-lg p-3.5 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    En Ruta / Pendientes
                  </span>
                  <Truck className="w-4 h-4 text-amber-600 shrink-0" />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-1">
                  <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {
                      visibleShipments.filter(
                        (s) => s.estado !== 'Entregado'
                      ).length
                    }
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 truncate">
                    En seguimiento
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 hidden sm:block">
                  Despacho desde Bodega Pedro de Valdivia 1423
                </p>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-lg p-3.5 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Valor Declarado
                  </span>
                  <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-1">
                  <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    $3.0M
                  </span>
                  <span className="text-[11px] font-semibold text-blue-700">
                    CLP · 15 kg
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 hidden sm:block">
                  Dimensiones 55×35×25 cm · Sello verificado
                </p>
              </div>
            </div>

            {/* Shipments Master Container */}
            <div className="bg-white border border-slate-200/80 rounded-lg shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-blue-600 font-semibold block">
                    {currentUser.rol === 'TRANSPORTISTA'
                      ? `Envíos Asignados a ${currentUser.nombre}`
                      : `Control de Despachos · ${currentCountrySummary.nombre}`}
                  </span>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                    Órdenes de Envío, Remitos Oficiales y Estado de Entregas
                  </h2>
                </div>

                {/* Filters & Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full sm:w-60">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar estaca, comuna, activo..."
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <select
                    value={stateFilter}
                    onChange={(e) =>
                      setStateFilter(e.target.value as ShipmentStatus | 'TODOS')
                    }
                    className="flex-1 sm:flex-none px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 focus:outline-none focus:border-blue-600"
                  >
                    <option value="TODOS">Todos los estados</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Listo para despacho">Listo para despacho</option>
                    <option value="En curso">En curso</option>
                    <option value="Llegué">Llegué</option>
                    <option value="Entregado">Entregado</option>
                    <option value="Incidencia">Incidencia</option>
                  </select>

                  <button
                    onClick={() => downloadShipmentsCsv(visibleShipments)}
                    className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </button>

                  {activeRolePerms.canCreateShipment && (
                    <button
                      onClick={() => setShowNewShipmentModal(true)}
                      className="w-full sm:w-auto justify-center px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nueva Orden de Envío
                    </button>
                  )}
                </div>
              </div>

              {/* ===============================================================
                  VISTA MÓVIL DE TARJETAS OPERATIVAS (md:hidden)
              =============================================================== */}
              <div className="md:hidden divide-y divide-slate-200">
                {visibleShipments.map((sh) => {
                  const assetObj = assets.find((a) => a.id === sh.activo_id);
                  return (
                    <div key={sh.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <button
                            onClick={() =>
                              activeRolePerms.canReassignCarrier &&
                              setSelectedShipmentDetail(sh)
                            }
                            className="font-mono text-xs font-bold text-blue-600 underline"
                          >
                            {sh.activo_id} · {sh.remito_numero}
                          </button>
                          <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                            {sh.estaca_distrito}{' '}
                            <span className="font-mono text-xs font-normal text-slate-500">
                              (#{sh.unidad_id})
                            </span>
                          </h3>
                        </div>
                        <div className="text-right shrink-0">
                          {renderStateIndicator(sh.estado)}
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-200/70">
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span>
                            {sh.direccion}, <strong>{sh.comuna}</strong> ({sh.region})
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                          <span className="font-medium text-slate-800">
                            {sh.destinatario_titular}
                          </span>
                          <a
                            href={`tel:${sh.telefono}`}
                            className="font-mono text-blue-700 font-semibold inline-flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            {sh.telefono}
                          </a>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          Transporte: {sh.transportista_nombre}
                        </div>
                      </div>

                      {/* Botones de Acción Táctiles en Móvil */}
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        {assetObj && (
                          <button
                            onClick={() => setQrBatchModalAssets([assetObj])}
                            className="py-2.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            QR
                          </button>
                        )}
                        <button
                          onClick={() => setRemitoModalShipment(sh)}
                          className="py-2.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Remito
                        </button>
                        {currentUser.rol !== 'AUDITOR' ? (
                          <button
                            onClick={() => {
                              setSelectedFieldShipmentId(sh.id);
                              setActiveModule('app_terreno');
                            }}
                            className="py-2.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                          >
                            {sh.estado === 'Entregado' ? 'Ver' : 'Operar'}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="py-2.5 px-2 bg-slate-100 text-slate-500 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1">
                            <Eye className="w-3.5 h-3.5" /> Lectura
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ===============================================================
                  VISTA ESCRITORIO TABLA COMPLETA (hidden md:block)
              =============================================================== */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Envío / Remito</th>
                      <th className="py-3 px-4">Activo Contenedor</th>
                      <th className="py-3 px-4">Unidad Destinataria / Comuna</th>
                      <th className="py-3 px-4">Titular y Transportista</th>
                      <th className="py-3 px-4">Estado Operativo</th>
                      <th className="py-3 px-4">Evidencia y Conformidad</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 text-xs">
                    {visibleShipments.map((sh) => {
                      const assetObj = assets.find((a) => a.id === sh.activo_id);
                      return (
                        <tr
                          key={sh.id}
                          className="hover:bg-slate-50/90 transition-colors"
                        >
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {activeRolePerms.canReassignCarrier ? (
                              <button
                                onClick={() => setSelectedShipmentDetail(sh)}
                                className="font-mono font-bold text-blue-600 hover:underline cursor-pointer"
                              >
                                {sh.id}
                              </button>
                            ) : (
                              <span className="font-mono font-bold text-slate-900">
                                {sh.id}
                              </span>
                            )}
                            <div className="text-[11px] font-mono text-slate-500">
                              {sh.remito_numero}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-slate-900">
                              {sh.activo_id}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {sh.nro_cfs_movil} · $
                              {sh.valor_declarado_clp.toLocaleString('es-CL')}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">
                              {sh.estaca_distrito}{' '}
                              <span className="font-mono text-slate-400 font-normal">
                                (#{sh.unidad_id})
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>
                                {sh.direccion}, <strong>{sh.comuna}</strong>
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-900">
                              {sh.destinatario_titular}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              RUT {sh.rut_titular} · {sh.transportista_nombre}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {renderStateIndicator(sh.estado)}
                            {sh.llegada_hora_local && (
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5 tabular-nums">
                                Llegada: {sh.llegada_hora_local}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {sh.foto_remito_firmado && sh.foto_receptor_maleta ? (
                              <div>
                                <span
                                  className={`text-[11px] font-semibold flex items-center gap-1 ${sh.estado_revision_evidencia === 'Aprobada'
                                      ? 'text-emerald-700'
                                      : sh.estado_revision_evidencia ===
                                        'Reintento solicitado'
                                        ? 'text-rose-700'
                                        : 'text-amber-700'
                                    }`}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />2 Fotos + Firma (
                                  {sh.estado_revision_evidencia})
                                </span>
                                {sh.receptor_final && (
                                  <span className="text-[10px] text-slate-500 block">
                                    Recibió: {sh.receptor_final.nombre_completo} (
                                    {sh.receptor_final.parentesco_rol})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">
                                Pendiente cierre en destino
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {assetObj && (
                                <button
                                  onClick={() => setQrBatchModalAssets([assetObj])}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                                  title="Imprimir Etiqueta QR"
                                >
                                  <QrCode className="w-3 h-3" />
                                  QR
                                </button>
                              )}
                              <button
                                onClick={() => setRemitoModalShipment(sh)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                                title="Ver e Imprimir Remito PDF (2 Ejemplares)"
                              >
                                <Printer className="w-3 h-3" />
                                Remito
                              </button>

                              {sh.estado !== 'Entregado' &&
                                currentUser.rol !== 'AUDITOR' && (
                                  <button
                                    onClick={() => {
                                      setSelectedFieldShipmentId(sh.id);
                                      setActiveModule('app_terreno');
                                    }}
                                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-semibold transition-colors inline-flex items-center gap-0.5 cursor-pointer"
                                  >
                                    Operar
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeModule === 'activos_catalogo' && (
          <AssetsAndCatalogModule
            assets={assets}
            assetTypes={assetTypes}
            onRegisterAsset={handleRegisterAsset}
            onEditAssetWithReason={handleEditAssetWithReason}
            onDecommissionAsset={handleDecommissionAsset}
            onCreateAssetType={handleCreateAssetType}
            onOpenQrBatchModal={(selected) => setQrBatchModalAssets(selected)}
          />
        )}

        {activeModule === 'inventario_incidentes' && (
          <InventoryAndIncidentsModule
            assets={assets}
            inventories={inventories}
            incidents={incidents}
            selectedCountry={selectedCountry}
            activeUserName={currentUser.nombre}
            onStartInventoryCampaign={handleStartInventoryCampaign}
            onScanAssetInCampaign={handleScanAssetInCampaign}
            onCloseInventoryCampaign={handleCloseInventoryCampaign}
            onCreateIncident={handleCreateIncident}
            onResolveIncident={handleResolveIncident}
          />
        )}

        {activeModule === 'importador_excel' && (
          <ExcelImportModule
            rows={excelRows}
            onUpdateRow={handleUpdateExcelRow}
            onReplaceAllRows={setExcelRows}
            onAutoNormalizeAll={handleAutoNormalizeExcel}
            onCommitValidRows={handleCommitValidExcelRows}
          />
        )}

        {activeModule === 'app_terreno' && (
          <MobileFieldSimulator
            shipments={visibleShipments}
            assets={assets}
            selectedShipmentId={selectedFieldShipmentId}
            onSelectShipment={setSelectedFieldShipmentId}
            onPackContainer={handlePackContainer}
            onStartDeliveryAndRemito={handleStartDeliveryAndRemito}
            onMarkArrived={handleMarkArrived}
            onConfirmDelivery={handleConfirmDelivery}
            onReportIncident={handleReportShipmentIncident}
            onOpenRemitoModal={(sh) => setRemitoModalShipment(sh)}
          />
        )}

        {activeModule === 'trazabilidad_auditoria' && (
          <TraceabilityAndAuditModule
            shipments={shipments}
            movements={movements}
            auditLogs={auditLogs}
            userRole={currentUser.rol}
            onVerifyEvidence={handleVerifyEvidence}
            onOpenRemitoModal={(sh) => setRemitoModalShipment(sh)}
          />
        )}
      </main>

      {/* =====================================================================
          BARRA DE NAVEGACIÓN INFERIOR FIJA PARA MÓVIL (md:hidden)
          Muestra dinámicamente solo las pantallas autorizadas para el rol
      ===================================================================== */}
      <nav
        className={`md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900 border-t border-slate-800 text-white grid h-16 px-1 ${allowedLogisticsStages.length === 2
            ? 'grid-cols-2'
            : allowedLogisticsStages.length === 3
              ? 'grid-cols-3'
              : allowedLogisticsStages.length === 4
                ? 'grid-cols-4'
                : 'grid-cols-5'
          }`}
      >
        {allowedLogisticsStages.slice(0, 5).map((stage) => {
          const Icon = stage.icon;
          const isActive = activeModule === stage.id;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => {
                setActiveModule(stage.id);
                setMobileMenuOpen(false);
              }}
              className={`flex flex-col items-center justify-center gap-1 ${isActive ? 'text-blue-400 font-bold' : 'text-slate-400'
                }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] truncate max-w-[72px]">
                {stage.shortTitle}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Modal: Remito PDF (2 Ejemplares) */}
      {remitoModalShipment && (
        <RemitoPdfModal
          shipment={remitoModalShipment}
          asset={assets.find((a) => a.id === remitoModalShipment.activo_id)}
          onClose={() => setRemitoModalShipment(null)}
        />
      )}

      {/* Modal: QR Batch Print */}
      {qrBatchModalAssets && (
        <QrBatchModal
          assets={qrBatchModalAssets}
          onClose={() => setQrBatchModalAssets(null)}
        />
      )}

      {/* Modal: Shipment Detail & Carrier Reassignment */}
      {selectedShipmentDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full overflow-hidden shadow-xl">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-blue-400 block">
                  Ficha de Envío y Asignación de Transporte
                </span>
                <h3 className="text-base font-bold">
                  {selectedShipmentDetail.id} · {selectedShipmentDetail.remito_numero}
                </h3>
              </div>
              <button
                onClick={() => setSelectedShipmentDetail(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-md border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Unidad Destinataria
                  </span>
                  <span className="font-bold text-slate-900">
                    {selectedShipmentDetail.estaca_distrito}
                  </span>
                  <span className="block text-slate-600">
                    {selectedShipmentDetail.direccion}, {selectedShipmentDetail.comuna}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Destinatario Titular
                  </span>
                  <span className="font-semibold text-slate-900">
                    {selectedShipmentDetail.destinatario_titular}
                  </span>
                  <span className="block font-mono text-slate-600">
                    RUT {selectedShipmentDetail.rut_titular}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Transportista / Operador Logístico Asignado
                </label>
                <select
                  value={selectedShipmentDetail.transportista_id}
                  onChange={(e) =>
                    setSelectedShipmentDetail({
                      ...selectedShipmentDetail,
                      transportista_id: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                >
                  {CARRIERS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.empresa})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  onClick={() => setSelectedShipmentDetail(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  onClick={() =>
                    handleReassignCarrier(
                      selectedShipmentDetail.id,
                      selectedShipmentDetail.transportista_id
                    )
                  }
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md cursor-pointer"
                >
                  Guardar Transportista
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Manual Shipment */}
      {showNewShipmentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full overflow-hidden shadow-xl my-6">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-blue-400 block">
                  Emisión de Orden y Remito Oficial
                </span>
                <h3 className="text-base font-bold">Crear Nueva Orden de Envío</h3>
              </div>
              <button
                onClick={() => setShowNewShipmentModal(false)}
                className="text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleCreateManualShipment} className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Contenedor / Activo a Despachar *
                </label>
                <select
                  value={newOrderAssetId}
                  onChange={(e) => setNewOrderAssetId(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id} — {a.tipo_nombre} ({a.estado})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Estaca o Distrito Destino *
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrderEstaca}
                    onChange={(e) => setNewOrderEstaca(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    N° Unidad *
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrderUnidadId}
                    onChange={(e) => setNewOrderUnidadId(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Comuna Oficial *
                  </label>
                  <select
                    value={newOrderComuna}
                    onChange={(e) => setNewOrderComuna(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                  >
                    {CHILE_COMUNAS_CATALOG.map((c) => (
                      <option key={c.comuna} value={c.comuna}>
                        {c.comuna} ({c.region})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Dirección Exacta *
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrderDireccion}
                    onChange={(e) => setNewOrderDireccion(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Destinatario Titular *
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrderTitular}
                    onChange={(e) => setNewOrderTitular(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    RUT Titular *
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrderRut}
                    onChange={(e) => setNewOrderRut(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="text"
                    value={newOrderTelefono}
                    onChange={(e) => setNewOrderTelefono(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={newOrderCorreo}
                    onChange={(e) => setNewOrderCorreo(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Transportista Asignado *
                </label>
                <select
                  value={newOrderCarrierId}
                  onChange={(e) => setNewOrderCarrierId(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                >
                  {CARRIERS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.empresa})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewShipmentModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!normalizeAndValidateRut(newOrderRut).valid}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Emitir Envío y Remito PDF
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Database Persistence, CSV Exports & PostgreSQL DDL */}
      {showDbModal && (
        <DatabaseConfigModal
          snapshot={{
            users,
            currentUserId,
            assets,
            assetTypes,
            shipments,
            movements,
            auditLogs,
            inventories,
            incidents,
          }}
          onImportSnapshot={handleImportSnapshot}
          onResetFactory={handleResetFactory}
          onClose={() => setShowDbModal(false)}
        />
      )}

      {/* Modal: Gestión y Alta de Usuarios (Exclusivo Administrador Regional) */}
      {showUserModal && currentUser.rol === 'ADMIN_REGIONAL' && (
        <UserManagementModal
          currentUser={currentUser}
          users={users}
          onAddUser={handleAddUser}
          onToggleUserStatus={handleToggleUserStatus}
          onClose={() => setShowUserModal(false)}
        />
      )}
    </div>
  );
}

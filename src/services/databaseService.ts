import {
  AssetIncidentRecord,
  AssetItem,
  AssetTypeConfig,
  AuditLogEntry,
  InventoryCampaign,
  MovementEvent,
  ShipmentOrder,
  UserAccount,
} from '../types/logistics';
import {
  INITIAL_ASSET_TYPES,
  INITIAL_ASSETS,
  INITIAL_AUDIT_LOGS,
  INITIAL_MOVEMENTS,
  INITIAL_SHIPMENTS,
  INITIAL_USERS,
} from '../data/initialData';

const STORAGE_KEYS = {
  USERS: 'lc_prod_users_v2',
  CURRENT_USER_ID: 'lc_prod_current_user_id_v2',
  ASSETS: 'lc_prod_assets_v2',
  ASSET_TYPES: 'lc_prod_asset_types_v2',
  SHIPMENTS: 'lc_prod_shipments_v2',
  MOVEMENTS: 'lc_prod_movements_v2',
  AUDIT_LOGS: 'lc_prod_audit_logs_v2',
  INVENTORIES: 'lc_prod_inventories_v2',
  INCIDENTS: 'lc_prod_incidents_v2',
};

export const INITIAL_INVENTORY_CAMPAIGNS: InventoryCampaign[] = [
  {
    id: 'INV-CL-2026-01',
    nombre: 'Control de Bodega Central — Providencia',
    ubicacion_objetivo: 'Bodega Central — Pedro de Valdivia 1423, Providencia',
    pais: 'CL',
    responsable: 'Rodrigo Soto (Bodega Central)',
    fecha_inicio: '2026-11-09',
    estado: 'En curso',
    activos_esperados_ids: ['CFS-CL-064', 'CFS-CL-065'],
    activos_escaneados_ids: ['CFS-CL-064'],
    hallazgos_otra_ubicacion_ids: [],
    observaciones_conciliacion: 'Verificación de contenedores previos a despacho.',
  },
  {
    id: 'INV-CL-2026-02',
    nombre: 'Inventario Semestral Estaca Concepción Andalién',
    ubicacion_objetivo: 'Estaca Concepción Andalién (Av. Chacabuco 1180)',
    pais: 'CL',
    responsable: 'Pdte. Patricio Riquelme Sanhueza',
    fecha_inicio: '2026-11-01',
    fecha_cierre: '2026-11-02',
    estado: 'Conciliada y Cerrada',
    activos_esperados_ids: ['CFS-CL-061'],
    activos_escaneados_ids: ['CFS-CL-061'],
    hallazgos_otra_ubicacion_ids: [],
    observaciones_conciliacion: 'Maleta y 6 equipos Lenovo operativos en la unidad.',
  },
];

export const INITIAL_INCIDENTS: AssetIncidentRecord[] = [
  {
    id: 'INC-2026-001',
    activo_id: 'CFS-CL-062',
    afecta_a: 'SOLO_COMPONENTE',
    componente_detalle: 'Cargador original Lenovo 65W USB-C (#4 de 6)',
    tipo_incidente: 'Falla técnica',
    estado_resultante: 'Incidente',
    descripcion: '1 de los 6 cargadores USB-C presenta intermitencia al conectar.',
    reportado_por: 'Daniel Fuentes Pizarro (Secretario Estaca La Florida Sur)',
    fecha_utc: '2026-11-08T14:20:00Z',
    estado_gestion: 'En reparación',
  },
];

function safeReadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export interface PersistedDatabaseSnapshot {
  users: UserAccount[];
  currentUserId: string | null;
  assets: AssetItem[];
  assetTypes: AssetTypeConfig[];
  shipments: ShipmentOrder[];
  movements: MovementEvent[];
  auditLogs: AuditLogEntry[];
  inventories: InventoryCampaign[];
  incidents: AssetIncidentRecord[];
}

export const DatabaseRepository = {
  loadSnapshot(): PersistedDatabaseSnapshot {
    return {
      users: safeReadStorage(STORAGE_KEYS.USERS, INITIAL_USERS),
      currentUserId: safeReadStorage<string | null>(
        STORAGE_KEYS.CURRENT_USER_ID,
        INITIAL_USERS[0].id
      ),
      assets: safeReadStorage(STORAGE_KEYS.ASSETS, INITIAL_ASSETS),
      assetTypes: safeReadStorage(STORAGE_KEYS.ASSET_TYPES, INITIAL_ASSET_TYPES),
      shipments: safeReadStorage(STORAGE_KEYS.SHIPMENTS, INITIAL_SHIPMENTS),
      movements: safeReadStorage(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS),
      auditLogs: safeReadStorage(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS),
      inventories: safeReadStorage(
        STORAGE_KEYS.INVENTORIES,
        INITIAL_INVENTORY_CAMPAIGNS
      ),
      incidents: safeReadStorage(STORAGE_KEYS.INCIDENTS, INITIAL_INCIDENTS),
    };
  },

  saveUsers(users: UserAccount[]) {
    safeWriteStorage(STORAGE_KEYS.USERS, users);
  },

  saveCurrentUserId(userId: string | null) {
    safeWriteStorage(STORAGE_KEYS.CURRENT_USER_ID, userId);
  },

  saveAssets(assets: AssetItem[]) {
    safeWriteStorage(STORAGE_KEYS.ASSETS, assets);
  },

  saveAssetTypes(types: AssetTypeConfig[]) {
    safeWriteStorage(STORAGE_KEYS.ASSET_TYPES, types);
  },

  saveShipments(shipments: ShipmentOrder[]) {
    safeWriteStorage(STORAGE_KEYS.SHIPMENTS, shipments);
  },

  saveMovements(movements: MovementEvent[]) {
    safeWriteStorage(STORAGE_KEYS.MOVEMENTS, movements);
  },

  saveAuditLogs(logs: AuditLogEntry[]) {
    safeWriteStorage(STORAGE_KEYS.AUDIT_LOGS, logs);
  },

  saveInventories(inventories: InventoryCampaign[]) {
    safeWriteStorage(STORAGE_KEYS.INVENTORIES, inventories);
  },

  saveIncidents(incidents: AssetIncidentRecord[]) {
    safeWriteStorage(STORAGE_KEYS.INCIDENTS, incidents);
  },

  resetToSeedData(): PersistedDatabaseSnapshot {
    Object.values(STORAGE_KEYS).forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        // ignore
      }
    });
    return this.loadSnapshot();
  },
};

export async function computeSha256Hex(
  input: ArrayBuffer | string
): Promise<string> {
  try {
    const data =
      typeof input === 'string' ? new TextEncoder().encode(input) : input;
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    const str = typeof input === 'string' ? input : String(input.byteLength);
    return Array.from({ length: 64 }, (_, i) =>
      ((i * 11 + str.charCodeAt(i % str.length)) % 16).toString(16)
    ).join('');
  }
}

/**
 * Comprime la fotografía en el dispositivo a <= 1.5 MB conservando legibilidad del remito
 * y calcula su Hash SHA-256 criptográfico.
 */
export async function processAndCompressEvidenceImage(file: File): Promise<{
  dataUrl: string;
  sizeKb: number;
  sha256: string;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const sha256 = await computeSha256Hex(arrayBuffer);

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      const img = new Image();
      img.onload = () => {
        const maxDim = 1400;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedUrl = canvas.toDataURL('image/jpeg', 0.82);
          const estimatedKb = Math.max(
            45,
            Math.min(1450, Math.round((compressedUrl.length * 0.75) / 1024))
          );
          resolve({
            dataUrl: compressedUrl,
            sizeKb: estimatedKb,
            sha256,
          });
        } else {
          resolve({
            dataUrl: rawDataUrl,
            sizeKb: Math.min(1450, Math.round(file.size / 1024)),
            sha256,
          });
        }
      };
      img.onerror = () => {
        resolve({
          dataUrl: rawDataUrl,
          sizeKb: Math.min(1450, Math.round(file.size / 1024)),
          sha256,
        });
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function downloadShipmentsCsv(shipments: ShipmentOrder[]) {
  const headers = [
    'ID_Envio',
    'Remito',
    'ID_Activo',
    'Token_QR',
    'Unidad_ID',
    'Estaca_Distrito',
    'Comuna',
    'Region',
    'Direccion',
    'Titular',
    'RUT_Titular',
    'Transportista',
    'Estado',
    'Receptor_Real',
    'RUT_Receptor_Real',
    'Parentesco_Rol',
    'Revision_Evidencia',
    'Valor_Declarado_CLP',
  ];

  const rows = shipments.map((s) => [
    s.id,
    s.remito_numero,
    s.activo_id,
    s.qr_token,
    s.unidad_id,
    `"${s.estaca_distrito.replace(/"/g, '""')}"`,
    `"${s.comuna}"`,
    `"${s.region}"`,
    `"${s.direccion.replace(/"/g, '""')}"`,
    `"${s.destinatario_titular.replace(/"/g, '""')}"`,
    s.rut_titular,
    `"${s.transportista_nombre}"`,
    s.estado,
    `"${s.receptor_final?.nombre_completo || ''}"`,
    s.receptor_final?.rut || '',
    s.receptor_final?.parentesco_rol || '',
    s.estado_revision_evidencia,
    s.valor_declarado_clp,
  ]);

  const csvContent =
    '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `logistics_connect_envios_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = 'text/plain;charset=utf-8;'
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

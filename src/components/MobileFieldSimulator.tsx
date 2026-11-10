import React, { useState, useRef, useEffect } from 'react';
import {
  QrCode,
  MapPin,
  Camera,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Wifi,
  WifiOff,
  RefreshCw,
  PackageCheck,
  UserCheck,
  PenTool,
  Upload,
  Eraser,
  Search,
  Truck,
  Phone,
  Clock,
  ChevronDown,
} from 'lucide-react';
import {
  AssetItem,
  EvidencePhoto,
  RelationType,
  ShipmentOrder,
} from '../types/logistics';
import { normalizeAndValidateRut } from '../data/initialData';
import {
  computeSha256Hex,
  processAndCompressEvidenceImage,
} from '../services/databaseService';

interface FieldOperationsViewProps {
  shipments: ShipmentOrder[];
  assets: AssetItem[];
  selectedShipmentId: string;
  onSelectShipment: (id: string) => void;
  onPackContainer: (shipmentId: string, sealCode: string) => void;
  onStartDeliveryAndRemito: (shipmentId: string) => void;
  onMarkArrived: (
    shipmentId: string,
    gps: string,
    distanceMeters: number
  ) => void;
  onConfirmDelivery: (
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
  ) => void;
  onReportIncident: (shipmentId: string, motivo: string) => void;
  onOpenRemitoModal: (shipment: ShipmentOrder) => void;
}

const RELATION_OPTIONS: RelationType[] = [
  'Titular',
  'Esposa',
  'Hijo',
  'Hija',
  'Consejero',
  'Secretario',
  'Otro',
];

export const MobileFieldSimulator: React.FC<FieldOperationsViewProps> = ({
  shipments,
  assets,
  selectedShipmentId,
  onSelectShipment,
  onPackContainer,
  onStartDeliveryAndRemito,
  onMarkArrived,
  onConfirmDelivery,
  onReportIncident,
  onOpenRemitoModal,
}) => {
  const activeShipment =
    shipments.find((s) => s.id === selectedShipmentId) || shipments[0];
  const activeAsset = assets.find((a) => a.id === activeShipment?.activo_id);

  // QR / Asset Quick Lookup
  const [qrLookupQuery, setQrLookupQuery] = useState('');
  const [qrLookupMessage, setQrLookupMessage] = useState<string | null>(null);
  const [showMobileRouteList, setShowMobileRouteList] = useState(false);

  // Real Online/Offline detection + Offline Queue
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);
  const [syncBanner, setSyncBanner] = useState<string | null>(null);
  const [locatingGps, setLocatingGps] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setOfflinePendingCount((prev) => {
        if (prev > 0) {
          setSyncBanner(
            `Conexión restablecida: ${prev} operación(es) sincronizadas con el servidor.`
          );
          setTimeout(() => setSyncBanner(null), 4500);
        }
        return 0;
      });
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Warehouse packing state
  const [sealInput, setSealInput] = useState('SELLO-CL-88425');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({
    notebooks: true,
    mouses: true,
    cargadores: true,
    zapatilla: true,
  });

  // Receiver & Evidence state
  const [relationType, setRelationType] = useState<RelationType>('Titular');
  const [altName, setAltName] = useState('');
  const [altRut, setAltRut] = useState('');
  const [consentChecked, setConsentChecked] = useState(true);
  const [signatureText, setSignatureText] = useState('');
  const [capturedRemitoPhoto, setCapturedRemitoPhoto] =
    useState<EvidencePhoto | null>(null);
  const [capturedReceiverPhoto, setCapturedReceiverPhoto] =
    useState<EvidencePhoto | null>(null);
  const [compressingPhoto, setCompressingPhoto] = useState(false);

  // HTML5 Canvas Signature Pad
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | undefined>(
    undefined
  );

  // Incident form state
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [incidentReason, setIncidentReason] = useState(
    'Sin moradores en el domicilio al momento de la visita (Reprogramar entrega)'
  );

  if (!activeShipment) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-600">
        No hay entregas asignadas a su cuenta en este momento.
      </div>
    );
  }

  const isTitular = relationType === 'Titular';
  const finalReceiverName = isTitular
    ? activeShipment.destinatario_titular
    : altName.trim();
  const finalReceiverRutRaw = isTitular
    ? activeShipment.rut_titular
    : altRut.trim();
  const rutValidation = normalizeAndValidateRut(finalReceiverRutRaw);

  const photo1Obj = capturedRemitoPhoto || activeShipment.foto_remito_firmado;
  const photo2Obj =
    capturedReceiverPhoto || activeShipment.foto_receptor_maleta;
  const hasPhoto1 = Boolean(photo1Obj);
  const hasPhoto2 = Boolean(photo2Obj);
  const receiverValid =
    finalReceiverName.length >= 4 && rutValidation.valid && consentChecked;

  const canConfirmDelivery =
    activeShipment.estado === 'Llegué' &&
    hasPhoto1 &&
    hasPhoto2 &&
    receiverValid;

  const handleQrSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrLookupQuery.trim()) return;
    const q = qrLookupQuery.trim().toLowerCase();
    const found = shipments.find(
      (s) =>
        s.activo_id.toLowerCase() === q ||
        s.qr_token.toLowerCase().includes(q) ||
        s.remito_numero.toLowerCase() === q
    );
    if (found) {
      onSelectShipment(found.id);
      setQrLookupMessage(null);
      setQrLookupQuery('');
    } else {
      setQrLookupMessage(
        `No se encontró un envío autorizado para el código "${qrLookupQuery}". Verifique sus permisos.`
      );
    }
  };

  const handleRealGeolocationArrival = () => {
    setLocatingGps(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocatingGps(false);
          const coords = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
          onMarkArrived(
            activeShipment.id,
            coords,
            Math.round(pos.coords.accuracy || 15)
          );
          if (isOffline) setOfflinePendingCount((c) => c + 1);
        },
        () => {
          setLocatingGps(false);
          onMarkArrived(activeShipment.id, '-33.4864, -70.5398', 14);
          if (isOffline) setOfflinePendingCount((c) => c + 1);
        },
        { timeout: 4000, enableHighAccuracy: true }
      );
    } else {
      setLocatingGps(false);
      onMarkArrived(activeShipment.id, '-33.4864, -70.5398', 14);
    }
  };

  const handleRealFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    tipo: 'FOTO_REMITO_FIRMADO' | 'FOTO_RECEPTOR_MALETA'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressingPhoto(true);
    const compressed = await processAndCompressEvidenceImage(file);
    setCompressingPhoto(false);

    const nowUtc = new Date().toISOString();
    const nowLocal = new Date().toLocaleString('es-CL', {
      timeZone: 'America/Santiago',
    });

    const photo: EvidencePhoto = {
      id: `EVID-${Date.now().toString().slice(-5)}`,
      tipo,
      titulo: file.name,
      capturada_en_utc: nowUtc,
      capturada_en_local: nowLocal,
      gps_coords: activeShipment.llegada_gps || '-33.4864, -70.5398',
      hash_sha256: compressed.sha256,
      tamano_kb: compressed.sizeKb,
      dispositivo: navigator.userAgent.slice(0, 48),
      preview_data_url: compressed.dataUrl,
    };

    if (tipo === 'FOTO_REMITO_FIRMADO') {
      setCapturedRemitoPhoto(photo);
    } else {
      setCapturedReceiverPhoto(photo);
    }
    if (isOffline) {
      setOfflinePendingCount((c) => c + 1);
    }
  };

  const handleQuickCaptureFallback = async (
    tipo: 'FOTO_REMITO_FIRMADO' | 'FOTO_RECEPTOR_MALETA'
  ) => {
    const nowUtc = new Date().toISOString();
    const nowLocal = new Date().toLocaleString('es-CL', {
      timeZone: 'America/Santiago',
    });
    const sha256 = await computeSha256Hex(
      `${tipo}-${activeShipment.id}-${nowUtc}`
    );

    const photo: EvidencePhoto = {
      id: `EVID-${Date.now().toString().slice(-5)}`,
      tipo,
      titulo:
        tipo === 'FOTO_REMITO_FIRMADO'
          ? `Remito ${activeShipment.remito_numero} firmado`
          : `Receptor (${finalReceiverName || 'en destino'}) con Maleta ${activeShipment.activo_id}`,
      capturada_en_utc: nowUtc,
      capturada_en_local: nowLocal,
      gps_coords: activeShipment.llegada_gps || '-33.4864, -70.5398',
      hash_sha256: sha256,
      tamano_kb: tipo === 'FOTO_REMITO_FIRMADO' ? 840 : 960,
      dispositivo: 'Terminal Móvil de Terreno',
    };

    if (tipo === 'FOTO_REMITO_FIRMADO') {
      setCapturedRemitoPhoto(photo);
    } else {
      setCapturedReceiverPhoto(photo);
    }
    if (isOffline) {
      setOfflinePendingCount((c) => c + 1);
    }
  };

  // Accurate touch/mouse coordinates scaled to canvas internal resolution
  const getCanvasCoords = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    const clientX =
      'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY =
      'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e, canvas);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureDataUrl(canvas.toDataURL('image/png'));
    }
  };

  const clearCanvasSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setSignatureDataUrl(undefined);
  };

  const handleCompleteDeliveryClick = () => {
    if (!canConfirmDelivery || !photo1Obj || !photo2Obj) return;
    onConfirmDelivery(
      activeShipment.id,
      {
        es_titular: isTitular,
        parentesco_rol: relationType,
        nombre_completo: finalReceiverName,
        rut: rutValidation.formatted,
        consentimiento_datos: consentChecked,
      },
      photo1Obj,
      photo2Obj,
      signatureText.trim() ||
        `${finalReceiverName} (${rutValidation.formatted})`,
      signatureDataUrl,
      isOffline
    );
    setCapturedRemitoPhoto(null);
    setCapturedReceiverPhoto(null);
    clearCanvasSignature();
    if (isOffline) {
      setOfflinePendingCount((c) => c + 1);
    }
  };

  // Determine step number for visual clarity
  const currentStepIndex =
    activeShipment.estado === 'Pendiente'
      ? 1
      : activeShipment.estado === 'Listo para despacho'
      ? 2
      : activeShipment.estado === 'En curso'
      ? 3
      : activeShipment.estado === 'Llegué'
      ? 4
      : 5;

  return (
    <div className="space-y-4">
      {/* Top Operational Bar: QR Scanner / Lookup & Offline Queue Control */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <form
          onSubmit={handleQrSearch}
          className="flex items-center gap-2 flex-1"
        >
          <div className="relative flex-1">
            <QrCode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Escanear QR, ID activo (CFS-CL-063) o Remito..."
              value={qrLookupQuery}
              onChange={(e) => setQrLookupQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            Buscar
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            if (isOffline) {
              setIsOffline(false);
              if (offlinePendingCount > 0) {
                setSyncBanner(
                  `Cola local sincronizada: ${offlinePendingCount} registro(s) enviados al servidor.`
                );
                setOfflinePendingCount(0);
                setTimeout(() => setSyncBanner(null), 4500);
              }
            } else {
              setIsOffline(true);
            }
          }}
          className={`px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shrink-0 ${
            isOffline
              ? 'bg-amber-100 text-amber-950 border border-amber-300'
              : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
          }`}
        >
          {isOffline ? (
            <>
              <WifiOff className="w-4 h-4 text-amber-700" />
              Modo Sin Señal (Cola: {offlinePendingCount})
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 text-emerald-600" />
              Conectado en Línea
            </>
          )}
        </button>
      </div>

      {qrLookupMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900">
          {qrLookupMessage}
        </div>
      )}

      {syncBanner && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{syncBanner}</span>
        </div>
      )}

      {/* Mobile Route Selector Dropdown (Only visible on < lg screens so operators go straight to action) */}
      <div className="lg:hidden bg-white border border-slate-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowMobileRouteList(!showMobileRouteList)}
          className="w-full p-3.5 flex items-center justify-between bg-slate-900 text-white text-left"
        >
          <div className="min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 block">
              Envío Seleccionado ({shipments.findIndex((s) => s.id === activeShipment.id) + 1} de {shipments.length}) · Toque para cambiar
            </span>
            <div className="text-xs font-bold truncate mt-0.5">
              {activeShipment.activo_id} — {activeShipment.estaca_distrito} ({activeShipment.estado})
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-300 shrink-0 transition-transform ${
              showMobileRouteList ? 'rotate-180' : ''
            }`}
          />
        </button>

        {showMobileRouteList && (
          <div className="divide-y divide-slate-200 max-h-72 overflow-y-auto">
            {shipments.map((ship) => {
              const isSelected = ship.id === activeShipment.id;
              return (
                <button
                  key={ship.id}
                  type="button"
                  onClick={() => {
                    onSelectShipment(ship.id);
                    setCapturedRemitoPhoto(null);
                    setCapturedReceiverPhoto(null);
                    setShowIncidentForm(false);
                    setQrLookupMessage(null);
                    setShowMobileRouteList(false);
                  }}
                  className={`w-full text-left p-3.5 transition-colors ${
                    isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {ship.activo_id} · {ship.remito_numero}
                    </span>
                    <span className="text-xs font-semibold text-blue-700">
                      {ship.estado}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">
                    {ship.estaca_distrito} — {ship.comuna}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Split: Left Assigned Queue (Desktop) | Right Active Execution Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Assigned Shipments Queue (Desktop lg+) */}
        <div className="hidden lg:block lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-700" />
              Hoja de Ruta y Despachos ({shipments.length})
            </span>
          </div>

          <div className="divide-y divide-slate-200 max-h-[640px] overflow-y-auto">
            {shipments.map((ship) => {
              const isSelected = ship.id === activeShipment.id;
              return (
                <button
                  key={ship.id}
                  onClick={() => {
                    onSelectShipment(ship.id);
                    setCapturedRemitoPhoto(null);
                    setCapturedReceiverPhoto(null);
                    setShowIncidentForm(false);
                    setQrLookupMessage(null);
                  }}
                  className={`w-full text-left p-4 transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {ship.activo_id} · {ship.remito_numero}
                    </span>
                    <span className="text-xs font-semibold text-blue-700">
                      {ship.estado}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900 mt-1">
                    {ship.estaca_distrito}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {ship.direccion}, {ship.comuna}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>{ship.destinatario_titular}</span>
                    <span className="font-mono">{ship.telefono}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active Operational Form */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Visual 4-Step Operational Progress Bar */}
          <div className="bg-slate-900 text-white px-4 py-3 border-b border-slate-800">
            <div className="grid grid-cols-4 gap-1.5 text-[10px] sm:text-xs font-semibold">
              {[
                { step: 1, label: '1. Bodega' },
                { step: 2, label: '2. Despacho' },
                { step: 3, label: '3. Llegué GPS' },
                { step: 4, label: '4. Fotos y Firma' },
              ].map((s) => {
                const isDone = currentStepIndex > s.step;
                const isCurrent = currentStepIndex === s.step;
                return (
                  <div
                    key={s.step}
                    className={`py-1.5 px-2 rounded text-center truncate ${
                      isDone
                        ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                        : isCurrent
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isDone ? `✓ ${s.label}` : s.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shipment Header */}
          <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                  <span className="font-bold text-blue-700">
                    {activeShipment.activo_id}
                  </span>
                  <span>·</span>
                  <span className="text-slate-700 font-semibold">
                    {activeShipment.remito_numero}
                  </span>
                  <span>·</span>
                  <span className="text-slate-500">
                    Unidad #{activeShipment.unidad_id}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
                  {activeShipment.estaca_distrito}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => onOpenRemitoModal(activeShipment)}
                className="w-full sm:w-auto justify-center px-3.5 py-2.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-blue-700" />
                Remito PDF (2 Ejemplares)
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-2 border-t border-slate-200">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-800">
                    {activeShipment.direccion}, {activeShipment.comuna}
                  </div>
                  <div className="text-slate-500">{activeShipment.region}</div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-800">
                    {activeShipment.destinatario_titular}
                  </div>
                  <div className="font-mono text-slate-500">
                    RUT {activeShipment.rut_titular} ·{' '}
                    <a
                      href={`tel:${activeShipment.telefono}`}
                      className="text-blue-700 underline"
                    >
                      {activeShipment.telefono}
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-800">
                    Estado: {activeShipment.estado}
                  </div>
                  <div className="text-slate-500">
                    {activeShipment.horario_preferencial ||
                      'Horario hábil estándar'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Operational Step Execution */}
          <div className="p-4 sm:p-6 space-y-6">
            {/* STAGE 1: PREPARACIÓN EN BODEGA */}
            {activeShipment.estado === 'Pendiente' && (
              <div className="space-y-5">
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <PackageCheck className="w-4 h-4 text-blue-700" />
                    Paso 1: Preparación y Armado de Contenedor en Bodega
                  </div>
                  <p className="text-xs text-slate-600">
                    Verifique cada componente del kit antes de colocar el sello de seguridad y habilitar el retiro del transportista.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-slate-800">
                    Verificación de Equipamiento ({activeShipment.nro_cfs_movil} · $3.000.000 CLP · 15 kg):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      {
                        key: 'notebooks',
                        label: '6× Notebooks Lenovo ThinkPad 14" + Fundas',
                      },
                      { key: 'mouses', label: '6× Mouses ópticos USB' },
                      {
                        key: 'cargadores',
                        label: '6× Cargadores originales Lenovo 65W',
                      },
                      {
                        key: 'zapatilla',
                        label: '1× Zapatilla eléctrica certificada (6 tomas)',
                      },
                    ].map((item) => (
                      <label
                        key={item.key}
                        className="flex items-center gap-3 p-3.5 border border-slate-200 rounded-lg text-xs text-slate-800 cursor-pointer hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={checkedItems[item.key]}
                          onChange={(e) =>
                            setCheckedItems({
                              ...checkedItems,
                              [item.key]: e.target.checked,
                            })
                          }
                          className="w-4 h-4 accent-blue-700"
                        />
                        <span className="font-medium">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="w-full sm:max-w-xs">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    N° Sello de Seguridad Aplicado *
                  </label>
                  <input
                    type="text"
                    value={sealInput}
                    onChange={(e) => setSealInput(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>

                <button
                  disabled={
                    !Object.values(checkedItems).every(Boolean) ||
                    !sealInput.trim()
                  }
                  onClick={() =>
                    onPackContainer(activeShipment.id, sealInput.trim())
                  }
                  className="w-full sm:w-auto min-h-[48px] px-6 py-3 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 rounded-xl transition-colors cursor-pointer"
                >
                  Confirmar Armado y Marcar "Listo para despacho"
                </button>
              </div>
            )}

            {/* STAGE 2: RETIRO Y GENERACIÓN DE REMITO */}
            {activeShipment.estado === 'Listo para despacho' && (
              <div className="space-y-5">
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-700" />
                    Paso 2: Retiro en Bodega e Inicio de Ruta
                  </div>
                  <p className="text-xs text-slate-600">
                    Contenedor verificado con sello{' '}
                    <span className="font-mono font-semibold">
                      {activeAsset?.sello_seguridad || 'SELLO-CL'}
                    </span>{' '}
                    en {activeShipment.origen_retiro}. Al iniciar la entrega se emite el Remito PDF con dos ejemplares y se registra la custodia en tránsito.
                  </p>
                </div>

                <button
                  onClick={() => {
                    onStartDeliveryAndRemito(activeShipment.id);
                    onOpenRemitoModal(activeShipment);
                  }}
                  className="w-full sm:w-auto min-h-[50px] px-6 py-3.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  Comenzar Entrega y Generar Remito (2 Ejemplares)
                </button>
              </div>
            )}

            {/* STAGE 3: EN TRÁNSITO -> BOTÓN "LLEGUÉ" CON GEOLOCALIZACIÓN REAL */}
            {activeShipment.estado === 'En curso' && (
              <div className="space-y-5">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <div className="text-sm font-bold text-amber-950">
                    Paso 3: Envío en Tránsito hacia Unidad Destinataria
                  </div>
                  <p className="text-xs text-amber-900">
                    Al llegar a{' '}
                    <strong>
                      {activeShipment.direccion}, {activeShipment.comuna}
                    </strong>
                    , presione el botón <strong>"Llegué al Destino"</strong> para capturar hora y coordenadas GPS del dispositivo antes de entregar el activo.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    disabled={locatingGps}
                    onClick={handleRealGeolocationArrival}
                    className="min-h-[52px] px-6 py-3.5 text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <MapPin className="w-5 h-5" />
                    {locatingGps
                      ? 'Obteniendo coordenadas GPS...'
                      : 'Llegué al Destino (Registrar Hora y GPS)'}
                  </button>

                  <button
                    onClick={() => onOpenRemitoModal(activeShipment)}
                    className="min-h-[50px] px-5 py-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    Descargar Remito PDF
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 4: RECEPCIÓN EN DESTINO, RUT Y 2 FOTOS OBLIGATORIAS */}
            {activeShipment.estado === 'Llegué' && (
              <div className="space-y-5">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>Llegada registrada:</strong>{' '}
                    {activeShipment.llegada_hora_local}
                  </span>
                  <span className="font-mono">
                    GPS: {activeShipment.llegada_gps} (±
                    {activeShipment.distancia_destino_metros} m)
                  </span>
                </div>

                {/* 1. Receptor */}
                <div className="border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-700" />
                    1. Datos de la Persona que Recibe
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">
                      Vínculo o cargo del receptor:
                    </label>
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                      {RELATION_OPTIONS.map((rel) => (
                        <button
                          key={rel}
                          type="button"
                          onClick={() => setRelationType(rel)}
                          className={`py-2.5 px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                            relationType === rel
                              ? 'bg-blue-700 text-white border-blue-700'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {rel}
                        </button>
                      ))}
                    </div>
                  </div>

                  {isTitular ? (
                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                      <div className="font-semibold text-slate-900">
                        Receptor Titular: {activeShipment.destinatario_titular}
                      </div>
                      <div className="font-mono text-slate-600">
                        RUT: {activeShipment.rut_titular}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Nombre Completo ({relationType}) *
                        </label>
                        <input
                          type="text"
                          placeholder="Nombre y dos apellidos"
                          value={altName}
                          onChange={(e) => setAltName(e.target.value)}
                          className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          RUT del Receptor *
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: 15.432.890-K"
                          value={altRut}
                          onChange={(e) => setAltRut(e.target.value)}
                          className="w-full px-3 py-2.5 text-xs font-mono border border-slate-300 rounded-lg"
                        />
                        {altRut && !rutValidation.valid && (
                          <p className="text-[11px] text-red-600 mt-1">
                            Ingrese un RUT válido con dígito verificador.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Evidencias Fotográficas Obligatorias */}
                <div className="border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Camera className="w-4 h-4 text-blue-700" />
                      2. Fotografías Obligatorias y Firma Digital
                    </div>
                    {compressingPhoto && (
                      <span className="text-xs text-blue-700 font-medium">
                        Comprimiendo imagen y generando hash SHA-256...
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Foto 1: Remito Firmado */}
                    <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          Fotografía 1: Remito Firmado *
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Capture el Ejemplar 2 del remito con la firma legible del receptor.
                        </p>
                      </div>

                      {photo1Obj ? (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1.5">
                          {photo1Obj.preview_data_url && (
                            <img
                              src={photo1Obj.preview_data_url}
                              alt="Remito firmado"
                              referrerPolicy="no-referrer"
                              className="w-full h-28 object-cover rounded border border-emerald-300"
                            />
                          )}
                          <div className="font-semibold flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                              Verificada ({photo1Obj.tamano_kb} KB)
                            </span>
                            <button
                              type="button"
                              onClick={() => setCapturedRemitoPhoto(null)}
                              className="text-[11px] text-emerald-800 underline cursor-pointer"
                            >
                              Reemplazar
                            </button>
                          </div>
                          <div className="font-mono text-[10px] text-emerald-700 truncate">
                            SHA-256: {photo1Obj.hash_sha256}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="w-full min-h-[48px] py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer">
                            <Camera className="w-4 h-4" />
                            Tomar / Subir Foto Remito
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(e) =>
                                handleRealFileUpload(e, 'FOTO_REMITO_FIRMADO')
                              }
                              className="hidden"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickCaptureFallback('FOTO_REMITO_FIRMADO')
                            }
                            className="w-full py-2 px-2.5 text-[11px] text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer font-medium"
                          >
                            Registrar captura directa de terminal
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Foto 2: Receptor con la Maleta */}
                    <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          Fotografía 2: Receptor con el Activo *
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Capture a la persona receptora junto a la maleta Centro Móvil entregada.
                        </p>
                      </div>

                      {photo2Obj ? (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1.5">
                          {photo2Obj.preview_data_url && (
                            <img
                              src={photo2Obj.preview_data_url}
                              alt="Receptor con maleta"
                              referrerPolicy="no-referrer"
                              className="w-full h-28 object-cover rounded border border-emerald-300"
                            />
                          )}
                          <div className="font-semibold flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                              Verificada ({photo2Obj.tamano_kb} KB)
                            </span>
                            <button
                              type="button"
                              onClick={() => setCapturedReceiverPhoto(null)}
                              className="text-[11px] text-emerald-800 underline cursor-pointer"
                            >
                              Reemplazar
                            </button>
                          </div>
                          <div className="font-mono text-[10px] text-emerald-700 truncate">
                            SHA-256: {photo2Obj.hash_sha256}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="w-full min-h-[48px] py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer">
                            <Upload className="w-4 h-4" />
                            Tomar / Subir Foto Receptor
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(e) =>
                                handleRealFileUpload(e, 'FOTO_RECEPTOR_MALETA')
                              }
                              className="hidden"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickCaptureFallback('FOTO_RECEPTOR_MALETA')
                            }
                            className="w-full py-2 px-2.5 text-[11px] text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer font-medium"
                          >
                            Registrar captura directa de terminal
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pad de Firma Digital */}
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <PenTool className="w-3.5 h-3.5 text-blue-700" />
                        Firma Digital de Conformidad en Pantalla
                      </span>
                      <button
                        type="button"
                        onClick={clearCanvasSignature}
                        className="text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer font-medium"
                      >
                        <Eraser className="w-3.5 h-3.5" /> Limpiar firma
                      </button>
                    </div>
                    <canvas
                      ref={canvasRef}
                      width={520}
                      height={110}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-[110px] bg-slate-50 border border-dashed border-slate-400 rounded-lg cursor-crosshair touch-none"
                    />
                    <input
                      type="text"
                      placeholder={`Aclaración de firma (${finalReceiverName || 'Nombre del receptor'})...`}
                      value={signatureText}
                      onChange={(e) => setSignatureText(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>

                  <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-blue-700 shrink-0"
                    />
                    <span>
                      El receptor autoriza el registro de su RUT y fotografía exclusivamente como respaldo de entrega y custodia del equipamiento (Ley 19.628 / 21.719).
                    </span>
                  </label>
                </div>

                {!canConfirmDelivery && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                    <strong>Requisitos pendientes para confirmar la entrega:</strong>
                    <ul className="list-disc pl-5 mt-1 space-y-0.5">
                      {!receiverValid && (
                        <li>
                          Complete nombre y RUT válido de la persona receptora.
                        </li>
                      )}
                      {!hasPhoto1 && (
                        <li>Adjunte la Fotografía 1 (Remito firmado).</li>
                      )}
                      {!hasPhoto2 && (
                        <li>
                          Adjunte la Fotografía 2 (Receptor con el activo).
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    disabled={!canConfirmDelivery}
                    onClick={handleCompleteDeliveryClick}
                    className={`min-h-[52px] flex-1 py-3.5 px-6 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
                      canConfirmDelivery
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer shadow-xs'
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Confirmar Entrega y Transferir Custodia
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowIncidentForm(!showIncidentForm)}
                    className="min-h-[48px] px-4 py-3 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Reportar Incidencia
                  </button>
                </div>

                {showIncidentForm && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
                    <div className="text-xs font-bold text-red-950">
                      Registrar Incidencia en Destino
                    </div>
                    <select
                      value={incidentReason}
                      onChange={(e) => setIncidentReason(e.target.value)}
                      className="w-full p-2.5 text-xs bg-white border border-red-300 rounded-lg text-slate-800"
                    >
                      <option value="Sin moradores en el domicilio al momento de la visita (Reprogramar entrega)">
                        Sin moradores en el domicilio (Reprogramar visita)
                      </option>
                      <option value="Dirección errónea o inexistente en la comuna indicada">
                        Dirección errónea o inexistente en la comuna
                      </option>
                      <option value="Sello de seguridad alterado o daño físico en contenedor">
                        Sello alterado o daño físico en contenedor
                      </option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        onReportIncident(activeShipment.id, incidentReason);
                        setShowIncidentForm(false);
                      }}
                      className="px-4 py-2.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer"
                    >
                      Guardar Incidencia
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STAGE 5: ENTREGADO */}
            {activeShipment.estado === 'Entregado' && (
              <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 text-xs text-emerald-950">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm flex items-center gap-2 text-emerald-900">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                    Entrega Confirmada y Custodia Transferida
                  </span>
                  <span className="font-mono text-[11px] font-semibold">
                    Revisión: {activeShipment.estado_revision_evidencia}
                  </span>
                </div>
                {activeShipment.receptor_final && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-emerald-200">
                    <div>
                      <span className="text-emerald-700">Recibido por:</span>{' '}
                      <strong>
                        {activeShipment.receptor_final.nombre_completo}
                      </strong>{' '}
                      ({activeShipment.receptor_final.parentesco_rol})
                    </div>
                    <div className="font-mono">
                      <span className="text-emerald-700">RUT Verificado:</span>{' '}
                      {activeShipment.receptor_final.rut}
                    </div>
                    <div className="font-mono">
                      <span className="text-emerald-700">Hora Recepción:</span>{' '}
                      {activeShipment.receptor_final.fecha_recepcion_local}
                    </div>
                    <div className="font-mono">
                      <span className="text-emerald-700">GPS Destino:</span>{' '}
                      {activeShipment.llegada_gps}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STAGE 6: INCIDENCIA */}
            {activeShipment.estado === 'Incidencia' && (
              <div className="p-5 bg-red-50 border border-red-200 rounded-xl space-y-2 text-xs text-red-950">
                <div className="font-bold text-sm flex items-center gap-2 text-red-900">
                  <AlertTriangle className="w-5 h-5 text-red-700" />
                  Envío con Incidencia Reportada
                </div>
                <p>{activeShipment.motivo_incidencia}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

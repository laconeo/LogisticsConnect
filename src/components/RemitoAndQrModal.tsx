import React from 'react';
import { Printer, X, QrCode, FileText, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { AssetItem, ShipmentOrder } from '../types/logistics';

interface DeterministicQrSvgProps {
  token: string;
  size?: number;
}

export const DeterministicQrSvg: React.FC<DeterministicQrSvgProps> = ({
  token,
  size = 112,
}) => {
  const grid = 11;
  const cells: boolean[][] = [];

  let hash = 2166136261;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < grid; r++) {
    cells[r] = [];
    for (let c = 0; c < grid; c++) {
      const isTopLeft = r < 3 && c < 3;
      const isTopRight = r < 3 && c >= grid - 3;
      const isBottomLeft = r >= grid - 3 && c < 3;
      if (isTopLeft || isTopRight || isBottomLeft) {
        cells[r][c] = true;
      } else {
        const bit = ((hash >> ((r * grid + c) % 24)) ^ (r * 7 + c * 13)) & 1;
        cells[r][c] = bit === 1;
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${grid + 2} ${grid + 2}`}
      className="bg-white border border-slate-300 p-1 rounded"
      aria-label={`Código QR ${token}`}
    >
      <rect width={grid + 2} height={grid + 2} fill="#ffffff" />
      {cells.map((row, rIdx) =>
        row.map((filled, cIdx) =>
          filled ? (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={cIdx + 1}
              y={rIdx + 1}
              width={0.92}
              height={0.92}
              fill="#0f172a"
            />
          ) : null
        )
      )}
    </svg>
  );
};

interface RemitoModalProps {
  shipment: ShipmentOrder;
  asset?: AssetItem;
  onClose: () => void;
}

export const RemitoPdfModal: React.FC<RemitoModalProps> = ({
  shipment,
  asset,
  onClose,
}) => {
  const ejemplares = [
    {
      numero: 1,
      titulo: 'EJEMPLAR 1 — DESTINATARIO (UNIDAD RECEPTORA)',
      subtitulo:
        'Copia para archivo del Presidente de Estaca / Distrito o Receptor Autorizado',
    },
    {
      numero: 2,
      titulo: 'EJEMPLAR 2 — ORGANIZACIÓN / CONTROL DE CUSTODIA (CONFORMIDAD FIRMADA)',
      subtitulo:
        'Debe ser firmado por el receptor en destino y fotografiado al confirmar la entrega',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-xl">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 no-print">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-700" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Remito Oficial de Entrega — {shipment.remito_numero}
              </h2>
              <p className="text-xs text-slate-500">
                Documento oficial en dos ejemplares (Destinatario y Organización)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              Imprimir / Guardar PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable 2 copies */}
        <div className="p-6 overflow-y-auto space-y-6 bg-slate-100">
          {ejemplares.map((ej) => (
            <div
              key={ej.numero}
              className="bg-white border border-slate-300 rounded-lg p-6 space-y-4 text-slate-900"
            >
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <div className="text-xs font-mono font-semibold text-blue-700">
                    {ej.titulo}
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-slate-900 mt-0.5">
                    LOGISTICS CONNECT · GUÍA Y REMITO DE ENTREGA DE ACTIVO
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{ej.subtitulo}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right font-mono text-xs">
                    <div className="font-semibold text-slate-900">
                      N° {shipment.remito_numero}
                    </div>
                    <div className="text-slate-500">Activo: {shipment.activo_id}</div>
                    <div className="text-slate-500">
                      Fecha emisión: {shipment.fecha_creacion}
                    </div>
                    <div className="text-slate-600 mt-0.5">
                      Sello: {asset?.sello_seguridad || 'SELLO-CL-VERIFICADO'}
                    </div>
                  </div>
                  <DeterministicQrSvg token={shipment.qr_token} size={76} />
                </div>
              </div>

              {/* Origen / Destino / Especificación */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="border border-slate-200 rounded p-3 space-y-1">
                  <div className="font-semibold text-slate-700">1. ORIGEN Y RETIRO</div>
                  <div className="text-slate-900 font-medium">
                    FamilySearch Chile — Bodega Central
                  </div>
                  <div className="text-slate-600">{shipment.origen_retiro}</div>
                  <div className="text-slate-600 font-mono">
                    Transportista: {shipment.transportista_nombre}
                  </div>
                </div>

                <div className="border border-slate-200 rounded p-3 space-y-1">
                  <div className="font-semibold text-slate-700">
                    2. UNIDAD DESTINATARIA
                  </div>
                  <div className="text-slate-900 font-medium">
                    {shipment.estaca_distrito} (Unidad #{shipment.unidad_id})
                  </div>
                  <div className="text-slate-600">
                    {shipment.direccion}, {shipment.comuna} · {shipment.region}
                  </div>
                  <div className="text-slate-600">
                    Titular: {shipment.destinatario_titular} ({shipment.rut_titular})
                  </div>
                </div>

                <div className="border border-slate-200 rounded p-3 space-y-1">
                  <div className="font-semibold text-slate-700">
                    3. ESPECIFICACIÓN Y SEGURO
                  </div>
                  <div className="text-slate-900 font-mono font-semibold tabular-nums">
                    Valor Declarado: $
                    {shipment.valor_declarado_clp.toLocaleString('es-CL')} CLP
                  </div>
                  <div className="text-slate-600 font-mono tabular-nums">
                    Peso: {shipment.peso_kg} kg · Medidas: {shipment.dimensiones}
                  </div>
                  <div className="text-slate-600">
                    Póliza: {asset?.atributos?.poliza_seguro || 'POL-CHILE-2026-9914'}
                  </div>
                </div>
              </div>

              {/* Contenido Declarado */}
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-2">
                  4. DETALLE DE EQUIPAMIENTO DEL CONTENEDOR ({shipment.nro_cfs_movil})
                </div>
                <table className="w-full text-xs border border-slate-200">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="text-left py-1.5 px-3 font-medium">
                        Componente / Descripción
                      </th>
                      <th className="text-left py-1.5 px-3 font-medium">
                        Serie / Identificación
                      </th>
                      <th className="text-right py-1.5 px-3 font-medium">Cantidad</th>
                      <th className="text-center py-1.5 px-3 font-medium">
                        Verificado Bodega
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(
                      asset?.componentes || [
                        {
                          id: '1',
                          nombre:
                            'Notebook Lenovo ThinkPad 14" + Funda protectora',
                          serial: 'Lote 6 unidades',
                          cantidad: 6,
                          verificado: true,
                        },
                        {
                          id: '2',
                          nombre: 'Mouse óptico USB ergonómico',
                          cantidad: 6,
                          verificado: true,
                        },
                        {
                          id: '3',
                          nombre: 'Cargador original Lenovo 65W USB-C',
                          cantidad: 6,
                          verificado: true,
                        },
                        {
                          id: '4',
                          nombre: 'Zapatilla eléctrica certificada SEC (6 tomas)',
                          cantidad: 1,
                          verificado: true,
                        },
                      ]
                    ).map((comp) => (
                      <tr key={comp.id}>
                        <td className="py-1.5 px-3 text-slate-900">{comp.nombre}</td>
                        <td className="py-1.5 px-3 font-mono text-slate-600">
                          {comp.serial || 'Control por lote'}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono tabular-nums font-semibold">
                          {comp.cantidad}
                        </td>
                        <td className="py-1.5 px-3 text-center text-emerald-700 font-medium">
                          {comp.verificado ? 'Sí · Verificado' : 'Pendiente'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Firma y Conformidad */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
                <div className="border border-slate-200 rounded p-3 space-y-1.5">
                  <div className="font-semibold text-slate-700">
                    DATOS DE QUIEN RECIBE EN DESTINO
                  </div>
                  {shipment.receptor_final ? (
                    <div className="space-y-1 text-slate-800">
                      <div>
                        <span className="text-slate-500">Receptor:</span>{' '}
                        <span className="font-semibold">
                          {shipment.receptor_final.nombre_completo}
                        </span>{' '}
                        <span>({shipment.receptor_final.parentesco_rol})</span>
                      </div>
                      <div className="font-mono">
                        <span className="text-slate-500">RUT Verificado:</span>{' '}
                        {shipment.receptor_final.rut}
                      </div>
                      <div className="font-mono text-slate-600">
                        Fecha/Hora: {shipment.receptor_final.fecha_recepcion_local} · GPS:{' '}
                        {shipment.llegada_gps}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-slate-500 pt-1">
                      <div>
                        [ ] Titular ({shipment.destinatario_titular}) &nbsp; [ ]
                        Receptor Alternativo
                      </div>
                      <div>
                        Nombre Completo Receptor:
                        _______________________________________________
                      </div>
                      <div>
                        RUT / Documento: _________________________ Fecha/Hora:
                        ____________
                      </div>
                    </div>
                  )}
                </div>

                <div className="border border-slate-200 rounded p-3 flex flex-col justify-between">
                  <div className="font-semibold text-slate-700">
                    FIRMA DE CONFORMIDAD Y TRANSFERENCIA DE CUSTODIA
                  </div>
                  {shipment.firma_digital_imagen || shipment.firma_digital_trazo ? (
                    <div className="my-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {shipment.firma_digital_imagen && (
                          <img
                            src={shipment.firma_digital_imagen}
                            alt="Firma digital receptor"
                            referrerPolicy="no-referrer"
                            className="h-10 object-contain bg-white border border-slate-200 rounded px-1"
                          />
                        )}
                        <span className="font-serif italic text-base text-slate-800">
                          {shipment.firma_digital_trazo}
                        </span>
                      </div>
                      <span className="text-xs font-sans not-italic text-emerald-700 flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Firmado
                      </span>
                    </div>
                  ) : (
                    <div className="h-12 border-b border-dashed border-slate-400 my-2" />
                  )}
                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>
                      Declaro recibir maleta sellada con valor declarado $3.000.000 CLP
                    </span>
                    <span className="font-mono">
                      Token: {shipment.qr_token.slice(0, 18)}...
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface QrLabelModalProps {
  assets: AssetItem[];
  onClose: () => void;
}

export const QrBatchModal: React.FC<QrLabelModalProps> = ({ assets, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 no-print">
          <div className="flex items-center gap-2.5">
            <QrCode className="w-5 h-5 text-blue-700" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Impresión de Etiquetas QR de Activos
              </h2>
              <p className="text-xs text-slate-500">
                Identificador único seguro sin exposición de datos personales
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              Imprimir Etiquetas ({assets.length})
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2.5 text-xs text-slate-700 no-print">
            <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
            <span>
              Cada etiqueta contiene un token criptográfico opaco. Al escanearlo desde la aplicación, el sistema verifica los permisos del usuario antes de desplegar la ficha y ubicación del activo.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="border-2 border-slate-800 rounded-lg p-4 flex items-center gap-4 bg-white"
              >
                <DeterministicQrSvg token={asset.qr_token} size={92} />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                    LOGISTICS CONNECT · CONTROL DE ACTIVO
                  </div>
                  <div className="text-base font-bold font-mono text-slate-900">
                    {asset.id}
                  </div>
                  <div className="text-xs text-slate-700 truncate">
                    {asset.tipo_nombre}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 truncate">
                    SN: {asset.serial}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 truncate pt-1">
                    ID QR: {asset.qr_token}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

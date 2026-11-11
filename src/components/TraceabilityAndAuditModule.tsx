import React, { useState } from 'react';
import {
  ShieldCheck,
  History,
  CheckCircle2,
  XCircle,
  MapPin,
  Lock,
  Camera,
  FileSignature,
  Search,
  FileText,
  Eye,
} from 'lucide-react';
import {
  ShipmentOrder,
  MovementEvent,
  AuditLogEntry,
  UserRole,
} from '../types/logistics';

interface TraceabilityAndAuditModuleProps {
  shipments: ShipmentOrder[];
  movements: MovementEvent[];
  auditLogs: AuditLogEntry[];
  userRole: UserRole;
  onVerifyEvidence: (
    shipmentId: string,
    decision: 'Aprobada' | 'Reintento solicitado',
    comment: string
  ) => void;
  onOpenRemitoModal: (shipment: ShipmentOrder) => void;
}

export const TraceabilityAndAuditModule: React.FC<TraceabilityAndAuditModuleProps> = ({
  shipments,
  movements,
  auditLogs,
  userRole,
  onVerifyEvidence,
  onOpenRemitoModal,
}) => {
  const isReadOnlyAuditor = userRole === 'AUDITOR';
  const [subTab, setSubTab] = useState<'aprobacion' | 'movimientos' | 'auditoria'>(
    isReadOnlyAuditor ? 'auditoria' : 'aprobacion'
  );
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [searchFilter, setSearchFilter] = useState('');

  const deliveredShipments = shipments.filter(
    (s) =>
      s.estado === 'Entregado' ||
      s.foto_remito_firmado !== undefined ||
      s.foto_receptor_maleta !== undefined
  );

  const filteredMovements = movements.filter(
    (m) =>
      m.activo_id.toLowerCase().includes(searchFilter.toLowerCase()) ||
      m.usuario.toLowerCase().includes(searchFilter.toLowerCase()) ||
      m.ubicacion.toLowerCase().includes(searchFilter.toLowerCase()) ||
      m.detalle.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredAudit = auditLogs.filter(
    (a) =>
      a.entidad_id.toLowerCase().includes(searchFilter.toLowerCase()) ||
      a.accion.toLowerCase().includes(searchFilter.toLowerCase()) ||
      a.usuario.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Sub-navigation Apple Segmented Control */}
      <div className="apple-card rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="grid grid-cols-3 sm:flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setSubTab('aprobacion')}
            className={`px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-all cursor-pointer text-center truncate flex items-center justify-center gap-1.5 ${subTab === 'aprobacion'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
            <span className="sm:hidden">Evidencias</span>
            <span className="hidden sm:inline">Validación Evidencias ({deliveredShipments.length})</span>
          </button>
          <button
            onClick={() => setSubTab('movimientos')}
            className={`px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-all cursor-pointer text-center truncate flex items-center justify-center gap-1.5 ${subTab === 'movimientos'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <History className="w-3.5 h-3.5 shrink-0 text-[#007AFF]" />
            <span className="sm:hidden">Movimientos</span>
            <span className="hidden sm:inline">Historial Movimientos ({movements.length})</span>
          </button>
          <button
            onClick={() => setSubTab('auditoria')}
            className={`px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-all cursor-pointer text-center truncate flex items-center justify-center gap-1.5 ${subTab === 'auditoria'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
            <span className="sm:hidden">Bitácora</span>
            <span className="hidden sm:inline">Bitácora Forense ({auditLogs.length})</span>
          </button>
        </div>

        {subTab !== 'aprobacion' && (
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Buscar por activo, usuario..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-slate-200/80 rounded-xl focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all font-medium"
            />
          </div>
        )}
      </div>

      {subTab === 'aprobacion' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-lg p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-blue-600 font-semibold block">
                Control de Calidad Documental
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Revisión de Fotografías de Respaldo, Firma y Coordenadas GPS
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Verifique la legibilidad del Remito firmado (Foto 1) y la fotografía del receptor con la maleta (Foto 2). Al aprobar la evidencia, el activo pasa a estado operativo <strong>"En uso (unidad)"</strong>.
              </p>
            </div>
            {isReadOnlyAuditor && (
              <div className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-2">
                <Eye className="w-4 h-4 text-slate-600" />
                Modo Auditor: Solo Lectura
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {deliveredShipments.map((sh) => {
              return (
                <div
                  key={sh.id}
                  className="bg-white border border-slate-200/80 rounded-lg p-5 shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-xs font-mono font-bold text-blue-600">
                          {sh.activo_id} · Remito {sh.remito_numero}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                          {sh.estaca_distrito} (Unidad #{sh.unidad_id})
                        </h4>
                        <p className="text-xs text-slate-500">
                          {sh.direccion}, {sh.comuna} · {sh.region}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-xs font-semibold block ${sh.estado_revision_evidencia === 'Aprobada'
                              ? 'text-emerald-700'
                              : sh.estado_revision_evidencia === 'Reintento solicitado'
                                ? 'text-rose-700'
                                : 'text-amber-700'
                            }`}
                        >
                          ● {sh.estado_revision_evidencia}
                        </span>
                        <button
                          onClick={() => onOpenRemitoModal(sh)}
                          className="text-[11px] font-semibold text-blue-700 hover:underline inline-flex items-center gap-1 mt-1 cursor-pointer"
                        >
                          <FileText className="w-3 h-3" /> Ver Remito PDF
                        </button>
                      </div>
                    </div>

                    {/* Receiver & Evidence Metadata */}
                    <div className="bg-slate-50 rounded-md p-3.5 border border-slate-200/70 space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <FileSignature className="w-3.5 h-3.5 text-slate-400" />
                          Receptor en Destino:
                        </span>
                        <span className="font-semibold text-slate-900">
                          {sh.receptor_final
                            ? `${sh.receptor_final.nombre_completo} (${sh.receptor_final.parentesco_rol} · RUT ${sh.receptor_final.rut})`
                            : `${sh.destinatario_titular} (${sh.rut_titular})`}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          Georreferenciación GPS:
                        </span>
                        <span className="font-mono text-slate-800 tabular-nums">
                          {sh.llegada_gps || '-33.5419, -70.5884'}{' '}
                          {sh.distancia_destino_metros
                            ? `(±${sh.distancia_destino_metros}m)`
                            : ''}
                        </span>
                      </div>

                      {sh.foto_remito_firmado && (
                        <div className="pt-2 border-t border-slate-200/70 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-700 flex items-center gap-1">
                              <Camera className="w-3.5 h-3.5 text-blue-600" />
                              Foto 1 (Remito Firmado):
                            </span>
                            <span className="font-mono text-slate-600">
                              {sh.foto_remito_firmado.tamano_kb} KB
                            </span>
                          </div>
                          {sh.foto_remito_firmado.preview_data_url && (
                            <img
                              src={sh.foto_remito_firmado.preview_data_url}
                              alt="Remito firmado"
                              className="h-28 w-full object-cover rounded border border-slate-300 my-1"
                            />
                          )}
                          <div className="font-mono text-[10px] text-slate-500 truncate">
                            SHA-256: {sh.foto_remito_firmado.hash_sha256}
                          </div>
                        </div>
                      )}

                      {sh.foto_receptor_maleta && (
                        <div className="pt-2 border-t border-slate-200/70 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-700 flex items-center gap-1">
                              <Camera className="w-3.5 h-3.5 text-blue-600" />
                              Foto 2 (Receptor con Maleta):
                            </span>
                            <span className="font-mono text-slate-600">
                              {sh.foto_receptor_maleta.tamano_kb} KB
                            </span>
                          </div>
                          {sh.foto_receptor_maleta.preview_data_url && (
                            <img
                              src={sh.foto_receptor_maleta.preview_data_url}
                              alt="Receptor con activo"
                              className="h-28 w-full object-cover rounded border border-slate-300 my-1"
                            />
                          )}
                          <div className="font-mono text-[10px] text-slate-500 truncate">
                            SHA-256: {sh.foto_receptor_maleta.hash_sha256}
                          </div>
                        </div>
                      )}
                    </div>

                    {sh.comentario_revision && (
                      <div className="text-xs bg-blue-50/70 border border-blue-200/80 text-blue-900 p-2.5 rounded">
                        <span className="font-semibold">Nota de Supervisión: </span>
                        {sh.comentario_revision}
                      </div>
                    )}
                  </div>

                  {/* Supervisor Actions (Hidden in Read-Only Auditor Mode) */}
                  {!isReadOnlyAuditor ? (
                    <div className="pt-3 border-t border-slate-100 space-y-2.5">
                      <input
                        type="text"
                        value={reviewComments[sh.id] || ''}
                        onChange={(e) =>
                          setReviewComments({
                            ...reviewComments,
                            [sh.id]: e.target.value,
                          })
                        }
                        placeholder="Observación de validación o motivo de solicitud de nueva fotografía..."
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none focus:border-blue-600"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            onVerifyEvidence(
                              sh.id,
                              'Aprobada',
                              reviewComments[sh.id] ||
                              'Documentación y evidencias fotográficas conformes.'
                            )
                          }
                          className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Aprobar Recepción
                        </button>
                        <button
                          onClick={() =>
                            onVerifyEvidence(
                              sh.id,
                              'Reintento solicitado',
                              reviewComments[sh.id] ||
                              'Se solicita volver a capturar fotografía legible del remito firmado.'
                            )
                          }
                          className="flex-1 py-2 px-3 bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Solicitar Reintento
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      Rol Auditor: Visualización de evidencias y hashes sin permisos de modificación.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {subTab === 'movimientos' && (
        <div className="bg-white border border-slate-200/80 rounded-lg shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Trazabilidad Histórica de Movimientos y Cambios de Custodia
              </h3>
              <p className="text-xs text-slate-500">
                Registro cronológico inmutable con doble marca temporal (UTC servidor y hora local), GPS y hash SHA-256.
              </p>
            </div>
          </div>

          {/* Vista Móvil Tarjetas de Movimientos */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredMovements.map((m) => (
              <div key={m.id} className="p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-blue-600">{m.activo_id}</span>
                  <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                    {m.hora_local_dispositivo}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  <span className="text-slate-500">{m.estado_anterior}</span>
                  <span className="text-slate-400">→</span>
                  <span className="font-bold text-slate-900">{m.estado_nuevo}</span>
                </div>
                <div className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200/70 space-y-1">
                  <div className="flex items-start gap-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                    <span>{m.ubicacion}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Custodio: <strong>{m.custodio}</strong> · {m.usuario}
                  </div>
                </div>
                <p className="text-[11px] text-slate-600">{m.detalle}</p>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">ID Evento / Hora Local</th>
                  <th className="py-3 px-4">Activo / Envío</th>
                  <th className="py-3 px-4">Transición de Estado</th>
                  <th className="py-3 px-4">Ubicación y Custodio</th>
                  <th className="py-3 px-4">Usuario / Rol</th>
                  <th className="py-3 px-4">Detalle Operativo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-xs">
                {filteredMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-900">{m.id}</div>
                      <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                        {m.hora_local_dispositivo}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-blue-600">
                        {m.activo_id}
                      </div>
                      {m.envio_id && (
                        <div className="text-[11px] font-mono text-slate-500">
                          {m.envio_id}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px]">
                      <span className="text-slate-500">{m.estado_anterior}</span>
                      <span className="mx-1.5 text-slate-400">→</span>
                      <span className="font-bold text-slate-900">{m.estado_nuevo}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">{m.ubicacion}</div>
                      <div className="text-[11px] text-slate-500">
                        Custodio: {m.custodio} · GPS: {m.gps}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{m.usuario}</div>
                      <div className="text-[11px] font-mono text-slate-500">{m.rol}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs">{m.detalle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'auditoria' && (
        <div className="bg-white border border-slate-200/80 rounded-lg shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-900 text-white">
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold">
                  Bitácora de Auditoría Técnica (Append-Only)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Registro inalterable de cambios de estado, altas, bajas y verificaciones con estado anterior y posterior.
                </p>
              </div>
            </div>
          </div>

          {/* Vista Móvil Tarjetas de Auditoría */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredAudit.map((log) => (
              <div key={log.id} className="p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-blue-700">{log.accion}</span>
                  <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                    {log.fecha_utc.slice(0, 19).replace('T', ' ')}
                  </span>
                </div>
                <div className="text-slate-800 font-medium">
                  {log.entidad}: <span className="font-mono text-slate-600">{log.entidad_id}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/70 text-[11px] font-mono space-y-1">
                  <div className="text-slate-500 truncate">Antes: {log.antes}</div>
                  <div className="text-slate-900 font-semibold truncate">Después: {log.despues}</div>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>{log.usuario} ({log.rol})</span>
                  <span>{log.dispositivo}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Log ID / Fecha UTC</th>
                  <th className="py-3 px-4">Acción / Entidad</th>
                  <th className="py-3 px-4">Estado Anterior → Posterior</th>
                  <th className="py-3 px-4">Usuario / Dispositivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-xs font-mono">
                {filteredAudit.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{log.id}</div>
                      <div className="text-[11px] text-slate-400 tabular-nums">
                        {log.fecha_utc}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-blue-700">{log.accion}</div>
                      <div className="text-[11px] text-slate-600">
                        {log.entidad}: {log.entidad_id}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[11px] max-w-md">
                      <div className="text-slate-500 truncate">Antes: {log.antes}</div>
                      <div className="text-slate-900 font-semibold truncate">
                        Después: {log.despues}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-sans font-medium">
                        {log.usuario} ({log.rol})
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {log.dispositivo} · IP: {log.ip}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

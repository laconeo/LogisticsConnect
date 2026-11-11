import React, { useState } from 'react';
import {
  ClipboardCheck,
  AlertTriangle,
  ScanLine,
  Plus,
  CheckCircle2,
  MapPin,
  Search,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import {
  AssetItem,
  InventoryCampaign,
  AssetIncidentRecord,
  CountryCode,
} from '../types/logistics';
import { CHILE_COMUNAS_CATALOG } from '../data/initialData';

interface InventoryAndIncidentsModuleProps {
  assets: AssetItem[];
  inventories: InventoryCampaign[];
  incidents: AssetIncidentRecord[];
  selectedCountry: CountryCode;
  activeUserName: string;
  onStartInventoryCampaign: (nombre: string, ubicacionObjetivo: string) => void;
  onScanAssetInCampaign: (campaignId: string, scannedAssetId: string) => void;
  onCloseInventoryCampaign: (campaignId: string, observaciones: string) => void;
  onCreateIncident: (incident: AssetIncidentRecord) => void;
  onResolveIncident: (incidentId: string) => void;
}

export const InventoryAndIncidentsModule: React.FC<InventoryAndIncidentsModuleProps> = ({
  assets,
  inventories,
  incidents,
  selectedCountry,
  activeUserName,
  onStartInventoryCampaign,
  onScanAssetInCampaign,
  onCloseInventoryCampaign,
  onCreateIncident,
  onResolveIncident,
}) => {
  const [subTab, setSubTab] = useState<'inventario' | 'incidentes' | 'territorio'>('inventario');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(
    inventories[0]?.id || ''
  );
  const [newCampaignName, setNewCampaignName] = useState(
    'Control Físico de Bodega Central — Providencia'
  );
  const [newLocation, setNewLocation] = useState(
    'Bodega Central — Pedro de Valdivia 1423, Providencia'
  );
  const [manualScanCode, setManualScanCode] = useState('');
  const [closingObs, setClosingObs] = useState(
    'Conciliación física completada conforme con lectura de etiquetas QR.'
  );

  // Incident form state
  const [incAssetId, setIncAssetId] = useState(assets[0]?.id || 'CFS-CL-063');
  const [incAfectaA, setIncAfectaA] = useState<'CONTENEDOR_COMPLETO' | 'SOLO_COMPONENTE'>(
    'SOLO_COMPONENTE'
  );
  const [incComponenteDetalle, setIncComponenteDetalle] = useState(
    'Cargador original Lenovo 65W USB-C'
  );
  const [incTipo, setIncTipo] = useState<AssetIncidentRecord['tipo_incidente']>('Falla técnica');
  const [incEstadoResultante, setIncEstadoResultante] =
    useState<AssetIncidentRecord['estado_resultante']>('Incidente');
  const [incDesc, setIncDesc] = useState('');

  // Territory filter
  const [comunaFilter, setComunaFilter] = useState('');

  const activeCampaign =
    inventories.find((c) => c.id === selectedCampaignId) || inventories[0];

  const handleStartCampaignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaignName.trim()) return;
    onStartInventoryCampaign(newCampaignName.trim(), newLocation);
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCampaign || !manualScanCode.trim()) return;
    onScanAssetInCampaign(activeCampaign.id, manualScanCode.trim().toUpperCase());
    setManualScanCode('');
  };

  const handleIncidentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incDesc.trim()) return;
    const newInc: AssetIncidentRecord = {
      id: `INC-2026-00${incidents.length + 1}`,
      activo_id: incAssetId,
      afecta_a: incAfectaA,
      componente_detalle: incAfectaA === 'SOLO_COMPONENTE' ? incComponenteDetalle : undefined,
      tipo_incidente: incTipo,
      estado_resultante: incEstadoResultante,
      descripcion: incDesc.trim(),
      reportado_por: activeUserName,
      fecha_utc: new Date().toISOString(),
      estado_gestion: 'Abierto',
    };
    onCreateIncident(newInc);
    setIncDesc('');
  };

  const filteredComunas = CHILE_COMUNAS_CATALOG.filter(
    (c) =>
      c.comuna.toLowerCase().includes(comunaFilter.toLowerCase()) ||
      c.region.toLowerCase().includes(comunaFilter.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Sub-navigation Hallmark */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs">
        <div className="grid grid-cols-3 sm:flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setSubTab('inventario')}
            className={`px-2 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-semibold rounded-md transition-colors cursor-pointer text-center truncate flex items-center justify-center gap-1.5 ${subTab === 'inventario'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">Inventario</span>
            <span className="hidden sm:inline">Auditoría Inventario ({inventories.length})</span>
          </button>
          <button
            onClick={() => setSubTab('incidentes')}
            className={`px-2 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-semibold rounded-md transition-colors cursor-pointer text-center truncate flex items-center justify-center gap-1.5 ${subTab === 'incidentes'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
            <span className="sm:hidden">Incidentes</span>
            <span className="hidden sm:inline">
              Incidentes ({incidents.filter((i) => i.estado_gestion !== 'Cerrado').length})
            </span>
          </button>
          <button
            onClick={() => setSubTab('territorio')}
            className={`px-2 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-semibold rounded-md transition-colors cursor-pointer text-center truncate flex items-center justify-center gap-1.5 ${subTab === 'territorio'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <MapPin className="w-3.5 h-3.5 shrink-0 text-blue-600" />
            <span className="sm:hidden">Comunas</span>
            <span className="hidden sm:inline">
              Catálogo Comunas ({CHILE_COMUNAS_CATALOG.length})
            </span>
          </button>
        </div>
      </div>

      {subTab === 'inventario' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Campaigns & Create */}
          <div className="lg:col-span-4 space-y-4">
            <form
              onSubmit={handleStartCampaignSubmit}
              className="bg-white border border-slate-200/80 rounded-lg p-5 shadow-xs space-y-4"
            >
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Iniciar Toma de Inventario Físico
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Seleccione la bodega o centro de estaca para conciliar los activos físicos mediante lectura QR.
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Nombre de la Sesión
                  </label>
                  <input
                    type="text"
                    required
                    value={newCampaignName}
                    onChange={(e) => setNewCampaignName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Ubicación / Bodega a Auditar
                  </label>
                  <select
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:border-blue-600"
                  >
                    <option value="Bodega Central — Pedro de Valdivia 1423, Providencia">
                      Bodega Central — Pedro de Valdivia 1423, Providencia
                    </option>
                    <option value="Estaca Santiago La Florida Sur (Av. Vicuña Mackenna 10420)">
                      Estaca Santiago La Florida Sur
                    </option>
                    <option value="Estaca Concepción Andalién (Av. Chacabuco 1180)">
                      Estaca Concepción Andalién
                    </option>
                    <option value="Estaca Talca Norte (Av. Lircay 1450)">
                      Estaca Talca Norte
                    </option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Abrir Nueva Sesión de Inventario ({selectedCountry})
                </button>
              </div>
            </form>

            <div className="bg-white border border-slate-200/80 rounded-lg p-5 shadow-xs space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Sesiones de Inventario Registradas
              </span>
              <div className="space-y-2">
                {inventories.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => setSelectedCampaignId(inv.id)}
                    className={`w-full text-left p-3 rounded-md border transition-colors cursor-pointer ${activeCampaign?.id === inv.id
                        ? 'bg-blue-50/60 border-blue-600'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-900">
                        {inv.id}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase ${inv.estado === 'Conciliada y Cerrada'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                          }`}
                      >
                        ● {inv.estado}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 mt-1 truncate">
                      {inv.nombre}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {inv.ubicacion_objetivo}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 tabular-nums">
                      <span>Inicio: {inv.fecha_inicio}</span>
                      <span>
                        Verificados: {inv.activos_escaneados_ids.length} /{' '}
                        {inv.activos_esperados_ids.length}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Active Campaign Scanner & Reconciliation */}
          <div className="lg:col-span-8">
            {activeCampaign ? (
              <div className="bg-white border border-slate-200/80 rounded-lg shadow-xs overflow-hidden">
                <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono uppercase tracking-wider text-blue-400">
                        {activeCampaign.id}
                      </span>
                      <span className="text-slate-500">·</span>
                      <span className="text-xs text-slate-300">
                        Responsable: {activeCampaign.responsable}
                      </span>
                    </div>
                    <h3 className="text-base font-bold mt-0.5">
                      {activeCampaign.nombre}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Ubicación: {activeCampaign.ubicacion_objetivo}
                    </p>
                  </div>
                  {activeCampaign.estado === 'En curso' && (
                    <button
                      onClick={() =>
                        onCloseInventoryCampaign(activeCampaign.id, closingObs)
                      }
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Cerrar y Conciliar Inventario
                    </button>
                  )}
                </div>

                <div className="p-6 space-y-6">
                  {/* Scan bar */}
                  {activeCampaign.estado === 'En curso' && (
                    <form
                      onSubmit={handleScanSubmit}
                      className="bg-slate-50 border border-slate-200/90 rounded-lg p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                    >
                      <div className="relative flex-1">
                        <ScanLine className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={manualScanCode}
                          onChange={(e) => setManualScanCode(e.target.value)}
                          placeholder="Escanee etiqueta QR o ingrese ID de activo (ej. CFS-CL-065)..."
                          className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Registrar Lectura QR
                      </button>
                    </form>
                  )}

                  {/* Expected assets table */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Activos Esperados en Ubicación ({activeCampaign.activos_esperados_ids.length})
                      </h4>
                      <span className="text-xs font-semibold text-slate-700 tabular-nums">
                        Avance:{' '}
                        {activeCampaign.activos_esperados_ids.length > 0
                          ? Math.round(
                            (activeCampaign.activos_escaneados_ids.filter((id) =>
                              activeCampaign.activos_esperados_ids.includes(id)
                            ).length /
                              activeCampaign.activos_esperados_ids.length) *
                            100
                          )
                          : 100}
                        %
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-md overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <th className="py-2.5 px-3">ID Activo</th>
                            <th className="py-2.5 px-3">Descripción / Serie</th>
                            <th className="py-2.5 px-3">Estado Conciliación</th>
                            <th className="py-2.5 px-3 text-right">Verificación QR</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/70 text-xs">
                          {activeCampaign.activos_esperados_ids.map((id) => {
                            const asset = assets.find((a) => a.id === id);
                            const isScanned =
                              activeCampaign.activos_escaneados_ids.includes(id);
                            return (
                              <tr key={id} className="hover:bg-slate-50/80">
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                  {id}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-medium text-slate-800">
                                    {asset?.tipo_nombre || 'Contenedor CFS'}
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-500">
                                    S/N: {asset?.serial || 'N/A'}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  {isScanned ? (
                                    <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                                      Verificado en Ubicación
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 text-amber-700 font-semibold">
                                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                                      Faltante / Pendiente Escaneo
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {!isScanned && activeCampaign.estado === 'En curso' ? (
                                    <button
                                      onClick={() =>
                                        onScanAssetInCampaign(activeCampaign.id, id)
                                      }
                                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded text-[11px] transition-colors cursor-pointer"
                                    >
                                      Confirmar QR
                                    </button>
                                  ) : (
                                    <span className="text-[11px] font-mono text-slate-400">
                                      OK
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {activeCampaign.hallazgos_otra_ubicacion_ids.length > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900">
                        <strong>Hallazgos de otra ubicación escaneados aquí: </strong>
                        {activeCampaign.hallazgos_otra_ubicacion_ids.join(', ')}
                      </div>
                    )}

                    {activeCampaign.estado === 'En curso' && (
                      <div className="pt-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Observaciones de Conciliación
                        </label>
                        <input
                          type="text"
                          value={closingObs}
                          onChange={(e) => setClosingObs(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {subTab === 'incidentes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form to report incident */}
          <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-lg p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-rose-600 font-semibold block">
                Control Técnico de Activos
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Reportar Incidente o Falla de Componente
              </h3>
            </div>

            <form onSubmit={handleIncidentSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Activo Afectado *
                </label>
                <select
                  value={incAssetId}
                  onChange={(e) => setIncAssetId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:border-blue-600"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id} — {a.tipo_nombre} ({a.estado})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Alcance del Incidente
                  </label>
                  <select
                    value={incAfectaA}
                    onChange={(e) =>
                      setIncAfectaA(
                        e.target.value as 'CONTENEDOR_COMPLETO' | 'SOLO_COMPONENTE'
                      )
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                  >
                    <option value="SOLO_COMPONENTE">Solo 1 Componente</option>
                    <option value="CONTENEDOR_COMPLETO">Contenedor Completo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Tipo de Incidente
                  </label>
                  <select
                    value={incTipo}
                    onChange={(e) =>
                      setIncTipo(
                        e.target.value as AssetIncidentRecord['tipo_incidente']
                      )
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                  >
                    <option value="Falla técnica">Falla técnica</option>
                    <option value="Daño físico">Daño físico</option>
                    <option value="Extravío">Extravío</option>
                    <option value="Robo con denuncia">Robo con denuncia</option>
                    <option value="Entrega fallida">Entrega fallida</option>
                  </select>
                </div>
              </div>

              {incAfectaA === 'SOLO_COMPONENTE' && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Componente Específico Afectado
                  </label>
                  <input
                    type="text"
                    value={incComponenteDetalle}
                    onChange={(e) => setIncComponenteDetalle(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Estado Resultante del Activo
                </label>
                <select
                  value={incEstadoResultante}
                  onChange={(e) =>
                    setIncEstadoResultante(
                      e.target.value as AssetIncidentRecord['estado_resultante']
                    )
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                >
                  <option value="Incidente">
                    Incidente (Observación activa en seguimiento)
                  </option>
                  <option value="Fuera de servicio">
                    Fuera de servicio (Requiere reemplazo / laboratorio)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Diagnóstico / Observación Técnica *
                </label>
                <textarea
                  rows={3}
                  required
                  value={incDesc}
                  onChange={(e) => setIncDesc(e.target.value)}
                  placeholder="Describa el hallazgo físico, falla de equipo o motivo del incidente..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4" />
                Registrar Incidente Técnico
              </button>
            </form>
          </div>

          {/* Incidents table */}
          <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-lg shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Bitácora de Incidentes Técnicos y Mantenciones
                </h3>
                <p className="text-xs text-slate-500">
                  Control granular de fallas por componente individual o contenedor completo.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-200/70">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/60"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-xs font-mono font-bold text-slate-900">
                        {inc.id}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs font-mono font-semibold text-blue-700">
                        Activo: {inc.activo_id}
                      </span>
                      <span className="text-[11px] font-bold uppercase text-rose-700">
                        [{inc.tipo_incidente} · {inc.estado_resultante}]
                      </span>
                    </div>
                    {inc.componente_detalle && (
                      <div className="text-xs font-semibold text-slate-800">
                        Componente: {inc.componente_detalle}
                      </div>
                    )}
                    <p className="text-xs text-slate-600">{inc.descripcion}</p>
                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-3">
                      <span>Fecha: {inc.fecha_utc.slice(0, 10)}</span>
                      <span>Reportado por: {inc.reportado_por}</span>
                      <span>Estado gestión: {inc.estado_gestion}</span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {inc.estado_gestion === 'Cerrado' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="w-4 h-4" />
                        Cerrado / Operativo
                      </span>
                    ) : (
                      <button
                        onClick={() => onResolveIncident(inc.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        Resolver y Restituir Operatividad
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {subTab === 'territorio' && (
        <div className="bg-white border border-slate-200/80 rounded-lg shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-blue-600 font-semibold block">
                División Político-Administrativa Oficial
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Catálogo Maestro de Comunas y Regiones (Chile)
              </h3>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={comunaFilter}
                onChange={(e) => setComunaFilter(e.target.value)}
                placeholder="Filtrar comuna o región..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Comuna Oficial</th>
                  <th className="py-3 px-4">Región</th>
                  <th className="py-3 px-4">País</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-xs">
                {filteredComunas.map((c, idx) => (
                  <tr key={c.comuna} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono text-slate-400 tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                      {c.comuna}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 font-medium">
                      {c.region}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 font-mono">
                      Chile (CL)
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

import React, { useState } from 'react';
import {
  Box,
  Layers,
  Plus,
  QrCode,
  Edit3,
  ArchiveX,
  CheckCircle2,
  FolderTree,
  Sliders,
} from 'lucide-react';
import {
  AssetItem,
  AssetTypeConfig,
  DynamicAttributeDef,
} from '../types/logistics';
import { DeterministicQrSvg } from './RemitoAndQrModal';

interface AssetsAndCatalogModuleProps {
  assets: AssetItem[];
  assetTypes: AssetTypeConfig[];
  onRegisterAsset: (newAsset: AssetItem) => void;
  onEditAssetWithReason: (
    assetId: string,
    newLocation: string,
    newObservations: string,
    reason: string
  ) => void;
  onDecommissionAsset: (assetId: string, reason: string) => void;
  onCreateAssetType: (newType: AssetTypeConfig) => void;
  onOpenQrBatchModal: (selectedAssets: AssetItem[]) => void;
}

export const AssetsAndCatalogModule: React.FC<AssetsAndCatalogModuleProps> = ({
  assets,
  assetTypes,
  onRegisterAsset,
  onEditAssetWithReason,
  onDecommissionAsset,
  onCreateAssetType,
  onOpenQrBatchModal,
}) => {
  const [subView, setSubView] = useState<
    'INVENTARIO' | 'ALTA_ACTIVO' | 'TIPOS_ACTIVO'
  >('INVENTARIO');
  const [selectedAssetId, setSelectedAssetId] = useState<string>(
    assets[0]?.id || 'CFS-CL-063'
  );
  const [mobileAssetTab, setMobileAssetTab] = useState<'lista' | 'detalle'>('lista');

  // Register new asset state
  const [selectedTypeId, setSelectedTypeId] = useState<string>(
    assetTypes[0]?.id || 'TYPE-CFS-MALETA'
  );
  const [newSerial, setNewSerial] = useState('SN-CFS2026-066');
  const [newLocation, setNewLocation] = useState(
    'Bodega Central — Pedro de Valdivia 1423, Providencia'
  );
  const [newCustodian, setNewCustodian] = useState(
    'Rodrigo Soto (Bodega Central)'
  );
  const [newObs, setNewObs] = useState('Ingreso a inventario de bodega');
  const [dynamicValues, setDynamicValues] = useState<Record<string, string>>({
    modelo_maleta: 'Pelican Storm Case iM2720 Acolchada',
    poliza_seguro: 'POL-CHILE-2026-9914',
    lote_despliegue: 'Chile 2026',
  });
  const [registerNotice, setRegisterNotice] = useState<string | null>(null);

  // Edit asset state
  const [editingAsset, setEditingAsset] = useState<AssetItem | null>(null);
  const [editLoc, setEditLoc] = useState('');
  const [editObs, setEditObs] = useState('');
  const [editReason, setEditReason] = useState('');

  // Decommission state
  const [decommissionAsset, setDecommissionAsset] = useState<AssetItem | null>(
    null
  );
  const [decommissionReason, setDecommissionReason] = useState(
    'Daño irreparable tras siniestro'
  );

  // New Asset Type state
  const [typeName, setTypeName] = useState('');
  const [typePrefix, setTypePrefix] = useState('ESC-FS');
  const [typeValueClp, setTypeValueClp] = useState(320000);
  const [typeIsContainer, setTypeIsContainer] = useState(false);
  const [customAttrLabel, setCustomAttrLabel] = useState(
    'Resolución Óptica (DPI)'
  );

  const activeAsset =
    assets.find((a) => a.id === selectedAssetId) || assets[0];
  const currentTypeConfig =
    assetTypes.find((t) => t.id === selectedTypeId) || assetTypes[0];

  const handleCreateAssetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSerial.trim()) return;
    const duplicate = assets.some(
      (a) => a.serial.toLowerCase() === newSerial.trim().toLowerCase()
    );
    if (duplicate) {
      setRegisterNotice(
        `El número de serie "${newSerial}" ya se encuentra registrado en el sistema.`
      );
      return;
    }

    const nextNum = assets.length + 61;
    const newId = `${currentTypeConfig.codigo_prefijo}-${String(
      nextNum
    ).padStart(3, '0')}`;
    const token = `qr_op_${Math.random()
      .toString(16)
      .slice(2, 10)}-4a9c-8c1e-${Date.now().toString().slice(-6)}`;

    const created: AssetItem = {
      id: newId,
      qr_token: token,
      serial: newSerial.trim(),
      tipo_id: currentTypeConfig.id,
      tipo_nombre: currentTypeConfig.nombre,
      es_contenedor: currentTypeConfig.es_contenedor,
      estado: 'Disponible en bodega',
      pais: 'CL',
      ubicacion_actual: newLocation,
      custodio_actual: newCustodian,
      fecha_adquisicion: new Date().toISOString().slice(0, 10),
      valor_declarado_clp: currentTypeConfig.valor_declarado_clp,
      atributos: { ...dynamicValues },
      componentes: currentTypeConfig.es_contenedor
        ? currentTypeConfig.plantilla_contenido.map((c, idx) => ({
            id: `CMP-${nextNum}-${idx + 1}`,
            nombre: c.nombre,
            cantidad: c.cantidad_esperada,
            verificado: true,
          }))
        : [],
      observaciones: newObs,
    };

    onRegisterAsset(created);
    setSelectedAssetId(created.id);
    setRegisterNotice(
      `Activo ${created.id} registrado exitosamente en estado "Disponible en bodega".`
    );
    setNewSerial(`SN-CFS2026-0${nextNum + 1}`);
  };

  const handleCreateTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeName.trim()) return;
    const newAttr: DynamicAttributeDef = {
      key: customAttrLabel.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      label: customAttrLabel,
      type: 'texto',
      required: true,
    };
    const createdType: AssetTypeConfig = {
      id: `TYPE-${Date.now().toString().slice(-4)}`,
      nombre: typeName.trim(),
      codigo_prefijo: typePrefix.trim().toUpperCase() || 'ACT-CL',
      es_contenedor: typeIsContainer,
      valor_declarado_clp: Number(typeValueClp) || 150000,
      atributos_esquema: [
        {
          key: 'marca_modelo',
          label: 'Marca y Modelo',
          type: 'texto',
          required: true,
        },
        newAttr,
      ],
      plantilla_contenido: [],
    };
    onCreateAssetType(createdType);
    setTypeName('');
    setSubView('ALTA_ACTIVO');
    setSelectedTypeId(createdType.id);
  };

  return (
    <div className="space-y-5">
      {/* Sub-navigation bar — Apple Segmented Control */}
      <div className="apple-card rounded-2xl border border-slate-200/80 p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
        <div className="grid grid-cols-3 sm:flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setSubView('INVENTARIO')}
            className={`px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-all cursor-pointer text-center truncate ${
              subView === 'INVENTARIO'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="sm:hidden">Activos</span>
            <span className="hidden sm:inline">Directorio de Activos</span>
          </button>
          <button
            onClick={() => setSubView('ALTA_ACTIVO')}
            className={`px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-all cursor-pointer text-center truncate ${
              subView === 'ALTA_ACTIVO'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="sm:hidden">+ Alta</span>
            <span className="hidden sm:inline">+ Registrar Nuevo Activo</span>
          </button>
          <button
            onClick={() => setSubView('TIPOS_ACTIVO')}
            className={`px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-all cursor-pointer text-center truncate ${
              subView === 'TIPOS_ACTIVO'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="sm:hidden">Tipos</span>
            <span className="hidden sm:inline">Configuración de Tipos</span>
          </button>
        </div>

        <button
          onClick={() => onOpenQrBatchModal(assets)}
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-black rounded-xl flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs active:scale-95 transition-all"
        >
          <QrCode className="w-4 h-4" />
          <span>Imprimir QR ({assets.length})</span>
        </button>
      </div>

      {/* VIEW 1: DIRECTORIO DE ACTIVOS */}
      {subView === 'INVENTARIO' && (
        <div className="space-y-4">
          {/* Mobile Switcher between Lista and Ficha */}
          <div className="lg:hidden flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMobileAssetTab('lista')}
              className={`flex-1 py-2 text-center rounded-lg transition-all ${
                mobileAssetTab === 'lista'
                  ? 'bg-white text-slate-900 shadow-sm font-bold'
                  : 'text-slate-600'
              }`}
            >
              Lista de Activos ({assets.length})
            </button>
            <button
              type="button"
              onClick={() => setMobileAssetTab('detalle')}
              className={`flex-1 py-2 text-center rounded-lg transition-all ${
                mobileAssetTab === 'detalle'
                  ? 'bg-white text-slate-900 shadow-sm font-bold'
                  : 'text-slate-600'
              }`}
            >
              Ficha: {activeAsset?.id || 'Detalle'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Asset List */}
            <div
              className={`lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs ${
                mobileAssetTab === 'detalle' ? 'hidden lg:block' : 'block'
              }`}
            >
              <div className="px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                  <Box className="w-4 h-4 text-blue-700" />
                  Activos Registrados ({assets.length})
                </div>
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  Seleccione un activo para ver su ficha y componentes
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {assets.map((asset) => {
                  const isSelected = asset.id === activeAsset?.id;
                  return (
                    <div
                      key={asset.id}
                      onClick={() => {
                        setSelectedAssetId(asset.id);
                        setMobileAssetTab('detalle');
                      }}
                      className={`p-3.5 sm:p-4 transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="font-mono font-bold text-slate-900">
                              {asset.id}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span className="font-medium text-slate-700 truncate">
                              {asset.tipo_nombre}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 mt-1 truncate">
                            Ubicación: <strong className="text-slate-800">{asset.ubicacion_actual}</strong>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                            Custodio: {asset.custodio_actual}
                          </div>
                        </div>

                        <div className="text-right shrink-0 space-y-1">
                          <div className="text-[11px] font-semibold text-slate-900">
                            {asset.estado}
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-slate-600">
                            ${asset.valor_declarado_clp.toLocaleString('es-CL')} CLP
                          </div>
                          <div className="lg:hidden text-[10px] text-blue-600 font-bold mt-1">
                            Ver ficha →
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          {/* Selected Asset Detail */}
          {activeAsset && (
            <div
              className={`lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-5 shadow-xs ${
                mobileAssetTab === 'lista' ? 'hidden lg:block' : 'block'
              }`}
            >
              <div className="lg:hidden pb-3 border-b border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMobileAssetTab('lista')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  ← Volver a lista de activos
                </button>
                <span className="text-[11px] font-mono text-slate-400">
                  {assets.findIndex((a) => a.id === activeAsset.id) + 1} de {assets.length}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <div className="text-xs font-mono text-blue-700 font-semibold">
                    FICHA TÉCNICA DE ACTIVO
                  </div>
                  <h3 className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                    {activeAsset.id}
                  </h3>
                  <p className="text-xs text-slate-600">
                    {activeAsset.tipo_nombre}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 mt-1">
                    ID Etiqueta QR: {activeAsset.qr_token}
                  </p>
                </div>
                <DeterministicQrSvg token={activeAsset.qr_token} size={80} />
              </div>

              {/* Dynamic Attributes */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-800">
                  Especificaciones y Atributos
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {Object.entries(activeAsset.atributos).map(([k, v]) => (
                    <div key={k}>
                      <span className="text-slate-500 capitalize">
                        {k.replace(/_/g, ' ')}:
                      </span>{' '}
                      <strong className="text-slate-900 font-mono">
                        {String(v)}
                      </strong>
                    </div>
                  ))}
                  {activeAsset.sello_seguridad && (
                    <div>
                      <span className="text-slate-500">Sello Seguridad:</span>{' '}
                      <strong className="text-slate-900 font-mono">
                        {activeAsset.sello_seguridad}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Container Components */}
              {activeAsset.es_contenedor && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <FolderTree className="w-4 h-4 text-blue-700" />
                    Equipamiento Contenido en la Maleta
                  </div>
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 text-xs">
                    {activeAsset.componentes.map((comp) => (
                      <div
                        key={comp.id}
                        className="p-2.5 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-medium text-slate-900">
                            {comp.nombre}
                          </div>
                          {comp.serial && (
                            <div className="text-[11px] font-mono text-slate-500">
                              Series: {comp.serial}
                            </div>
                          )}
                        </div>
                        <div className="text-right font-mono tabular-nums shrink-0">
                          <span className="font-bold text-slate-900">
                            ×{comp.cantidad}
                          </span>
                          <span className="text-[11px] text-emerald-700 block">
                            {comp.verificado ? 'Verificado' : 'Pendiente'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingAsset(activeAsset);
                    setEditLoc(activeAsset.ubicacion_actual);
                    setEditObs(activeAsset.observaciones);
                    setEditReason('');
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Editar Datos
                </button>

                <button
                  type="button"
                  disabled={
                    activeAsset.estado === 'En curso' ||
                    activeAsset.estado === 'Dado de baja'
                  }
                  onClick={() => setDecommissionAsset(activeAsset)}
                  className="px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-40 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <ArchiveX className="w-3.5 h-3.5" />
                  Dar de Baja Activo
                </button>
              </div>

              {activeAsset.estado === 'En curso' && (
                <p className="text-[11px] text-slate-500">
                  No se puede dar de baja un activo mientras se encuentra en tránsito.
                </p>
              )}

              {/* Inline Edit Drawer */}
              {editingAsset && editingAsset.id === activeAsset.id && (
                <div className="p-3.5 bg-slate-50 border border-slate-300 rounded-lg space-y-2.5 text-xs">
                  <div className="font-bold text-slate-900">
                    Actualizar Ficha de {editingAsset.id}
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                      Observaciones
                    </label>
                    <input
                      type="text"
                      value={editObs}
                      onChange={(e) => setEditObs(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                      Motivo de la modificación *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Actualización de póliza o ajuste de inventario"
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!editReason.trim()}
                      onClick={() => {
                        onEditAssetWithReason(
                          editingAsset.id,
                          editLoc,
                          editObs,
                          editReason.trim()
                        );
                        setEditingAsset(null);
                      }}
                      className="px-3 py-1.5 bg-blue-700 text-white font-semibold rounded disabled:bg-slate-300 cursor-pointer"
                    >
                      Guardar Cambios
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingAsset(null)}
                      className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Decommission Drawer */}
              {decommissionAsset && decommissionAsset.id === activeAsset.id && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg space-y-2.5 text-xs">
                  <div className="font-bold text-red-950">
                    Confirmar Baja Definitiva de Activo
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-red-900 mb-0.5">
                      Motivo de Baja:
                    </label>
                    <select
                      value={decommissionReason}
                      onChange={(e) => setDecommissionReason(e.target.value)}
                      className="w-full p-1.5 bg-white border border-red-300 rounded"
                    >
                      <option value="Obsolescencia tecnológica (> 5 años)">
                        Obsolescencia tecnológica (&gt; 5 años)
                      </option>
                      <option value="Daño irreparable tras siniestro">
                        Daño irreparable tras siniestro
                      </option>
                      <option value="Pérdida o robo confirmado con denuncia">
                        Pérdida o robo confirmado con denuncia
                      </option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onDecommissionAsset(
                          decommissionAsset.id,
                          decommissionReason
                        );
                        setDecommissionAsset(null);
                      }}
                      className="px-3 py-1.5 bg-red-700 text-white font-semibold rounded cursor-pointer"
                    >
                      Confirmar Baja e Inactivar QR
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecommissionAsset(null)}
                      className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      )}

      {/* VIEW 2: ALTA DE ACTIVO */}
      {subView === 'ALTA_ACTIVO' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-2xl space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Registrar Nuevo Activo Físico y Generar Etiqueta QR
            </h3>
            <p className="text-xs text-slate-600">
              Complete los datos de identificación para dar de alta el equipamiento en bodega.
            </p>
          </div>

          {registerNotice && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-950 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0" />
              <span>{registerNotice}</span>
            </div>
          )}

          <form
            onSubmit={handleCreateAssetSubmit}
            className="space-y-4 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  1. Tipo de Activo
                </label>
                <select
                  value={selectedTypeId}
                  onChange={(e) => setSelectedTypeId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white"
                >
                  {assetTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} (
                      {t.es_contenedor
                        ? 'Contenedor'
                        : 'Equipamiento Individual'}
                      )
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  2. Número de Serie Único *
                </label>
                <input
                  type="text"
                  required
                  value={newSerial}
                  onChange={(e) => setNewSerial(e.target.value)}
                  className="w-full p-2.5 font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {/* Dynamic attributes */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="font-semibold text-slate-800">
                Atributos de "{currentTypeConfig.nombre}":
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentTypeConfig.atributos_esquema.map((attr) => (
                  <div key={attr.key}>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      {attr.label} {attr.required && '*'}
                    </label>
                    {attr.type === 'lista' && attr.options ? (
                      <select
                        value={dynamicValues[attr.key] || attr.options[0]}
                        onChange={(e) =>
                          setDynamicValues({
                            ...dynamicValues,
                            [attr.key]: e.target.value,
                          })
                        }
                        className="w-full p-2 bg-white border border-slate-300 rounded"
                      >
                        {attr.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={attr.type === 'numero' ? 'number' : 'text'}
                        required={attr.required}
                        value={dynamicValues[attr.key] || ''}
                        onChange={(e) =>
                          setDynamicValues({
                            ...dynamicValues,
                            [attr.key]: e.target.value,
                          })
                        }
                        className="w-full p-2 bg-white border border-slate-300 rounded"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ubicación Inicial
                </label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Custodio Responsable Inicial
                </label>
                <input
                  type="text"
                  value={newCustodian}
                  onChange={(e) => setNewCustodian(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Observaciones
              </label>
              <input
                type="text"
                value={newObs}
                onChange={(e) => setNewObs(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Registrar Activo y Generar Etiqueta QR
            </button>
          </form>
        </div>
      )}

      {/* VIEW 3: TIPOS DE ACTIVO */}
      {subView === 'TIPOS_ACTIVO' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Layers className="w-4 h-4 text-blue-700" />
              Catálogo de Tipos de Activo Configurables
            </div>
            <div className="space-y-3">
              {assetTypes.map((t) => (
                <div
                  key={t.id}
                  className="p-4 border border-slate-200 rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">
                      {t.nombre} ({t.codigo_prefijo})
                    </span>
                    <span className="text-xs font-mono text-slate-600">
                      Valor Declarado: $
                      {t.valor_declarado_clp.toLocaleString('es-CL')} CLP
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    Modalidad:{' '}
                    {t.es_contenedor
                      ? 'Contenedor (Agrupa componentes)'
                      : 'Activo individual'}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    Campos configurados:{' '}
                    {t.atributos_esquema
                      .map((a) => `${a.label} (${a.type})`)
                      .join(' · ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Sliders className="w-4 h-4 text-blue-700" />
              Agregar Nuevo Tipo de Activo
            </div>
            <form onSubmit={handleCreateTypeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nombre del Tipo de Activo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Escáner de Libros Genealógicos"
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Prefijo de Código
                  </label>
                  <input
                    type="text"
                    value={typePrefix}
                    onChange={(e) => setTypePrefix(e.target.value)}
                    className="w-full p-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Valor Declarado (CLP)
                  </label>
                  <input
                    type="number"
                    value={typeValueClp}
                    onChange={(e) => setTypeValueClp(Number(e.target.value))}
                    className="w-full p-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Campo Técnico Adicional
                </label>
                <input
                  type="text"
                  value={customAttrLabel}
                  onChange={(e) => setCustomAttrLabel(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={typeIsContainer}
                  onChange={(e) => setTypeIsContainer(e.target.checked)}
                  className="accent-blue-700"
                />
                <span>Es contenedor (permite asociar componentes internos)</span>
              </label>
              <button
                type="submit"
                className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg cursor-pointer"
              >
                Guardar Tipo de Activo
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

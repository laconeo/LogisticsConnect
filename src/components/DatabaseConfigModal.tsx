import React, { useState } from 'react';
import {
  Database,
  Download,
  Upload,
  RotateCcw,
  Copy,
  Check,
  X,
  HardDrive,
  FileCode2,
  FileSpreadsheet,
  Cloud,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import {
  PersistedDatabaseSnapshot,
  downloadTextFile,
  downloadShipmentsCsv,
} from '../services/databaseService';
import { LOGISTICS_CONNECT_POSTGRES_DDL } from '../services/sqlSchema';
import {
  isSupabaseConfigured,
  testSupabaseConnection,
} from '../services/supabaseClient';
import { SupabaseDataService } from '../services/supabaseDataService';

interface DatabaseConfigModalProps {
  snapshot: PersistedDatabaseSnapshot;
  onImportSnapshot: (data: PersistedDatabaseSnapshot) => void;
  onResetFactory: () => void;
  onClose: () => void;
}

export const DatabaseConfigModal: React.FC<DatabaseConfigModalProps> = ({
  snapshot,
  onImportSnapshot,
  onResetFactory,
  onClose,
}) => {
  const [tab, setTab] = useState<'respaldo' | 'sql' | 'supabase'>('supabase');
  const [copiedSql, setCopiedSql] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Estado para la prueba de conexión con Supabase
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    tableFound?: boolean;
    url?: string;
  } | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleSyncToSupabase = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await SupabaseDataService.seedAll(snapshot);
      setSyncResult(res);
    } catch (e) {
      setSyncResult({
        success: false,
        message: 'Error al sincronizar: ' + (e instanceof Error ? e.message : String(e)),
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testSupabaseConnection();
      setTestResult(result);
    } catch (e) {
      setTestResult({
        success: false,
        message: 'Error inesperado al probar conexión: ' + (e instanceof Error ? e.message : String(e)),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleExportJSON = () => {
    const json = JSON.stringify(snapshot, null, 2);
    downloadTextFile(
      `logistics_connect_backup_${new Date().toISOString().slice(0, 10)}.json`,
      json,
      'application/json'
    );
  };

  const handleDownloadSQL = () => {
    downloadTextFile(
      'logistics_connect_postgresql_schema.sql',
      LOGISTICS_CONNECT_POSTGRES_DDL,
      'text/plain;charset=utf-8'
    );
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(LOGISTICS_CONNECT_POSTGRES_DDL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result));
        if (!parsed.assets || !parsed.shipments) {
          throw new Error('Estructura de respaldo JSON inválida.');
        }
        onImportSnapshot(parsed);
        setImportError(null);
      } catch (err) {
        setImportError(
          err instanceof Error
            ? err.message
            : 'Error al leer el archivo de respaldo JSON.'
        );
      }
    };
    reader.readAsText(file);
  };

  const configured = isSupabaseConfigured();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full overflow-hidden shadow-2xl my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Database className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">
                Administración de Datos, Supabase y Esquema SQL
              </h3>
              <p className="text-[11px] text-slate-400">
                Conexión Supabase PostgreSQL, respaldos JSON, reportes CSV y script DDL de tablas.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-md cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="px-4 sm:px-6 pt-2 bg-slate-100 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto shrink-0 no-scrollbar">
          <button
            onClick={() => setTab('supabase')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-md border-t border-x transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              tab === 'supabase'
                ? 'bg-white border-slate-200 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-emerald-600" />
            Conexión Supabase
            {configured ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block ml-1" title="Configurado" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block ml-1" title="Pendiente de configurar" />
            )}
          </button>
          <button
            onClick={() => setTab('respaldo')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-md border-t border-x transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              tab === 'respaldo'
                ? 'bg-white border-slate-200 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-blue-600" />
            Exportación y Respaldo JSON
          </button>
          <button
            onClick={() => setTab('sql')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-md border-t border-x transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              tab === 'sql'
                ? 'bg-white border-slate-200 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5 text-indigo-600" />
            Esquema Relacional (`schema.sql`)
          </button>
        </div>

        {/* Tab 1: Supabase */}
        {tab === 'supabase' && (
          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Estado de Configuración Supabase
                  </span>
                  {configured ? (
                    <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Configurado en .env
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-800 rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-600" /> Falta configurar .env
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 font-mono">
                  URL: {import.meta.env.VITE_SUPABASE_URL || 'No configurada (VITE_SUPABASE_URL)'}
                </p>
              </div>

              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-xs flex items-center gap-2 cursor-pointer whitespace-nowrap self-start md:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                {isTesting ? 'Probando conexión...' : 'Probar Conexión con Supabase'}
              </button>
            </div>

            {testResult && (
              <div
                className={`p-4 rounded-lg border text-xs flex items-start gap-3 ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{testResult.message}</p>
                  {testResult.tableFound === false && (
                    <p className="mt-1 text-[11px] text-emerald-700">
                      Sugerencia: Ve a la pestaña <b>"Esquema Relacional"</b>, copia el script SQL y pégalo en el <b>SQL Editor</b> de tu panel de Supabase para inicializar las tablas con un clic.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Sincronización Manual de Datos a Supabase */}
            <div className="p-4 rounded-lg border border-blue-200 bg-blue-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-blue-600" />
                  Sincronización Total con Base de Datos Supabase
                </h4>
                <p className="text-[11px] text-blue-800 mt-0.5">
                  Sube o actualiza en bloque todos los activos ({snapshot.assets.length}), envíos ({snapshot.shipments.length}) y usuarios ({snapshot.users.length}) directamente a tus tablas de Supabase.
                </p>
              </div>
              <button
                onClick={handleSyncToSupabase}
                disabled={isSyncing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-md shadow-xs flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Sincronizando...' : 'Sincronizar a Supabase'}
              </button>
            </div>

            {syncResult && (
              <div
                className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                  syncResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {syncResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{syncResult.message}</p>
                </div>
              </div>
            )}

            {/* Guía rápida de configuración */}
            <div className="border border-slate-200 rounded-lg p-5 bg-white space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                Pasos para vincular tu proyecto existente de Supabase:
              </h4>

              <ol className="text-xs text-slate-600 space-y-3 list-decimal list-inside leading-relaxed">
                <li>
                  Abre tu archivo <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-800 font-mono">.env</code> en la raíz del proyecto.
                </li>
                <li>
                  Ingresa las credenciales de tu proyecto de Supabase (desde <i>Project Settings → API</i>):
                  <pre className="bg-slate-900 text-emerald-400 p-3 rounded mt-1.5 font-mono text-[11px] overflow-x-auto">
                    VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co{'\n'}
                    VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
                  </pre>
                </li>
                <li>
                  Crea las 16 tablas y políticas de seguridad (RLS) en Supabase:
                  <div className="mt-1 pl-4 text-slate-500">
                    Copia el contenido de la pestaña <b>Esquema Relacional (`schema.sql`)</b> y pégalo en el <b>SQL Editor</b> de Supabase, luego presiona <b>Run</b>.
                  </div>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Tab 2: Respaldo */}
        {tab === 'respaldo' && (
          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
            {/* Database Record Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Activos
                </span>
                <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                  {snapshot.assets.length}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Envíos
                </span>
                <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                  {snapshot.shipments.length}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Movimientos
                </span>
                <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                  {snapshot.movements.length}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Auditoría
                </span>
                <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                  {snapshot.auditLogs.length}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Campañas
                </span>
                <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                  {snapshot.inventories.length}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Incidentes
                </span>
                <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                  {snapshot.incidents.length}
                </span>
              </div>
            </div>

            {/* Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Export JSON */}
              <div className="p-4 border border-slate-200 rounded-lg space-y-2 bg-white">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-bold text-slate-900">
                    Exportar Respaldo Completo (JSON)
                  </h4>
                </div>
                <p className="text-xs text-slate-500">
                  Descarga un archivo con toda la información local de activos, envíos, auditoría y catálogos.
                </p>
                <button
                  onClick={handleExportJSON}
                  className="w-full mt-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar Respaldo JSON
                </button>
              </div>

              {/* Export CSV */}
              <div className="p-4 border border-slate-200 rounded-lg space-y-2 bg-white">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-900">
                    Reporte de Envíos en CSV (Excel)
                  </h4>
                </div>
                <p className="text-xs text-slate-500">
                  Exporta la planilla de órdenes de despacho con formato compatible para Microsoft Excel y Google Sheets.
                </p>
                <button
                  onClick={() => downloadShipmentsCsv(snapshot.shipments)}
                  className="w-full mt-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar Reporte Envíos CSV
                </button>
              </div>

              {/* Import JSON */}
              <div className="p-4 border border-slate-200 rounded-lg space-y-2 bg-white">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-bold text-slate-900">
                    Restaurar Respaldo (JSON)
                  </h4>
                </div>
                <p className="text-xs text-slate-500">
                  Carga un archivo de respaldo generado previamente para restaurar el estado completo.
                </p>
                <label className="w-full mt-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md shadow-xs flex items-center justify-center gap-2 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  Seleccionar Archivo JSON
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJSON}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Factory Reset */}
              <div className="p-4 border border-rose-200 rounded-lg space-y-2 bg-rose-50/50">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-rose-600" />
                  <h4 className="text-xs font-bold text-rose-900">
                    Restablecer Datos de Demostración
                  </h4>
                </div>
                <p className="text-xs text-rose-700">
                  Borra las modificaciones locales y recarga el conjunto de datos de prueba corporativo.
                </p>
                <button
                  onClick={onResetFactory}
                  className="w-full mt-2 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-md shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restablecer a Valores de Fábrica
                </button>
              </div>
            </div>

            {importError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md">
                {importError}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: SQL */}
        {tab === 'sql' && (
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Script DDL PostgreSQL / Supabase (16 Tablas, Triggers Append-Only y RLS)
                </h4>
                <p className="text-xs text-slate-500">
                  Ejecute este script en el SQL Editor de Supabase o en su instancia PostgreSQL para crear la estructura relacional corporativa.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopySQL}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar SQL
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownloadSQL}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar schema.sql
                </button>
              </div>
            </div>

            <pre className="bg-slate-950 text-slate-200 p-4 rounded-lg text-[11px] font-mono overflow-x-auto max-h-96 leading-relaxed">
              {LOGISTICS_CONNECT_POSTGRES_DDL}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

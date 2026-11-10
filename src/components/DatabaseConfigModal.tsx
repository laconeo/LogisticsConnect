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
} from 'lucide-react';
import {
  PersistedDatabaseSnapshot,
  downloadTextFile,
  downloadShipmentsCsv,
} from '../services/databaseService';
import { LOGISTICS_CONNECT_POSTGRES_DDL } from '../services/sqlSchema';

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
  const [tab, setTab] = useState<'respaldo' | 'sql'>('respaldo');
  const [copiedSql, setCopiedSql] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-lg max-w-4xl w-full overflow-hidden shadow-xl my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">
              <Database className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">
                Administración de Datos, Exportación CSV/JSON y Esquema SQL
              </h3>
              <p className="text-[11px] text-slate-400">
                Respaldo de base de datos local, reportes CSV para Excel y script DDL PostgreSQL.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="px-6 pt-3 bg-slate-100 border-b border-slate-200 flex items-center gap-2">
          <button
            onClick={() => setTab('respaldo')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-md border-t border-x transition-colors flex items-center gap-1.5 cursor-pointer ${
              tab === 'respaldo'
                ? 'bg-white border-slate-200 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-blue-600" />
            Exportación de Datos y Respaldo JSON
          </button>
          <button
            onClick={() => setTab('sql')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-md border-t border-x transition-colors flex items-center gap-1.5 cursor-pointer ${
              tab === 'sql'
                ? 'bg-white border-slate-200 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5 text-emerald-600" />
            Esquema Relacional PostgreSQL (`schema.sql`)
          </button>
        </div>

        {tab === 'respaldo' ? (
          <div className="p-6 space-y-6">
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
                  Inventarios
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
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Auditoría
                </span>
                <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                  {snapshot.auditLogs.length}
                </span>
              </div>
            </div>

            {/* Direct CSV Export */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Planilla Consolidada de Envíos y Recepciones (Excel CSV)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Descargue el reporte completo con estado de envíos, remitos, receptores y validación de evidencias.
                </p>
              </div>
              <button
                onClick={() => downloadShipmentsCsv(snapshot.shipments)}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Exportar Envíos a Excel (.CSV)
              </button>
            </div>

            {/* Full Backup / Restore JSON */}
            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleExportJSON}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar Respaldo Completo (.JSON)
                </button>
                <label className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  Restaurar desde Respaldo (.JSON)
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJSON}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={onResetFactory}
                  className="px-3.5 py-2 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold rounded-md flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restablecer Datos Iniciales
                </button>
              </div>
            </div>

            {importError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md">
                {importError}
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Script DDL PostgreSQL / Supabase (16 Tablas, Triggers Append-Only y RLS)
                </h4>
                <p className="text-xs text-slate-500">
                  Ejecute este script en su instancia PostgreSQL para crear la estructura relacional corporativa.
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

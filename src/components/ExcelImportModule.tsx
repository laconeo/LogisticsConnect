import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Upload,
  Plus,
  Download,
  ClipboardPaste,
  Wand2,
} from 'lucide-react';
import { ExcelImportRow } from '../types/logistics';
import {
  validateExcelRow,
  CHILE_COMUNAS_CATALOG,
} from '../data/initialData';
import { downloadTextFile } from '../services/databaseService';

interface ExcelImportModuleProps {
  rows: ExcelImportRow[];
  onUpdateRow: (updatedRow: ExcelImportRow) => void;
  onReplaceAllRows: (newRows: ExcelImportRow[]) => void;
  onAutoNormalizeAll: () => void;
  onCommitValidRows: (validRows: ExcelImportRow[]) => void;
}

export const ExcelImportModule: React.FC<ExcelImportModuleProps> = ({
  rows,
  onUpdateRow,
  onReplaceAllRows,
  onAutoNormalizeAll,
  onCommitValidRows,
}) => {
  const [editingRowNum, setEditingRowNum] = useState<number | null>(null);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const validations = rows.map((r) => ({
    row: r,
    val: validateExcelRow(r),
  }));

  const activeValidations = validations.filter((v) => !v.row.excluida);
  const validRows = activeValidations.filter((v) => v.val.es_valida).map((v) => v.row);
  const invalidCount = activeValidations.filter((v) => !v.val.es_valida).length;

  const parseDelimitedText = (text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const firstLower = lines[0].toLowerCase();
    const dataLines =
      firstLower.includes('unidad') ||
        firstLower.includes('estaca') ||
        firstLower.includes('destinatario') ||
        firstLower.includes('rut')
        ? lines.slice(1)
        : lines;

    const parsed: ExcelImportRow[] = dataLines.map((line, idx) => {
      const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
      const cols = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
      return {
        fila: idx + 1,
        nro_unidad: cols[0] || `52${100 + idx}`,
        estaca_distrito: cols[1] || 'Estaca Por Confirmar',
        destinatario: cols[2] || 'Destinatario Titular',
        rut: cols[3] || '',
        telefono: cols[4] || '+56 9 0000 0000',
        correo: cols[5] || '',
        direccion: cols[6] || 'Dirección sin especificar',
        comuna_raw: cols[7] || '',
        ciudad: cols[8] || 'Santiago',
        comentario_planilla: cols[9] || '',
      };
    });

    if (parsed.length > 0) {
      onReplaceAllRows(parsed);
      setBatchNotice(
        `Se cargaron ${parsed.length} filas para validación previa a la creación de envíos.`
      );
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      parseDelimitedText(String(ev.target?.result || ''));
    };
    reader.readAsText(file);
  };

  const handlePasteSubmit = () => {
    if (!pasteContent.trim()) return;
    parseDelimitedText(pasteContent);
    setShowPasteBox(false);
    setPasteContent('');
  };

  const handleDownloadTemplate = () => {
    const csv = [
      'nro_unidad;estaca_distrito;destinatario;rut;telefono;correo;direccion;comuna;ciudad;comentario',
      '514820;Estaca Santiago Peñalolén;Roberto Andrés Morales Vega;12.845.392-4;+56 9 8412 5530;rmoralesv@iglesiajesucristo.org;Av. Consistorial 2840;Peñalolén;Santiago;Solicita capacitación inicial',
      '521904;Estaca Talca Norte;Gonzalo Esteban Tapia Rojas;13.490.118-K;+56 9 7623 9011;gtapiarojas@iglesiajesucristo.org;Av. Lircay 1450;Talca;Talca;Renovación de equipamiento',
    ].join('\n');
    downloadTextFile(
      'plantilla_importacion_logistics_connect.csv',
      csv,
      'text/csv;charset=utf-8;'
    );
  };

  const handleAddRow = () => {
    const nextFila = rows.length > 0 ? Math.max(...rows.map((r) => r.fila)) + 1 : 1;
    onReplaceAllRows([
      ...rows,
      {
        fila: nextFila,
        nro_unidad: `530${nextFila}`,
        estaca_distrito: 'Estaca Nueva Unidad',
        destinatario: 'Presidente de Estaca',
        rut: '12.345.678-5',
        telefono: '+56 9 8888 7777',
        correo: 'presidente@iglesiajesucristo.org',
        direccion: 'Av. Principal 100',
        comuna_raw: 'Providencia',
        ciudad: 'Santiago',
        comentario_planilla: 'Ingreso manual en lote',
      },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Header Card — Apple Card Style */}
      <div className="apple-card rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#007AFF] font-bold block">
              Carga Masiva de Unidades y Envíos
            </span>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">
              Importador de Planillas Excel / CSV con Normalización de Comunas y RUT
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl">
              Suba un archivo CSV o pegue un rango de celdas desde Excel. El asistente detecta comunas con errores de escritura, normaliza el formato del RUT chileno y valida correos antes de generar los activos y órdenes de envío.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={handleDownloadTemplate}
              className="px-3.5 py-2 bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-xs active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Plantilla CSV
            </button>
            <button
              onClick={() => setShowPasteBox(!showPasteBox)}
              className="px-3.5 py-2 bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-xs active:scale-95"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-[#007AFF]" />
              Pegar desde Excel
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-xs active:scale-95"
            >
              <Upload className="w-3.5 h-3.5 text-[#007AFF]" />
              Subir Archivo CSV
            </button>
            <button
              onClick={handleAddRow}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar Fila
            </button>
          </div>
        </div>

        {showPasteBox && (
          <div className="mt-4 p-4 bg-slate-50/90 border border-slate-200/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Pegar Celdas desde Microsoft Excel (Separadas por Tabulación o Punto y Coma)
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                Unidad | Estaca/Distrito | Destinatario | RUT | Teléfono | Correo | Dirección | Comuna
              </span>
            </div>
            <textarea
              rows={4}
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder={`514820\tEstaca Santiago Peñalolén\tRoberto Morales Vega\t12.845.392-4\t+56 9 8412 5530\trmoralesv@iglesiajesucristo.org\tAv. Consistorial 2840\tPeñalolén\tSantiago`}
              className="w-full p-3 text-xs font-mono bg-white border border-slate-300/80 rounded-xl focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPasteBox(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePasteSubmit}
                className="px-4 py-2 bg-[#007AFF] hover:bg-[#0066d6] text-white text-xs font-semibold rounded-xl cursor-pointer shadow-sm active:scale-95 transition-all"
              >
                Procesar Filas Pegadas
              </button>
            </div>
          </div>
        )}

        {/* Summary & Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-5">
          <div className="flex items-center gap-3">
            <div className="flex-1 sm:flex-none px-4 py-2 bg-emerald-50 border border-emerald-200/80 rounded-xl text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                Filas Válidas
              </span>
              <span className="text-lg font-bold font-mono text-emerald-800 tabular-nums">
                {validRows.length} / {activeValidations.length}
              </span>
            </div>
            <div className="flex-1 sm:flex-none px-4 py-2 bg-rose-50 border border-rose-200/80 rounded-xl text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                Observadas
              </span>
              <span className="text-lg font-bold font-mono text-rose-800 tabular-nums">
                {invalidCount}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {invalidCount > 0 && (
              <button
                onClick={() => {
                  onAutoNormalizeAll();
                  setBatchNotice(
                    'Se normalizaron automáticamente las comunas sugeridas, formatos de RUT y correos observados.'
                  );
                }}
                className="w-full sm:w-auto justify-center px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
              >
                <Wand2 className="w-4 h-4" />
                Normalizar Automáticamente ({invalidCount} filas)
              </button>
            )}

            <button
              onClick={() => {
                if (validRows.length === 0) return;
                onCommitValidRows(validRows);
                setBatchNotice(
                  `Se importaron exitosamente ${validRows.length} envíos con sus activos y etiquetas QR.`
                );
              }}
              disabled={validRows.length === 0}
              className="w-full sm:w-auto justify-center px-4 py-2.5 bg-[#007AFF] hover:bg-[#0066d6] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Confirmar e Importar {validRows.length} Filas Válidas
            </button>
          </div>
        </div>

        {batchNotice && (
          <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
            <span className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {batchNotice}
            </span>
            <button
              onClick={() => setBatchNotice(null)}
              className="text-emerald-700 underline font-semibold ml-4 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>

      {/* Validation Table */}
      <div className="apple-card rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Revisión y Corrección en Línea de Planilla
          </h3>
          <span className="text-xs text-slate-500">
            Puede corregir cada fila individualmente o usar la normalización asistida.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Fila</th>
                <th className="py-3 px-4">Unidad / Estaca o Distrito</th>
                <th className="py-3 px-4">Destinatario Titular y RUT</th>
                <th className="py-3 px-4">Dirección y Comuna</th>
                <th className="py-3 px-4">Estado de Validación</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-xs">
              {validations.map(({ row, val }) => {
                if (row.excluida) return null;
                const isEditing = editingRowNum === row.fila;
                return (
                  <tr
                    key={row.fila}
                    className={
                      val.es_valida
                        ? 'hover:bg-slate-50/80'
                        : 'bg-rose-50/30 hover:bg-rose-50/50'
                    }
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-500 tabular-nums">
                      #{row.fila}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">
                        {row.estaca_distrito}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        Unidad #{row.nro_unidad}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">
                        {row.destinatario}
                      </div>
                      {isEditing ? (
                        <div className="flex flex-col gap-1 mt-1">
                          <input
                            type="text"
                            value={row.rut}
                            onChange={(e) =>
                              onUpdateRow({ ...row, rut: e.target.value })
                            }
                            placeholder="RUT"
                            className="px-2 py-1 text-xs font-mono border border-blue-500 rounded bg-white"
                          />
                          <input
                            type="text"
                            value={row.correo}
                            onChange={(e) =>
                              onUpdateRow({ ...row, correo: e.target.value })
                            }
                            placeholder="Correo electrónico"
                            className="px-2 py-1 text-xs border border-blue-500 rounded bg-white"
                          />
                        </div>
                      ) : (
                        <div className="text-[11px] font-mono text-slate-500">
                          RUT: {row.rut} · {row.correo}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-800">{row.direccion}</div>
                      {isEditing ? (
                        <select
                          value={row.comuna_raw}
                          onChange={(e) =>
                            onUpdateRow({ ...row, comuna_raw: e.target.value })
                          }
                          className="mt-1 px-2 py-1 text-xs border border-blue-500 rounded bg-white font-semibold"
                        >
                          <option value={row.comuna_raw}>
                            {row.comuna_raw} (Actual)
                          </option>
                          {CHILE_COMUNAS_CATALOG.map((c) => (
                            <option key={c.comuna} value={c.comuna}>
                              {c.comuna} — {c.region}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-[11px] font-semibold text-slate-700">
                          Comuna: {row.comuna_raw}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {val.es_valida ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          Válida para importar
                        </span>
                      ) : (
                        <div className="space-y-1">
                          {val.errores.map((err, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-1.5 text-rose-700 text-[11px] font-medium"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <span>{err}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                      {!val.es_valida && val.comuna_sugerida && !isEditing && (
                        <button
                          onClick={() =>
                            onUpdateRow({
                              ...row,
                              comuna_raw: val.comuna_sugerida || row.comuna_raw,
                              rut: val.rut_normalizado || row.rut,
                            })
                          }
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-semibold cursor-pointer"
                        >
                          Aplicar sugerencia
                        </button>
                      )}
                      <button
                        onClick={() =>
                          setEditingRowNum(isEditing ? null : row.fila)
                        }
                        className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-[11px] font-semibold cursor-pointer"
                      >
                        {isEditing ? 'Guardar' : 'Editar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

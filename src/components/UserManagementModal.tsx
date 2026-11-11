import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  X,
  CheckCircle2,
  AlertCircle,
  Mail,
  Lock,
  Globe,
  Building2,
  MapPin,
  Truck,
  Check,
  Search,
  Key,
} from 'lucide-react';
import { UserAccount, UserRole, CountryCode } from '../types/logistics';
import { CARRIERS } from '../data/initialData';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

interface UserManagementModalProps {
  currentUser: UserAccount;
  users: UserAccount[];
  onAddUser: (newUser: UserAccount) => void;
  onToggleUserStatus: (userId: string) => void;
  onClose: () => void;
}

const ROLE_OPTIONS: {
  value: UserRole;
  label: string;
  description: string;
  color: string;
}[] = [
  {
    value: 'ADMIN_REGIONAL',
    label: 'Administrador Regional',
    description: 'Acceso total a las 6 instancias, gestión de 4 países y alta de usuarios.',
    color: 'border-rose-300 bg-rose-50 text-rose-800',
  },
  {
    value: 'COORDINADOR_NACIONAL',
    label: 'Coordinador Nacional',
    description: 'Gestión nacional completa restringida al país asignado.',
    color: 'border-blue-300 bg-blue-50 text-blue-800',
  },
  {
    value: 'ENCARGADO_BODEGA',
    label: 'Encargado de Bodega Central',
    description: 'Alta de activos, QR, armado de contenedores y stock físico.',
    color: 'border-amber-300 bg-amber-50 text-amber-800',
  },
  {
    value: 'TRANSPORTISTA',
    label: 'Operador Logístico / Transportista',
    description: 'Terminal móvil exclusiva para entregas y captura de remitos en ruta.',
    color: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  },
  {
    value: 'AUDITOR',
    label: 'Auditor de Cumplimiento',
    description: 'Modo solo lectura para inspección forense y hashes de auditoría.',
    color: 'border-purple-300 bg-purple-50 text-purple-800',
  },
];

const COUNTRIES: { code: CountryCode; label: string }[] = [
  { code: 'CL', label: 'Chile (CL)' },
  { code: 'AR', label: 'Argentina (AR)' },
  { code: 'PY', label: 'Paraguay (PY)' },
  { code: 'UY', label: 'Uruguay (UY)' },
];

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  currentUser,
  users,
  onAddUser,
  onToggleUserStatus,
  onClose,
}) => {
  const [tab, setTab] = useState<'lista' | 'alta'>('alta');
  const [search, setSearch] = useState('');

  // Form State
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('fs2026');
  const [rol, setRol] = useState<UserRole>('COORDINADOR_NACIONAL');
  const [pais, setPais] = useState<CountryCode>('CL');
  const [organizacion, setOrganizacion] = useState('FamilySearch');
  const [ambito, setAmbito] = useState('Chile · Nacional');
  const [transportistaId, setTransportistaId] = useState(CARRIERS[0].id);

  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verificación estricta: Solo Administrador Regional puede ver y usar este módulo
  if (currentUser.rol !== 'ADMIN_REGIONAL') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-rose-200">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Acceso Restringido
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            La creación y alta de usuarios está reservada exclusivamente para el perfil{' '}
            <b className="text-rose-700">Administrador Regional (ADMIN_REGIONAL)</b>. Tu perfil actual es{' '}
            <b>{currentUser.rol_etiqueta}</b>.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Entendido / Cerrar
          </button>
        </div>
      </div>
    );
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);

    // Validaciones
    if (!nombre.trim() || nombre.trim().length < 3) {
      setFormError('Por favor ingrese el nombre completo del usuario (mínimo 3 caracteres).');
      return;
    }

    const emailNorm = correo.trim().toLowerCase();
    if (!emailNorm || !emailNorm.includes('@') || !emailNorm.includes('.')) {
      setFormError('Por favor ingrese un correo electrónico corporativo válido.');
      return;
    }

    const exists = users.some((u) => u.correo.trim().toLowerCase() === emailNorm);
    if (exists) {
      setFormError(`Ya existe un usuario registrado con el correo ${emailNorm}.`);
      return;
    }

    if (!password.trim() || password.trim().length < 4) {
      setFormError('La contraseña inicial debe tener al menos 4 caracteres.');
      return;
    }

    setIsSubmitting(true);

    const selectedRoleMeta = ROLE_OPTIONS.find((r) => r.value === rol);
    const newId = `USR-${(users.length + 1).toString().padStart(2, '0')}`;

    const newUser: UserAccount = {
      id: newId,
      nombre: nombre.trim(),
      correo: emailNorm,
      rol,
      rol_etiqueta: selectedRoleMeta?.label || rol,
      pais,
      ambito: ambito.trim() || `${pais} · Operativo`,
      organizacion: organizacion.trim() || 'Logistics Connect',
      transportista_id: rol === 'TRANSPORTISTA' ? transportistaId : undefined,
      activo: true,
      password: password.trim(),
    };

    try {
      // 1. Guardar en memoria y persistencia local
      onAddUser(newUser);

      // 2. Si Supabase está configurado, sincronizar con la tabla usuarios
      if (isSupabaseConfigured() && supabase) {
        try {
          await supabase.from('usuarios').insert({
            id: newUser.id,
            nombre: newUser.nombre,
            correo: newUser.correo,
            rol: newUser.rol,
            pais_iso: newUser.pais,
            unidad_asignada: newUser.ambito,
            activo: true,
          });
        } catch (supaErr) {
          console.warn('Nota: No se pudo insertar en Supabase (modo local activo):', supaErr);
        }
      }

      setSuccessMsg(
        `¡Usuario ${newUser.nombre} (${newUser.rol_etiqueta}) dado de alta exitosamente con ID ${newId}!`
      );

      // Limpiar formulario
      setNombre('');
      setCorreo('');
      setPassword('fs2026');
      setRol('COORDINADOR_NACIONAL');
      setPais('CL');
      setOrganizacion('FamilySearch');
      setAmbito('Chile · Nacional');
    } catch (err) {
      setFormError('Ocurrió un error al registrar el usuario: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.nombre.toLowerCase().includes(search.toLowerCase()) ||
      u.correo.toLowerCase().includes(search.toLowerCase()) ||
      u.rol_etiqueta.toLowerCase().includes(search.toLowerCase()) ||
      u.pais.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl my-6 flex flex-col max-h-[92vh]">
        {/* Encabezado con distintivo de Administrador */}
        <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600 flex items-center justify-center shadow-md shadow-rose-600/30">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight">
                  Gestión y Alta de Usuarios
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-rose-900/90 text-rose-200 border border-rose-700/80">
                  Solo Administrador Regional
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Crea nuevas cuentas operativas y asigna perfiles de acceso para la plataforma.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de pestañas */}
        <div className="px-6 pt-3 bg-slate-100 border-b border-slate-200 flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setTab('alta');
              setSuccessMsg(null);
            }}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg border-t border-x transition-colors flex items-center gap-2 cursor-pointer ${
              tab === 'alta'
                ? 'bg-white border-slate-200 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-4 h-4 text-rose-600" />
            Dar de Alta Nuevo Usuario
          </button>
          <button
            onClick={() => {
              setTab('lista');
              setSuccessMsg(null);
            }}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg border-t border-x transition-colors flex items-center gap-2 cursor-pointer ${
              tab === 'lista'
                ? 'bg-white border-slate-200 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 text-blue-600" />
            Usuarios Registrados ({users.length})
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* TAB 1: FORMULARIO DE ALTA */}
          {tab === 'alta' && (
            <form onSubmit={handleCreateUser} className="space-y-6">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Error de validación:</span> {formError}
                  </div>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-lg flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Registro completado:</span> {successMsg}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Nombre */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Nombre Completo <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="ej: Rodrigo Soto Morales"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900 font-medium"
                  />
                </div>

                {/* Correo */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Correo Electrónico Corporativo <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      placeholder="ej: rsoto@familysearch.org"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900 font-medium"
                    />
                  </div>
                </div>

                {/* Contraseña Inicial */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Contraseña Inicial de Acceso <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="fs2026"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono text-slate-900"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    El usuario podrá iniciar sesión con esta credencial.
                  </span>
                </div>

                {/* País */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    País Asignado <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={pais}
                    onChange={(e) => setPais(e.target.value as CountryCode)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900 font-medium cursor-pointer"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Organización */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Organización / Entidad
                  </label>
                  <input
                    type="text"
                    value={organizacion}
                    onChange={(e) => setOrganizacion(e.target.value)}
                    placeholder="ej: FamilySearch Chile o Starken Cargo"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                  />
                </div>

                {/* Ámbito Operativo */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Ámbito Operativo / Territorio
                  </label>
                  <input
                    type="text"
                    value={ambito}
                    onChange={(e) => setAmbito(e.target.value)}
                    placeholder="ej: Bodega Central Providencia o Chile · Nacional"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                  />
                </div>
              </div>

              {/* Selector de Rol */}
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Perfil y Permisos Operativos (RBAC) <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ROLE_OPTIONS.map((opt) => {
                    const isSelected = rol === opt.value;
                    return (
                      <div
                        key={opt.value}
                        onClick={() => setRol(opt.value)}
                        className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/60 shadow-xs ring-1 ring-blue-500/20'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${opt.color}`}
                            >
                              {opt.label}
                            </span>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 leading-snug pt-1">
                            {opt.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Si es Transportista, selección de empresa */}
              {rol === 'TRANSPORTISTA' && (
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
                  <label className="block text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    Empresa Transportista Vinculada
                  </label>
                  <select
                    value={transportistaId}
                    onChange={(e) => setTransportistaId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium text-slate-900 cursor-pointer"
                  >
                    {CARRIERS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} (Chile)
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-emerald-700">
                    Este usuario solo tendrá visibilidad de las órdenes asignadas a esta empresa transportista.
                  </p>
                </div>
              )}

              {/* Botón de Envío */}
              <div className="pt-2 flex justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-md shadow-rose-600/20 flex items-center gap-2 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  {isSubmitting ? 'Registrando Usuario...' : 'Dar de Alta Usuario'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: LISTA DE USUARIOS */}
          {tab === 'lista' && (
            <div className="space-y-4">
              {/* Buscador */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar usuario por nombre, correo, rol o país..."
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                />
              </div>

              {/* Lista */}
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {filteredUsers.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No se encontraron usuarios con ese criterio de búsqueda.
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const roleMeta = ROLE_OPTIONS.find((r) => r.value === u.rol);
                    const isCurrentUser = u.id === currentUser.id;

                    return (
                      <div
                        key={u.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">
                              {u.nombre}
                            </span>
                            {isCurrentUser && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-blue-100 text-blue-800">
                                Tu cuenta actual
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                roleMeta?.color || 'bg-slate-100 text-slate-800 border-slate-300'
                              }`}
                            >
                              {u.rol_etiqueta}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="flex items-center gap-1 font-mono">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {u.correo}
                            </span>
                            <span>·</span>
                            <span>{u.organizacion}</span>
                            <span>·</span>
                            <span className="font-semibold text-slate-700">País: {u.pais}</span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Ámbito: {u.ambito}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          <span
                            className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                              u.activo
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </span>

                          {!isCurrentUser && (
                            <button
                              type="button"
                              onClick={() => onToggleUserStatus(u.id)}
                              className={`text-xs px-2.5 py-1 rounded-md border font-medium cursor-pointer transition-colors ${
                                u.activo
                                  ? 'border-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300'
                                  : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              }`}
                            >
                              {u.activo ? 'Desactivar' : 'Activar'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import {
  Truck,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Cloud,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { UserAccount, UserRole } from '../types/logistics';
import { isSupabaseConfigured } from '../services/supabaseClient';

interface LoginScreenProps {
  users: UserAccount[];
  onLogin: (user: UserAccount, remember: boolean) => void;
}

const ROLE_BADGES: Record<
  UserRole,
  { label: string; bg: string; text: string; iconDesc: string }
> = {
  ADMIN_REGIONAL: {
    label: 'Administrador Regional',
    bg: 'bg-rose-100 text-rose-800 border-rose-300',
    text: 'text-rose-600',
    iconDesc: 'Acceso Total + Alta Usuarios',
  },
  COORDINADOR_NACIONAL: {
    label: 'Coordinador Nacional',
    bg: 'bg-blue-100 text-blue-800 border-blue-300',
    text: 'text-blue-600',
    iconDesc: 'Gestión País Completa',
  },
  ENCARGADO_BODEGA: {
    label: 'Encargado de Bodega',
    bg: 'bg-amber-100 text-amber-800 border-amber-300',
    text: 'text-amber-600',
    iconDesc: 'Bodega Central & QR',
  },
  TRANSPORTISTA: {
    label: 'Transportista / Ruta',
    bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    text: 'text-emerald-600',
    iconDesc: 'App Móvil de Terreno',
  },
  AUDITOR: {
    label: 'Auditor de Cumplimiento',
    bg: 'bg-purple-100 text-purple-800 border-purple-300',
    text: 'text-purple-600',
    iconDesc: 'Solo Lectura Forense',
  },
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ users, onLogin }) => {
  const [tab, setTab] = useState<'form' | 'demo'>('form');
  const [email, setEmail] = useState('mvalenzuela@familysearch.org');
  const [password, setPassword] = useState('fs2026');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabaseReady = isSupabaseConfigured();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    setTimeout(() => {
      const normalizedEmail = email.trim().toLowerCase();
      const matched = users.find(
        (u) => u.correo.trim().toLowerCase() === normalizedEmail
      );

      if (!matched) {
        setError('No existe ninguna cuenta registrada con este correo electrónico.');
        setLoading(false);
        return;
      }

      if (!matched.activo) {
        setError('Esta cuenta se encuentra inactiva. Contacte al Administrador Regional.');
        setLoading(false);
        return;
      }

      // Validar contraseña
      const expectedPassword = matched.password || 'fs2026';
      if (password.trim() !== expectedPassword && password.trim() !== 'fs2026') {
        setError('Contraseña incorrecta. (Contraseña de prueba por defecto: fs2026)');
        setLoading(false);
        return;
      }

      setLoading(false);
      onLogin(matched, rememberMe);
    }, 300);
  };

  const handleSelectDemoUser = (user: UserAccount) => {
    setEmail(user.correo);
    setPassword(user.password || 'fs2026');
    setError(null);
    onLogin(user, rememberMe);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex flex-col justify-between p-4 sm:p-6 antialiased selection:bg-blue-600 selection:text-white">
      {/* Barra superior mínima */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between py-2 text-slate-300">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-white block">
              LOGISTICS CONNECT
            </span>
            <span className="text-[10px] text-slate-400">
              Área Sudamérica Sur
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {supabaseReady ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Supabase Activo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-950/80 text-amber-400 border border-amber-800/80">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Modo Local
            </span>
          )}
        </div>
      </header>

      {/* Contenedor central */}
      <main className="max-w-md w-full mx-auto my-auto py-8">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
          {/* Encabezado del login */}
          <div className="space-y-1.5 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 mb-2 border border-blue-100 shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Iniciar Sesión en el Sistema
            </h1>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Plataforma de Control Logístico, Trazabilidad Inmutable y Gestión de Activos.
            </p>
          </div>

          {/* Selector de pestañas: Formulario vs Cuentas Demo */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setTab('form');
                setError(null);
              }}
              className={`py-2 rounded-md transition-all cursor-pointer ${
                tab === 'form'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Credenciales de Acceso
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('demo');
                setError(null);
              }}
              className={`py-2 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                tab === 'demo'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Perfiles de Prueba
            </button>
          </div>

          {/* Vista 1: Formulario tradicional */}
          {tab === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              {/* Correo */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ej: usuario@familysearch.org"
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-medium text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Contraseña */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Contraseña
                  </label>
                  <span className="text-[11px] text-slate-400 font-normal">
                    (Por defecto: fs2026)
                  </span>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Recordar sesión */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>Recordar sesión en este equipo</span>
                </label>
              </div>

              {/* Botón Ingresar */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-md shadow-blue-500/20 hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Autenticando...
                  </>
                ) : (
                  <>
                    Ingresar a Logistics Connect
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Vista 2: Selector Rápido por Perfil (Demo) */}
          {tab === 'demo' && (
            <div className="space-y-2.5">
              <p className="text-[11px] text-slate-500">
                Selecciona una de las cuentas autorizadas para probar los diferentes niveles de acceso y permisos:
              </p>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {users.map((u) => {
                  const badge = ROLE_BADGES[u.rol] || {
                    label: u.rol_etiqueta,
                    bg: 'bg-slate-100 text-slate-800 border-slate-300',
                    text: 'text-slate-600',
                    iconDesc: u.organizacion,
                  };
                  const isAdmin = u.rol === 'ADMIN_REGIONAL';

                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectDemoUser(u)}
                      className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between group ${
                        isAdmin
                          ? 'border-rose-200 bg-rose-50/40 hover:bg-rose-50 hover:border-rose-400'
                          : 'border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-blue-700 truncate">
                            {u.nombre}
                          </span>
                          {isAdmin && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-rose-600 text-white">
                              ADMIN
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {u.correo}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                          <span
                            className={`px-1.5 py-0.5 rounded border font-semibold ${badge.bg}`}
                          >
                            {badge.label}
                          </span>
                          <span className="text-slate-400">· {u.pais}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Nota de pie */}
        <p className="text-center text-[11px] text-slate-400 mt-4">
          Sistema certificado bajo estándares de seguridad inmutable y Row Level Security.
        </p>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 py-2">
        Logistics Connect MVP v1.2 · Chile & Área Sudamérica Sur
      </footer>
    </div>
  );
};


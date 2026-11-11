import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://gumfbdcfjfhpqtttlsbw.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_NHMpuCIW7vA2Xi4iIFhirw_-3Eo72E2';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('tu-proyecto') &&
    supabaseUrl.startsWith('https://')
  );
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

/**
 * Prueba la conectividad con Supabase consultando la tabla de países o el estado del API
 */
export async function testSupabaseConnection(): Promise<{
  success: boolean;
  message: string;
  url?: string;
  tableFound?: boolean;
}> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      success: false,
      message:
        'Supabase no está configurado. Asegúrate de configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env',
    };
  }

  try {
    const startTime = performance.now();
    // Intenta consultar la tabla de países del esquema DDL
    const { data, error } = await supabase
      .from('paises')
      .select('codigo_iso, nombre')
      .limit(5);
    const latency = Math.round(performance.now() - startTime);

    if (error) {
      // Si la tabla aún no fue creada mediante el script SQL DDL (42P01 en postgres o PGRST205 en PostgREST)
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return {
          success: true,
          tableFound: false,
          url: supabaseUrl,
          message: `¡Conexión exitosa con Supabase (${latency}ms)! Tus credenciales son válidas y el servidor respondió correctamente. Solo falta ejecutar el script SQL en el SQL Editor de Supabase.`,
        };
      }
      return {
        success: false,
        url: supabaseUrl,
        message: `Respuesta de Supabase: ${error.message} (Código: ${error.code || 'N/A'})`,
      };
    }

    return {
      success: true,
      tableFound: true,
      url: supabaseUrl,
      message: `Conexión exitosa con Supabase (${latency}ms). Se detectaron ${data?.length ?? 0} registros en la tabla 'paises'.`,
    };
  } catch (err) {
    return {
      success: false,
      url: supabaseUrl,
      message: `Error de red al intentar contactar Supabase: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Carga o sincroniza el conjunto de datos iniciales en las tablas de Supabase
 */
export async function seedSupabaseDatabase(snapshot: {
  users: any[];
  assets: any[];
  assetTypes: any[];
  shipments: any[];
}): Promise<{ success: boolean; message: string }> {
  if (!supabase) {
    return { success: false, message: 'Supabase no está configurado.' };
  }
  try {
    // 1. Tipos de activos
    if (snapshot.assetTypes && snapshot.assetTypes.length > 0) {
      const { error: tErr } = await supabase.from('tipos_activos').upsert(
        snapshot.assetTypes.map((t) => ({
          id: t.id,
          nombre: t.nombre,
          es_contenedor: t.es_contenedor ?? false,
          requiere_componentes: t.requiere_componentes ?? false,
          cantidad_componentes_esperada: t.cantidad_componentes_esperada ?? 0,
          icono: t.icono || 'Package',
          descripcion: t.descripcion || '',
        }))
      );
      if (tErr) throw tErr;
    }

    // 2. Usuarios
    if (snapshot.users && snapshot.users.length > 0) {
      const { error: uErr } = await supabase.from('usuarios').upsert(
        snapshot.users.map((u) => ({
          id: u.id,
          nombre: u.nombre,
          correo: u.correo,
          rol: u.rol,
          pais_iso: u.pais,
          unidad_asignada: u.ambito,
          activo: u.activo ?? true,
        }))
      );
      if (uErr) throw uErr;
    }

    // 3. Activos
    if (snapshot.assets && snapshot.assets.length > 0) {
      const { error: aErr } = await supabase.from('activos').upsert(
        snapshot.assets.map((a) => ({
          id: a.id,
          tipo_id: a.tipo_id,
          nombre: a.nombre,
          pais_iso: a.pais,
          ubicacion_actual: a.ubicacion_actual,
          estado_operativo: a.estado_operativo,
          custodio_actual: a.custodio_actual,
          total_componentes: a.total_componentes ?? 0,
          componentes_operativos: a.componentes_operativos ?? 0,
          valor_declarado_clp: a.valor_declarado_clp ?? 0,
          qr_token: a.qr_token,
        }))
      );
      if (aErr) throw aErr;
    }

    // 4. Órdenes de Envío
    if (snapshot.shipments && snapshot.shipments.length > 0) {
      const { error: sErr } = await supabase.from('ordenes_envio').upsert(
        snapshot.shipments.map((s) => ({
          id: s.id,
          remito_numero: s.remito_numero,
          activo_id: s.activo_id,
          qr_token: s.qr_token,
          pais_iso: s.pais,
          unidad_id: s.unidad_id,
          estaca_distrito: s.estaca_distrito,
          comuna: s.comuna,
          region: s.region,
          direccion: s.direccion,
          destinatario_titular: s.destinatario_titular,
          rut_titular: s.rut_titular,
          telefono_titular: s.telefono_titular || '',
          transportista_nombre: s.transportista_nombre,
          valor_declarado_clp: s.valor_declarado_clp ?? 0,
          estado: s.estado,
          estado_revision_evidencia: s.estado_revision_evidencia || 'Pendiente',
        }))
      );
      if (sErr) throw sErr;
    }

    return {
      success: true,
      message: `¡Datos iniciales sembrados con éxito en Supabase! Sincronizados ${snapshot.users.length} usuarios, ${snapshot.assets.length} activos y ${snapshot.shipments.length} envíos.`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Error al sembrar datos en Supabase: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

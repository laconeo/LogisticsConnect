import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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
      message: 'Supabase no está configurado. Asegúrate de configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env',
    };
  }

  try {
    const startTime = performance.now();
    // Intenta consultar la tabla de países del esquema DDL
    const { data, error } = await supabase.from('paises').select('codigo_iso, nombre').limit(5);
    const latency = Math.round(performance.now() - startTime);

    if (error) {
      // Si la tabla aún no fue creada mediante el script SQL DDL
      if (error.code === '42P01') {
        return {
          success: true,
          tableFound: false,
          url: supabaseUrl,
          message: `Conectado exitosamente con Supabase (${latency}ms). Nota: La tabla 'paises' aún no existe. Ejecuta el script SQL DDL en el SQL Editor de Supabase.`,
        };
      }
      return {
        success: false,
        url: supabaseUrl,
        message: `Error al conectar con Supabase: ${error.message} (${error.code || 'Desconocido'})`,
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

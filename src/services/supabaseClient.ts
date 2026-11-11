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

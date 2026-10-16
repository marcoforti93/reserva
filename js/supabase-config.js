// ============================================================
// supabase-config.js
// Configuração da conexão com o Banco de Dados SUPABASE (PostgreSQL + Realtime)
// ============================================================

/**
 * ⚠️ CREDENCIAIS DO SEU PROJETO SUPABASE:
 *
 * Você pode preencher as constantes abaixo OU colar diretamente
 * pela interface web clicando no ícone do banco de dados no topo.
 *
 * Como obter no painel do Supabase:
 * 1. Acesse: https://supabase.com/dashboard/project/_/settings/api
 * 2. Copie a "Project URL" (ex: https://xyzcompany.supabase.co)
 * 3. Copie a chave "anon" / "public" (Project API keys)
 */
export const DEFAULT_SUPABASE_URL = "https://ajopbdoaxqrvirurxdip.supabase.co";
export const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqb3BiZG9heHFydmlydXJ4ZGlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMTA2NjAsImV4cCI6MjEwNzY4NjY2MH0.fJQGsR-QiRKj-HgA1qSP6WsJMGpCUHTUlrcWHcJl0QQ";

const STORAGE_KEY_URL = 'reserva_supabase_url';
const STORAGE_KEY_KEY = 'reserva_supabase_anon_key';

let cachedClient = null;

/**
 * Retorna a URL do Supabase ativa (prioriza localStorage)
 */
export function getSupabaseUrl() {
    const custom = localStorage.getItem(STORAGE_KEY_URL);
    if (custom && custom.trim().startsWith('http')) return custom.trim();
    return DEFAULT_SUPABASE_URL;
}

/**
 * Retorna a chave anônima (anon key) ativa (prioriza localStorage)
 */
export function getSupabaseAnonKey() {
    const custom = localStorage.getItem(STORAGE_KEY_KEY);
    if (custom && custom.trim()) return custom.trim();
    return DEFAULT_SUPABASE_ANON_KEY;
}

/**
 * Define credenciais customizadas via interface
 */
export function setSupabaseConfig(url, anonKey) {
    if (url && url.trim()) {
        localStorage.setItem(STORAGE_KEY_URL, url.trim());
    } else {
        localStorage.removeItem(STORAGE_KEY_URL);
    }

    if (anonKey && anonKey.trim()) {
        localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
    } else {
        localStorage.removeItem(STORAGE_KEY_KEY);
    }

    cachedClient = null; // Reseta cliente em cache
}

/**
 * Verifica se a conexão com o Supabase está configurada com credenciais válidas
 */
export function isSupabaseConfigured() {
    const url = getSupabaseUrl();
    const key = getSupabaseAnonKey();
    return Boolean(
        url &&
        url.startsWith('http') &&
        !url.includes('SEU_PROJETO') &&
        key &&
        key.length > 20
    );
}

/**
 * Retorna uma instância do cliente oficial do Supabase JS
 */
export function getSupabaseClient() {
    if (cachedClient) return cachedClient;

    const url = getSupabaseUrl();
    const key = getSupabaseAnonKey();

    if (!url || !key) return null;

    if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
        console.warn('Biblioteca Supabase JS não carregada no window.');
        return null;
    }

    try {
        cachedClient = window.supabase.createClient(url, key, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            },
            realtime: {
                params: {
                    eventsPerSecond: 10
                }
            }
        });
        return cachedClient;
    } catch (e) {
        console.error('Erro ao inicializar cliente Supabase:', e);
        return null;
    }
}

/**
 * Testa a conexão com o banco de dados Supabase executando um ping simples
 */
export async function testSupabaseConnection(url = null, key = null) {
    const testUrl = url || getSupabaseUrl();
    const testKey = key || getSupabaseAnonKey();

    if (!testUrl || !testKey) {
        return { success: false, error: 'URL do projeto e Anon Key são obrigatórios.' };
    }

    if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
        return { success: false, error: 'Biblioteca do Supabase ainda não foi carregada no navegador.' };
    }

    try {
        const client = window.supabase.createClient(testUrl, testKey);
        // Faz uma consulta simples à tabela laboratorios com limit 1
        const { data, error } = await client
            .from('laboratorios')
            .select('id, nome')
            .limit(1);

        if (error) {
            return {
                success: false,
                error: `Erro retornado pelo Supabase: ${error.message} (Código: ${error.code})`
            };
        }

        return {
            success: true,
            message: 'Conexão com o Supabase estabelecida com sucesso! Banco PostgreSQL ativo.',
            data
        };
    } catch (err) {
        return {
            success: false,
            error: 'Falha de rede ao conectar com o Supabase: ' + (err.message || err)
        };
    }
}

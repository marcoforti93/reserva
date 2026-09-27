// ============================================================
// sheet-config.js
// Configuração da API do Google Sheets (Apps Script Web App)
// ============================================================

/**
 * ⚠️ URL DA API GOOGLE APPS SCRIPT:
 * 
 * Substitua o valor abaixo com a "URL do app da Web" gerada
 * após implantar o script no Google Sheets.
 * 
 * Siga o passo a passo em: google-apps-script/COMO_CONFIGURAR_A_PLANILHA.md
 */
export const DEFAULT_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbwIXgvG25mNMzCUUqjj5cvpNzU8rKDRxU9dhbVcYmNc_4ijsj9CqDkMhsOditwjfhpjQA/exec";

/**
 * Retorna a URL da API ativa (prioriza localStorage para testes rápidos via interface)
 */
export function getSheetApiUrl() {
    const custom = localStorage.getItem('reserva_custom_api_url');
    if (custom && custom.trim().startsWith('http')) return custom.trim();
    return DEFAULT_SHEET_API_URL;
}

/**
 * Define uma URL customizada via navegador (para facilitar configuração sem recompilar)
 */
export function setCustomSheetApiUrl(url) {
    if (url && url.trim()) {
        localStorage.setItem('reserva_custom_api_url', url.trim());
    } else {
        localStorage.removeItem('reserva_custom_api_url');
    }
}

/**
 * Verifica se a URL da API foi configurada
 */
export function isApiConfigured() {
    const url = getSheetApiUrl();
    return Boolean(url && url.startsWith('http') && !url.includes('SUA_URL_AQUI'));
}

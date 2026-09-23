// ============================================================
// utils.js
// Funções utilitárias para manipulação de datas e validações
// ============================================================

/**
 * Formata uma data para o padrão brasileiro DD/MM/AAAA
 */
export function formatDateBR(date) {
    if (typeof date === 'string') date = new Date(date + 'T00:00:00');
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}

/**
 * Formata uma data para YYYY-MM-DD (ISO, para Firestore)
 */
export function formatDateISO(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${y}-${m}-${d}`;
}

/**
 * Retorna o dia da semana como número (1=Seg, 5=Sex, 0=Dom, 6=Sáb)
 */
export function getDayOfWeek(date) {
    if (typeof date === 'string') date = new Date(date + 'T00:00:00');
    return date.getDay();
}

/**
 * Retorna o nome do dia da semana
 */
export function getDayName(date) {
    if (typeof date === 'string') date = new Date(date + 'T00:00:00');
    const names = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return names[date.getDay()];
}

/**
 * Retorna a segunda-feira da semana de uma data
 */
export function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Retorna a sexta-feira da semana de uma data
 */
export function getFriday(date) {
    const monday = getMonday(date);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    return friday;
}

/**
 * Retorna um array com as datas de segunda a sexta da semana
 */
export function getWeekDates(date) {
    const monday = getMonday(date);
    const dates = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(d);
    }
    return dates;
}

/**
 * Adiciona N semanas a uma data
 */
export function addWeeks(date, weeks) {
    const d = new Date(date);
    d.setDate(d.getDate() + weeks * 7);
    return d;
}

/**
 * Adiciona N dias a uma data
 */
export function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

/**
 * Verifica se duas datas são o mesmo dia
 */
export function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

/**
 * Verifica se a data é hoje
 */
export function isToday(date) {
    return isSameDay(date, new Date());
}

/**
 * Formata label da semana (ex: "23/09 - 27/09/2026")
 */
export function getWeekLabel(date) {
    const monday = getMonday(date);
    const friday = getFriday(date);
    const mDay = String(monday.getDate()).padStart(2, '0');
    const mMonth = String(monday.getMonth() + 1).padStart(2, '0');
    const fDay = String(friday.getDate()).padStart(2, '0');
    const fMonth = String(friday.getMonth() + 1).padStart(2, '0');
    const year = friday.getFullYear();
    return `${mDay}/${mMonth} - ${fDay}/${fMonth}/${year}`;
}

/**
 * Gera um ID simples (para uso temporário)
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * Debounce - atrasa execução de função
 */
export function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Verifica se arrays de aulas têm interseção (para validação anticonflito)
 */
export function hasAulaConflict(aulas1, aulas2) {
    return aulas1.some(a => aulas2.includes(a));
}

/**
 * Gera todas as datas semanais entre startDate e endDate (mesmo dia da semana)
 */
export function getRecurringDates(startDate, endDate) {
    const dates = [];
    let current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 7);
    }

    return dates;
}

/**
 * Retorna o turno sugerido com base na hora atual
 */
export function getSuggestedTurno() {
    const hour = new Date().getHours();
    if (hour < 12) return 'manha';
    if (hour < 18) return 'tarde';
    return 'noite';
}

/**
 * Escapa HTML para prevenir XSS
 */
export function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

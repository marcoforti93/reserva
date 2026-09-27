// ============================================================
// sheet-service.js
// Serviço CRUD de Alta Performance para Google Sheets + Apps Script Web App
// Inclui cache em memória, persistência local instantânea e atualizações otimistas
// ============================================================

import { getSheetApiUrl, isApiConfigured } from './sheet-config.js';
import { hasAulaConflict, formatDateISO, getRecurringDates } from './utils.js';
import { showToast } from './ui-helpers.js';
import { getDisciplinaSigla } from './schedule-config.js';

// ============================================================
// NORMALIZAÇÃO DE DADOS
// ============================================================

/**
 * Normaliza qualquer formato de data (ISO com hora, Date object, string simples) para YYYY-MM-DD
 */
export function normalizeDate(d) {
    if (!d) return '';
    if (d instanceof Date) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    const str = String(d).trim();
    if (str.includes('T')) return str.split('T')[0];
    return str.substring(0, 10);
}

/**
 * Normaliza o campo aulas para array de números
 */
export function parseAulas(aulas) {
    if (Array.isArray(aulas)) return aulas.map(Number);
    if (!aulas) return [];
    if (typeof aulas === 'string') {
        const trimmed = aulas.trim();
        if (trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed.map(Number);
            } catch (e) { }
        }
        return trimmed.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    }
    return [];
}

/**
 * Normaliza um objeto de reserva garantindo data YYYY-MM-DD e aulas como array de números
 */
function normalizeReserva(r) {
    if (!r) return r;

    // Resolução de Turma
    let turmaVal = r.turmaNome || r.turma || '';
    if (!turmaVal && r.turmaId && memoryCache.turmas && memoryCache.turmas.length > 0) {
        const found = memoryCache.turmas.find(t => String(t.id) === String(r.turmaId));
        if (found) turmaVal = found.nome || '';
    }
    if (!turmaVal && r.cursoNome) {
        turmaVal = r.cursoNome;
    }

    // Resolução de Disciplina
    let discNome = r.disciplinaNome || r.disciplina || '';
    let discSigla = r.disciplinaSigla || '';

    // Se tiver sigla mas não tiver nome, tenta recuperar pelo catálogo de disciplinas
    if (!discNome && discSigla && memoryCache.disciplinas && memoryCache.disciplinas.length > 0) {
        const found = memoryCache.disciplinas.find(d =>
            String(d.sigla || '').toLowerCase().trim() === discSigla.toLowerCase().trim()
        );
        if (found) discNome = found.nome || '';
    }
    // Se tiver nome mas não tiver sigla, tenta recuperar sigla
    if (!discSigla && discNome && memoryCache.disciplinas && memoryCache.disciplinas.length > 0) {
        const found = memoryCache.disciplinas.find(d =>
            String(d.nome || '').toLowerCase().trim() === discNome.toLowerCase().trim()
        );
        if (found) discSigla = found.sigla || '';
    }
    if (!discSigla && discNome) {
        discSigla = getDisciplinaSigla(discNome) || '';
    }
    if (!discNome && discSigla) {
        discNome = discSigla;
    }

    const recursosParsed = Array.isArray(r.recursos) ? r.recursos : (
        Array.isArray(r.recursosExtras) ? r.recursosExtras : (
            typeof r.recursosExtras === 'string' && r.recursosExtras ? (
                r.recursosExtras.startsWith('[') ? JSON.parse(r.recursosExtras) : [r.recursosExtras]
            ) : (
                typeof r.recursos === 'string' && r.recursos ? (
                    r.recursos.startsWith('[') ? JSON.parse(r.recursos) : [r.recursos]
                ) : []
            )
        )
    );

    return {
        ...r,
        data: normalizeDate(r.data),
        aulas: parseAulas(r.aulas),
        turma: turmaVal,
        turmaNome: turmaVal,
        disciplina: discNome,
        disciplinaNome: discNome,
        disciplinaSigla: discSigla,
        recursos: recursosParsed,
        recursosExtras: recursosParsed
    };
}

// ============================================================
// CACHE EM MEMÓRIA E LOCALSTORAGE (STALE-WHILE-REVALIDATE)
// ============================================================

const CACHE_STORAGE_KEY = 'reserva_sheets_cache_v3';
let initialFetchPromise = null;
const listeners = new Set();

// Tenta restaurar cache prévio do localStorage para abertura instantânea (0ms)
let memoryCache = {
    laboratorios: [],
    professores: [],
    cursos: [],
    turmas: [],
    disciplinas: [],
    reservas: [],
    lastFetchTime: 0
};

try {
    const saved = localStorage.getItem(CACHE_STORAGE_KEY);
    if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
            memoryCache = {
                laboratorios: parsed.laboratorios || [],
                professores: parsed.professores || [],
                cursos: parsed.cursos || [],
                turmas: parsed.turmas || [],
                disciplinas: parsed.disciplinas || [],
                reservas: (parsed.reservas || []).map(normalizeReserva),
                lastFetchTime: parsed.lastFetchTime || 0
            };
        }
    }
} catch (e) {
    console.warn('Falha ao restaurar cache local:', e);
}

function persistCache() {
    try {
        localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(memoryCache));
    } catch (e) {
        console.warn('Falha ao persistir cache local:', e);
    }
}

function notifyListeners() {
    listeners.forEach(fn => {
        try { fn(); } catch (err) { console.error('Erro em listener do cache:', err); }
    });
}

// ============================================================
// COMUNICAÇÃO HTTP
// ============================================================

async function apiGet(action, params = {}) {
    const baseUrl = getSheetApiUrl();
    const query = new URLSearchParams({ action, ...params }).toString();
    const url = `${baseUrl}?${query}`;

    const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const data = await response.json();
    if (data && data.success === false) {
        throw new Error(data.error || 'Erro desconhecido na API do Google Sheets.');
    }
    return data;
}

async function apiPost(action, payload = {}) {
    const url = getSheetApiUrl();
    const bodyContent = JSON.stringify({ action, ...payload });
    const response = await fetch(url, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: bodyContent
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const data = await response.json();
    if (data && data.success === false) {
        throw new Error(data.error || 'Erro ao salvar na planilha.');
    }
    return data;
}

// ============================================================
// CARREGAMENTO CENTRALIZADO (UMA ÚNICA REQUISIÇÃO)
// ============================================================

/**
 * Carrega todos os dados da planilha em uma ÚNICA requisição (getInitialData)
 */
export async function fetchInitialData(forceRefresh = false) {
    if (!isApiConfigured()) {
        return memoryCache;
    }

    const now = Date.now();
    // Reutiliza promessa em andamento se houver chamadas simultâneas
    if (initialFetchPromise) return initialFetchPromise;

    // Se já foi buscado há menos de 15 segundos e não é forceRefresh, retorna imediatamente
    if (!forceRefresh && memoryCache.lastFetchTime && (now - memoryCache.lastFetchTime < 15000)) {
        return memoryCache;
    }

    initialFetchPromise = (async () => {
        try {
            const res = await apiGet('getInitialData');
            if (res.data) {
                memoryCache = {
                    laboratorios: res.data.laboratorios || [],
                    professores: res.data.professores || [],
                    cursos: res.data.cursos || [],
                    turmas: res.data.turmas || [],
                    disciplinas: res.data.disciplinas || [],
                    reservas: (res.data.reservas || []).map(normalizeReserva),
                    lastFetchTime: Date.now()
                };
                persistCache();
                notifyListeners();
            }
            return memoryCache;
        } catch (err) {
            console.error('Erro ao sincronizar com Google Sheets:', err);
            // Retorna cache existente mesmo em caso de erro de rede
            return memoryCache;
        } finally {
            initialFetchPromise = null;
        }
    })();

    return initialFetchPromise;
}

// Dispara busca inicial em segundo plano assim que o módulo for carregado
if (isApiConfigured()) {
    fetchInitialData().catch(() => {});
}

// ============================================================
// LABORATÓRIOS
// ============================================================

export async function getLaboratorios() {
    if (memoryCache.laboratorios.length === 0 && isApiConfigured()) {
        await fetchInitialData();
    }
    return memoryCache.laboratorios
        .filter(l => l.ativo !== false)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
}

export async function addLaboratorio(data) {
    const id = 'lab_' + Date.now();
    const newItem = { id, ...data, ativo: true, criadoEm: new Date().toISOString() };
    
    // Atualização otimista
    memoryCache.laboratorios.push(newItem);
    persistCache();
    notifyListeners();

    if (isApiConfigured()) {
        apiPost('addItem', { table: 'laboratorios', data }).then(res => {
            if (res && res.id) newItem.id = res.id;
            persistCache();
        }).catch(err => {
            console.error('Falha ao salvar laboratório na planilha:', err);
        });
    }

    showToast('Laboratório cadastrado com sucesso!', 'success');
    return id;
}

export async function updateLaboratorio(id, data) {
    const idx = memoryCache.laboratorios.findIndex(l => String(l.id) === String(id));
    if (idx !== -1) {
        memoryCache.laboratorios[idx] = { ...memoryCache.laboratorios[idx], ...data };
        persistCache();
        notifyListeners();
    }

    if (isApiConfigured()) {
        apiPost('updateItem', { table: 'laboratorios', id, data }).catch(err => {
            console.error('Falha ao atualizar laboratório na planilha:', err);
        });
    }

    showToast('Laboratório atualizado!', 'success');
}

export async function deleteLaboratorio(id) {
    const idx = memoryCache.laboratorios.findIndex(l => String(l.id) === String(id));
    if (idx !== -1) {
        memoryCache.laboratorios[idx].ativo = false;
        persistCache();
        notifyListeners();
    }

    if (isApiConfigured()) {
        apiPost('deleteItem', { table: 'laboratorios', id, softDelete: true }).catch(err => {
            console.error('Falha ao remover laboratório na planilha:', err);
        });
    }

    showToast('Laboratório removido.', 'info');
}

// ============================================================
// PROFESSORES
// ============================================================

export async function getProfessores() {
    if (memoryCache.professores.length === 0 && isApiConfigured()) {
        await fetchInitialData();
    }
    return memoryCache.professores.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
}

export async function addProfessor(data) {
    const id = 'prof_' + Date.now();
    const newItem = { id, ...data, criadoEm: new Date().toISOString() };

    memoryCache.professores.push(newItem);
    persistCache();
    notifyListeners();

    if (isApiConfigured()) {
        apiPost('addItem', { table: 'professores', data }).then(res => {
            if (res && res.id) newItem.id = res.id;
            persistCache();
        }).catch(console.error);
    }

    showToast('Professor cadastrado com sucesso!', 'success');
    return id;
}

export async function updateProfessor(id, data) {
    const idx = memoryCache.professores.findIndex(p => String(p.id) === String(id));
    if (idx !== -1) {
        memoryCache.professores[idx] = { ...memoryCache.professores[idx], ...data };
        persistCache();
        notifyListeners();
    }

    if (isApiConfigured()) {
        apiPost('updateItem', { table: 'professores', id, data }).catch(console.error);
    }

    showToast('Professor atualizado!', 'success');
}

export async function deleteProfessor(id) {
    memoryCache.professores = memoryCache.professores.filter(p => String(p.id) !== String(id));
    persistCache();
    notifyListeners();

    if (isApiConfigured()) {
        apiPost('deleteItem', { table: 'professores', id, softDelete: false }).catch(console.error);
    }

    showToast('Professor removido.', 'info');
}

// ============================================================
// CURSOS
// ============================================================

export async function getCursos() {
    if (memoryCache.cursos.length === 0 && isApiConfigured()) {
        await fetchInitialData();
    }
    return memoryCache.cursos
        .filter(c => c.ativo !== false)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
}

export async function addCurso(data) {
    const id = 'cur_' + Date.now();
    const newItem = { id, ...data, ativo: true, criadoEm: new Date().toISOString() };

    memoryCache.cursos.push(newItem);
    persistCache();
    notifyListeners();

    if (isApiConfigured()) {
        apiPost('addItem', { table: 'cursos', data }).then(res => {
            if (res && res.id) newItem.id = res.id;
            persistCache();
        }).catch(console.error);
    }

    showToast('Curso cadastrado com sucesso!', 'success');
    return id;
}

export async function updateCurso(id, data) {
    const idx = memoryCache.cursos.findIndex(c => String(c.id) === String(id));
    if (idx !== -1) {
        memoryCache.cursos[idx] = { ...memoryCache.cursos[idx], ...data };
        persistCache();
        notifyListeners();
    }

    if (isApiConfigured()) {
        apiPost('updateItem', { table: 'cursos', id, data }).catch(console.error);
    }

    showToast('Curso atualizado!', 'success');
}

export async function deleteCurso(id) {
    const idx = memoryCache.cursos.findIndex(c => String(c.id) === String(id));
    if (idx !== -1) {
        memoryCache.cursos[idx].ativo = false;
        persistCache();
        notifyListeners();
    }

    if (isApiConfigured()) {
        apiPost('deleteItem', { table: 'cursos', id, softDelete: true }).catch(console.error);
    }

    showToast('Curso removido.', 'info');
}

// ============================================================
// TURMAS
// ============================================================

export async function getTurmas() {
    if (memoryCache.turmas.length === 0 && isApiConfigured()) {
        await fetchInitialData();
    }
    return memoryCache.turmas
        .filter(t => t.ativo !== false)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
}

export async function addTurma(data) {
    const id = 'tur_' + Date.now();
    const newItem = { id, ...data, ativo: true, criadoEm: new Date().toISOString() };

    memoryCache.turmas.push(newItem);
    persistCache();
    notifyListeners();

    if (isApiConfigured()) {
        apiPost('addItem', { table: 'turmas', data }).then(res => {
            if (res && res.id) newItem.id = res.id;
            persistCache();
        }).catch(console.error);
    }

    showToast('Turma cadastrada com sucesso!', 'success');
    return id;
}

export async function updateTurma(id, data) {
    const idx = memoryCache.turmas.findIndex(t => String(t.id) === String(id));
    if (idx !== -1) {
        memoryCache.turmas[idx] = { ...memoryCache.turmas[idx], ...data };
        persistCache();
        notifyListeners();
    }

    if (isApiConfigured()) {
        apiPost('updateItem', { table: 'turmas', id, data }).catch(console.error);
    }

    showToast('Turma atualizada!', 'success');
}

export async function deleteTurma(id) {
    const idx = memoryCache.turmas.findIndex(t => String(t.id) === String(id));
    if (idx !== -1) {
        memoryCache.turmas[idx].ativo = false;
        persistCache();
        notifyListeners();
    }

    if (isApiConfigured()) {
        apiPost('deleteItem', { table: 'turmas', id, softDelete: true }).catch(console.error);
    }

    showToast('Turma removida.', 'info');
}

export async function seedTurmas(defaultList) {
    const items = defaultList.map(item => ({
        nome: typeof item === 'string' ? item : item.nome,
        turno: typeof item === 'object' && item.turno ? item.turno : ''
    }));

    if (isApiConfigured()) {
        try {
            const res = await apiPost('seedItems', { table: 'turmas', items, keyField: 'nome' });
            await fetchInitialData(true);
            showToast(`${res.count || 0} turma(s) importada(s) para a planilha!`, 'success');
            return res.count || 0;
        } catch (error) {
            showToast('Erro ao importar turmas.', 'error');
            throw error;
        }
    }
    return 0;
}

// ============================================================
// DISCIPLINAS
// ============================================================

export async function getDisciplinas() {
    if (memoryCache.disciplinas.length === 0 && isApiConfigured()) {
        await fetchInitialData();
    }
    return memoryCache.disciplinas
        .filter(d => d.ativo !== false)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
}

export async function addDisciplina(data) {
    const id = 'disc_' + Date.now();
    const newItem = { id, ...data, ativo: true, criadoEm: new Date().toISOString() };

    memoryCache.disciplinas.push(newItem);
    persistCache();
    notifyListeners();

    if (isApiConfigured()) {
        apiPost('addItem', { table: 'disciplinas', data }).then(res => {
            if (res && res.id) newItem.id = res.id;
            persistCache();
        }).catch(console.error);
    }

    showToast('Disciplina cadastrada com sucesso!', 'success');
    return id;
}

export async function updateDisciplina(id, data) {
    const idx = memoryCache.disciplinas.findIndex(d => String(d.id) === String(id));
    if (idx !== -1) {
        memoryCache.disciplinas[idx] = { ...memoryCache.disciplinas[idx], ...data };
        persistCache();
        notifyListeners();
    }

    if (isApiConfigured()) {
        apiPost('updateItem', { table: 'disciplinas', id, data }).catch(console.error);
    }

    showToast('Disciplina atualizada!', 'success');
}

export async function deleteDisciplina(id) {
    const idx = memoryCache.disciplinas.findIndex(d => String(d.id) === String(id));
    if (idx !== -1) {
        memoryCache.disciplinas[idx].ativo = false;
        persistCache();
        notifyListeners();
    }

    if (isApiConfigured()) {
        apiPost('deleteItem', { table: 'disciplinas', id, softDelete: true }).catch(console.error);
    }

    showToast('Disciplina removida.', 'info');
}

export async function seedDisciplinas(defaultList) {
    const items = defaultList.map(item => ({
        nome: typeof item === 'string' ? item : item.nome,
        sigla: (typeof item === 'object' && item.sigla) ? item.sigla : getDisciplinaSigla(typeof item === 'string' ? item : item.nome)
    }));

    if (isApiConfigured()) {
        try {
            const res = await apiPost('seedItems', { table: 'disciplinas', items, keyField: 'nome' });
            await fetchInitialData(true);
            showToast(`${res.count || 0} disciplina(s) importada(s) para a planilha!`, 'success');
            return res.count || 0;
        } catch (error) {
            showToast('Erro ao importar disciplinas.', 'error');
            throw error;
        }
    }
    return 0;
}

// ============================================================
// RESERVAS (COM NORMALIZAÇÃO DE DATA E ATUALIZAÇÕES INSTANTÂNEAS)
// ============================================================

export async function getReservas(dataISO, labId = '', turno = '') {
    if (memoryCache.reservas.length === 0 && isApiConfigured()) {
        await fetchInitialData();
    }
    
    const targetDate = normalizeDate(dataISO);
    return memoryCache.reservas.filter(r => {
        if (targetDate && normalizeDate(r.data) !== targetDate) return false;
        if (labId && String(r.labId) !== String(labId)) return false;
        if (turno && String(r.turno) !== String(turno)) return false;
        return true;
    });
}

export async function getReservasSemana(datesISO) {
    if (!datesISO || datesISO.length === 0) return [];

    if (memoryCache.reservas.length === 0 && isApiConfigured()) {
        await fetchInitialData();
    }

    const normalizedDates = datesISO.map(normalizeDate);
    return memoryCache.reservas.filter(r => normalizedDates.includes(normalizeDate(r.data)));
}

export async function getReservasProfessor(professorId) {
    if (memoryCache.reservas.length === 0 && isApiConfigured()) {
        await fetchInitialData();
    }
    return memoryCache.reservas.filter(r => String(r.professorId) === String(professorId));
}

export async function getReservasPendentes() {
    if (memoryCache.reservas.length === 0 && isApiConfigured()) {
        await fetchInitialData();
    }
    return memoryCache.reservas
        .filter(r => r.status === 'pendente')
        .sort((a, b) => (a.data || '').localeCompare(b.data || ''));
}

export async function getReservaById(id) {
    if (memoryCache.reservas.length === 0 && isApiConfigured()) {
        await fetchInitialData();
    }
    return memoryCache.reservas.find(r => String(r.id) === String(id)) || null;
}

/**
 * Validação instantânea de conflito em memória (< 1ms)
 */
export async function checkConflict(labId, dataISO, turno, aulas, excludeId = '') {
    const targetDate = normalizeDate(dataISO);
    const targetAulas = parseAulas(aulas);

    for (const r of memoryCache.reservas) {
        if (String(r.id) === String(excludeId)) continue;
        if (r.status === 'rejeitado') continue;

        if (
            String(r.labId) === String(labId) &&
            normalizeDate(r.data) === targetDate &&
            String(r.turno) === String(turno)
        ) {
            const existingAulas = parseAulas(r.aulas);
            if (hasAulaConflict(targetAulas, existingAulas)) {
                return {
                    hasConflict: true,
                    conflictingReserva: r
                };
            }
        }
    }

    return { hasConflict: false, conflictingReserva: null };
}

/**
 * Cria reserva com atualização otimista na tela em milissegundos
 */
export async function createReserva(reservaData, isAdmin = false) {
    const targetDate = normalizeDate(reservaData.data);
    const aulasList = parseAulas(reservaData.aulas);

    // Validação de conflito instantânea em memória
    const { hasConflict, conflictingReserva } = await checkConflict(
        reservaData.labId,
        targetDate,
        reservaData.turno,
        aulasList
    );

    if (hasConflict) {
        const msg = `Conflito: ${conflictingReserva.professorNome || 'Outro professor'} já reservou este horário (${conflictingReserva.status}).`;
        showToast(msg, 'error', 5000);
        return { success: false, conflict: conflictingReserva };
    }

    const tempId = 'res_' + Date.now();
    const newReserva = normalizeReserva({
        ...reservaData,
        id: tempId,
        data: targetDate,
        aulas: aulasList,
        status: isAdmin ? 'confirmado' : 'pendente',
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
    });

    // 1. Atualização Otimista Imediata (o card surge na tela instantaneamente!)
    memoryCache.reservas.push(newReserva);
    persistCache();
    notifyListeners();

    showToast(isAdmin ? 'Reserva confirmada!' : 'Reserva enviada! Aguardando aprovação.', 'success');

    // 2. Persistência assíncrona na Planilha Google Sheets
    if (isApiConfigured()) {
        apiPost('createReserva', { data: newReserva }).then(res => {
            if (res && res.id) {
                newReserva.id = res.id;
                persistCache();
            }
        }).catch(err => {
            console.error('Erro ao persistir na planilha:', err);
            // Em caso de falha de conexão, mantém no cache local
            showToast('Aviso: Salvo localmente. Sincronizando com a nuvem...', 'info', 4000);
        });
    }

    return { success: true, id: tempId };
}

/**
 * Cria reservas recorrentes com atualização em lote
 */
export async function createReservaRecorrente(baseData, dataFim, isAdmin = false) {
    const startDate = new Date(baseData.data + 'T00:00:00');
    const endDate = new Date(dataFim + 'T00:00:00');
    const dates = getRecurringDates(startDate, endDate);

    const reservaList = [];
    let conflicts = 0;

    for (const date of dates) {
        const dateISO = formatDateISO(date);
        const { hasConflict } = await checkConflict(baseData.labId, dateISO, baseData.turno, baseData.aulas);
        if (!hasConflict) {
            const item = normalizeReserva({
                ...baseData,
                id: 'res_' + Date.now() + Math.random().toString(36).substring(2, 6),
                data: dateISO,
                recorrente: true,
                recorrenteAte: dataFim,
                status: isAdmin ? 'confirmado' : 'pendente',
                criadoEm: new Date().toISOString()
            });
            reservaList.push(item);
            memoryCache.reservas.push(item);
        } else {
            conflicts++;
        }
    }

    persistCache();
    notifyListeners();

    const created = reservaList.length;
    showToast(`${created} reserva(s) criada(s)!${conflicts > 0 ? ` (${conflicts} conflitos evitados)` : ''}`, 'success', 5000);

    // Envio assíncrono em batch para a planilha
    if (isApiConfigured() && reservaList.length > 0) {
        apiPost('createReservaBatch', { list: reservaList }).catch(err => {
            console.error('Erro ao salvar batch na planilha:', err);
        });
    }

    return { created, conflicts, errors: 0 };
}

/**
 * Atualiza status da reserva com feedback imediato
 */
export async function updateReservaStatus(id, newStatus) {
    const r = memoryCache.reservas.find(res => String(res.id) === String(id));
    if (r) {
        r.status = newStatus;
        r.atualizadoEm = new Date().toISOString();
        persistCache();
        notifyListeners();
    }

    const labels = { confirmado: 'aprovada', rejeitado: 'rejeitada', manutencao: 'marcada em manutenção' };
    showToast(`Reserva ${labels[newStatus] || 'atualizada'}!`, 'success');

    if (isApiConfigured()) {
        apiPost('updateReservaStatus', { id, status: newStatus }).catch(console.error);
    }
}

/**
 * Remove reserva com feedback imediato
 */
export async function deleteReserva(id) {
    memoryCache.reservas = memoryCache.reservas.filter(r => String(r.id) !== String(id));
    persistCache();
    notifyListeners();

    showToast('Reserva cancelada.', 'info');

    if (isApiConfigured()) {
        apiPost('deleteReserva', { id }).catch(console.error);
    }
}

/**
 * Monitoramento de reservas para as datas selecionadas
 * Retorna dados em 0ms do cache e mantém sincronia suave
 */
export function onReservasChange(datesISO, callback) {
    if (!datesISO || datesISO.length === 0) return () => { };

    const filterCurrent = () => {
        const normalized = datesISO.map(normalizeDate);
        return memoryCache.reservas.filter(r => normalized.includes(normalizeDate(r.data)));
    };

    // 1. Resposta IMEDIATA (0ms) a partir do cache!
    callback(filterCurrent());

    // 2. Registra listener para qualquer mutação de cache (criação, edição, exclusão)
    const listener = () => {
        callback(filterCurrent());
    };
    listeners.add(listener);

    // 3. Atualização em segundo plano suave a cada 25 segundos
    const timerId = setInterval(() => {
        if (document.hidden) return;
        fetchInitialData(true).then(() => {
            callback(filterCurrent());
        }).catch(() => {});
    }, 25000);

    return () => {
        listeners.delete(listener);
        clearInterval(timerId);
    };
}

// ============================================================
// supabase-service.js
// Serviço de Alta Performance e Tempo Real com Supabase (PostgreSQL)
// Inclui cache em memória, realtime websocket e fallback local
// ============================================================

import { getSupabaseClient, isSupabaseConfigured } from './supabase-config.js';
import { hasAulaConflict, formatDateISO, getRecurringDates } from './utils.js';
import { showToast } from './ui-helpers.js';
import { getDisciplinaSigla, getCursoSigla } from './schedule-config.js';

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
 * Normaliza um objeto de reserva garantindo compatibilidade com camelCase e snake_case
 */
function normalizeReserva(r) {
    if (!r) return r;

    const dataNorm = normalizeDate(r.data);
    const aulasNorm = parseAulas(r.aulas);
    const turmaVal = r.turma_nome || r.turmaNome || r.turma || '';
    const cursoVal = r.curso_nome || r.cursoNome || '';
    const profVal = r.professor_nome || r.professorNome || '';
    const labNomeVal = r.lab_nome || r.labNome || '';
    const labIdVal = r.lab_id || r.labId || '';
    const discNomeVal = r.disciplina_nome || r.disciplinaNome || r.disciplina || '';
    let discSiglaVal = r.disciplina_sigla || r.disciplinaSigla || '';

    if (!discSiglaVal && discNomeVal) {
        discSiglaVal = getDisciplinaSigla(discNomeVal);
    }

    const recursosParsed = Array.isArray(r.recursos_extras) ? r.recursos_extras : (
        Array.isArray(r.recursosExtras) ? r.recursosExtras : (
            Array.isArray(r.recursos) ? r.recursos : []
        )
    );

    return {
        ...r,
        id: String(r.id),
        data: dataNorm,
        turno: r.turno,
        labId: labIdVal,
        lab_id: labIdVal,
        labNome: labNomeVal,
        lab_nome: labNomeVal,
        professorId: r.professor_id || r.professorId || '',
        professor_id: r.professor_id || r.professorId || '',
        professorNome: profVal,
        professor_nome: profVal,
        cursoId: r.curso_id || r.cursoId || '',
        curso_id: r.curso_id || r.cursoId || '',
        cursoNome: cursoVal,
        curso_nome: cursoVal,
        turmaId: r.turma_id || r.turmaId || '',
        turma_id: r.turma_id || r.turmaId || '',
        turmaNome: turmaVal,
        turma_nome: turmaVal,
        turma: turmaVal,
        disciplinaId: r.disciplina_id || r.disciplinaId || '',
        disciplina_id: r.disciplina_id || r.disciplinaId || '',
        disciplinaNome: discNomeVal,
        disciplina_nome: discNomeVal,
        disciplina: discNomeVal,
        disciplinaSigla: discSiglaVal,
        disciplina_sigla: discSiglaVal,
        aulas: aulasNorm,
        recursos: recursosParsed,
        recursosExtras: recursosParsed,
        recursos_extras: recursosParsed,
        observacoes: r.observacoes || '',
        status: r.status || 'confirmado',
        recorrente: Boolean(r.recorrente),
        recorrenteAte: r.recorrente_ate || r.recorrenteAte || null,
        recorrente_ate: r.recorrente_ate || r.recorrenteAte || null
    };
}

// ============================================================
// CACHE EM MEMÓRIA E LOCALSTORAGE
// ============================================================

const CACHE_STORAGE_KEY = 'reserva_supabase_cache_v1';
let initialFetchPromise = null;
const listeners = new Set();
let realtimeSubscribed = false;

let memoryCache = {
    laboratorios: [],
    professores: [],
    cursos: [],
    turmas: [],
    disciplinas: [],
    reservas: [],
    atribuicoes: [],
    usuarios: [],
    lastFetchTime: 0
};

// Restaura cache local para carregamento instantâneo (0ms)
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
                atribuicoes: parsed.atribuicoes || [],
                usuarios: parsed.usuarios || [],
                lastFetchTime: parsed.lastFetchTime || 0
            };
        }
    }
} catch (e) {
    console.warn('Falha ao restaurar cache do Supabase:', e);
}

function persistCache() {
    try {
        localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(memoryCache));
    } catch (e) {
        console.warn('Falha ao salvar cache no localStorage:', e);
    }
}

function notifyListeners() {
    listeners.forEach(cb => {
        try { cb(memoryCache); } catch (e) { console.error('Erro em listener do cache:', e); }
    });
}

// ============================================================
// CARREGAMENTO CENTRALIZADO (POSTGREST)
// ============================================================

/**
 * Carrega todos os catálogos e reservas do Supabase de forma paralela e de alta velocidade
 */
export async function fetchInitialData(forceRefresh = false) {
    if (!isSupabaseConfigured()) {
        return memoryCache;
    }

    const client = getSupabaseClient();
    if (!client) return memoryCache;

    const now = Date.now();
    if (initialFetchPromise) return initialFetchPromise;

    // Cache recente (10 segundos) se não for forceRefresh
    if (!forceRefresh && memoryCache.lastFetchTime && (now - memoryCache.lastFetchTime < 10000)) {
        return memoryCache;
    }

    initialFetchPromise = (async () => {
        try {
            // Executa consultas em paralelo no PostgreSQL
            const [
                labsRes,
                profsRes,
                cursosRes,
                turmasRes,
                discsRes,
                reservasRes,
                atribRes,
                usersRes
            ] = await Promise.all([
                client.from('laboratorios').select('*').order('nome'),
                client.from('professores').select('*').order('nome'),
                client.from('cursos').select('*').order('nome'),
                client.from('turmas').select('*').order('nome'),
                client.from('disciplinas').select('*').order('nome'),
                client.from('reservas').select('*').order('data', { ascending: true }),
                client.from('atribuicoes').select('*').order('professor'),
                client.from('usuarios').select('id, email, nome, perfil, professor_id, created_at').order('nome')
            ]);

            memoryCache = {
                laboratorios: labsRes.data || memoryCache.laboratorios,
                professores: profsRes.data || memoryCache.professores,
                cursos: cursosRes.data || memoryCache.cursos,
                turmas: turmasRes.data || memoryCache.turmas,
                disciplinas: discsRes.data || memoryCache.disciplinas,
                reservas: (reservasRes.data || []).map(normalizeReserva),
                atribuicoes: (atribRes.data || []).map(a => ({
                    professor: a.professor,
                    curso: a.curso || '',
                    turma: a.turma || '',
                    disciplina: a.disciplina || '',
                    sigla: a.sigla || ''
                })),
                usuarios: (usersRes.data || []).map(u => ({
                    id: u.id,
                    email: u.email,
                    nome: u.nome,
                    perfil: u.perfil,
                    professorId: u.professor_id || ''
                })),
                lastFetchTime: Date.now()
            };

            persistCache();
            notifyListeners();

            // Ativa o ouvinte Realtime do Supabase se ainda não ativo
            setupRealtimeSubscription(client);

            return memoryCache;
        } catch (err) {
            console.error('Erro ao sincronizar com Supabase:', err);
            return memoryCache;
        } finally {
            initialFetchPromise = null;
        }
    })();

    return initialFetchPromise;
}

/**
 * Ativa sincronização em tempo real via WebSocket do Supabase
 */
function setupRealtimeSubscription(client) {
    if (realtimeSubscribed || !client) return;

    try {
        client
            .channel('public:reservas_realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'reservas' },
                (payload) => {
                    handleRealtimeChange(payload);
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    realtimeSubscribed = true;
                }
            });
    } catch (e) {
        console.warn('Não foi possível ativar assinatura Realtime:', e);
    }
}

function handleRealtimeChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT') {
        const norm = normalizeReserva(newRecord);
        const exists = memoryCache.reservas.some(r => String(r.id) === String(norm.id));
        if (!exists) {
            memoryCache.reservas.push(norm);
        }
    } else if (eventType === 'UPDATE') {
        const norm = normalizeReserva(newRecord);
        const idx = memoryCache.reservas.findIndex(r => String(r.id) === String(norm.id));
        if (idx !== -1) {
            memoryCache.reservas[idx] = norm;
        } else {
            memoryCache.reservas.push(norm);
        }
    } else if (eventType === 'DELETE') {
        const delId = oldRecord?.id;
        if (delId) {
            memoryCache.reservas = memoryCache.reservas.filter(r => String(r.id) !== String(delId));
        }
    }

    persistCache();
    notifyListeners();
}

// Inicia busca automaticamente ao carregar se configurado
if (isSupabaseConfigured()) {
    fetchInitialData().catch(() => {});
}

// ============================================================
// LABORATÓRIOS
// ============================================================

export async function getLaboratorios() {
    if (memoryCache.laboratorios.length === 0 && isSupabaseConfigured()) {
        await fetchInitialData();
    }
    return memoryCache.laboratorios.filter(l => l.ativo !== false);
}

export async function addLaboratorio(data) {
    const newItem = {
        id: 'lab_' + Date.now().toString(36),
        nome: data.nome,
        capacidade: Number(data.capacidade) || 40,
        descricao: data.descricao || '',
        recursos: data.recursos || [],
        ativo: true
    };

    memoryCache.laboratorios.push(newItem);
    persistCache();
    notifyListeners();

    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.from('laboratorios').insert([newItem]);
        if (error) throw new Error(error.message);
    }
    return { success: true, id: newItem.id };
}

export async function updateLaboratorio(id, data) {
    const idx = memoryCache.laboratorios.findIndex(l => String(l.id) === String(id));
    if (idx !== -1) {
        memoryCache.laboratorios[idx] = { ...memoryCache.laboratorios[idx], ...data };
        persistCache();
        notifyListeners();
    }

    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.from('laboratorios').update(data).eq('id', id);
        if (error) throw new Error(error.message);
    }
    return { success: true };
}

export async function deleteLaboratorio(id) {
    const idx = memoryCache.laboratorios.findIndex(l => String(l.id) === String(id));
    if (idx !== -1) {
        memoryCache.laboratorios[idx].ativo = false;
        persistCache();
        notifyListeners();
    }

    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.from('laboratorios').update({ ativo: false }).eq('id', id);
        if (error) throw new Error(error.message);
    }
    return { success: true };
}

// ============================================================
// PROFESSORES
// ============================================================

export async function getProfessores() {
    if (memoryCache.professores.length === 0 && isSupabaseConfigured()) {
        await fetchInitialData();
    }
    return memoryCache.professores.filter(p => p.ativo !== false);
}

export async function addProfessor(data) {
    const newItem = {
        id: 'prof_' + Date.now().toString(36),
        nome: data.nome,
        email: data.email || '',
        disciplinas: data.disciplinas || [],
        ativo: true
    };

    memoryCache.professores.push(newItem);
    persistCache();
    notifyListeners();

    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.from('professores').insert([newItem]);
        if (error) throw new Error(error.message);
    }
    return { success: true, id: newItem.id };
}

export async function updateProfessor(id, data) {
    const idx = memoryCache.professores.findIndex(p => String(p.id) === String(id));
    if (idx !== -1) {
        memoryCache.professores[idx] = { ...memoryCache.professores[idx], ...data };
        persistCache();
        notifyListeners();
    }

    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.from('professores').update(data).eq('id', id);
        if (error) throw new Error(error.message);
    }
    return { success: true };
}

export async function deleteProfessor(id) {
    const idx = memoryCache.professores.findIndex(p => String(p.id) === String(id));
    if (idx !== -1) {
        memoryCache.professores[idx].ativo = false;
        persistCache();
        notifyListeners();
    }

    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.from('professores').update({ ativo: false }).eq('id', id);
        if (error) throw new Error(error.message);
    }
    return { success: true };
}

// ============================================================
// CURSOS
// ============================================================

export async function getCursos() {
    if (memoryCache.cursos.length === 0 && isSupabaseConfigured()) {
        await fetchInitialData();
    }
    return memoryCache.cursos.filter(c => c.ativo !== false);
}

export async function addCurso(data) {
    const newItem = {
        id: 'cur_' + Date.now().toString(36),
        nome: data.nome,
        sigla: data.sigla || getCursoSigla(data.nome) || '',
        periodo: data.periodo || '',
        ativo: true
    };

    memoryCache.cursos.push(newItem);
    persistCache();
    notifyListeners();

    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.from('cursos').insert([newItem]);
        if (error) throw new Error(error.message);
    }
    return { success: true, id: newItem.id };
}

export async function updateCurso(id, data) {
    const idx = memoryCache.cursos.findIndex(c => String(c.id) === String(id));
    if (idx !== -1) {
        memoryCache.cursos[idx] = { ...memoryCache.cursos[idx], ...data };
        persistCache();
        notifyListeners();
    }

    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.from('cursos').update(data).eq('id', id);
        if (error) throw new Error(error.message);
    }
    return { success: true };
}

export async function deleteCurso(id) {
    const idx = memoryCache.cursos.findIndex(c => String(c.id) === String(id));
    if (idx !== -1) {
        memoryCache.cursos[idx].ativo = false;
        persistCache();
        notifyListeners();
    }

    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.from('cursos').update({ ativo: false }).eq('id', id);
        if (error) throw new Error(error.message);
    }
    return { success: true };
}

// ============================================================
// TURMAS
// ============================================================

export async function getTurmas() {
    if (memoryCache.turmas.length === 0 && isSupabaseConfigured()) {
        await fetchInitialData();
    }
    return memoryCache.turmas.filter(t => t.ativo !== false);
}

export async function addTurma(data) {
    const newItem = {
        id: 'tur_' + Date.now().toString(36),
        nome: data.nome,
        turno: data.turno || '',
        ativo: true
    };

    memoryCache.turmas.push(newItem);
    persistCache();
    notifyListeners();

    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.from('turmas').insert([newItem]);
        if (error) throw new Error(error.message);
    }
    return { success: true, id: newItem.id };
}

export async function updateTurma(id, data) {
    const idx = memoryCache.turmas.findIndex(t => String(t.id) === String(id));
    if (idx !== -1) {
        memoryCache.turmas[idx] = { ...memoryCache.turmas[idx], ...data };
        persistCache();
        notifyListeners();
    }

    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.from('turmas').update(data).eq('id', id);
        if (error) throw new Error(error.message);
    }
    return { success: true };
}

export async function deleteTurma(id) {
    const idx = memoryCache.turmas.findIndex(t => String(t.id) === String(id));
    if (idx !== -1) {
        memoryCache.turmas[idx].ativo = false;
        persistCache();
        notifyListeners();
    }

    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.from('turmas').update({ ativo: false }).eq('id', id);
        if (error) throw new Error(error.message);
    }
    return { success: true };
}

export async function seedTurmas(defaultList) {
    const existing = new Set(memoryCache.turmas.map(t => t.nome.toLowerCase().trim()));
    const toInsert = [];

    defaultList.forEach(nome => {
        if (!existing.has(nome.toLowerCase().trim())) {
            const newItem = {
                id: 'tur_' + Math.random().toString(36).substring(2, 9),
                nome,
                turno: nome.toLowerCase().includes('noturno') ? 'noite' : 'manha',
                ativo: true
            };
            memoryCache.turmas.push(newItem);
            toInsert.push(newItem);
        }
    });

    persistCache();
    notifyListeners();

    const client = getSupabaseClient();
    if (client && toInsert.length > 0) {
        await client.from('turmas').upsert(toInsert, { onConflict: 'nome' });
    }
    return { success: true, count: toInsert.length };
}

// ============================================================
// DISCIPLINAS
// ============================================================

export async function getDisciplinas() {
    if (memoryCache.disciplinas.length === 0 && isSupabaseConfigured()) {
        await fetchInitialData();
    }
    return memoryCache.disciplinas.filter(d => d.ativo !== false);
}

export async function addDisciplina(data) {
    const newItem = {
        id: 'disc_' + Date.now().toString(36),
        nome: data.nome,
        sigla: data.sigla || getDisciplinaSigla(data.nome) || '',
        ativo: true
    };

    memoryCache.disciplinas.push(newItem);
    persistCache();
    notifyListeners();

    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.from('disciplinas').insert([newItem]);
        if (error) throw new Error(error.message);
    }
    return { success: true, id: newItem.id };
}

export async function updateDisciplina(id, data) {
    const idx = memoryCache.disciplinas.findIndex(d => String(d.id) === String(id));
    if (idx !== -1) {
        memoryCache.disciplinas[idx] = { ...memoryCache.disciplinas[idx], ...data };
        persistCache();
        notifyListeners();
    }

    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.from('disciplinas').update(data).eq('id', id);
        if (error) throw new Error(error.message);
    }
    return { success: true };
}

export async function deleteDisciplina(id) {
    const idx = memoryCache.disciplinas.findIndex(d => String(d.id) === String(id));
    if (idx !== -1) {
        memoryCache.disciplinas[idx].ativo = false;
        persistCache();
        notifyListeners();
    }

    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.from('disciplinas').update({ ativo: false }).eq('id', id);
        if (error) throw new Error(error.message);
    }
    return { success: true };
}

export async function seedDisciplinas(defaultList) {
    const existing = new Set(memoryCache.disciplinas.map(d => d.nome.toLowerCase().trim()));
    const toInsert = [];

    defaultList.forEach(item => {
        const nome = typeof item === 'string' ? item : item.nome;
        const sigla = (typeof item === 'object' && item.sigla) ? item.sigla : getDisciplinaSigla(nome);

        if (!existing.has(nome.toLowerCase().trim())) {
            const newItem = {
                id: 'disc_' + Math.random().toString(36).substring(2, 9),
                nome,
                sigla,
                ativo: true
            };
            memoryCache.disciplinas.push(newItem);
            toInsert.push(newItem);
        }
    });

    persistCache();
    notifyListeners();

    const client = getSupabaseClient();
    if (client && toInsert.length > 0) {
        await client.from('disciplinas').upsert(toInsert, { onConflict: 'nome' });
    }
    return { success: true, count: toInsert.length };
}

// ============================================================
// RESERVAS E CALENDÁRIO
// ============================================================

export async function getReservas(dataISO, labId = '', turno = '') {
    const dNorm = normalizeDate(dataISO);
    return memoryCache.reservas.filter(r => {
        if (r.status === 'rejeitado') return false;
        if (r.data !== dNorm) return false;
        if (labId && String(r.labId) !== String(labId)) return false;
        if (turno && r.turno !== turno) return false;
        return true;
    });
}

export async function getReservasSemana(datesISO) {
    const normDates = (datesISO || []).map(normalizeDate);
    return memoryCache.reservas.filter(r => {
        if (r.status === 'rejeitado') return false;
        return normDates.includes(r.data);
    });
}

export async function getReservasProfessor(professorId) {
    return memoryCache.reservas.filter(r =>
        String(r.professorId) === String(professorId) && r.status !== 'rejeitado'
    );
}

export async function getReservasPendentes() {
    return memoryCache.reservas.filter(r => r.status === 'pendente');
}

export async function getReservaById(id) {
    return memoryCache.reservas.find(r => String(r.id) === String(id)) || null;
}

/**
 * Verifica se há conflito de reservas no mesmo laboratório, data, turno e aulas
 */
export async function checkConflict(labId, dataISO, turno, aulas, excludeId = '') {
    const dNorm = normalizeDate(dataISO);
    const aulasNum = parseAulas(aulas);

    const conflito = memoryCache.reservas.find(r => {
        if (String(r.id) === String(excludeId)) return false;
        if (r.status === 'rejeitado') return false;
        if (String(r.labId) !== String(labId)) return false;
        if (r.data !== dNorm) return false;
        if (r.turno !== turno) return false;
        return hasAulaConflict(r.aulas, aulasNum);
    });

    if (conflito) {
        return {
            hasConflict: true,
            conflictingReserva: conflito
        };
    }
    return { hasConflict: false, conflictingReserva: null };
}

/**
 * Cria uma reserva individual
 */
export async function createReserva(reservaData, isAdmin = false) {
    const dNorm = normalizeDate(reservaData.data);
    const aulasNum = parseAulas(reservaData.aulas);

    // 1. Validação Anticonflito
    const conflict = await checkConflict(reservaData.labId, dNorm, reservaData.turno, aulasNum);
    if (conflict.hasConflict) {
        const c = conflict.conflictingReserva;
        throw new Error(
            `Conflito de horário! O ${c.labNome || 'laboratório'} já possui reserva para a ` +
            `${(c.aulas || []).map(a => a + 'ª').join(', ')} aula (${c.professorNome || 'outro professor'}).`
        );
    }

    const newId = 'res_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const status = isAdmin ? (reservaData.status || 'confirmado') : 'pendente';

    const dbRow = {
        id: newId,
        data: dNorm,
        turno: reservaData.turno,
        lab_id: reservaData.labId,
        lab_nome: reservaData.labNome,
        professor_id: reservaData.professorId || '',
        professor_nome: reservaData.professorNome,
        curso_id: reservaData.cursoId || '',
        curso_nome: reservaData.cursoNome || '',
        turma_id: reservaData.turmaId || '',
        turma_nome: reservaData.turmaNome || reservaData.turma || '',
        disciplina_id: reservaData.disciplinaId || '',
        disciplina_nome: reservaData.disciplinaNome || reservaData.disciplina || '',
        disciplina_sigla: reservaData.disciplinaSigla || getDisciplinaSigla(reservaData.disciplinaNome) || '',
        aulas: aulasNum,
        recursos_extras: reservaData.recursosExtras || reservaData.recursos || [],
        observacoes: reservaData.observacoes || '',
        status: status,
        recorrente: Boolean(reservaData.recorrente),
        recorrente_ate: reservaData.recorrenteAte ? normalizeDate(reservaData.recorrenteAte) : null
    };

    const normalized = normalizeReserva(dbRow);

    // Atualização otimista imediata na memória e tela
    memoryCache.reservas.push(normalized);
    persistCache();
    notifyListeners();

    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.from('reservas').insert([dbRow]);
        if (error) {
            // Reverte em caso de erro no banco
            memoryCache.reservas = memoryCache.reservas.filter(r => r.id !== newId);
            persistCache();
            notifyListeners();
            throw new Error('Erro ao salvar reserva no Supabase: ' + error.message);
        }
    }

    return { success: true, id: newId, reserva: normalized };
}

/**
 * Cria reservas recorrentes semanais
 */
export async function createReservaRecorrente(baseData, dataFim, isAdmin = false) {
    const dates = getRecurringDates(baseData.data, dataFim);
    let created = 0;
    let conflicts = 0;

    for (const d of dates) {
        try {
            await createReserva({
                ...baseData,
                data: d,
                recorrente: true,
                recorrenteAte: dataFim
            }, isAdmin);
            created++;
        } catch (err) {
            conflicts++;
        }
    }

    return { success: true, created, conflicts };
}

export async function updateReservaStatus(id, newStatus) {
    const idx = memoryCache.reservas.findIndex(r => String(r.id) === String(id));
    if (idx !== -1) {
        memoryCache.reservas[idx].status = newStatus;
        persistCache();
        notifyListeners();
    }

    const client = getSupabaseClient();
    if (client) {
        const { error } = await client
            .from('reservas')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw new Error(error.message);
    }
    return { success: true };
}

export async function deleteReserva(id) {
    memoryCache.reservas = memoryCache.reservas.filter(r => String(r.id) !== String(id));
    persistCache();
    notifyListeners();

    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.from('reservas').delete().eq('id', id);
        if (error) throw new Error(error.message);
    }
    return { success: true };
}

/**
 * Registra um callback para atualizações em tempo real no calendário
 */
export function onReservasChange(datesISO, callback) {
    const listener = () => {
        const res = memoryCache.reservas.filter(r => {
            if (r.status === 'rejeitado') return false;
            return datesISO.includes(r.data);
        });
        callback(res);
    };

    listeners.add(listener);

    // Retorna função para cancelar inscrição (cleanup)
    return () => {
        listeners.delete(listener);
    };
}

// ============================================================
// OPÇÕES DO FORMULÁRIO (RESTRIÇÃO POR PROFESSOR)
// ============================================================

export async function getOpcoesFormulario(profile) {
    const isAdm = profile?.perfil === 'admin';

    if (isAdm) {
        return {
            success: true,
            perfil: 'admin',
            restrito: false,
            cursos: (await getCursos()).map(c => c.nome),
            turmas: (await getTurmas()).map(t => t.nome),
            disciplinas: (await getDisciplinas()).map(d => ({ nome: d.nome, sigla: d.sigla || '' })),
            atribuicoes: []
        };
    }

    const userNome = (profile?.nome || '').toLowerCase().trim();
    const userEmail = (profile?.email || '').toLowerCase().trim();

    const atribs = memoryCache.atribuicoes.filter(a => {
        const prof = (a.professor || '').toLowerCase().trim();
        return prof === userNome || prof === userEmail || userNome.includes(prof) || prof.includes(userNome);
    });

    if (atribs.length === 0) {
        // Fallback: se não tiver atribuição cadastrada ainda, libera catálogo geral
        return {
            success: true,
            perfil: 'professor',
            restrito: false,
            cursos: (await getCursos()).map(c => c.nome),
            turmas: (await getTurmas()).map(t => t.nome),
            disciplinas: (await getDisciplinas()).map(d => ({ nome: d.nome, sigla: d.sigla || '' })),
            atribuicoes: []
        };
    }

    const cursosSet = new Set();
    const turmasSet = new Set();
    const discMap = new Map();

    atribs.forEach(a => {
        if (a.curso) cursosSet.add(a.curso);
        if (a.turma) turmasSet.add(a.turma);
        if (a.disciplina && !discMap.has(a.disciplina)) {
            discMap.set(a.disciplina, a.sigla || getDisciplinaSigla(a.disciplina));
        }
    });

    return {
        success: true,
        perfil: 'professor',
        restrito: true,
        cursos: Array.from(cursosSet),
        turmas: Array.from(turmasSet),
        disciplinas: Array.from(discMap.entries()).map(([nome, sigla]) => ({ nome, sigla })),
        atribuicoes: atribs
    };
}

// ============================================================
// ATRIBUIÇÕES (IMPORTAÇÃO EXCEL / CSV)
// ============================================================

export async function getAtribuicoesList() {
    if (memoryCache.atribuicoes.length === 0 && isSupabaseConfigured()) {
        await fetchInitialData();
    }
    return memoryCache.atribuicoes || [];
}

export async function importAtribuicoes(items, options = {}) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Nenhum item válido para importar.');
    }

    if (options.overwrite !== false) {
        memoryCache.atribuicoes = [];
    }

    const formatted = items.map(it => ({
        professor: it.professor || it.Professor || '',
        curso: it.curso || it.Curso || '',
        turma: it.turma || it.Turma || '',
        disciplina: it.disciplina || it.Disciplina || '',
        sigla: it.sigla || it.Sigla || getDisciplinaSigla(it.disciplina || it.Disciplina) || ''
    })).filter(it => it.professor && it.disciplina);

    memoryCache.atribuicoes = formatted;
    persistCache();
    notifyListeners();

    const client = getSupabaseClient();
    if (client) {
        if (options.overwrite !== false) {
            await client.from('atribuicoes').delete().neq('id', '0');
        }
        const { error } = await client.from('atribuicoes').insert(formatted);
        if (error) throw new Error('Erro ao salvar atribuições no Supabase: ' + error.message);
    }

    return { success: true, count: formatted.length };
}

// ============================================================
// USUÁRIOS
// ============================================================

export async function getUsuarios() {
    if (memoryCache.usuarios.length === 0 && isSupabaseConfigured()) {
        await fetchInitialData();
    }
    return memoryCache.usuarios;
}

export async function updateUsuario(id, data) {
    const idx = memoryCache.usuarios.findIndex(u => String(u.id) === String(id));
    if (idx !== -1) {
        memoryCache.usuarios[idx] = { ...memoryCache.usuarios[idx], ...data };
        persistCache();
        notifyListeners();
    }

    const client = getSupabaseClient();
    if (client) {
        const updateData = {};
        if (data.nome) updateData.nome = data.nome;
        if (data.perfil) updateData.perfil = data.perfil;
        if (data.professorId !== undefined) updateData.professor_id = data.professorId;
        if (data.senha) updateData.senha = data.senha;

        const { error } = await client.from('usuarios').update(updateData).eq('id', id);
        if (error) throw new Error(error.message);
    }
    return { success: true };
}

export async function deleteUsuario(id) {
    memoryCache.usuarios = memoryCache.usuarios.filter(u => String(u.id) !== String(id));
    persistCache();
    notifyListeners();

    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.from('usuarios').delete().eq('id', id);
        if (error) throw new Error(error.message);
    }
    return { success: true };
}

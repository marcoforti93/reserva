// ============================================================
// sheet-service.js
// Serviço CRUD conectado à planilha Google Sheets via Apps Script Web App
// Com fallback automático para armazenamento local (mock) se a API não estiver configurada
// ============================================================

import { getSheetApiUrl, isApiConfigured } from './sheet-config.js';
import { hasAulaConflict, formatDateISO, getRecurringDates } from './utils.js';
import { showToast } from './ui-helpers.js';
import { getDisciplinaSigla } from './schedule-config.js';

// Cache em memória para desempenho instantâneo
let localCache = {
    laboratorios: null,
    professores: null,
    cursos: null,
    turmas: null,
    disciplinas: null,
    reservas: null,
    lastFetchTime: 0
};

// ============================================================
// REQUISIÇÕES HTTP PARA A API GOOGLE APPS SCRIPT
// ============================================================

/**
 * Executa chamada GET para o Google Apps Script
 */
async function apiGet(action, params = {}) {
    const baseUrl = getSheetApiUrl();
    const query = new URLSearchParams({ action, ...params }).toString();
    const url = `${baseUrl}?${query}`;

    try {
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
    } catch (err) {
        console.error(`Erro na requisição GET [${action}]:`, err);
        throw err;
    }
}

/**
 * Executa chamada POST para o Google Apps Script
 * Envia como text/plain para evitar bloqueios de CORS Preflight (OPTIONS)
 */
async function apiPost(action, payload = {}) {
    const url = getSheetApiUrl();

    try {
        const bodyContent = JSON.stringify({ action, ...payload });
        const response = await fetch(url, {
            method: 'POST',
            redirect: 'follow',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: bodyContent
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const data = await response.json();
        if (data && data.success === false) {
            throw new Error(data.error || 'Erro desconhecido ao salvar na planilha.');
        }
        return data;
    } catch (err) {
        console.error(`Erro na requisição POST [${action}]:`, err);
        throw err;
    }
}

// ============================================================
// MOCK LOCALSTORAGE (Executado quando a API ainda não foi configurada)
// Permite testar o sistema completo localmente sem falhas
// ============================================================

const MOCK_STORAGE_KEY = 'reserva_salas_mock_data';

function getMockData() {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    if (raw) {
        try { return JSON.parse(raw); } catch (e) { }
    }
    const initial = {
        laboratorios: [
            { id: 'lab_1', nome: 'Laboratório 1 - Informática', capacidade: 32, descricao: 'Computadores i5, Projetor e Ar condicionado', recursos: ['computadores', 'projetor', 'ar_condicionado', 'internet'], ativo: true },
            { id: 'lab_2', nome: 'Laboratório 2 - Redes e Manutenção', capacidade: 28, descricao: 'Racks, switches Cisco e bancadas técnicas', recursos: ['computadores', 'projetor', 'ar_condicionado'], ativo: true },
            { id: 'lab_3', nome: 'Laboratório 3 - Design e Multimídia', capacidade: 30, descricao: 'Edição de vídeo, multimídia e som', recursos: ['computadores', 'projetor', 'ar_condicionado', 'sistema_som'], ativo: true },
            { id: 'lab_4', nome: 'Laboratório 4 - Informática Geral', capacidade: 35, descricao: 'Aulas teóricas e práticas com projetor', recursos: ['computadores', 'projetor', 'ar_condicionado'], ativo: true }
        ],
        professores: [
            { id: 'prof_1', nome: 'Prof. Carlos Silva', email: 'carlos.silva@etec.sp.gov.br', disciplinas: ['Programação Web', 'Banco de Dados'] },
            { id: 'prof_2', nome: 'Profa. Mariana Costa', email: 'mariana.costa@etec.sp.gov.br', disciplinas: ['Redes de Computadores', 'Sistemas Operacionais'] }
        ],
        cursos: [
            { id: 'cur_1', nome: 'Técnico em Desenvolvimento de Sistemas', periodo: 'Noturno', ativo: true },
            { id: 'cur_2', nome: 'Técnico em Informática para Internet', periodo: 'Tarde', ativo: true },
            { id: 'cur_3', nome: 'Ensino Médio com Habilitação Técnica (M-TEC)', periodo: 'Manhã', ativo: true }
        ],
        turmas: [
            { id: 'tur_1', nome: '1º DS - Noite', turno: 'noite', ativo: true },
            { id: 'tur_2', nome: '2º DS - Noite', turno: 'noite', ativo: true },
            { id: 'tur_3', nome: '3º DS - Noite', turno: 'noite', ativo: true }
        ],
        disciplinas: [
            { id: 'disc_1', nome: 'Programação Web I', sigla: 'PW I', ativo: true },
            { id: 'disc_2', nome: 'Banco de Dados', sigla: 'BD', ativo: true },
            { id: 'disc_3', nome: 'Redes de Computadores', sigla: 'RC', ativo: true }
        ],
        reservas: []
    };
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(initial));
    return initial;
}

function saveMockData(data) {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(data));
}

// ============================================================
// LABORATÓRIOS
// ============================================================

export async function getLaboratorios() {
    if (!isApiConfigured()) {
        return getMockData().laboratorios.filter(l => l.ativo !== false);
    }
    try {
        const res = await apiGet('getItems', { table: 'laboratorios' });
        const labs = (res.data || []).filter(l => l.ativo !== false);
        return labs.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    } catch (error) {
        console.error('Erro ao buscar laboratórios da planilha:', error);
        return getMockData().laboratorios.filter(l => l.ativo !== false);
    }
}

export async function addLaboratorio(data) {
    if (!isApiConfigured()) {
        const mock = getMockData();
        const id = 'lab_' + Date.now();
        mock.laboratorios.push({ id, ...data, ativo: true });
        saveMockData(mock);
        showToast('Laboratório cadastrado com sucesso!', 'success');
        return id;
    }
    try {
        const res = await apiPost('addItem', { table: 'laboratorios', data });
        showToast('Laboratório cadastrado na planilha!', 'success');
        return res.id;
    } catch (error) {
        showToast('Erro ao cadastrar laboratório na planilha.', 'error');
        throw error;
    }
}

export async function updateLaboratorio(id, data) {
    if (!isApiConfigured()) {
        const mock = getMockData();
        const idx = mock.laboratorios.findIndex(l => l.id === id);
        if (idx !== -1) {
            mock.laboratorios[idx] = { ...mock.laboratorios[idx], ...data };
            saveMockData(mock);
        }
        showToast('Laboratório atualizado!', 'success');
        return;
    }
    try {
        await apiPost('updateItem', { table: 'laboratorios', id, data });
        showToast('Laboratório atualizado na planilha!', 'success');
    } catch (error) {
        showToast('Erro ao atualizar laboratório.', 'error');
        throw error;
    }
}

export async function deleteLaboratorio(id) {
    if (!isApiConfigured()) {
        const mock = getMockData();
        const idx = mock.laboratorios.findIndex(l => l.id === id);
        if (idx !== -1) {
            mock.laboratorios[idx].ativo = false;
            saveMockData(mock);
        }
        showToast('Laboratório removido.', 'info');
        return;
    }
    try {
        await apiPost('deleteItem', { table: 'laboratorios', id, softDelete: true });
        showToast('Laboratório removido da planilha.', 'info');
    } catch (error) {
        showToast('Erro ao remover laboratório.', 'error');
        throw error;
    }
}

// ============================================================
// PROFESSORES
// ============================================================

export async function getProfessores() {
    if (!isApiConfigured()) {
        return getMockData().professores.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    }
    try {
        const res = await apiGet('getItems', { table: 'professores' });
        return (res.data || []).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    } catch (error) {
        console.error('Erro ao buscar professores:', error);
        return getMockData().professores;
    }
}

export async function addProfessor(data) {
    if (!isApiConfigured()) {
        const mock = getMockData();
        const id = 'prof_' + Date.now();
        mock.professores.push({ id, ...data });
        saveMockData(mock);
        showToast('Professor cadastrado com sucesso!', 'success');
        return id;
    }
    try {
        const res = await apiPost('addItem', { table: 'professores', data });
        showToast('Professor cadastrado na planilha!', 'success');
        return res.id;
    } catch (error) {
        showToast('Erro ao cadastrar professor.', 'error');
        throw error;
    }
}

export async function updateProfessor(id, data) {
    if (!isApiConfigured()) {
        const mock = getMockData();
        const idx = mock.professores.findIndex(p => p.id === id);
        if (idx !== -1) {
            mock.professores[idx] = { ...mock.professores[idx], ...data };
            saveMockData(mock);
        }
        showToast('Professor atualizado!', 'success');
        return;
    }
    try {
        await apiPost('updateItem', { table: 'professores', id, data });
        showToast('Professor atualizado na planilha!', 'success');
    } catch (error) {
        showToast('Erro ao atualizar professor.', 'error');
        throw error;
    }
}

export async function deleteProfessor(id) {
    if (!isApiConfigured()) {
        const mock = getMockData();
        mock.professores = mock.professores.filter(p => p.id !== id);
        saveMockData(mock);
        showToast('Professor removido.', 'info');
        return;
    }
    try {
        await apiPost('deleteItem', { table: 'professores', id, softDelete: false });
        showToast('Professor removido.', 'info');
    } catch (error) {
        showToast('Erro ao remover professor.', 'error');
        throw error;
    }
}

// ============================================================
// CURSOS
// ============================================================

export async function getCursos() {
    if (!isApiConfigured()) {
        return getMockData().cursos.filter(c => c.ativo !== false);
    }
    try {
        const res = await apiGet('getItems', { table: 'cursos' });
        return (res.data || []).filter(c => c.ativo !== false).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    } catch (error) {
        console.error('Erro ao buscar cursos:', error);
        return getMockData().cursos;
    }
}

export async function addCurso(data) {
    if (!isApiConfigured()) {
        const mock = getMockData();
        const id = 'cur_' + Date.now();
        mock.cursos.push({ id, ...data, ativo: true });
        saveMockData(mock);
        showToast('Curso cadastrado com sucesso!', 'success');
        return id;
    }
    try {
        const res = await apiPost('addItem', { table: 'cursos', data });
        showToast('Curso cadastrado na planilha!', 'success');
        return res.id;
    } catch (error) {
        showToast('Erro ao cadastrar curso.', 'error');
        throw error;
    }
}

export async function updateCurso(id, data) {
    if (!isApiConfigured()) {
        const mock = getMockData();
        const idx = mock.cursos.findIndex(c => c.id === id);
        if (idx !== -1) {
            mock.cursos[idx] = { ...mock.cursos[idx], ...data };
            saveMockData(mock);
        }
        showToast('Curso atualizado!', 'success');
        return;
    }
    try {
        await apiPost('updateItem', { table: 'cursos', id, data });
        showToast('Curso atualizado na planilha!', 'success');
    } catch (error) {
        showToast('Erro ao atualizar curso.', 'error');
        throw error;
    }
}

export async function deleteCurso(id) {
    if (!isApiConfigured()) {
        const mock = getMockData();
        const idx = mock.cursos.findIndex(c => c.id === id);
        if (idx !== -1) {
            mock.cursos[idx].ativo = false;
            saveMockData(mock);
        }
        showToast('Curso removido.', 'info');
        return;
    }
    try {
        await apiPost('deleteItem', { table: 'cursos', id, softDelete: true });
        showToast('Curso removido.', 'info');
    } catch (error) {
        showToast('Erro ao remover curso.', 'error');
        throw error;
    }
}

// ============================================================
// TURMAS
// ============================================================

export async function getTurmas() {
    if (!isApiConfigured()) {
        return getMockData().turmas.filter(t => t.ativo !== false);
    }
    try {
        const res = await apiGet('getItems', { table: 'turmas' });
        return (res.data || []).filter(t => t.ativo !== false).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    } catch (error) {
        console.error('Erro ao buscar turmas:', error);
        return getMockData().turmas;
    }
}

export async function addTurma(data) {
    if (!isApiConfigured()) {
        const mock = getMockData();
        const id = 'tur_' + Date.now();
        mock.turmas.push({ id, ...data, ativo: true });
        saveMockData(mock);
        showToast('Turma cadastrada com sucesso!', 'success');
        return id;
    }
    try {
        const res = await apiPost('addItem', { table: 'turmas', data });
        showToast('Turma cadastrada na planilha!', 'success');
        return res.id;
    } catch (error) {
        showToast('Erro ao cadastrar turma.', 'error');
        throw error;
    }
}

export async function updateTurma(id, data) {
    if (!isApiConfigured()) {
        const mock = getMockData();
        const idx = mock.turmas.findIndex(t => t.id === id);
        if (idx !== -1) {
            mock.turmas[idx] = { ...mock.turmas[idx], ...data };
            saveMockData(mock);
        }
        showToast('Turma atualizada!', 'success');
        return;
    }
    try {
        await apiPost('updateItem', { table: 'turmas', id, data });
        showToast('Turma atualizada na planilha!', 'success');
    } catch (error) {
        showToast('Erro ao atualizar turma.', 'error');
        throw error;
    }
}

export async function deleteTurma(id) {
    if (!isApiConfigured()) {
        const mock = getMockData();
        const idx = mock.turmas.findIndex(t => t.id === id);
        if (idx !== -1) {
            mock.turmas[idx].ativo = false;
            saveMockData(mock);
        }
        showToast('Turma removida.', 'info');
        return;
    }
    try {
        await apiPost('deleteItem', { table: 'turmas', id, softDelete: true });
        showToast('Turma removida.', 'info');
    } catch (error) {
        showToast('Erro ao remover turma.', 'error');
        throw error;
    }
}

export async function seedTurmas(defaultList) {
    const items = defaultList.map(item => ({
        nome: typeof item === 'string' ? item : item.nome,
        turno: typeof item === 'object' && item.turno ? item.turno : ''
    }));

    if (!isApiConfigured()) {
        const mock = getMockData();
        const existingNames = new Set(mock.turmas.map(t => (t.nome || '').toLowerCase().trim()));
        let count = 0;
        for (const item of items) {
            if (!existingNames.has(item.nome.toLowerCase().trim())) {
                mock.turmas.push({ id: 'tur_' + Date.now() + Math.random(), ...item, ativo: true });
                count++;
            }
        }
        saveMockData(mock);
        showToast(`${count} turma(s) importada(s)!`, 'success');
        return count;
    }

    try {
        const res = await apiPost('seedItems', { table: 'turmas', items, keyField: 'nome' });
        showToast(`${res.count || 0} turma(s) importada(s) para a planilha!`, 'success');
        return res.count || 0;
    } catch (error) {
        showToast('Erro ao importar turmas.', 'error');
        throw error;
    }
}

// ============================================================
// DISCIPLINAS
// ============================================================

export async function getDisciplinas() {
    if (!isApiConfigured()) {
        return getMockData().disciplinas.filter(d => d.ativo !== false);
    }
    try {
        const res = await apiGet('getItems', { table: 'disciplinas' });
        return (res.data || []).filter(d => d.ativo !== false).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    } catch (error) {
        console.error('Erro ao buscar disciplinas:', error);
        return getMockData().disciplinas;
    }
}

export async function addDisciplina(data) {
    if (!isApiConfigured()) {
        const mock = getMockData();
        const id = 'disc_' + Date.now();
        mock.disciplinas.push({ id, ...data, ativo: true });
        saveMockData(mock);
        showToast('Disciplina cadastrada com sucesso!', 'success');
        return id;
    }
    try {
        const res = await apiPost('addItem', { table: 'disciplinas', data });
        showToast('Disciplina cadastrada na planilha!', 'success');
        return res.id;
    } catch (error) {
        showToast('Erro ao cadastrar disciplina.', 'error');
        throw error;
    }
}

export async function updateDisciplina(id, data) {
    if (!isApiConfigured()) {
        const mock = getMockData();
        const idx = mock.disciplinas.findIndex(d => d.id === id);
        if (idx !== -1) {
            mock.disciplinas[idx] = { ...mock.disciplinas[idx], ...data };
            saveMockData(mock);
        }
        showToast('Disciplina atualizada!', 'success');
        return;
    }
    try {
        await apiPost('updateItem', { table: 'disciplinas', id, data });
        showToast('Disciplina atualizada na planilha!', 'success');
    } catch (error) {
        showToast('Erro ao atualizar disciplina.', 'error');
        throw error;
    }
}

export async function deleteDisciplina(id) {
    if (!isApiConfigured()) {
        const mock = getMockData();
        const idx = mock.disciplinas.findIndex(d => d.id === id);
        if (idx !== -1) {
            mock.disciplinas[idx].ativo = false;
            saveMockData(mock);
        }
        showToast('Disciplina removida.', 'info');
        return;
    }
    try {
        await apiPost('deleteItem', { table: 'disciplinas', id, softDelete: true });
        showToast('Disciplina removida.', 'info');
    } catch (error) {
        showToast('Erro ao remover disciplina.', 'error');
        throw error;
    }
}

export async function seedDisciplinas(defaultList) {
    const items = defaultList.map(item => ({
        nome: typeof item === 'string' ? item : item.nome,
        sigla: (typeof item === 'object' && item.sigla) ? item.sigla : getDisciplinaSigla(typeof item === 'string' ? item : item.nome)
    }));

    if (!isApiConfigured()) {
        const mock = getMockData();
        const existingNames = new Set(mock.disciplinas.map(d => (d.nome || '').toLowerCase().trim()));
        let count = 0;
        for (const item of items) {
            if (!existingNames.has(item.nome.toLowerCase().trim())) {
                mock.disciplinas.push({ id: 'disc_' + Date.now() + Math.random(), ...item, ativo: true });
                count++;
            }
        }
        saveMockData(mock);
        showToast(`${count} disciplina(s) importada(s)!`, 'success');
        return count;
    }

    try {
        const res = await apiPost('seedItems', { table: 'disciplinas', items, keyField: 'nome' });
        showToast(`${res.count || 0} disciplina(s) importada(s) para a planilha!`, 'success');
        return res.count || 0;
    } catch (error) {
        showToast('Erro ao importar disciplinas.', 'error');
        throw error;
    }
}

// ============================================================
// RESERVAS
// ============================================================

export async function getReservas(dataISO, labId = '', turno = '') {
    let list = [];
    if (!isApiConfigured()) {
        list = getMockData().reservas.filter(r => r.data === dataISO);
    } else {
        try {
            const res = await apiGet('getReservas', { data: dataISO });
            list = res.data || [];
        } catch (error) {
            console.error('Erro ao buscar reservas da planilha:', error);
            list = getMockData().reservas.filter(r => r.data === dataISO);
        }
    }

    if (labId) list = list.filter(r => String(r.labId) === String(labId));
    if (turno) list = list.filter(r => String(r.turno) === String(turno));
    return list;
}

export async function getReservasSemana(datesISO) {
    if (!datesISO || datesISO.length === 0) return [];

    if (!isApiConfigured()) {
        const mock = getMockData();
        return mock.reservas.filter(r => datesISO.includes(r.data));
    }

    try {
        const res = await apiGet('getReservas', { semana: datesISO.join(',') });
        return res.data || [];
    } catch (error) {
        console.error('Erro ao buscar reservas da semana:', error);
        return getMockData().reservas.filter(r => datesISO.includes(r.data));
    }
}

export async function getReservasProfessor(professorId) {
    if (!isApiConfigured()) {
        return getMockData().reservas.filter(r => String(r.professorId) === String(professorId));
    }
    try {
        const res = await apiGet('getReservas', { professorId });
        return res.data || [];
    } catch (error) {
        console.error('Erro ao buscar reservas do professor:', error);
        return [];
    }
}

export async function getReservasPendentes() {
    let list = [];
    if (!isApiConfigured()) {
        list = getMockData().reservas;
    } else {
        try {
            const res = await apiGet('getItems', { table: 'reservas' });
            list = res.data || [];
        } catch (error) {
            console.error('Erro ao buscar reservas pendentes:', error);
            list = getMockData().reservas;
        }
    }
    return list.filter(r => r.status === 'pendente').sort((a, b) => (a.data || '').localeCompare(b.data || ''));
}

export async function getReservaById(id) {
    let list = [];
    if (!isApiConfigured()) {
        list = getMockData().reservas;
    } else {
        try {
            const res = await apiGet('getItems', { table: 'reservas' });
            list = res.data || [];
        } catch (error) {
            list = getMockData().reservas;
        }
    }
    return list.find(r => String(r.id) === String(id)) || null;
}

export async function checkConflict(labId, dataISO, turno, aulas, excludeId = '') {
    const reservas = await getReservas(dataISO, labId, turno);

    for (const r of reservas) {
        if (String(r.id) === String(excludeId)) continue;
        if (r.status === 'rejeitado') continue;

        const rAulas = Array.isArray(r.aulas) ? r.aulas : [];
        if (hasAulaConflict(aulas, rAulas)) {
            return {
                hasConflict: true,
                conflictingReserva: r
            };
        }
    }

    return { hasConflict: false, conflictingReserva: null };
}

export async function createReserva(reservaData, isAdmin = false) {
    const { hasConflict, conflictingReserva } = await checkConflict(
        reservaData.labId,
        reservaData.data,
        reservaData.turno,
        reservaData.aulas
    );

    if (hasConflict) {
        const msg = `Conflito: ${conflictingReserva.professorNome || 'Outro professor'} já reservou este horário (${conflictingReserva.status}).`;
        showToast(msg, 'error', 5000);
        return { success: false, conflict: conflictingReserva };
    }

    const payload = {
        ...reservaData,
        status: isAdmin ? 'confirmado' : 'pendente'
    };

    if (!isApiConfigured()) {
        const mock = getMockData();
        const id = 'res_' + Date.now();
        const now = new Date().toISOString();
        mock.reservas.push({ id, ...payload, criadoEm: now, atualizadoEm: now });
        saveMockData(mock);
        showToast(isAdmin ? 'Reserva confirmada!' : 'Reserva enviada! Aguardando aprovação.', 'success');
        return { success: true, id };
    }

    try {
        const res = await apiPost('createReserva', { data: payload });
        showToast(isAdmin ? 'Reserva confirmada na planilha!' : 'Reserva enviada! Aguardando aprovação.', 'success');
        return { success: true, id: res.id };
    } catch (error) {
        showToast('Erro ao gravar reserva na planilha.', 'error');
        throw error;
    }
}

export async function createReservaRecorrente(baseData, dataFim, isAdmin = false) {
    const startDate = new Date(baseData.data + 'T00:00:00');
    const endDate = new Date(dataFim + 'T00:00:00');
    const dates = getRecurringDates(startDate, endDate);

    const reservaList = dates.map(date => ({
        ...baseData,
        data: formatDateISO(date),
        recorrente: true,
        recorrenteAte: dataFim,
        status: isAdmin ? 'confirmado' : 'pendente'
    }));

    if (!isApiConfigured()) {
        const mock = getMockData();
        let created = 0;
        let conflicts = 0;
        const now = new Date().toISOString();

        for (const item of reservaList) {
            const hasConf = mock.reservas.some(r =>
                r.status !== 'rejeitado' &&
                String(r.labId) === String(item.labId) &&
                String(r.data) === String(item.data) &&
                String(r.turno) === String(item.turno) &&
                hasAulaConflict(item.aulas, r.aulas || [])
            );

            if (!hasConf) {
                mock.reservas.push({ id: 'res_' + Date.now() + Math.random(), ...item, criadoEm: now, atualizadoEm: now });
                created++;
            } else {
                conflicts++;
            }
        }
        saveMockData(mock);
        showToast(`${created} reserva(s) criada(s)!${conflicts > 0 ? ` ${conflicts} conflito(s).` : ''}`, 'success', 5000);
        return { created, conflicts, errors: 0 };
    }

    try {
        const res = await apiPost('createReservaBatch', { list: reservaList });
        const created = res.created || 0;
        const conflicts = res.conflicts || 0;
        showToast(`${created} reserva(s) salvas na planilha!${conflicts > 0 ? ` (${conflicts} conflitos evitados)` : ''}`, 'success', 5000);
        return { created, conflicts, errors: 0 };
    } catch (error) {
        showToast('Erro ao processar reservas recorrentes.', 'error');
        throw error;
    }
}

export async function updateReservaStatus(id, newStatus) {
    if (!isApiConfigured()) {
        const mock = getMockData();
        const r = mock.reservas.find(res => String(res.id) === String(id));
        if (r) {
            r.status = newStatus;
            r.atualizadoEm = new Date().toISOString();
            saveMockData(mock);
        }
        const labels = { confirmado: 'aprovada', rejeitado: 'rejeitada', manutencao: 'marcada em manutenção' };
        showToast(`Reserva ${labels[newStatus] || 'atualizada'}!`, 'success');
        return;
    }

    try {
        await apiPost('updateReservaStatus', { id, status: newStatus });
        const labels = { confirmado: 'aprovada', rejeitado: 'rejeitada', manutencao: 'marcada em manutenção' };
        showToast(`Reserva ${labels[newStatus] || 'atualizada na planilha'}!`, 'success');
    } catch (error) {
        showToast('Erro ao atualizar reserva.', 'error');
        throw error;
    }
}

export async function deleteReserva(id) {
    if (!isApiConfigured()) {
        const mock = getMockData();
        mock.reservas = mock.reservas.filter(r => String(r.id) !== String(id));
        saveMockData(mock);
        showToast('Reserva cancelada.', 'info');
        return;
    }

    try {
        await apiPost('deleteReserva', { id });
        showToast('Reserva removida da planilha.', 'info');
    } catch (error) {
        showToast('Erro ao cancelar reserva.', 'error');
        throw error;
    }
}

/**
 * Monitora reservas da semana
 * Atualiza imediatamente e faz polling periódico a cada 25 segundos
 */
export function onReservasChange(datesISO, callback) {
    if (!datesISO || datesISO.length === 0) return () => { };

    let isDisposed = false;

    // Busca imediata
    getReservasSemana(datesISO).then(data => {
        if (!isDisposed) callback(data);
    });

    // Polling a cada 25 segundos
    const timerId = setInterval(async () => {
        if (isDisposed) return;
        if (document.hidden) return; // Evita requisições se a aba estiver em segundo plano
        try {
            const data = await getReservasSemana(datesISO);
            if (!isDisposed) callback(data);
        } catch (e) {
            // Silencioso em caso de instabilidade de rede temporária
        }
    }, 25000);

    return () => {
        isDisposed = true;
        clearInterval(timerId);
    };
}

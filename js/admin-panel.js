// ============================================================
// admin-panel.js
// Painel Administrativo: aprovações, CRUD labs/profs/cursos/turmas/disciplinas
// ============================================================

import {
    getReservasPendentes, updateReservaStatus, deleteReserva,
    getLaboratorios, addLaboratorio, updateLaboratorio, deleteLaboratorio,
    getProfessores, addProfessor, updateProfessor, deleteProfessor,
    getCursos, addCurso, updateCurso, deleteCurso,
    getTurmas, addTurma, updateTurma, deleteTurma, seedTurmas,
    getDisciplinas, addDisciplina, updateDisciplina, deleteDisciplina, seedDisciplinas,
    getAtribuicoesList, importAtribuicoes,
    getUsuarios, updateUsuario, deleteUsuario
} from './sheet-service.js';
import { registerUser, isAdmin, getCurrentUser } from './auth.js';
import { showToast, showConfirm, showLoader, createStatusBadge, openModal, closeModal, syncBodyScrollLock } from './ui-helpers.js';
import { SCHEDULE_CONFIG, getAulaLabel, STATUS_CONFIG, DEFAULT_TURMAS, DEFAULT_DISCIPLINAS } from './schedule-config.js';
import { formatDateBR, escapeHTML } from './utils.js';
import { refreshCalendar } from './calendar-view.js';
import { refreshFormData } from './reservation-form.js';

let activeTab = 'pendentes';
let adminTabsInitialized = false;

/**
 * Inicializa o painel administrativo
 */
export async function initAdminPanel() {
    if (!isAdmin()) return;
    setupAdminTabs();
    setupImportAtribuicoesModal();
    await loadAdminTab('pendentes');
}

/**
 * Configura as abas do painel admin
 */
function setupAdminTabs() {
    if (adminTabsInitialized) return;
    adminTabsInitialized = true;

    document.querySelectorAll('[data-admin-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('[data-admin-tab]').forEach(t => {
                t.classList.remove('border-indigo-500', 'text-indigo-600');
                t.classList.add('border-transparent', 'text-gray-500');
            });
            tab.classList.add('border-indigo-500', 'text-indigo-600');
            tab.classList.remove('border-transparent', 'text-gray-500');
            activeTab = tab.dataset.adminTab;
            loadAdminTab(activeTab);
        });
    });
}

/**
 * Carrega conteúdo de uma aba admin
 */
async function loadAdminTab(tab) {
    syncBodyScrollLock();
    const container = document.getElementById('admin-content');
    if (!container) return;

    container.innerHTML = '<div class="flex justify-center py-12"><div class="loader-spinner"></div></div>';

    switch (tab) {
        case 'pendentes':
            await renderPendentes(container);
            break;
        case 'laboratorios':
            await renderLabsCrud(container);
            break;
        case 'professores':
            await renderProfsCrud(container);
            break;
        case 'cursos':
            await renderCursosCrud(container);
            break;
        case 'turmas':
            await renderTurmasCrud(container);
            break;
        case 'disciplinas':
            await renderDisciplinasCrud(container);
            break;
        case 'usuarios':
            await renderUsuariosCrud(container);
            break;
        case 'atribuicoes':
            await renderAtribuicoesTab(container);
            break;
    }
}

// ========================
// RESERVAS PENDENTES
// ========================

async function renderPendentes(container) {
    const pendentes = await getReservasPendentes();

    if (pendentes.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="text-5xl mb-3">✅</div>
                <h3 class="text-lg font-semibold text-gray-700">Nenhuma reserva pendente</h3>
                <p class="text-sm text-gray-400 mt-1">Todas as reservas foram processadas!</p>
            </div>`;
        return;
    }

    let html = `
        <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gray-800">Reservas Pendentes</h3>
            <span class="px-3 py-1 rounded-full text-sm font-semibold bg-amber-100 text-amber-700">${pendentes.length} pendente(s)</span>
        </div>
        <div class="space-y-3">`;

    pendentes.forEach(r => {
        const dataStr = formatDateBR(r.data);
        const turnoConfig = SCHEDULE_CONFIG[r.turno] || {};
        const aulasStr = (r.aulas || []).map(a => `${a}ª`).join(', ');

        html += `
            <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div class="space-y-1">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-gray-900">${escapeHTML(r.labNome || 'Laboratório')}</span>
                            <span class="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">Pendente</span>
                            ${r.recorrente ? '<span class="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">🔄 Recorrente</span>' : ''}
                        </div>
                        <div class="text-xs text-gray-500">
                            📅 ${dataStr} · ${turnoConfig.icon || ''} ${turnoConfig.label || r.turno} · Aulas: ${aulasStr}
                        </div>
                        <div class="text-sm text-gray-700">
                            👤 <strong>${escapeHTML(r.professorNome || 'Professor')}</strong>
                            ${r.cursoNome ? `· 🎓 ${escapeHTML(r.cursoNome)}` : ''}
                        </div>
                        <div class="text-xs text-gray-600">
                            👥 <strong>Turma:</strong> ${escapeHTML(r.turmaNome || r.turma || r.cursoNome || 'Sem turma')} · 
                            📖 <strong>Disciplina:</strong> ${escapeHTML(r.disciplinaNome || r.disciplina || r.disciplinaSigla || 'Sem disciplina')}
                            ${r.recursos?.length ? `· 🔧 ${r.recursos.join(', ')}` : ''}
                        </div>
                        ${r.observacoes ? `<div class="text-xs text-gray-400 italic">"${escapeHTML(r.observacoes)}"</div>` : ''}
                    </div>

                    <div class="flex items-center gap-2 self-end sm:self-center">
                        <button onclick="window.dispatchEvent(new CustomEvent('approve-reserva', {detail: '${r.id}'}))"
                            class="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-1">
                            ✓ Aprovar
                        </button>
                        <button onclick="window.dispatchEvent(new CustomEvent('reject-reserva', {detail: '${r.id}'}))"
                            class="px-4 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors flex items-center gap-1">
                            ✕ Rejeitar
                        </button>
                    </div>
                </div>
            </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
}

// ========================
// CRUD LABORATÓRIOS
// ========================

async function renderLabsCrud(container) {
    const labs = await getLaboratorios();

    let html = `
        <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gray-800">Laboratórios</h3>
            <button id="admin-add-lab" class="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm">
                + Novo Laboratório
            </button>
        </div>
        <div class="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
            <table class="w-full text-sm">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-3 text-left font-semibold text-gray-700">Nome</th>
                        <th class="px-4 py-3 text-left font-semibold text-gray-700">Descrição</th>
                        <th class="px-4 py-3 text-left font-semibold text-gray-700">Capacidade</th>
                        <th class="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                        <th class="px-4 py-3 text-right font-semibold text-gray-700">Ações</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">`;

    labs.forEach(lab => {
        html += `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3 font-medium text-gray-900">${escapeHTML(lab.nome)}</td>
                <td class="px-4 py-3 text-gray-500">${escapeHTML(lab.descricao || '—')}</td>
                <td class="px-4 py-3 text-gray-500">${lab.capacidade ? `${lab.capacidade} alunos` : '—'}</td>
                <td class="px-4 py-3">
                    <span class="text-xs px-2 py-0.5 rounded-full ${lab.ativo !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'} font-semibold">
                        ${lab.ativo !== false ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td class="px-4 py-3 text-right">
                    <button onclick="window.dispatchEvent(new CustomEvent('edit-lab', {detail: '${lab.id}'}))" class="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors mr-1 font-medium">✏️ Editar</button>
                    <button onclick="window.dispatchEvent(new CustomEvent('delete-lab', {detail: '${lab.id}'}))" class="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium">🗑️ Desativar</button>
                </td>
            </tr>`;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;

    document.getElementById('admin-add-lab')?.addEventListener('click', () => {
        openAdminItemModal('lab');
    });
}

// ========================
// CRUD PROFESSORES
// ========================

async function renderProfsCrud(container) {
    const profs = await getProfessores();

    let html = `
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
                <h3 class="text-lg font-bold text-gray-800">Professores</h3>
                <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">${profs.length} cadastrado(s)</span>
            </div>
            <button id="admin-add-prof" class="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm">
                + Novo Professor
            </button>
        </div>
        <div class="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
            <table class="w-full text-sm">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-3 text-left font-semibold text-gray-700">Nome</th>
                        <th class="px-4 py-3 text-left font-semibold text-gray-700">Email</th>
                        <th class="px-4 py-3 text-right font-semibold text-gray-700">Ações</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">`;

    if (profs.length === 0) {
        html += `
            <tr>
                <td colspan="3" class="px-4 py-8 text-center text-gray-400">
                    Nenhum professor cadastrado.
                </td>
            </tr>`;
    } else {
        profs.forEach(p => {
            html += `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-3 font-medium text-gray-900">${escapeHTML(p.nome)}</td>
                    <td class="px-4 py-3 text-gray-500">${escapeHTML(p.email || '—')}</td>
                    <td class="px-4 py-3 text-right">
                        <button onclick="window.dispatchEvent(new CustomEvent('edit-prof', {detail: '${p.id}'}))" class="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors mr-1 font-medium">✏️ Editar</button>
                        <button onclick="window.dispatchEvent(new CustomEvent('delete-prof', {detail: '${p.id}'}))" class="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium">🗑️ Excluir</button>
                    </td>
                </tr>`;
        });
    }

    html += `</tbody></table></div>`;
    container.innerHTML = html;

    document.getElementById('admin-add-prof')?.addEventListener('click', () => {
        openAdminItemModal('professor');
    });
}

// ========================
// CRUD CURSOS
// ========================

async function renderCursosCrud(container) {
    const cursosList = await getCursos();

    let html = `
        <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gray-800">Cursos</h3>
            <button id="admin-add-curso" class="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm">
                + Novo Curso
            </button>
        </div>
        <div class="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
            <table class="w-full text-sm">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-3 text-left font-semibold text-gray-700">Nome</th>
                        <th class="px-4 py-3 text-left font-semibold text-gray-700">Sigla</th>
                        <th class="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                        <th class="px-4 py-3 text-right font-semibold text-gray-700">Ações</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">`;

    cursosList.forEach(c => {
        html += `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3 font-medium text-gray-900">${escapeHTML(c.nome)}</td>
                <td class="px-4 py-3 text-gray-500">${escapeHTML(c.sigla || '—')}</td>
                <td class="px-4 py-3">
                    <span class="text-xs px-2 py-0.5 rounded-full ${c.ativo === false ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'} font-semibold">
                        ${c.ativo === false ? 'Inativo' : 'Ativo'}
                    </span>
                </td>
                <td class="px-4 py-3 text-right">
                    <button onclick="window.dispatchEvent(new CustomEvent('edit-curso', {detail: '${c.id}'}))" class="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors mr-1 font-medium">✏️ Editar</button>
                    <button onclick="window.dispatchEvent(new CustomEvent('delete-curso', {detail: '${c.id}'}))" class="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium">🗑️ Desativar</button>
                </td>
            </tr>`;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;

    document.getElementById('admin-add-curso')?.addEventListener('click', () => {
        openAdminItemModal('curso');
    });
}

// ========================
// CRUD TURMAS
// ========================

async function renderTurmasCrud(container) {
    const turmasList = await getTurmas();

    let html = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div class="flex items-center gap-2">
                <h3 class="text-lg font-bold text-gray-800">Turmas</h3>
                <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">${turmasList.length} cadastrada(s)</span>
            </div>
            <div class="flex items-center gap-2">
                <button id="admin-seed-turmas" class="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors" title="Importa as 37 turmas padrão da ETEC para o banco">
                    📥 Importar Padrões da ETEC
                </button>
                <button id="admin-add-turma" class="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm">
                    + Nova Turma
                </button>
            </div>
        </div>`;

    if (turmasList.length === 0) {
        html += `
            <div class="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 shadow-sm">
                <div class="text-4xl mb-2">👥</div>
                <h4 class="font-bold text-base text-gray-800">Nenhuma turma cadastrada no banco</h4>
                <p class="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                    Você pode cadastrar turmas manualmente ou importar todas as turmas padrão da ETEC Dr. Domingos Minicucci Filho com um único clique.
                </p>
                <button id="admin-seed-turmas-empty" class="mt-4 px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-md">
                    📥 Carregar Turmas Padrão da ETEC
                </button>
            </div>`;
    } else {
        html += `
        <div class="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
            <table class="w-full text-sm">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-3 text-left font-semibold text-gray-700">Nome da Turma</th>
                        <th class="px-4 py-3 text-left font-semibold text-gray-700">Turno / Período</th>
                        <th class="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                        <th class="px-4 py-3 text-right font-semibold text-gray-700">Ações</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">`;

        turmasList.forEach(t => {
            html += `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-3 font-medium text-gray-900">${escapeHTML(t.nome)}</td>
                    <td class="px-4 py-3 text-gray-500">${escapeHTML(t.turno || '—')}</td>
                    <td class="px-4 py-3">
                        <span class="text-xs px-2 py-0.5 rounded-full ${t.ativo !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'} font-semibold">
                            ${t.ativo !== false ? 'Ativa' : 'Inativa'}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-right">
                        <button onclick="window.dispatchEvent(new CustomEvent('edit-turma', {detail: '${t.id}'}))" class="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors mr-1 font-medium">✏️ Editar</button>
                        <button onclick="window.dispatchEvent(new CustomEvent('delete-turma', {detail: '${t.id}'}))" class="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium">🗑️ Desativar</button>
                    </td>
                </tr>`;
        });

        html += `</tbody></table></div>`;
    }

    container.innerHTML = html;

    document.getElementById('admin-add-turma')?.addEventListener('click', () => {
        openAdminItemModal('turma');
    });

    const triggerSeedTurmas = async () => {
        const confirmed = await showConfirm(
            'Importar Turmas Padrão',
            `Deseja importar as ${DEFAULT_TURMAS.length} turmas padrão da ETEC para o banco de dados? Turmas já existentes não serão duplicadas.`,
            'Importar'
        );
        if (confirmed) {
            showLoader(true, 'Importando turmas...');
            try {
                await seedTurmas(DEFAULT_TURMAS);
                await loadAdminTab('turmas');
                await refreshFormData();
            } finally {
                showLoader(false);
            }
        }
    };

    document.getElementById('admin-seed-turmas')?.addEventListener('click', triggerSeedTurmas);
    document.getElementById('admin-seed-turmas-empty')?.addEventListener('click', triggerSeedTurmas);
}

// ========================
// CRUD DISCIPLINAS
// ========================

async function renderDisciplinasCrud(container) {
    const disciplinasList = await getDisciplinas();

    let html = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div class="flex items-center gap-2">
                <h3 class="text-lg font-bold text-gray-800">Disciplinas</h3>
                <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">${disciplinasList.length} cadastrada(s)</span>
            </div>
            <div class="flex items-center gap-2">
                <button id="admin-seed-disciplinas" class="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors" title="Importa as 32 disciplinas curriculares padrão para o banco">
                    📥 Importar Padrões da ETEC
                </button>
                <button id="admin-add-disciplina" class="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm">
                    + Nova Disciplina
                </button>
            </div>
        </div>`;

    if (disciplinasList.length === 0) {
        html += `
            <div class="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 shadow-sm">
                <div class="text-4xl mb-2">📖</div>
                <h4 class="font-bold text-base text-gray-800">Nenhuma disciplina cadastrada no banco</h4>
                <p class="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                    Você pode cadastrar disciplinas individualmente ou importar todas as disciplinas padrão da ETEC com um clique.
                </p>
                <button id="admin-seed-disciplinas-empty" class="mt-4 px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-md">
                    📥 Carregar Disciplinas Padrão da ETEC
                </button>
            </div>`;
    } else {
        html += `
        <div class="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
            <table class="w-full text-sm">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-3 text-left font-semibold text-gray-700">Nome da Disciplina</th>
                        <th class="px-4 py-3 text-left font-semibold text-gray-700">Sigla / Código</th>
                        <th class="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                        <th class="px-4 py-3 text-right font-semibold text-gray-700">Ações</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">`;

        disciplinasList.forEach(d => {
            html += `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-3 font-medium text-gray-900">${escapeHTML(d.nome)}</td>
                    <td class="px-4 py-3 text-gray-500">${escapeHTML(d.sigla || '—')}</td>
                    <td class="px-4 py-3">
                        <span class="text-xs px-2 py-0.5 rounded-full ${d.ativo !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'} font-semibold">
                            ${d.ativo !== false ? 'Ativa' : 'Inativa'}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-right">
                        <button onclick="window.dispatchEvent(new CustomEvent('edit-disciplina', {detail: '${d.id}'}))" class="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors mr-1 font-medium">✏️ Editar</button>
                        <button onclick="window.dispatchEvent(new CustomEvent('delete-disciplina', {detail: '${d.id}'}))" class="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium">🗑️ Desativar</button>
                    </td>
                </tr>`;
        });

        html += `</tbody></table></div>`;
    }

    container.innerHTML = html;

    document.getElementById('admin-add-disciplina')?.addEventListener('click', () => {
        openAdminItemModal('disciplina');
    });

    const triggerSeedDisciplinas = async () => {
        const confirmed = await showConfirm(
            'Importar Disciplinas Padrão',
            `Deseja importar as ${DEFAULT_DISCIPLINAS.length} disciplinas padrão da ETEC para o banco de dados? Disciplinas já existentes não serão duplicadas.`,
            'Importar'
        );
        if (confirmed) {
            showLoader(true, 'Importando disciplinas...');
            try {
                await seedDisciplinas(DEFAULT_DISCIPLINAS);
                await loadAdminTab('disciplinas');
                await refreshFormData();
            } finally {
                showLoader(false);
            }
        }
    };

    document.getElementById('admin-seed-disciplinas')?.addEventListener('click', triggerSeedDisciplinas);
    document.getElementById('admin-seed-disciplinas-empty')?.addEventListener('click', triggerSeedDisciplinas);
}

// ========================
// CRUD USUÁRIOS (Listagem, Busca, Níveis e Gestão de Contas)
// ========================

async function renderUsuariosCrud(container) {
    const users = await getUsuarios();
    const currentEmail = getCurrentUser()?.email?.toLowerCase() || '';

    let html = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div class="flex items-center gap-2">
                <h3 class="text-lg font-bold text-gray-800">Usuários do Sistema</h3>
                <span id="usuarios-count-badge" class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">${users.length} cadastrado(s)</span>
            </div>
            <div class="flex items-center gap-2">
                <button id="admin-add-user" class="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-1.5 active:scale-[0.98]">
                    <span>+</span> Novo Usuário
                </button>
            </div>
        </div>

        <!-- Barra de Busca e Filtro de Nível -->
        <div class="bg-white rounded-xl border border-gray-200 p-3 mb-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div class="relative w-full sm:w-80">
                <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 text-xs">🔍</span>
                <input type="text" id="usuarios-search-input" placeholder="Buscar por nome ou email..."
                    class="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
            </div>
            <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
                <label for="usuarios-filter-perfil" class="text-xs font-medium text-gray-500 whitespace-nowrap">Filtrar por nível:</label>
                <select id="usuarios-filter-perfil" class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500">
                    <option value="">Todos os níveis</option>
                    <option value="admin">🛡️ Administrador</option>
                    <option value="professor">👨‍🏫 Professor</option>
                </select>
            </div>
        </div>

        <div class="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
            <table class="w-full text-sm">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-3 text-left font-semibold text-gray-700">Usuário</th>
                        <th class="px-4 py-3 text-left font-semibold text-gray-700">Email</th>
                        <th class="px-4 py-3 text-left font-semibold text-gray-700">Nível de Acesso</th>
                        <th class="px-4 py-3 text-left font-semibold text-gray-700">Cadastrado em</th>
                        <th class="px-4 py-3 text-right font-semibold text-gray-700">Ações</th>
                    </tr>
                </thead>
                <tbody id="usuarios-table-body" class="divide-y divide-gray-100">
                    ${renderUsuariosTableRows(users, currentEmail)}
                </tbody>
            </table>
        </div>`;

    container.innerHTML = html;

    // Ações
    document.getElementById('admin-add-user')?.addEventListener('click', () => {
        openAdminItemModal('usuario');
    });

    const searchInput = document.getElementById('usuarios-search-input');
    const filterSelect = document.getElementById('usuarios-filter-perfil');
    const tableBody = document.getElementById('usuarios-table-body');
    const countBadge = document.getElementById('usuarios-count-badge');

    const applyFilter = () => {
        const q = (searchInput?.value || '').toLowerCase().trim();
        const perfilFiltro = (filterSelect?.value || '').toLowerCase().trim();

        const filtered = users.filter(u => {
            const matchName = String(u.nome || '').toLowerCase().includes(q);
            const matchEmail = String(u.email || '').toLowerCase().includes(q);
            const matchPerfil = !perfilFiltro || String(u.perfil || 'professor').toLowerCase() === perfilFiltro;
            return (matchName || matchEmail) && matchPerfil;
        });

        if (tableBody) tableBody.innerHTML = renderUsuariosTableRows(filtered, currentEmail);
        if (countBadge) countBadge.textContent = `${filtered.length} de ${users.length} usuário(s)`;
    };

    searchInput?.addEventListener('input', applyFilter);
    filterSelect?.addEventListener('change', applyFilter);
}

function renderUsuariosTableRows(usersList, currentEmail) {
    if (!usersList || usersList.length === 0) {
        return `
            <tr>
                <td colspan="5" class="px-4 py-8 text-center text-gray-400">
                    Nenhum usuário encontrado com os filtros atuais.
                </td>
            </tr>`;
    }

    return usersList.map(u => {
        const isSelf = u.email && u.email.toLowerCase() === currentEmail;
        const initial = (u.nome ? u.nome.charAt(0) : (u.email ? u.email.charAt(0) : '?')).toUpperCase();
        const isAdminUser = String(u.perfil || '').toLowerCase() === 'admin';
        const formattedDate = u.criadoEm ? formatDateBR(u.criadoEm.substring(0, 10)) : '—';

        return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-full ${isAdminUser ? 'bg-indigo-600' : 'bg-emerald-600'} text-white font-bold flex items-center justify-center text-xs shadow-xs flex-shrink-0">
                            ${escapeHTML(initial)}
                        </div>
                        <div class="min-w-0">
                            <div class="font-bold text-gray-900 truncate flex items-center gap-1.5">
                                ${escapeHTML(u.nome || 'Sem nome')}
                                ${isSelf ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">Você</span>' : ''}
                            </div>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 text-gray-600 text-xs sm:text-sm font-mono">
                    ${escapeHTML(u.email || '—')}
                </td>
                <td class="px-4 py-3">
                    ${isAdminUser ? `
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                            🛡️ Administrador
                        </span>
                    ` : `
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                            👨‍🏫 Professor
                        </span>
                    `}
                </td>
                <td class="px-4 py-3 text-gray-400 text-xs">
                    ${escapeHTML(formattedDate)}
                </td>
                <td class="px-4 py-3 text-right whitespace-nowrap">
                    <button onclick="window.dispatchEvent(new CustomEvent('edit-usuario', {detail: '${u.id}'}))" 
                        class="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors mr-1 font-medium active:scale-95" title="Editar informações ou nível de acesso">
                        ✏️ Editar
                    </button>
                    <button onclick="window.dispatchEvent(new CustomEvent('delete-usuario', {detail: '${u.id}'}))" 
                        ${isSelf ? 'disabled title="Você não pode excluir sua própria conta" class="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed font-medium opacity-50"' : 'class="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium active:scale-95" title="Excluir usuário"'} >
                        🗑️ Excluir
                    </button>
                </td>
            </tr>`;
    }).join('');
}

// ========================
// MODAL GENÉRICO DE ADIÇÃO/EDIÇÃO
// ========================

function openAdminItemModal(type, editData = null) {
    const modal = document.getElementById('admin-item-modal');
    const title = document.getElementById('admin-item-modal-title');
    const formContainer = document.getElementById('admin-item-form-container');

    if (!modal || !formContainer) return;

    const titles = {
        lab: editData ? 'Editar Laboratório' : 'Novo Laboratório',
        professor: editData ? 'Editar Professor' : 'Novo Professor',
        curso: editData ? 'Editar Curso' : 'Novo Curso',
        turma: editData ? 'Editar Turma' : 'Nova Turma',
        disciplina: editData ? 'Editar Disciplina' : 'Nova Disciplina',
        usuario: editData ? 'Editar Usuário' : 'Novo Usuário'
    };

    if (title) title.textContent = titles[type] || 'Novo Item';

    let formHTML = '';

    switch (type) {
        case 'usuario':
            formHTML = `
                <form id="admin-item-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Nome Completo *</label>
                        <input type="text" id="item-nome" required value="${escapeHTML(editData?.nome || '')}" class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" placeholder="Ex: Carlos Silva">
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Email *</label>
                        <input type="email" id="item-email" required value="${escapeHTML(editData?.email || '')}" ${editData ? 'readonly class="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 text-sm cursor-not-allowed"' : 'class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"'} placeholder="usuario@escola.edu.br">
                    </div>
                    ${!editData ? `
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Senha * (mín. 6 caracteres)</label>
                        <input type="password" id="item-password" required minlength="6" class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" placeholder="••••••••">
                    </div>` : `
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Nova Senha (opcional)</label>
                        <input type="password" id="item-password" minlength="6" class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" placeholder="Deixe em branco para manter a atual">
                    </div>`}
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Nível de Acesso (Perfil) *</label>
                        <select id="item-perfil" required class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white">
                            <option value="professor" ${editData?.perfil === 'professor' ? 'selected' : ''}>👨‍🏫 Professor</option>
                            <option value="admin" ${editData?.perfil === 'admin' ? 'selected' : ''}>🛡️ Administrador</option>
                        </select>
                    </div>
                    <div class="flex gap-3 pt-2">
                        <button type="button" id="cancel-admin-item" class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">Cancelar</button>
                        <button type="submit" class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">Salvar</button>
                    </div>
                </form>`;
            break;
        case 'lab':
            formHTML = `
                <form id="admin-item-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Nome do Laboratório *</label>
                        <input type="text" id="item-nome" required value="${escapeHTML(editData?.nome || '')}" class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" placeholder="Ex: LAB 01">
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Descrição</label>
                        <input type="text" id="item-descricao" value="${escapeHTML(editData?.descricao || '')}" class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" placeholder="Ex: 30 PCs, Projetor">
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Capacidade (alunos)</label>
                        <input type="number" id="item-capacidade" value="${editData?.capacidade || ''}" class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" placeholder="30">
                    </div>
                    <div class="flex gap-3 pt-2">
                        <button type="button" id="cancel-admin-item" class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">Cancelar</button>
                        <button type="submit" class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">Salvar</button>
                    </div>
                </form>`;
            break;
        case 'professor':
            formHTML = `
                <form id="admin-item-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Nome do Professor *</label>
                        <input type="text" id="item-nome" required value="${escapeHTML(editData?.nome || '')}" class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" placeholder="Ex: Prof. Carlos Silva">
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                        <input type="email" id="item-email" value="${escapeHTML(editData?.email || '')}" class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" placeholder="prof@escola.edu.br">
                    </div>
                    <div class="flex gap-3 pt-2">
                        <button type="button" id="cancel-admin-item" class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">Cancelar</button>
                        <button type="submit" class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">Salvar</button>
                    </div>
                </form>`;
            break;
        case 'curso':
            formHTML = `
                <form id="admin-item-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Nome do Curso *</label>
                        <input type="text" id="item-nome" required value="${escapeHTML(editData?.nome || '')}" class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" placeholder="Ex: Informática para Internet">
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Sigla</label>
                        <input type="text" id="item-sigla" value="${escapeHTML(editData?.sigla || '')}" class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" placeholder="Ex: INFO">
                    </div>
                    <div class="flex gap-3 pt-2">
                        <button type="button" id="cancel-admin-item" class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">Cancelar</button>
                        <button type="submit" class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">Salvar</button>
                    </div>
                </form>`;
            break;
        case 'turma':
            formHTML = `
                <form id="admin-item-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Nome da Turma *</label>
                        <input type="text" id="item-nome" required value="${escapeHTML(editData?.nome || '')}" class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" placeholder="Ex: 1º M-TEC Informática para Internet">
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Turno / Período</label>
                        <select id="item-turno" class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white">
                            <option value="">Não especificado</option>
                            <option value="Manhã" ${editData?.turno === 'Manhã' ? 'selected' : ''}>☀️ Manhã</option>
                            <option value="Tarde" ${editData?.turno === 'Tarde' ? 'selected' : ''}>🌤️ Tarde</option>
                            <option value="Noite" ${editData?.turno === 'Noite' ? 'selected' : ''}>🌙 Noite</option>
                            <option value="Integral" ${editData?.turno === 'Integral' ? 'selected' : ''}>🕒 Integral</option>
                        </select>
                    </div>
                    <div class="flex gap-3 pt-2">
                        <button type="button" id="cancel-admin-item" class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">Cancelar</button>
                        <button type="submit" class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">Salvar</button>
                    </div>
                </form>`;
            break;
        case 'disciplina':
            formHTML = `
                <form id="admin-item-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Nome da Disciplina *</label>
                        <input type="text" id="item-nome" required value="${escapeHTML(editData?.nome || '')}" class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" placeholder="Ex: Desenvolvimento Web II">
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Sigla / Código</label>
                        <input type="text" id="item-sigla" value="${escapeHTML(editData?.sigla || '')}" class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" placeholder="Ex: DW2">
                    </div>
                    <div class="flex gap-3 pt-2">
                        <button type="button" id="cancel-admin-item" class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">Cancelar</button>
                        <button type="submit" class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">Salvar</button>
                    </div>
                </form>`;
            break;
    }

    formContainer.innerHTML = formHTML;
    openModal('admin-item-modal');

    // Cancel
    document.getElementById('cancel-admin-item')?.addEventListener('click', () => {
        closeModal('admin-item-modal');
    });

    // Submit
    document.getElementById('admin-item-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            showLoader(true, 'Salvando...');
            switch (type) {
                case 'lab': {
                    const data = {
                        nome: document.getElementById('item-nome')?.value?.trim(),
                        descricao: document.getElementById('item-descricao')?.value?.trim(),
                        capacidade: parseInt(document.getElementById('item-capacidade')?.value) || 0
                    };
                    if (editData) await updateLaboratorio(editData.id, data);
                    else await addLaboratorio(data);
                    break;
                }
                case 'professor': {
                    const data = {
                        nome: document.getElementById('item-nome')?.value?.trim(),
                        email: document.getElementById('item-email')?.value?.trim()
                    };
                    if (editData) await updateProfessor(editData.id, data);
                    else await addProfessor(data);
                    break;
                }
                case 'curso': {
                    const data = {
                        nome: document.getElementById('item-nome')?.value?.trim(),
                        sigla: document.getElementById('item-sigla')?.value?.trim()
                    };
                    if (editData) await updateCurso(editData.id, data);
                    else await addCurso(data);
                    break;
                }
                case 'turma': {
                    const data = {
                        nome: document.getElementById('item-nome')?.value?.trim(),
                        turno: document.getElementById('item-turno')?.value || ''
                    };
                    if (editData) await updateTurma(editData.id, data);
                    else await addTurma(data);
                    break;
                }
                case 'disciplina': {
                    const data = {
                        nome: document.getElementById('item-nome')?.value?.trim(),
                        sigla: document.getElementById('item-sigla')?.value?.trim()
                    };
                    if (editData) await updateDisciplina(editData.id, data);
                    else await addDisciplina(data);
                    break;
                }
                case 'usuario': {
                    const nome = document.getElementById('item-nome')?.value?.trim();
                    const email = document.getElementById('item-email')?.value?.trim();
                    const perfil = document.getElementById('item-perfil')?.value || 'professor';
                    const password = document.getElementById('item-password')?.value;

                    if (editData) {
                        const updateData = { nome, perfil };
                        if (password && password.trim()) {
                            updateData.senha = password.trim();
                        }
                        await updateUsuario(editData.id, updateData);
                    } else {
                        if (!password || password.length < 6) {
                            showToast('A senha deve ter no mínimo 6 caracteres.', 'warning');
                            return;
                        }
                        await registerUser(email, password, { nome, perfil });
                    }
                    break;
                }
            }
            closeModal('admin-item-modal');
            await loadAdminTab(activeTab);
            refreshCalendar();
            await refreshFormData();
        } catch (error) {
            console.error(error);
        } finally {
            showLoader(false);
        }
    });
}

/**
 * Configura event listeners globais para ações admin
 */
export function setupAdminEventListeners() {
    // Aprovar reserva
    window.addEventListener('approve-reserva', async (e) => {
        const id = e.detail;
        const confirmed = await showConfirm('Aprovar Reserva', 'Deseja confirmar esta reserva?', 'Aprovar');
        if (confirmed) {
            await updateReservaStatus(id, 'confirmado');
            await loadAdminTab('pendentes');
            refreshCalendar();
        }
    });

    // Rejeitar reserva
    window.addEventListener('reject-reserva', async (e) => {
        const id = e.detail;
        const confirmed = await showConfirm('Rejeitar Reserva', 'Deseja rejeitar esta reserva? Esta ação não pode ser desfeita.', 'Rejeitar', 'danger');
        if (confirmed) {
            await updateReservaStatus(id, 'rejeitado');
            await loadAdminTab('pendentes');
            refreshCalendar();
        }
    });

    // Editar lab
    window.addEventListener('edit-lab', async (e) => {
        const labs = await getLaboratorios();
        const lab = labs.find(l => l.id === e.detail);
        if (lab) openAdminItemModal('lab', lab);
    });

    // Deletar lab
    window.addEventListener('delete-lab', async (e) => {
        const confirmed = await showConfirm('Remover Laboratório', 'Deseja desativar este laboratório?', 'Remover', 'danger');
        if (confirmed) {
            await deleteLaboratorio(e.detail);
            await loadAdminTab('laboratorios');
            refreshCalendar();
            await refreshFormData();
        }
    });

    // Editar professor
    window.addEventListener('edit-prof', async (e) => {
        const profs = await getProfessores();
        const prof = profs.find(p => p.id === e.detail);
        if (prof) openAdminItemModal('professor', prof);
    });

    // Deletar professor
    window.addEventListener('delete-prof', async (e) => {
        const confirmed = await showConfirm('Remover Professor', 'Deseja remover este professor?', 'Remover', 'danger');
        if (confirmed) {
            await deleteProfessor(e.detail);
            await loadAdminTab('professores');
            await refreshFormData();
        }
    });

    // Editar curso
    window.addEventListener('edit-curso', async (e) => {
        const cursosList = await getCursos();
        const curso = cursosList.find(c => c.id === e.detail);
        if (curso) openAdminItemModal('curso', curso);
    });

    // Deletar curso
    window.addEventListener('delete-curso', async (e) => {
        const confirmed = await showConfirm('Remover Curso', 'Deseja desativar este curso?', 'Remover', 'danger');
        if (confirmed) {
            await deleteCurso(e.detail);
            await loadAdminTab('cursos');
            await refreshFormData();
        }
    });

    // Editar turma
    window.addEventListener('edit-turma', async (e) => {
        const turmasList = await getTurmas();
        const turma = turmasList.find(t => t.id === e.detail);
        if (turma) openAdminItemModal('turma', turma);
    });

    // Deletar turma
    window.addEventListener('delete-turma', async (e) => {
        const confirmed = await showConfirm('Remover Turma', 'Deseja desativar esta turma?', 'Remover', 'danger');
        if (confirmed) {
            await deleteTurma(e.detail);
            await loadAdminTab('turmas');
            await refreshFormData();
        }
    });

    // Editar disciplina
    window.addEventListener('edit-disciplina', async (e) => {
        const disciplinasList = await getDisciplinas();
        const disciplina = disciplinasList.find(d => d.id === e.detail);
        if (disciplina) openAdminItemModal('disciplina', disciplina);
    });

    // Deletar disciplina
    window.addEventListener('delete-disciplina', async (e) => {
        const confirmed = await showConfirm('Remover Disciplina', 'Deseja desativar esta disciplina?', 'Remover', 'danger');
        if (confirmed) {
            await deleteDisciplina(e.detail);
            await loadAdminTab('disciplinas');
            await refreshFormData();
        }
    });

    // Editar usuário
    window.addEventListener('edit-usuario', async (e) => {
        const users = await getUsuarios();
        const user = users.find(u => u.id === e.detail);
        if (user) openAdminItemModal('usuario', user);
    });

    // Deletar usuário
    window.addEventListener('delete-usuario', async (e) => {
        const users = await getUsuarios();
        const user = users.find(u => u.id === e.detail);
        if (!user) return;

        const currentEmail = getCurrentUser()?.email?.toLowerCase();
        if (user.email && user.email.toLowerCase() === currentEmail) {
            showToast('Você não pode excluir a sua própria conta enquanto estiver conectado.', 'warning', 4000);
            return;
        }

        const confirmed = await showConfirm(
            'Remover Usuário',
            `Deseja realmente remover o usuário "${user.nome || user.email}" (${user.email})? Esta ação revogará o acesso ao sistema.`,
            'Remover Usuário',
            'danger'
        );
        if (confirmed) {
            await deleteUsuario(e.detail);
            await loadAdminTab('usuarios');
        }
    });
}

// ============================================================
// [ATUALIZAÇÃO] ABA DE ATRIBUIÇÕES DE AULAS (ETEC)
// ============================================================

async function renderAtribuicoesTab(container) {
    const list = await getAtribuicoesList();

    const uniqueProfs = [...new Set(list.map(r => r.professor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const uniqueCursos = [...new Set(list.map(r => r.curso).filter(Boolean))];
    const uniqueDiscs = [...new Set(list.map(r => r.disciplina).filter(Boolean))];

    let html = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
                <div class="flex items-center gap-2">
                    <h3 class="text-lg font-bold text-gray-800">Atribuições de Aulas</h3>
                    <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                        ${list.length} aula(s) cadastrada(s)
                    </span>
                </div>
                <p class="text-xs text-gray-500 mt-0.5">
                    Relação oficial de professores, turmas e disciplinas que determina as opções do agendamento
                </p>
            </div>
            <div class="flex items-center gap-2">
                <button id="tab-import-atribuicoes-btn" class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-1.5 active:scale-[0.98]">
                    <span>📤</span>
                    <span>Importar Planilha (.xlsx / .csv)</span>
                </button>
            </div>
        </div>`;

    if (list.length === 0) {
        html += `
            <div class="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500 shadow-sm">
                <div class="w-16 h-16 mx-auto mb-3 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-3xl shadow-sm">
                    📚
                </div>
                <h4 class="font-bold text-base text-gray-800">Nenhuma atribuição de aula cadastrada</h4>
                <p class="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                    Importe a planilha oficial de aulas da ETEC (com colunas Professor, Curso, Turma, Disciplina e Sigla) para habilitar as opções dos professores no sistema.
                </p>
                <button id="btn-import-atribuicoes-empty" class="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-md active:scale-95 flex items-center gap-2 mx-auto">
                    <span>📤</span>
                    <span>Importar Planilha Agora</span>
                </button>
            </div>`;
    } else {
        html += `
            <!-- Barra de Filtros e Busca -->
            <div class="bg-white rounded-xl border border-gray-200 p-3 mb-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div class="flex-1 relative">
                    <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">🔍</span>
                    <input type="text" id="atribuicoes-search-input" placeholder="Buscar por professor, curso, turma, disciplina ou sigla..."
                        class="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                </div>
                <div class="flex items-center gap-2">
                    <select id="atribuicoes-filter-prof" class="px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500">
                        <option value="">Todos os professores (${uniqueProfs.length})</option>
                        ${uniqueProfs.map(p => `<option value="${escapeHTML(p)}">${escapeHTML(p)}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- Tabela de Atribuições -->
            <div class="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
                <table class="w-full text-xs" id="atribuicoes-table">
                    <thead class="bg-gray-50 text-gray-700 border-b border-gray-200">
                        <tr>
                            <th class="px-4 py-3 text-left font-semibold">Professor</th>
                            <th class="px-4 py-3 text-left font-semibold">Curso</th>
                            <th class="px-4 py-3 text-left font-semibold">Turma / Divisão</th>
                            <th class="px-4 py-3 text-left font-semibold">Disciplina</th>
                            <th class="px-4 py-3 text-left font-semibold">Sigla</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100" id="atribuicoes-tbody">
                        ${renderAtribuicoesRowsHTML(list)}
                    </tbody>
                </table>
            </div>`;
    }

    container.innerHTML = html;

    // Listeners da aba
    document.getElementById('tab-import-atribuicoes-btn')?.addEventListener('click', () => {
        openModal('import-atribuicoes-modal');
    });
    document.getElementById('btn-import-atribuicoes-empty')?.addEventListener('click', () => {
        openModal('import-atribuicoes-modal');
    });

    const searchInput = document.getElementById('atribuicoes-search-input');
    const profSelect = document.getElementById('atribuicoes-filter-prof');

    const filterTable = () => {
        const query = (searchInput?.value || '').toLowerCase().trim();
        const profFilter = (profSelect?.value || '').toLowerCase().trim();

        const filtered = list.filter(item => {
            const matchProf = !profFilter || String(item.professor || '').toLowerCase().trim() === profFilter;
            if (!matchProf) return false;

            if (!query) return true;
            const fullText = `${item.professor} ${item.curso} ${item.turma} ${item.disciplina} ${item.sigla}`.toLowerCase();
            return fullText.includes(query);
        });

        const tbody = document.getElementById('atribuicoes-tbody');
        if (tbody) {
            tbody.innerHTML = renderAtribuicoesRowsHTML(filtered);
        }
    };

    searchInput?.addEventListener('input', filterTable);
    profSelect?.addEventListener('change', filterTable);
}

function renderAtribuicoesRowsHTML(items) {
    if (!items || items.length === 0) {
        return `<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">Nenhum registro encontrado para este filtro.</td></tr>`;
    }
    return items.map(item => `
        <tr class="hover:bg-indigo-50/30 transition-colors">
            <td class="px-4 py-2.5 font-bold text-gray-900">${escapeHTML(item.professor)}</td>
            <td class="px-4 py-2.5 text-gray-700">${escapeHTML(item.curso || '—')}</td>
            <td class="px-4 py-2.5">
                <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-700">
                    ${escapeHTML(item.turma || '—')}
                </span>
            </td>
            <td class="px-4 py-2.5 text-gray-900 font-medium">${escapeHTML(item.disciplina)}</td>
            <td class="px-4 py-2.5">
                <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-700">
                    ${escapeHTML(item.sigla || '—')}
                </span>
            </td>
        </tr>
    `).join('');
}

// ============================================================
// MODAL DE IMPORTAÇÃO DE ATRIBUIÇÕES (.xlsx / .csv)
// ============================================================

let importModalInitialized = false;
let parsedImportData = null;

function setupImportAtribuicoesModal() {
    if (importModalInitialized) return;
    importModalInitialized = true;

    const modal = document.getElementById('import-atribuicoes-modal');
    const openBtn = document.getElementById('admin-import-atribuicoes-btn');
    const closeBtn = document.getElementById('close-import-atribuicoes-btn');
    const cancelBtn = document.getElementById('import-cancel-btn');
    const fileInput = document.getElementById('import-atribuicoes-file-input');
    const dropzone = document.getElementById('import-atribuicoes-dropzone');
    const changeFileBtn = document.getElementById('import-change-file-btn');
    const confirmBtn = document.getElementById('import-confirm-btn');

    const openImportModal = () => {
        resetImportModal();
        openModal('import-atribuicoes-modal');
    };

    const closeImportModal = () => {
        closeModal('import-atribuicoes-modal');
        resetImportModal();
    };

    openBtn?.addEventListener('click', openImportModal);
    closeBtn?.addEventListener('click', closeImportModal);
    cancelBtn?.addEventListener('click', closeImportModal);

    // Dropzone e Seleção de Arquivo
    dropzone?.addEventListener('click', () => fileInput?.click());
    changeFileBtn?.addEventListener('click', () => fileInput?.click());

    dropzone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('border-indigo-600', 'bg-indigo-100/50');
    });

    dropzone?.addEventListener('dragleave', () => {
        dropzone.classList.remove('border-indigo-600', 'bg-indigo-100/50');
    });

    dropzone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-indigo-600', 'bg-indigo-100/50');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleSelectedFile(e.dataTransfer.files[0]);
        }
    });

    fileInput?.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleSelectedFile(e.target.files[0]);
        }
    });

    // Confirmação da Importação
    confirmBtn?.addEventListener('click', async () => {
        if (!parsedImportData || parsedImportData.length === 0) return;

        const autoSync = document.getElementById('import-opt-sync')?.checked ?? true;
        const overwrite = document.getElementById('import-opt-overwrite')?.checked ?? true;

        try {
            showLoader(true, 'Importando atribuições e sincronizando dados...');
            const res = await importAtribuicoes(parsedImportData, {
                overwrite: overwrite,
                autoSyncCadastros: autoSync
            });

            closeImportModal();
            showToast(`✅ ${res.totalImportadas || parsedImportData.length} aulas/atribuições importadas com sucesso!`, 'success');

            if (autoSync) {
                const extras = [];
                if (res.novosProfessores) extras.push(`${res.novosProfessores} profs`);
                if (res.novosCursos) extras.push(`${res.novosCursos} cursos`);
                if (res.novasTurmas) extras.push(`${res.novasTurmas} turmas`);
                if (res.novasDisciplinas) extras.push(`${res.novasDisciplinas} disciplinas`);
                if (extras.length) {
                    showToast(`Sincronizados: ${extras.join(', ')} cadastrados automaticamente!`, 'info');
                }
            }

            await loadAdminTab(activeTab);
            await refreshFormData();
        } catch (err) {
            console.error('Erro na importação:', err);
            showToast('Erro ao importar: ' + (err.message || 'Falha no processamento'), 'error');
        } finally {
            showLoader(false);
        }
    });
}

function resetImportModal() {
    parsedImportData = null;
    const fileInput = document.getElementById('import-atribuicoes-file-input');
    if (fileInput) fileInput.value = '';

    const previewContainer = document.getElementById('import-atribuicoes-preview-container');
    if (previewContainer) previewContainer.classList.add('hidden');

    const confirmBtn = document.getElementById('import-confirm-btn');
    if (confirmBtn) confirmBtn.disabled = true;

    const tbody = document.getElementById('import-preview-tbody');
    if (tbody) tbody.innerHTML = '';
}

function handleSelectedFile(file) {
    if (!file) return;

    if (typeof XLSX === 'undefined') {
        showToast('Biblioteca SheetJS ainda carregando. Aguarde 2 segundos...', 'warning');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (!rawRows || rawRows.length === 0) {
                showToast('A planilha selecionada está vazia.', 'warning');
                return;
            }

            processParsedRows(file, rawRows);
        } catch (err) {
            console.error('Erro ao ler arquivo Excel:', err);
            showToast('Não foi possível ler o arquivo. Verifique se é um arquivo Excel ou CSV válido.', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function processParsedRows(file, rawRows) {
    // Normalização das chaves das colunas
    // Ex: "Professor", "Docente", "Curso", "Turma", "Disciplina", "Sigla"
    const parsed = [];

    rawRows.forEach(row => {
        let prof = '';
        let curso = '';
        let turma = '';
        let disc = '';
        let sigla = '';

        Object.keys(row).forEach(key => {
            const normKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
            const val = String(row[key] || '').trim();

            if (normKey.includes('prof') || normKey.includes('docente')) {
                prof = val;
            } else if (normKey.includes('curso')) {
                curso = val;
            } else if (normKey.includes('turma') || normKey.includes('divis') || normKey.includes('classe')) {
                turma = val;
            } else if (normKey.includes('disc') || normKey.includes('componente') || normKey.includes('materia')) {
                disc = val;
            } else if (normKey.includes('sigla') || normKey.includes('curric') || normKey.includes('cod')) {
                sigla = val;
            }
        });

        if (prof && disc) {
            parsed.push({
                Professor: prof,
                Curso: curso,
                Turma: turma,
                Disciplina: disc,
                Sigla: sigla
            });
        }
    });

    if (parsed.length === 0) {
        showToast('Nenhuma linha válida encontrada. Certifique-se de que a planilha possui as colunas Professor e Disciplina.', 'warning');
        return;
    }

    parsedImportData = parsed;

    // Métricas
    const profs = new Set(parsed.map(r => r.Professor));
    const cursos = new Set(parsed.map(r => r.Curso));
    const turmas = new Set(parsed.map(r => r.Turma));
    const discs = new Set(parsed.map(r => r.Disciplina));

    document.getElementById('import-preview-filename').textContent = file.name;
    document.getElementById('import-preview-filesize').textContent = (file.size / 1024).toFixed(1) + ' KB';

    document.getElementById('import-count-profs').textContent = profs.size;
    document.getElementById('import-count-cursos').textContent = cursos.size;
    document.getElementById('import-count-turmas').textContent = turmas.size;
    document.getElementById('import-count-discs').textContent = discs.size;
    document.getElementById('import-count-aulas').textContent = parsed.length;

    // Amostra de 6 linhas na tabela de preview
    const tbody = document.getElementById('import-preview-tbody');
    const sampleRows = parsed.slice(0, 6);
    tbody.innerHTML = sampleRows.map(r => `
        <tr class="hover:bg-gray-50">
            <td class="px-3 py-1.5 font-bold text-gray-900">${escapeHTML(r.Professor)}</td>
            <td class="px-3 py-1.5 text-gray-600">${escapeHTML(r.Curso)}</td>
            <td class="px-3 py-1.5 text-gray-600">${escapeHTML(r.Turma)}</td>
            <td class="px-3 py-1.5 text-gray-800 font-medium">${escapeHTML(r.Disciplina)}</td>
            <td class="px-3 py-1.5 font-bold text-indigo-600">${escapeHTML(r.Sigla)}</td>
        </tr>
    `).join('');

    const sampleLabel = document.getElementById('import-sample-label');
    if (sampleLabel) sampleLabel.textContent = `Exibindo ${sampleRows.length} de ${parsed.length} aulas`;

    // Exibir painel e habilitar botão de confirmação
    document.getElementById('import-atribuicoes-preview-container').classList.remove('hidden');
    document.getElementById('import-confirm-btn').disabled = false;

    showToast(`Planilha lida com sucesso! ${parsed.length} aulas detectadas.`, 'info');
}

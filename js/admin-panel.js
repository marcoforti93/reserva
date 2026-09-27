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
    getDisciplinas, addDisciplina, updateDisciplina, deleteDisciplina, seedDisciplinas
} from './sheet-service.js';
import { registerUser, isAdmin } from './auth.js';
import { showToast, showConfirm, showLoader, createStatusBadge, openModal, closeModal } from './ui-helpers.js';
import { SCHEDULE_CONFIG, getAulaLabel, STATUS_CONFIG, DEFAULT_TURMAS, DEFAULT_DISCIPLINAS } from './schedule-config.js';
import { formatDateBR, escapeHTML } from './utils.js';
import { refreshCalendar } from './calendar-view.js';
import { refreshFormData } from './reservation-form.js';

let activeTab = 'pendentes';

/**
 * Inicializa o painel administrativo
 */
export async function initAdminPanel() {
    if (!isAdmin()) return;
    setupAdminTabs();
    await loadAdminTab('pendentes');
}

/**
 * Configura as abas do painel admin
 */
function setupAdminTabs() {
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
            renderUsuariosCrud(container);
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
                            👥 <strong>Turma:</strong> ${escapeHTML(r.turmaNome || r.turma || r.turmaNome || 'Sem turma')} · 
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
            <h3 class="text-lg font-bold text-gray-800">Professores</h3>
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
// CRUD USUÁRIOS (Criar contas)
// ========================

function renderUsuariosCrud(container) {
    container.innerHTML = `
        <div class="max-w-lg mx-auto">
            <h3 class="text-lg font-bold text-gray-800 mb-4">Criar Novo Usuário</h3>
            <form id="admin-user-form" class="space-y-4 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-1">Nome</label>
                    <input type="text" id="admin-user-nome" required class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all">
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                    <input type="email" id="admin-user-email" required class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all">
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-1">Senha (mín. 6 caracteres)</label>
                    <input type="password" id="admin-user-password" required minlength="6" class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all">
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-1">Perfil</label>
                    <select id="admin-user-perfil" class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all bg-white">
                        <option value="professor">Professor</option>
                        <option value="admin">Administrador</option>
                    </select>
                </div>
                <button type="submit" class="w-full py-3 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm">
                    Criar Usuário
                </button>
            </form>
        </div>`;

    document.getElementById('admin-user-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('admin-user-nome')?.value?.trim();
        const email = document.getElementById('admin-user-email')?.value?.trim();
        const password = document.getElementById('admin-user-password')?.value;
        const perfil = document.getElementById('admin-user-perfil')?.value;

        if (!nome || !email || !password) return showToast('Preencha todos os campos.', 'warning');

        try {
            await registerUser(email, password, { nome, perfil });
            document.getElementById('admin-user-form')?.reset();
        } catch (error) {
            console.error(error);
        }
    });
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
        disciplina: editData ? 'Editar Disciplina' : 'Nova Disciplina'
    };

    if (title) title.textContent = titles[type] || 'Novo Item';

    let formHTML = '';

    switch (type) {
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
}

// ============================================================
// reservation-form.js
// Modal de formulário de reserva com selects dinâmicos,
// seleção de Turma e Disciplina integrados ao Firestore (+ Adicionar Novo),
// pills de aulas, recursos extras e reserva recorrente
// ============================================================

import { SCHEDULE_CONFIG, RECURSOS_DISPONIVEIS, DEFAULT_TURMAS, DEFAULT_DISCIPLINAS, getAulaLabel, getDisciplinaSigla } from './schedule-config.js';
import { getSuggestedTurno, formatDateISO, escapeHTML } from './utils.js';
import { 
    getLaboratorios, getProfessores, getCursos, 
    getTurmas, addTurma, getDisciplinas, addDisciplina,
    createReserva, createReservaRecorrente, addProfessor, addCurso 
} from './sheet-service.js';
import { openModal, closeModal, showToast, showLoader } from './ui-helpers.js';
import { getCurrentUser, getUserProfile, isAdmin } from './auth.js';
import { refreshCalendar } from './calendar-view.js';

let laboratorios = [];
let professores = [];
let cursos = [];
let turmas = [];
let disciplinas = [];

/**
 * Inicializa o formulário de reserva
 */
export async function initReservationForm() {
    await loadFormData();
    setupFormListeners();
    setupQuickAddModals();
    updateFormRoleVisibility();
}

/**
 * Carrega dados para os selects a partir do Firestore
 */
async function loadFormData() {
    try {
        [laboratorios, professores, cursos, turmas, disciplinas] = await Promise.all([
            getLaboratorios(),
            getProfessores(),
            getCursos(),
            getTurmas(),
            getDisciplinas()
        ]);
    } catch (err) {
        console.error('Erro ao carregar dados do formulário:', err);
    }
    populateSelects();
}

/**
 * Popula os selects com dados do Firestore (com fallback para listas padrão da ETEC)
 */
function populateSelects() {
    // Laboratórios
    const labSelect = document.getElementById('reserva-lab');
    if (labSelect) {
        const curVal = labSelect.value;
        labSelect.innerHTML = `<option value="">Selecione o laboratório</option>` +
            laboratorios.filter(l => l.ativo !== false).map(l =>
                `<option value="${l.id}">${escapeHTML(l.nome)} (${escapeHTML(l.descricao || '')})</option>`
            ).join('');
        if (curVal) labSelect.value = curVal;
    }

    // Professores (visível apenas para admin)
    const profSelect = document.getElementById('reserva-professor');
    if (profSelect) {
        const curVal = profSelect.value;
        profSelect.innerHTML = `<option value="">Selecione o professor</option>` +
            professores.map(p =>
                `<option value="${p.id}">${escapeHTML(p.nome)}</option>`
            ).join('');
        if (curVal) profSelect.value = curVal;
    }

    // Cursos
    const cursoSelect = document.getElementById('reserva-curso');
    if (cursoSelect) {
        const curVal = cursoSelect.value;
        cursoSelect.innerHTML = `<option value="">Selecione o curso</option>` +
            cursos.filter(c => c.ativo !== false).map(c =>
                `<option value="${c.id}">${escapeHTML(c.nome)}${c.sigla ? ` (${escapeHTML(c.sigla)})` : ''}</option>`
            ).join('');
        if (curVal) cursoSelect.value = curVal;
    }

    // Turmas (Lista Dropdown alimentada pelo Firestore / Admin Panel)
    const turmaSelect = document.getElementById('reserva-turma');
    if (turmaSelect) {
        const curVal = turmaSelect.value;
        let activeTurmas = turmas.filter(t => t.ativo !== false).map(t => t.nome);
        // Se ainda não houver turmas cadastradas no Firestore, utiliza o catálogo padrão
        if (activeTurmas.length === 0) {
            activeTurmas = DEFAULT_TURMAS;
        }
        activeTurmas = [...new Set(activeTurmas)].sort((a, b) => a.localeCompare('pt-BR'));
        turmaSelect.innerHTML = `<option value="">Selecione a turma...</option>` +
            activeTurmas.map(t =>
                `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`
            ).join('');
        if (curVal) turmaSelect.value = curVal;
    }

    // Disciplinas (Lista Dropdown alimentada pelo Firestore / Admin Panel)
    const discSelect = document.getElementById('reserva-disciplina');
    if (discSelect) {
        const curVal = discSelect.value;
        let activeDiscs = disciplinas.filter(d => d.ativo !== false).map(d => d.nome);
        // Se ainda não houver disciplinas cadastradas no Firestore, utiliza o catálogo padrão
        if (activeDiscs.length === 0) {
            activeDiscs = DEFAULT_DISCIPLINAS;
        }
        activeDiscs = [...new Set(activeDiscs)].sort((a, b) => a.localeCompare('pt-BR'));
        discSelect.innerHTML = `<option value="">Selecione a disciplina...</option>` +
            activeDiscs.map(d =>
                `<option value="${escapeHTML(d)}">${escapeHTML(d)}</option>`
            ).join('');
        if (curVal) discSelect.value = curVal;
    }
}

/**
 * Renderiza as pills de seleção de aulas
 */
function renderAulaPills(turno) {
    const container = document.getElementById('aula-pills-container');
    if (!container) return;

    const config = SCHEDULE_CONFIG[turno];
    if (!config) {
        container.innerHTML = '<p class="text-sm text-gray-400">Selecione um turno</p>';
        return;
    }

    let html = `<div class="flex flex-wrap gap-2">`;

    // Botão "Selecionar Todas"
    html += `<button type="button" id="select-all-aulas" class="px-3 py-1.5 rounded-lg text-xs font-semibold border-2 border-indigo-300 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors">
        ✓ Todas
    </button>`;

    config.aulas.forEach(aula => {
        // Mostra indicador de intervalo
        if (config.intervalo && aula.numero === config.intervalo.aposAula + 1) {
            html += `<span class="flex items-center text-[10px] text-amber-600 font-medium px-1">
                ☕ Intervalo
            </span>`;
        }

        html += `<button type="button" class="aula-pill px-3 py-2 rounded-xl text-xs font-semibold border-2 
            border-gray-200 bg-white text-gray-600 hover:border-indigo-400 hover:text-indigo-600 
            transition-all active:scale-95 cursor-pointer select-none"
            data-aula="${aula.numero}">
            <div class="font-bold">${aula.numero}ª Aula</div>
            <div class="text-[10px] opacity-70">${aula.inicio}-${aula.fim}</div>
        </button>`;
    });

    html += `</div>`;
    container.innerHTML = html;

    // Event listeners para pills
    container.querySelectorAll('.aula-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            pill.classList.toggle('border-indigo-500');
            pill.classList.toggle('bg-indigo-50');
            pill.classList.toggle('text-indigo-700');
            pill.classList.toggle('border-gray-200');
            pill.classList.toggle('text-gray-600');
        });
    });

    // Selecionar todas
    document.getElementById('select-all-aulas')?.addEventListener('click', () => {
        const pills = container.querySelectorAll('.aula-pill');
        const allSelected = [...pills].every(p => p.classList.contains('border-indigo-500'));

        pills.forEach(pill => {
            if (allSelected) {
                pill.classList.remove('border-indigo-500', 'bg-indigo-50', 'text-indigo-700');
                pill.classList.add('border-gray-200', 'text-gray-600');
            } else {
                pill.classList.add('border-indigo-500', 'bg-indigo-50', 'text-indigo-700');
                pill.classList.remove('border-gray-200', 'text-gray-600');
            }
        });
    });
}

/**
 * Renderiza checkboxes de recursos extras
 */
function renderRecursos() {
    const container = document.getElementById('recursos-container');
    if (!container) return;

    container.innerHTML = RECURSOS_DISPONIVEIS.map(r => `
        <label class="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer transition-colors select-none">
            <input type="checkbox" value="${r.id}" class="recurso-check rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
            <span class="text-sm">${r.icon} ${r.label}</span>
        </label>
    `).join('');
}

/**
 * Configura listeners do formulário
 */
function setupFormListeners() {
    // Turno change -> atualiza pills
    const turnoSelect = document.getElementById('reserva-turno');
    turnoSelect?.addEventListener('change', () => {
        renderAulaPills(turnoSelect.value);
    });

    // Recorrente toggle
    const recorrenteToggle = document.getElementById('reserva-recorrente');
    const recorrenteSection = document.getElementById('recorrente-section');
    recorrenteToggle?.addEventListener('change', () => {
        if (recorrenteSection) {
            recorrenteSection.classList.toggle('hidden', !recorrenteToggle.checked);
        }
    });

    // Form submit
    const form = document.getElementById('reserva-form');
    form?.addEventListener('submit', handleFormSubmit);

    // Cancel button
    document.getElementById('reserva-cancel')?.addEventListener('click', () => {
        closeModal('reserva-modal');
    });

    // Close modal on backdrop
    document.getElementById('reserva-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'reserva-modal' || e.target.classList.contains('modal-backdrop')) {
            closeModal('reserva-modal');
        }
    });
}

/**
 * Abre o modal de reserva com dados pré-preenchidos
 * @param {object} preData - { labId, labNome, data, turno, aula, turma, disciplina }
 */
export function openReservationForm(preData = {}) {
    const profile = getUserProfile();
    const admin = isAdmin();

    // Reset form
    const form = document.getElementById('reserva-form');
    if (form) form.reset();

    // Popula selects garantindo dados atualizados
    populateSelects();

    // Pre-fill lab
    if (preData.labId) {
        const labSelect = document.getElementById('reserva-lab');
        if (labSelect) labSelect.value = preData.labId;
    }

    // Pre-fill date
    const dateInput = document.getElementById('reserva-data');
    if (dateInput) {
        dateInput.value = preData.data || formatDateISO(new Date());
    }

    // Pre-fill turno
    const turnoSelect = document.getElementById('reserva-turno');
    if (turnoSelect) {
        turnoSelect.value = preData.turno || getSuggestedTurno();
    }

    // Pre-fill turma se fornecida
    if (preData.turma) {
        const turmaSelect = document.getElementById('reserva-turma');
        if (turmaSelect) turmaSelect.value = preData.turma;
    }

    // Pre-fill disciplina se fornecida
    if (preData.disciplina) {
        const discSelect = document.getElementById('reserva-disciplina');
        if (discSelect) discSelect.value = preData.disciplina;
    }

    // Render aula pills
    renderAulaPills(turnoSelect?.value || preData.turno || getSuggestedTurno());

    // Pre-select specific aula if given
    if (preData.aula) {
        setTimeout(() => {
            const pill = document.querySelector(`.aula-pill[data-aula="${preData.aula}"]`);
            if (pill) {
                pill.classList.add('border-indigo-500', 'bg-indigo-50', 'text-indigo-700');
                pill.classList.remove('border-gray-200', 'text-gray-600');
            }
        }, 50);
    }

    // Render recursos
    renderRecursos();

    // Professor auto-fill (se professor logado)
    const profSection = document.getElementById('professor-select-section');
    const profAutoFill = document.getElementById('professor-auto-fill');

    if (!admin && profile) {
        // Professor logado - auto-fill e oculta select
        if (profSection) profSection.classList.add('hidden');
        if (profAutoFill) {
            profAutoFill.classList.remove('hidden');
            profAutoFill.querySelector('#auto-professor-name').textContent = profile.nome || profile.email;
        }
    } else {
        // Admin - mostra select
        if (profSection) profSection.classList.remove('hidden');
        if (profAutoFill) profAutoFill.classList.add('hidden');
    }

    // Garante que botões de criação rápida só apareçam para admin
    updateFormRoleVisibility();

    // Reset recorrente
    const recorrenteToggle = document.getElementById('reserva-recorrente');
    const recorrenteSection = document.getElementById('recorrente-section');
    if (recorrenteToggle) recorrenteToggle.checked = false;
    if (recorrenteSection) recorrenteSection.classList.add('hidden');

    // Open modal
    openModal('reserva-modal');
}

/**
 * Handles form submission
 */
async function handleFormSubmit(e) {
    e.preventDefault();

    const profile = getUserProfile();
    const admin = isAdmin();

    // Coleta dados do formulário
    const labId = document.getElementById('reserva-lab')?.value;
    const data = document.getElementById('reserva-data')?.value;
    const turno = document.getElementById('reserva-turno')?.value;
    const turma = document.getElementById('reserva-turma')?.value?.trim();
    const disciplina = document.getElementById('reserva-disciplina')?.value?.trim();
    const observacoes = document.getElementById('reserva-observacoes')?.value?.trim();

    // Professor
    let professorId, professorNome;
    if (admin) {
        professorId = document.getElementById('reserva-professor')?.value;
        const profOption = document.getElementById('reserva-professor')?.selectedOptions[0];
        professorNome = profOption?.textContent || '';
    } else {
        professorId = profile?.professorId || profile?.id;
        professorNome = profile?.nome || profile?.email;
    }

    // Curso
    const cursoId = document.getElementById('reserva-curso')?.value;
    const cursoOption = document.getElementById('reserva-curso')?.selectedOptions[0];
    const cursoObj = cursos.find(c => c.id === cursoId);
    let cursoNome = cursoObj?.nome || '';
    let cursoSigla = cursoObj?.sigla || '';
    if (!cursoNome && cursoOption && cursoId) {
        cursoNome = cursoOption.textContent || '';
    }

    // Aulas selecionadas
    const selectedAulas = [...document.querySelectorAll('.aula-pill.border-indigo-500')]
        .map(p => parseInt(p.dataset.aula));

    // Recursos
    const recursos = [...document.querySelectorAll('.recurso-check:checked')]
        .map(c => c.value);

    // Recorrente
    const recorrente = document.getElementById('reserva-recorrente')?.checked;
    const recorrenteAte = document.getElementById('reserva-recorrente-ate')?.value;

    // Validações
    if (!labId) return showToast('Selecione um laboratório.', 'warning');
    if (!data) return showToast('Selecione uma data.', 'warning');
    if (!turno) return showToast('Selecione um turno.', 'warning');
    if (selectedAulas.length === 0) return showToast('Selecione pelo menos uma aula.', 'warning');
    if (!turma) return showToast('Selecione uma turma.', 'warning');
    if (!disciplina) return showToast('Selecione uma disciplina.', 'warning');
    if (admin && !professorId) return showToast('Selecione um professor.', 'warning');
    if (recorrente && !recorrenteAte) return showToast('Informe a data final da recorrência.', 'warning');

    const labNome = document.getElementById('reserva-lab')?.selectedOptions[0]?.textContent || '';
    const discObj = disciplinas.find(d => d.nome?.toLowerCase() === disciplina.toLowerCase() || d.id === disciplina);
    const disciplinaSigla = discObj?.sigla || getDisciplinaSigla(disciplina);

    const reservaData = {
        labId,
        labNome,
        data,
        turno,
        aulas: selectedAulas,
        professorId,
        professorNome,
        cursoId: cursoId || null,
        cursoNome: cursoNome || '',
        cursoSigla: cursoSigla || '',
        turma,
        turmaNome: turma,
        disciplina,
        disciplinaNome: disciplina,
        disciplinaSigla: disciplinaSigla || '',
        recursos,
        recursosExtras: recursos,
        observacoes,
        recorrente: recorrente || false,
        recorrenteAte: recorrente ? recorrenteAte : null,
        criadoPor: getCurrentUser()?.uid || ''
    };

    try {
        showLoader(true, 'Salvando reserva...');

        if (recorrente && recorrenteAte) {
            await createReservaRecorrente(reservaData, recorrenteAte, admin);
        } else {
            const result = await createReserva(reservaData, admin);
            if (!result.success) return; // Conflito - toast já mostrado
        }

        closeModal('reserva-modal');
        refreshCalendar();
    } catch (error) {
        console.error('Erro ao salvar reserva:', error);
    } finally {
        showLoader(false);
    }
}

/**
 * Configura modais de adição rápida (Professor, Curso, Turma e Disciplina)
 */
function setupQuickAddModals() {
    // ------------------------------------
    // PROFESSOR
    // ------------------------------------
    document.getElementById('add-professor-btn')?.addEventListener('click', () => {
        openModal('quick-add-professor-modal');
    });

    document.getElementById('quick-professor-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('quick-professor-nome')?.value?.trim();
        const email = document.getElementById('quick-professor-email')?.value?.trim();

        if (!nome) return showToast('Informe o nome do professor.', 'warning');

        try {
            showLoader(true, 'Cadastrando professor...');
            const id = await addProfessor({ nome, email: email || '' });
            professores = await getProfessores();
            populateSelects();

            const profSelect = document.getElementById('reserva-professor');
            if (profSelect) profSelect.value = id;

            closeModal('quick-add-professor-modal');
            document.getElementById('quick-professor-form')?.reset();
        } catch (error) {
            console.error(error);
        } finally {
            showLoader(false);
        }
    });

    document.getElementById('cancel-quick-professor')?.addEventListener('click', () => {
        closeModal('quick-add-professor-modal');
    });

    // ------------------------------------
    // CURSO
    // ------------------------------------
    document.getElementById('add-curso-btn')?.addEventListener('click', () => {
        if (!isAdmin()) {
            showToast('Apenas administradores podem cadastrar novos cursos.', 'warning');
            return;
        }
        openModal('quick-add-curso-modal');
    });

    document.getElementById('quick-curso-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!isAdmin()) {
            showToast('Apenas administradores podem cadastrar novos cursos.', 'warning');
            return;
        }
        const nome = document.getElementById('quick-curso-nome')?.value?.trim();
        const sigla = document.getElementById('quick-curso-sigla')?.value?.trim();

        if (!nome) return showToast('Informe o nome do curso.', 'warning');

        try {
            showLoader(true, 'Cadastrando curso...');
            const id = await addCurso({ nome, sigla: sigla || '' });
            cursos = await getCursos();
            populateSelects();

            const cursoSelect = document.getElementById('reserva-curso');
            if (cursoSelect) cursoSelect.value = id;

            closeModal('quick-add-curso-modal');
            document.getElementById('quick-curso-form')?.reset();
        } catch (error) {
            console.error(error);
        } finally {
            showLoader(false);
        }
    });

    document.getElementById('cancel-quick-curso')?.addEventListener('click', () => {
        closeModal('quick-add-curso-modal');
    });

    // ------------------------------------
    // TURMA (Salva no Firestore)
    // ------------------------------------
    document.getElementById('add-turma-btn')?.addEventListener('click', () => {
        if (!isAdmin()) {
            showToast('Apenas administradores podem cadastrar novas turmas.', 'warning');
            return;
        }
        openModal('quick-add-turma-modal');
    });

    document.getElementById('quick-turma-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!isAdmin()) {
            showToast('Apenas administradores podem cadastrar novas turmas.', 'warning');
            return;
        }
        const nome = document.getElementById('quick-turma-nome')?.value?.trim();
        if (!nome) return showToast('Informe o nome da turma.', 'warning');

        try {
            showLoader(true, 'Cadastrando turma...');
            await addTurma({ nome });
            turmas = await getTurmas();
            populateSelects();

            const turmaSelect = document.getElementById('reserva-turma');
            if (turmaSelect) turmaSelect.value = nome;

            closeModal('quick-add-turma-modal');
            document.getElementById('quick-turma-form')?.reset();
        } catch (error) {
            console.error(error);
        } finally {
            showLoader(false);
        }
    });

    document.getElementById('cancel-quick-turma')?.addEventListener('click', () => {
        closeModal('quick-add-turma-modal');
    });

    // ------------------------------------
    // DISCIPLINA (Salva no Firestore)
    // ------------------------------------
    document.getElementById('add-disciplina-btn')?.addEventListener('click', () => {
        if (!isAdmin()) {
            showToast('Apenas administradores podem cadastrar novas disciplinas.', 'warning');
            return;
        }
        openModal('quick-add-disciplina-modal');
    });

    document.getElementById('quick-disciplina-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!isAdmin()) {
            showToast('Apenas administradores podem cadastrar novas disciplinas.', 'warning');
            return;
        }
        const nome = document.getElementById('quick-disciplina-nome')?.value?.trim();
        const siglaInput = document.getElementById('quick-disciplina-sigla')?.value?.trim();
        const sigla = siglaInput || getDisciplinaSigla(nome);
        if (!nome) return showToast('Informe o nome da disciplina.', 'warning');

        try {
            showLoader(true, 'Cadastrando disciplina...');
            await addDisciplina({ nome, sigla: sigla || '' });
            disciplinas = await getDisciplinas();
            populateSelects();

            const discSelect = document.getElementById('reserva-disciplina');
            if (discSelect) discSelect.value = nome;

            closeModal('quick-add-disciplina-modal');
            document.getElementById('quick-disciplina-form')?.reset();
        } catch (error) {
            console.error(error);
        } finally {
            showLoader(false);
        }
    });

    document.getElementById('cancel-quick-disciplina')?.addEventListener('click', () => {
        closeModal('quick-add-disciplina-modal');
    });

    // Fechar modais ao clicar no backdrop
    ['quick-add-professor-modal', 'quick-add-curso-modal', 'quick-add-turma-modal', 'quick-add-disciplina-modal'].forEach(modalId => {
        document.getElementById(modalId)?.addEventListener('click', (e) => {
            if (e.target.id === modalId || e.target.classList.contains('modal-backdrop')) {
                closeModal(modalId);
            }
        });
    });
}

/**
 * Atualiza a visibilidade dos botões de criação rápida conforme o perfil (apenas administrador)
 */
export function updateFormRoleVisibility() {
    const admin = isAdmin();
    const addCursoBtn = document.getElementById('add-curso-btn');
    const addTurmaBtn = document.getElementById('add-turma-btn');
    const addDisciplinaBtn = document.getElementById('add-disciplina-btn');

    if (addCursoBtn) addCursoBtn.classList.toggle('hidden', !admin);
    if (addTurmaBtn) addTurmaBtn.classList.toggle('hidden', !admin);
    if (addDisciplinaBtn) addDisciplinaBtn.classList.toggle('hidden', !admin);
}

/**
 * Atualiza os selects após mudanças no painel admin
 */
export async function refreshFormData() {
    await loadFormData();
}

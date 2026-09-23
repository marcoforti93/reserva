// ============================================================
// reservation-form.js
// Modal de formulário de reserva com selects dinâmicos,
// pills de aulas, recursos extras e reserva recorrente
// ============================================================

import { SCHEDULE_CONFIG, RECURSOS_DISPONIVEIS, getAulaLabel } from './schedule-config.js';
import { getSuggestedTurno, formatDateISO } from './utils.js';
import { getLaboratorios, getProfessores, getCursos, createReserva, createReservaRecorrente, addProfessor, addCurso, getReservas } from './firestore-service.js';
import { openModal, closeModal, showToast, showLoader } from './ui-helpers.js';
import { getCurrentUser, getUserProfile, isAdmin } from './auth.js';
import { refreshCalendar } from './calendar-view.js';

let laboratorios = [];
let professores = [];
let cursos = [];

/**
 * Inicializa o formulário de reserva
 */
export async function initReservationForm() {
    await loadFormData();
    setupFormListeners();
    setupQuickAddModals();
}

/**
 * Carrega dados para os selects
 */
async function loadFormData() {
    [laboratorios, professores, cursos] = await Promise.all([
        getLaboratorios(),
        getProfessores(),
        getCursos()
    ]);
    populateSelects();
}

/**
 * Popula os selects com dados do Firestore
 */
function populateSelects() {
    // Laboratórios
    const labSelect = document.getElementById('reserva-lab');
    if (labSelect) {
        labSelect.innerHTML = `<option value="">Selecione o laboratório</option>` +
            laboratorios.filter(l => l.ativo !== false).map(l =>
                `<option value="${l.id}">${l.nome} (${l.descricao || ''})</option>`
            ).join('');
    }

    // Professores (visível apenas para admin)
    const profSelect = document.getElementById('reserva-professor');
    if (profSelect) {
        profSelect.innerHTML = `<option value="">Selecione o professor</option>` +
            professores.map(p =>
                `<option value="${p.id}">${p.nome}</option>`
            ).join('');
    }

    // Cursos
    const cursoSelect = document.getElementById('reserva-curso');
    if (cursoSelect) {
        cursoSelect.innerHTML = `<option value="">Selecione o curso</option>` +
            cursos.filter(c => c.ativo !== false).map(c =>
                `<option value="${c.id}">${c.nome}${c.sigla ? ` (${c.sigla})` : ''}</option>`
            ).join('');
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
 * @param {object} preData - { labId, labNome, data, turno, aula }
 */
export function openReservationForm(preData = {}) {
    const profile = getUserProfile();
    const admin = isAdmin();

    // Reset form
    const form = document.getElementById('reserva-form');
    if (form) form.reset();

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
    const cursoNome = cursoOption?.textContent || '';

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
    if (!turma) return showToast('Informe a turma.', 'warning');
    if (!disciplina) return showToast('Informe a disciplina.', 'warning');
    if (admin && !professorId) return showToast('Selecione um professor.', 'warning');
    if (recorrente && !recorrenteAte) return showToast('Informe a data final da recorrência.', 'warning');

    const labNome = document.getElementById('reserva-lab')?.selectedOptions[0]?.textContent || '';

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
        turma,
        disciplina,
        recursos,
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
 * Configura modais de adição rápida (Professor e Curso)
 */
function setupQuickAddModals() {
    // Botão "+ Adicionar Professor"
    document.getElementById('add-professor-btn')?.addEventListener('click', () => {
        openModal('quick-add-professor-modal');
    });

    // Form de professor rápido
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

            // Seleciona o professor recém adicionado
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

    // Botão "+ Adicionar Curso"
    document.getElementById('add-curso-btn')?.addEventListener('click', () => {
        openModal('quick-add-curso-modal');
    });

    // Form de curso rápido
    document.getElementById('quick-curso-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
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
}

/**
 * Atualiza os selects após mudanças no painel admin
 */
export async function refreshFormData() {
    await loadFormData();
}

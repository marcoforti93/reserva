// ============================================================
// app.js
// Ponto de entrada da SPA — Router, inicialização e eventos
// ============================================================

import { initAuthObserver, login, logout, getCurrentUser, getUserProfile, isAdmin, updateUserUI } from './auth.js';
import { initCalendarView, refreshCalendar, destroyCalendarView } from './calendar-view.js';
import { initReservationForm, openReservationForm, updateFormRoleVisibility } from './reservation-form.js';
import { initAdminPanel, setupAdminEventListeners } from './admin-panel.js';
import { initExportService } from './export-service.js';
import { getReservasProfessor, getReservas, getReservasSemana, deleteReserva, updateReservaStatus, getReservaById } from './sheet-service.js';
import { getSheetApiUrl, setCustomSheetApiUrl, isApiConfigured } from './sheet-config.js';
import { showToast, showConfirm, openModal, closeModal, createStatusBadge, showLoader } from './ui-helpers.js';
import { SCHEDULE_CONFIG, STATUS_CONFIG, getAulaLabel } from './schedule-config.js';
import { formatDateBR, escapeHTML } from './utils.js';

// ========================
// SPA ROUTER
// ========================

const VIEWS = {
    calendario: 'view-calendario',
    agendamentos: 'view-agendamentos',
    admin: 'view-admin'
};

let currentView = 'calendario';

/**
 * Navega para uma view
 */
function navigateTo(view) {
    // Esconde todas as views
    Object.values(VIEWS).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    // Mostra a view selecionada
    const targetEl = document.getElementById(VIEWS[view]);
    if (targetEl) targetEl.classList.remove('hidden');

    // Atualiza tabs de navegação
    document.querySelectorAll('[data-nav]').forEach(tab => {
        tab.classList.remove('nav-active');
        if (tab.dataset.nav === view) {
            tab.classList.add('nav-active');
        }
    });

    currentView = view;
    window.location.hash = view;

    // Ações específicas por view
    if (view === 'calendario') {
        refreshCalendar();
    } else if (view === 'agendamentos') {
        loadMyReservations();
    } else if (view === 'admin') {
        initAdminPanel();
    }
}

/**
 * Configura o router baseado em hash
 */
function setupRouter() {
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '') || 'calendario';
        if (VIEWS[hash]) navigateTo(hash);
    });

    // Navegação por clique nos tabs
    document.querySelectorAll('[data-nav]').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const view = tab.dataset.nav;
            if (view === 'admin' && !isAdmin()) {
                showToast('Acesso restrito a administradores.', 'warning');
                return;
            }
            navigateTo(view);
        });
    });
}

// ========================
// LOGIN/LOGOUT
// ========================

function setupLoginForm() {
    const form = document.getElementById('login-form');
    const submitBtn = document.getElementById('login-submit-btn');

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email')?.value?.trim();
        const password = document.getElementById('login-password')?.value;

        if (!email || !password) {
            showToast('Preencha email e senha.', 'warning');
            return;
        }

        const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
            submitBtn.innerHTML = `
                <span class="inline-flex items-center justify-center gap-2">
                    <svg class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Entrando no sistema...</span>
                </span>
            `;
        }

        try {
            await login(email, password);
        } catch {
            // Erro já tratado e exibido por auth.js (toast e inline alert)
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
                submitBtn.innerHTML = originalBtnHtml;
            }
        }
    });

    // Logout button
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        const confirmed = await showConfirm('Sair', 'Deseja realmente sair do sistema?', 'Sair');
        if (confirmed) await logout();
    });

    // Toggle password visibility
    document.getElementById('toggle-password')?.addEventListener('click', () => {
        const input = document.getElementById('login-password');
        const icon = document.getElementById('toggle-password-icon');
        if (input.type === 'password') {
            input.type = 'text';
            if (icon) icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.11 6.11m3.768 3.768l4.242 4.242m0 0l3.768 3.768M6.11 6.11L3 3m3.11 3.11l4.242 4.242"/>`;
        } else {
            input.type = 'password';
            if (icon) icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>`;
        }
    });
}

// ========================
// MEUS AGENDAMENTOS
// ========================

async function loadMyReservations() {
    const container = document.getElementById('my-reservations-list');
    if (!container) return;

    container.innerHTML = '<div class="flex justify-center py-12"><div class="loader-spinner"></div></div>';

    const profile = getUserProfile();
    if (!profile) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400">Carregando perfil...</div>';
        return;
    }

    // Para admin, mostra todas; para professor, filtra
    let reservas;
    if (isAdmin()) {
        reservas = await getReservas();
    } else {
        reservas = await getReservasProfessor(profile.professorId || profile.id);
    }

    if (!reservas || reservas.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="text-5xl mb-3">📋</div>
                <h3 class="text-lg font-semibold text-gray-700">Nenhum agendamento encontrado</h3>
                <p class="text-sm text-gray-400 mt-1">Suas reservas aparecerão aqui.</p>
            </div>`;
        return;
    }

    // Ordena por data
    reservas.sort((a, b) => (a.data || '').localeCompare(b.data || ''));

    let html = `<div class="space-y-3">`;

    reservas.forEach(r => {
        const statusCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.livre;
        const turnoLabel = SCHEDULE_CONFIG[r.turno]?.label || r.turno;
        const aulasLabel = (r.aulas || []).map(a => {
            const lbl = getAulaLabel(r.turno, a);
            return lbl || `${a}ª aula`;
        }).join(', ');

        const turmaCard = r.turmaNome || r.turma || (r.cursoNome ? r.cursoNome : 'Sem turma');
        let discCard = r.disciplinaNome || r.disciplina || '';
        if (r.disciplinaSigla) {
            if (discCard && !discCard.toLowerCase().includes(r.disciplinaSigla.toLowerCase())) {
                discCard = `${discCard} (${r.disciplinaSigla})`;
            } else if (!discCard) {
                discCard = r.disciplinaSigla;
            }
        }
        if (!discCard) discCard = 'Sem disciplina';

        html += `
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div class="h-1.5 ${statusCfg.bgClass}"></div>
            <div class="p-4">
                <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="font-bold text-gray-900">${escapeHTML(r.labNome || '')}</span>
                            ${createStatusBadge(r.status)}
                        </div>
                        <div class="text-sm text-gray-600 space-y-0.5">
                            <div>📅 <strong>${formatDateBR(r.data)}</strong> · ${turnoLabel}</div>
                            <div>⏰ ${aulasLabel}</div>
                            <div>👤 ${escapeHTML(r.professorNome || '')}</div>
                            <div>👥 <strong>Turma:</strong> ${escapeHTML(turmaCard)}</div>
                            <div>📖 <strong>Disciplina:</strong> ${escapeHTML(discCard)}</div>
                            ${r.cursoNome && r.cursoNome !== turmaCard ? `<div>🎓 ${escapeHTML(r.cursoNome)}</div>` : ''}
                            ${r.recursos?.length ? `<div>🔧 ${r.recursos.join(', ')}</div>` : ''}
                            ${r.observacoes ? `<div class="text-gray-400 italic text-xs mt-1">💬 ${escapeHTML(r.observacoes)}</div>` : ''}
                            ${r.recorrente ? `<div class="text-indigo-500 text-xs mt-1">🔄 Recorrente até ${r.recorrenteAte ? formatDateBR(r.recorrenteAte) : '—'}</div>` : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        ${(r.status === 'pendente' || isAdmin()) ? `
                        <button onclick="window.dispatchEvent(new CustomEvent('cancel-reserva', {detail: '${r.id}'}))" 
                            class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                            Cancelar
                        </button>` : ''}
                    </div>
                </div>
            </div>
        </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
}

function getReservas_batch(datesISO) {
    return getReservasSemana(datesISO);
}

// ========================
// GLOBAL EVENT LISTENERS
// ========================

function setupGlobalEvents() {
    // Nova reserva (do calendário)
    window.addEventListener('new-reserva', (e) => {
        openReservationForm(e.detail);
    });

    // Ver detalhes de reserva
    window.addEventListener('view-reserva', (e) => {
        showReservaDetails(e.detail);
    });

    // Cancelar reserva
    window.addEventListener('cancel-reserva', async (e) => {
        const confirmed = await showConfirm(
            'Cancelar Reserva',
            'Deseja realmente cancelar esta reserva?',
            'Cancelar Reserva',
            'danger'
        );
        if (confirmed) {
            try {
                await deleteReserva(e.detail);
                refreshCalendar();
                if (currentView === 'agendamentos') loadMyReservations();
            } catch (error) {
                console.error(error);
            }
        }
    });

    // Botão nova reserva no header
    document.getElementById('new-reserva-btn')?.addEventListener('click', () => {
        openReservationForm();
    });
    document.getElementById('new-reserva-btn-mobile')?.addEventListener('click', () => {
        openReservationForm();
    });

    // Mobile menu toggle
    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
        const menu = document.getElementById('mobile-menu');
        if (menu) menu.classList.toggle('hidden');
    });

    // User dropdown
    document.getElementById('user-menu-btn')?.addEventListener('click', () => {
        const dropdown = document.getElementById('user-dropdown');
        if (dropdown) dropdown.classList.toggle('hidden');
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('user-dropdown');
        const btn = document.getElementById('user-menu-btn');
        if (dropdown && btn && !btn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
}

/**
 * Mostra detalhes de uma reserva em modal
 */
async function showReservaDetails(reservaId) {
    try {
        const r = await getReservaById(reservaId);
        if (!r) {
            showToast('Reserva não encontrada.', 'error');
            return;
        }

        const statusCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.livre;
        const turnoLabel = SCHEDULE_CONFIG[r.turno]?.label || r.turno;
        const aulasLabel = (r.aulas || []).map(a => getAulaLabel(r.turno, a) || `${a}ª aula`).join('<br>');

        let cursoTexto = r.turmaNome || r.turma || r.cursoNome || 'Não informado';
        if (r.cursoNome && (r.turmaNome || r.turma) && !(r.turmaNome || r.turma).toLowerCase().includes(r.cursoNome.toLowerCase())) {
            cursoTexto = `${r.cursoNome} · ${r.turmaNome || r.turma}`;
        }
        
        let disciplinaTexto = r.disciplinaNome || r.disciplina || '';
        if (r.disciplinaSigla) {
            if (disciplinaTexto && !disciplinaTexto.toLowerCase().includes(r.disciplinaSigla.toLowerCase())) {
                disciplinaTexto = `${disciplinaTexto} (${r.disciplinaSigla})`;
            } else if (!disciplinaTexto) {
                disciplinaTexto = r.disciplinaSigla;
            }
        }
        if (!disciplinaTexto) disciplinaTexto = 'Não informada';

        const detailContent = document.getElementById('reserva-detail-content');
        if (detailContent) {
            detailContent.innerHTML = `
                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <h3 class="text-xl font-bold text-gray-900">${escapeHTML(r.labNome || '')}</h3>
                        ${createStatusBadge(r.status)}
                    </div>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div class="space-y-2">
                            <div class="flex items-start gap-2">
                                <span class="text-gray-400">📅</span>
                                <div><strong>Data:</strong> ${formatDateBR(r.data)}</div>
                            </div>
                            <div class="flex items-start gap-2">
                                <span class="text-gray-400">🕐</span>
                                <div><strong>Turno:</strong> ${turnoLabel}</div>
                            </div>
                            <div class="flex items-start gap-2">
                                <span class="text-gray-400">⏰</span>
                                <div><strong>Aulas:</strong><br>${aulasLabel}</div>
                            </div>
                        </div>
                        <div class="space-y-2">
                            <div class="flex items-start gap-2">
                                <span class="text-gray-400">👤</span>
                                <div><strong>Professor:</strong> ${escapeHTML(r.professorNome || '')}</div>
                            </div>
                            <div class="flex items-start gap-2">
                                <span class="text-gray-400">🎓</span>
                                <div><strong>Curso:</strong> <span class="text-gray-900 font-medium">${escapeHTML(cursoTexto)}</span></div>
                            </div>
                            <div class="flex items-start gap-2">
                                <span class="text-gray-400">📖</span>
                                <div><strong>Disciplina:</strong> <span class="text-gray-900 font-medium">${escapeHTML(disciplinaTexto)}</span></div>
                            </div>
                        </div>
                    </div>

                    ${r.recursos?.length ? `
                    <div class="border-t border-gray-100 pt-3">
                        <strong class="text-sm text-gray-700">Recursos solicitados:</strong>
                        <div class="flex flex-wrap gap-2 mt-1">
                            ${r.recursos.map(rec => `<span class="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs">${rec}</span>`).join('')}
                        </div>
                    </div>` : ''}

                    ${r.observacoes ? `
                    <div class="border-t border-gray-100 pt-3">
                        <strong class="text-sm text-gray-700">Observações:</strong>
                        <p class="text-sm text-gray-500 mt-1">${escapeHTML(r.observacoes)}</p>
                    </div>` : ''}

                    <div class="border-t border-gray-100 pt-3 flex flex-wrap gap-2">
                        ${isAdmin() && r.status === 'pendente' ? `
                        <button onclick="window.dispatchEvent(new CustomEvent('approve-reserva', {detail: '${r.id}'})); document.getElementById('reserva-detail-modal').classList.add('hidden');" 
                            class="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                            ✓ Aprovar
                        </button>
                        <button onclick="window.dispatchEvent(new CustomEvent('reject-reserva', {detail: '${r.id}'})); document.getElementById('reserva-detail-modal').classList.add('hidden');" 
                            class="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors">
                            ✕ Rejeitar
                        </button>` : ''}
                        ${r.status === 'pendente' || isAdmin() ? `
                        <button onclick="window.dispatchEvent(new CustomEvent('cancel-reserva', {detail: '${r.id}'})); document.getElementById('reserva-detail-modal').classList.add('hidden');" 
                            class="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                            🗑️ Cancelar Reserva
                        </button>` : ''}
                    </div>
                </div>`;
        }

        openModal('reserva-detail-modal');
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        showToast('Erro ao carregar detalhes da reserva.', 'error');
    }
}

// ========================
// APP INITIALIZATION
// ========================

function showApp() {
    document.getElementById('login-screen')?.classList.add('hidden');
    document.getElementById('app-screen')?.classList.remove('hidden');
}

function showLogin() {
    document.getElementById('login-screen')?.classList.remove('hidden');
    document.getElementById('app-screen')?.classList.add('hidden');
}

// ============================================================
// CONFIGURAÇÃO DA PLANILHA GOOGLE SHEETS (UI)
// ============================================================

function setupSheetsConfigUI() {
    const updateHeaderBadge = () => {
        const configured = isApiConfigured();
        const dot = document.getElementById('sheets-status-dot');
        const text = document.getElementById('sheets-status-text');
        if (dot) {
            dot.className = `w-2 h-2 rounded-full ${configured ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`;
        }
        if (text) {
            text.textContent = configured ? 'Google Sheets' : 'Modo Local';
        }
    };

    const openConfigModal = () => {
        if (!isAdmin()) {
            showToast('Apenas administradores podem configurar a URL da planilha.', 'warning');
            return;
        }

        const modal = document.getElementById('sheets-config-modal');
        const input = document.getElementById('sheets-api-url-input');
        const bannerTitle = document.getElementById('sheets-banner-title');
        const bannerDesc = document.getElementById('sheets-banner-desc');
        const bannerIcon = document.getElementById('sheets-banner-icon');

        if (input) input.value = getSheetApiUrl();

        if (isApiConfigured()) {
            if (bannerTitle) bannerTitle.textContent = '🟢 Conectado ao Google Sheets';
            if (bannerDesc) bannerDesc.textContent = 'Suas reservas e cadastros estão sendo gravados e lidos diretamente na planilha online.';
            if (bannerIcon) bannerIcon.textContent = '🟢';
        } else {
            if (bannerTitle) bannerTitle.textContent = '🟡 Modo Local (Demonstração)';
            if (bannerDesc) bannerDesc.textContent = 'O sistema está gravando localmente no navegador. Cole a URL da API do Google Apps Script abaixo para salvar na nuvem.';
            if (bannerIcon) bannerIcon.textContent = '🟡';
        }

        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    };

    document.getElementById('open-sheets-config-header')?.addEventListener('click', openConfigModal);

    document.getElementById('sheets-save-btn')?.addEventListener('click', () => {
        if (!isAdmin()) {
            showToast('Apenas administradores podem configurar a URL da planilha.', 'warning');
            return;
        }

        const input = document.getElementById('sheets-api-url-input');
        const val = input ? input.value.trim() : '';
        setCustomSheetApiUrl(val);
        updateHeaderBadge();

        const modal = document.getElementById('sheets-config-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }

        showToast(val ? 'URL da API salva com sucesso!' : 'Modo local ativado.', 'success');
        refreshCalendar();
    });

    document.getElementById('sheets-test-btn')?.addEventListener('click', async () => {
        if (!isAdmin()) {
            showToast('Apenas administradores podem testar a conexão com a planilha.', 'warning');
            return;
        }

        const input = document.getElementById('sheets-api-url-input');
        const val = input ? input.value.trim() : '';
        if (!val) {
            showToast('Informe a URL da API antes de testar.', 'warning');
            return;
        }

        showLoader(true, 'Testando conexão com a planilha...');
        try {
            const res = await fetch(`${val}?action=ping`, { method: 'GET', redirect: 'follow' });
            const data = await res.json();
            if (data && data.success) {
                showToast('✅ Conexão com o Google Sheets estabelecida com sucesso!', 'success', 5000);
            } else {
                throw new Error(data.error || 'Resposta inválida.');
            }
        } catch (err) {
            showToast('❌ Falha ao conectar: verifique a URL e se a implantação está acessível a "Qualquer pessoa".', 'error', 6000);
        } finally {
            showLoader(false);
        }
    });

    updateHeaderBadge();
}

async function initApp() {
    console.log('🚀 Inicializando Sistema de Reservas (Google Sheets)...');

    setupLoginForm();
    setupRouter();
    setupGlobalEvents();
    setupAdminEventListeners();
    setupSheetsConfigUI();
    initExportService();

    initAuthObserver(
        // On Login
        async (user, profile) => {
            console.log('✅ Logado como:', profile?.nome || user.email);
            showApp();
            updateUserUI();

            // Mostra/esconde tab admin, botão de configuração do Sheets e botões de criação
            const admin = isAdmin();
            const adminTab = document.getElementById('nav-admin');
            if (adminTab) {
                adminTab.classList.toggle('hidden', !admin);
            }
            const sheetsHeaderBtn = document.getElementById('open-sheets-config-header');
            if (sheetsHeaderBtn) {
                sheetsHeaderBtn.classList.toggle('hidden', !admin);
            }
            
            // Botões de exportação de planilha (apenas admin)
            const exportCalBtn = document.getElementById('admin-export-calendar-btn');
            if (exportCalBtn) {
                exportCalBtn.classList.toggle('hidden', !admin);
                exportCalBtn.classList.toggle('flex', admin);
            }
            const exportPanelBtn = document.getElementById('admin-export-panel-btn');
            if (exportPanelBtn) {
                exportPanelBtn.classList.toggle('hidden', !admin);
                exportPanelBtn.classList.toggle('sm:flex', admin);
            }

            updateFormRoleVisibility();

            // Inicializa views
            try {
                await initCalendarView();
                await initReservationForm();
            } catch (err) {
                console.error('Erro ao carregar dados iniciais das views:', err);
            }

            // Navega para view baseada no hash
            const hash = window.location.hash.replace('#', '') || 'calendario';
            navigateTo(hash);
        },
        // On Logout
        () => {
            console.log('🔒 Deslogado');
            showLogin();
            destroyCalendarView();
            updateFormRoleVisibility();
            const sheetsHeaderBtn = document.getElementById('open-sheets-config-header');
            if (sheetsHeaderBtn) {
                sheetsHeaderBtn.classList.add('hidden');
            }
            const exportCalBtn = document.getElementById('admin-export-calendar-btn');
            if (exportCalBtn) {
                exportCalBtn.classList.add('hidden');
                exportCalBtn.classList.remove('flex');
            }
            const exportPanelBtn = document.getElementById('admin-export-panel-btn');
            if (exportPanelBtn) {
                exportPanelBtn.classList.add('hidden');
                exportPanelBtn.classList.remove('sm:flex');
            }
        }
    );
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

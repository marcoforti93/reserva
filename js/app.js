// ============================================================
// app.js
// Ponto de entrada da SPA — Router, inicialização e eventos
// ============================================================

import { initAuthObserver, login, logout, getCurrentUser, getUserProfile, isAdmin, updateUserUI } from './auth.js';
import { initCalendarView, refreshCalendar, destroyCalendarView } from './calendar-view.js';
import { initReservationForm, openReservationForm } from './reservation-form.js';
import { initAdminPanel, setupAdminEventListeners } from './admin-panel.js';
import { getReservasProfessor, getReservas, deleteReserva, updateReservaStatus } from './firestore-service.js';
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
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email')?.value?.trim();
        const password = document.getElementById('login-password')?.value;

        if (!email || !password) {
            showToast('Preencha email e senha.', 'warning');
            return;
        }

        try {
            await login(email, password);
        } catch {
            // Toast already shown by auth.js
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
        // Admin vê todas (poderia filtrar aqui)
        const today = new Date();
        const dates = [];
        for (let i = -7; i < 30; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            dates.push(iso);
        }
        // Firestore 'in' query limit is 30
        const batch1 = dates.slice(0, 30);
        reservas = await getReservas_batch(batch1);
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
                            <div>📚 ${escapeHTML(r.turma || '')} — ${escapeHTML(r.disciplina || '')}</div>
                            ${r.cursoNome ? `<div>🎓 ${escapeHTML(r.cursoNome)}</div>` : ''}
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

/**
 * Helper para buscar reservas por batch de datas
 */
async function getReservas_batch(datesISO) {
    const { getReservasSemana } = await import('./firestore-service.js');
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
    // Buscar reserva do cache ou do Firestore
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
    const { db } = await import('./firebase-config.js');

    try {
        const docSnap = await getDoc(doc(db, 'reservas', reservaId));
        if (!docSnap.exists()) {
            showToast('Reserva não encontrada.', 'error');
            return;
        }

        const r = { id: docSnap.id, ...docSnap.data() };
        const statusCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.livre;
        const turnoLabel = SCHEDULE_CONFIG[r.turno]?.label || r.turno;
        const aulasLabel = (r.aulas || []).map(a => getAulaLabel(r.turno, a) || `${a}ª aula`).join('<br>');

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
                                <span class="text-gray-400">📚</span>
                                <div><strong>Turma:</strong> ${escapeHTML(r.turma || '')}<br><strong>Disciplina:</strong> ${escapeHTML(r.disciplina || '')}</div>
                            </div>
                            ${r.cursoNome ? `<div class="flex items-start gap-2">
                                <span class="text-gray-400">🎓</span>
                                <div><strong>Curso:</strong> ${escapeHTML(r.cursoNome)}</div>
                            </div>` : ''}
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

async function initApp() {
    console.log('🚀 Inicializando Sistema de Reservas...');

    setupLoginForm();
    setupRouter();
    setupGlobalEvents();
    setupAdminEventListeners();

    initAuthObserver(
        // On Login
        async (user, profile) => {
            console.log('✅ Logado como:', profile?.nome || user.email);
            showApp();
            updateUserUI();

            // Mostra/esconde tab admin
            const adminTab = document.getElementById('nav-admin');
            if (adminTab) {
                adminTab.classList.toggle('hidden', !isAdmin());
            }

            // Inicializa views
            await initCalendarView();
            await initReservationForm();

            // Navega para view baseada no hash
            const hash = window.location.hash.replace('#', '') || 'calendario';
            navigateTo(hash);
        },
        // On Logout
        () => {
            console.log('🔒 Deslogado');
            showLogin();
            destroyCalendarView();
        }
    );
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

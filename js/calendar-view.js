// ============================================================
// calendar-view.js
// Renderização da grade semanal (desktop) e cards (mobile)
// ============================================================

import { SCHEDULE_CONFIG, STATUS_CONFIG, DIAS_SEMANA, getAulaShortLabel } from './schedule-config.js';
import { getWeekDates, formatDateISO, formatDateBR, getWeekLabel, addWeeks, getDayName, isToday, escapeHTML } from './utils.js';
import { getReservasSemana, onReservasChange } from './firestore-service.js';
import { getLaboratorios } from './firestore-service.js';
import { createStatusBadge, createSkeletonCards, showLoader } from './ui-helpers.js';
import { isAdmin, getUserProfile } from './auth.js';

let currentWeekDate = new Date();
let currentTurno = 'noite';
let laboratorios = [];
let reservasCache = [];
let unsubscribeReservas = null;

/**
 * Inicializa o calendar view
 */
export async function initCalendarView() {
    await loadLabs();
    setupCalendarControls();
    await loadWeekData();
}

/**
 * Carrega laboratórios
 */
async function loadLabs() {
    laboratorios = await getLaboratorios();
    renderLabFilters();
}

/**
 * Renderiza os filtros de laboratório
 */
function renderLabFilters() {
    const container = document.getElementById('lab-filter-chips');
    if (!container) return;
    container.innerHTML = `
        <button class="lab-chip active" data-lab="all">Todos</button>
        ${laboratorios.filter(l => l.ativo !== false).map(lab => `
            <button class="lab-chip" data-lab="${lab.id}">${escapeHTML(lab.nome)}</button>
        `).join('')}
    `;

    container.querySelectorAll('.lab-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            container.querySelectorAll('.lab-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            renderCalendar();
        });
    });
}

/**
 * Configura os controles do calendário
 */
function setupCalendarControls() {
    // Navegação por semana
    document.getElementById('prev-week')?.addEventListener('click', () => {
        currentWeekDate = addWeeks(currentWeekDate, -1);
        loadWeekData();
    });
    document.getElementById('next-week')?.addEventListener('click', () => {
        currentWeekDate = addWeeks(currentWeekDate, 1);
        loadWeekData();
    });
    document.getElementById('today-btn')?.addEventListener('click', () => {
        currentWeekDate = new Date();
        loadWeekData();
    });

    // Seletores de turno
    document.querySelectorAll('[data-turno]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-turno]').forEach(b => {
                b.classList.remove('active', 'bg-indigo-600', 'text-white');
                b.classList.add('bg-white', 'text-gray-700');
            });
            btn.classList.add('active', 'bg-indigo-600', 'text-white');
            btn.classList.remove('bg-white', 'text-gray-700');
            currentTurno = btn.dataset.turno;
            renderCalendar();
        });
    });

    // Date picker
    document.getElementById('date-picker')?.addEventListener('change', (e) => {
        currentWeekDate = new Date(e.target.value + 'T00:00:00');
        loadWeekData();
    });
}

/**
 * Carrega dados da semana e renderiza
 */
async function loadWeekData() {
    const weekDates = getWeekDates(currentWeekDate);
    const datesISO = weekDates.map(d => formatDateISO(d));

    // Update week label
    const weekLabel = document.getElementById('week-label');
    if (weekLabel) weekLabel.textContent = getWeekLabel(currentWeekDate);

    // Update date picker
    const datePicker = document.getElementById('date-picker');
    if (datePicker) datePicker.value = formatDateISO(currentWeekDate);

    // Unsubscribe previous listener
    if (unsubscribeReservas) unsubscribeReservas();

    // Show skeleton
    const desktopGrid = document.getElementById('desktop-grid');
    const mobileCards = document.getElementById('mobile-cards');
    if (desktopGrid) desktopGrid.innerHTML = '<div class="p-8 text-center text-gray-400">Carregando...</div>';
    if (mobileCards) mobileCards.innerHTML = createSkeletonCards(5);

    // Load reservas with real-time listener
    unsubscribeReservas = onReservasChange(datesISO, (reservas) => {
        reservasCache = reservas;
        renderCalendar();
    });
}

/**
 * Renderiza o calendário (desktop grid + mobile cards)
 */
function renderCalendar() {
    renderDesktopGrid();
    renderMobileCards();
}

/**
 * Retorna os laboratórios filtrados
 */
function getFilteredLabs() {
    const activeChip = document.querySelector('.lab-chip.active');
    const selectedLab = activeChip?.dataset.lab || 'all';
    let labs = laboratorios.filter(l => l.ativo !== false);
    if (selectedLab !== 'all') {
        labs = labs.filter(l => l.id === selectedLab);
    }
    return labs;
}

/**
 * Renderiza a grade semanal para desktop
 */
function renderDesktopGrid() {
    const container = document.getElementById('desktop-grid');
    if (!container) return;

    const weekDates = getWeekDates(currentWeekDate);
    const turnoConfig = SCHEDULE_CONFIG[currentTurno];
    const labs = getFilteredLabs();

    if (labs.length === 0) {
        container.innerHTML = `
            <div class="p-12 text-center text-gray-400">
                <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                </svg>
                <p class="text-lg font-medium">Nenhum laboratório encontrado</p>
                <p class="text-sm mt-1">Cadastre laboratórios no Painel Administrativo</p>
            </div>`;
        return;
    }

    let html = `
        <div class="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table class="w-full border-collapse min-w-[900px]">
                <thead>
                    <tr class="bg-gradient-to-r from-slate-800 to-slate-700">
                        <th class="p-3 text-left text-white text-sm font-semibold border-r border-slate-600 min-w-[100px] sticky left-0 bg-slate-800 z-10">
                            ${turnoConfig.icon} ${turnoConfig.label}
                        </th>`;

    // Header: dias da semana com labs
    weekDates.forEach((date, di) => {
        const dayName = DIAS_SEMANA[di]?.label || '';
        const dateStr = formatDateBR(date);
        const todayClass = isToday(date) ? 'bg-indigo-700' : '';
        const colSpan = labs.length;
        html += `<th colspan="${colSpan}" class="p-3 text-center text-white text-sm font-semibold border-r border-slate-600 ${todayClass}">
            <div class="font-bold">${dayName}</div>
            <div class="text-xs font-normal opacity-80">${dateStr}</div>
        </th>`;
    });
    html += `</tr>`;

    // Sub-header: nomes dos labs
    html += `<tr class="bg-slate-100">
        <th class="p-2 text-xs text-gray-600 border-r border-gray-200 sticky left-0 bg-slate-100 z-10">Horário</th>`;
    weekDates.forEach(() => {
        labs.forEach(lab => {
            html += `<th class="p-2 text-xs text-gray-600 border-r border-gray-200 text-center min-w-[130px]">
                <div class="font-semibold">${escapeHTML(lab.nome)}</div>
                <div class="text-gray-400">${escapeHTML(lab.descricao || '')}</div>
            </th>`;
        });
    });
    html += `</tr></thead><tbody>`;

    // Linhas: cada aula do turno
    turnoConfig.aulas.forEach((aula, ai) => {
        // Intervalo
        if (turnoConfig.intervalo && aula.numero === turnoConfig.intervalo.aposAula + 1) {
            html += `<tr class="bg-amber-50/50">
                <td colspan="${1 + weekDates.length * labs.length}" class="p-2 text-center text-xs font-medium text-amber-700 border-r border-gray-200 sticky left-0 bg-amber-50/50 z-10">
                    ☕ Intervalo (${turnoConfig.intervalo.inicio} - ${turnoConfig.intervalo.fim})
                </td>
            </tr>`;
        }

        html += `<tr class="hover:bg-gray-50/50 transition-colors">
            <td class="p-2 border-r border-gray-200 text-xs font-medium text-gray-700 sticky left-0 bg-white z-10">
                <div class="font-bold">${aula.numero}ª Aula</div>
                <div class="text-gray-400">${aula.inicio}-${aula.fim}</div>
            </td>`;

        weekDates.forEach(date => {
            const dateISO = formatDateISO(date);
            labs.forEach(lab => {
                const reserva = reservasCache.find(r =>
                    r.labId === lab.id &&
                    r.data === dateISO &&
                    r.turno === currentTurno &&
                    (r.aulas || []).includes(aula.numero)
                );

                if (reserva) {
                    const statusCfg = STATUS_CONFIG[reserva.status] || STATUS_CONFIG.livre;
                    html += `<td class="p-1 border-r border-gray-200 cursor-pointer transition-all hover:brightness-110"
                        onclick="window.dispatchEvent(new CustomEvent('view-reserva', {detail: '${reserva.id}'}))">
                        <div class="rounded-lg p-1.5 text-[10px] leading-tight ${statusCfg.bgClass} ${statusCfg.textClass} h-full min-h-[50px]">
                            <div class="font-bold truncate">${escapeHTML(reserva.turma || '')}</div>
                            <div class="truncate opacity-90">${escapeHTML(reserva.disciplina || '')}</div>
                            <div class="truncate opacity-80">${escapeHTML(reserva.professorNome || '')}</div>
                        </div>
                    </td>`;
                } else {
                    html += `<td class="p-1 border-r border-gray-200 cursor-pointer hover:bg-emerald-50 transition-colors group"
                        onclick="window.dispatchEvent(new CustomEvent('new-reserva', {detail: {labId: '${lab.id}', labNome: '${escapeHTML(lab.nome)}', data: '${dateISO}', turno: '${currentTurno}', aula: ${aula.numero}}}))">
                        <div class="rounded-lg p-1.5 text-[10px] leading-tight border-2 border-dashed border-gray-200 group-hover:border-emerald-400 h-full min-h-[50px] flex items-center justify-center text-gray-300 group-hover:text-emerald-500 transition-colors">
                            <span class="hidden group-hover:inline">+ Reservar</span>
                        </div>
                    </td>`;
                }
            });
        });

        html += `</tr>`;
    });

    html += `</tbody></table></div>`;

    // Legenda
    html += `
        <div class="flex flex-wrap items-center justify-center gap-4 mt-4 text-xs text-gray-600">
            ${Object.entries(STATUS_CONFIG).map(([key, cfg]) => `
                <div class="flex items-center gap-1.5">
                    <span class="w-3 h-3 rounded-full ${cfg.bgClass}"></span>
                    <span>${cfg.label}</span>
                </div>
            `).join('')}
        </div>`;

    container.innerHTML = html;
}

/**
 * Renderiza os cards para mobile
 */
function renderMobileCards() {
    const container = document.getElementById('mobile-cards');
    if (!container) return;

    const weekDates = getWeekDates(currentWeekDate);
    const turnoConfig = SCHEDULE_CONFIG[currentTurno];
    const labs = getFilteredLabs();

    if (labs.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 py-8">Nenhum laboratório cadastrado.</div>`;
        return;
    }

    let html = '';

    weekDates.forEach(date => {
        const dateISO = formatDateISO(date);
        const dayName = getDayName(date);
        const todayClass = isToday(date) ? 'ring-2 ring-indigo-500' : '';

        html += `
        <div class="mb-4">
            <div class="flex items-center gap-2 mb-2 px-1">
                <div class="w-8 h-8 rounded-lg ${isToday(date) ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'} flex items-center justify-center text-sm font-bold">
                    ${date.getDate()}
                </div>
                <div>
                    <div class="font-semibold text-gray-800 text-sm">${dayName}</div>
                    <div class="text-xs text-gray-400">${formatDateBR(date)}</div>
                </div>
            </div>`;

        labs.forEach(lab => {
            const labReservas = reservasCache.filter(r =>
                r.labId === lab.id &&
                r.data === dateISO &&
                r.turno === currentTurno
            );

            turnoConfig.aulas.forEach(aula => {
                const reserva = labReservas.find(r => (r.aulas || []).includes(aula.numero));

                if (reserva) {
                    const statusCfg = STATUS_CONFIG[reserva.status] || STATUS_CONFIG.livre;
                    html += `
                    <div class="mb-2 rounded-xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-transform ${todayClass}"
                        onclick="window.dispatchEvent(new CustomEvent('view-reserva', {detail: '${reserva.id}'}))">
                        <div class="h-1.5 ${statusCfg.bgClass}"></div>
                        <div class="p-3 bg-white">
                            <div class="flex items-center justify-between mb-1.5">
                                <span class="text-xs font-bold text-gray-800">${escapeHTML(lab.nome)}</span>
                                <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusCfg.badgeClass}">${statusCfg.label}</span>
                            </div>
                            <div class="text-xs text-gray-500 mb-1">${aula.numero}ª aula · ${aula.inicio} - ${aula.fim}</div>
                            <div class="text-sm font-semibold text-gray-900">${escapeHTML(reserva.turma || '')} — ${escapeHTML(reserva.disciplina || '')}</div>
                            <div class="text-xs text-gray-500 mt-0.5">${escapeHTML(reserva.professorNome || '')}</div>
                        </div>
                    </div>`;
                } else {
                    html += `
                    <div class="mb-2 rounded-xl border-2 border-dashed border-gray-200 p-3 flex items-center justify-between cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all active:scale-[0.98]"
                        onclick="window.dispatchEvent(new CustomEvent('new-reserva', {detail: {labId: '${lab.id}', labNome: '${escapeHTML(lab.nome)}', data: '${dateISO}', turno: '${currentTurno}', aula: ${aula.numero}}}))">
                        <div>
                            <div class="text-xs font-bold text-gray-400">${escapeHTML(lab.nome)}</div>
                            <div class="text-xs text-gray-300">${aula.numero}ª aula · ${aula.inicio} - ${aula.fim}</div>
                        </div>
                        <span class="text-emerald-500 text-xs font-semibold">+ Reservar</span>
                    </div>`;
                }
            });
        });

        html += `</div>`;
    });

    container.innerHTML = html;
}

/**
 * Retorna o turno atualmente selecionado
 */
export function getCurrentTurno() {
    return currentTurno;
}

/**
 * Retorna os laboratórios carregados
 */
export function getLoadedLabs() {
    return laboratorios;
}

/**
 * Recarrega os dados da semana
 */
export function refreshCalendar() {
    loadWeekData();
}

/**
 * Destrói listeners
 */
export function destroyCalendarView() {
    if (unsubscribeReservas) {
        unsubscribeReservas();
        unsubscribeReservas = null;
    }
}

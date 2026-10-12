// ============================================================
// calendar-view.js
// Renderização do calendário para visualização de UM DIA
// Exibe Nome do Curso, Sigla e Nome do Professor nos cards
// ============================================================

import { SCHEDULE_CONFIG, STATUS_CONFIG, getAulaShortLabel, getDisciplinaSigla, getCursoSigla, formatShortProfessorName } from './schedule-config.js';
import { 
    formatDateISO, formatDateBR, getDayLabel, 
    getDayName, isToday, addDays, escapeHTML 
} from './utils.js';
import { onReservasChange, getLaboratorios, getCursos, getDisciplinas, normalizeDate } from './sheet-service.js';
import { createSkeletonCards } from './ui-helpers.js';

let currentDate = new Date();
currentDate.setHours(12, 0, 0, 0);

let currentTurno = 'noite';
let laboratorios = [];
let cursosCache = [];
let disciplinasCache = [];
let reservasCache = [];
let unsubscribeReservas = null;
let calendarControlsInitialized = false;

/**
 * Inicializa o calendar view
 */
export async function initCalendarView() {
    await loadInitialData();
    setupCalendarControls();
    await loadDayData();
}

/**
 * Carrega laboratórios, cursos e disciplinas
 */
async function loadInitialData() {
    try {
        [laboratorios, cursosCache, disciplinasCache] = await Promise.all([
            getLaboratorios(),
            getCursos(),
            getDisciplinas()
        ]);
    } catch (err) {
        console.error('Erro ao carregar dados iniciais do calendário:', err);
    }
}

/**
 * Configura os controles do calendário (navegação de dias, turnos, data)
 */
function setupCalendarControls() {
    if (calendarControlsInitialized) return;
    calendarControlsInitialized = true;

    // Navegação dia a dia (anterior / próximo) - avança ou recua exatamente 1 dia consecutivo por clique
    const prevBtn = document.getElementById('prev-day') || document.getElementById('prev-week');
    if (prevBtn) {
        prevBtn.onclick = (e) => {
            e.preventDefault();
            currentDate = addDays(currentDate, -1);
            loadDayData();
        };
    }
    
    const nextBtn = document.getElementById('next-day') || document.getElementById('next-week');
    if (nextBtn) {
        nextBtn.onclick = (e) => {
            e.preventDefault();
            currentDate = addDays(currentDate, 1);
            loadDayData();
        };
    }

    // Botão "Hoje"
    const todayBtn = document.getElementById('today-btn');
    if (todayBtn) {
        todayBtn.onclick = (e) => {
            e.preventDefault();
            const today = new Date();
            today.setHours(12, 0, 0, 0);
            currentDate = today;
            loadDayData();
        };
    }

    // Seletores de turno
    document.querySelectorAll('[data-turno]').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('[data-turno]').forEach(b => {
                b.classList.remove('active', 'bg-indigo-600', 'text-white');
                b.classList.add('bg-white', 'text-gray-700');
            });
            btn.classList.add('active', 'bg-indigo-600', 'text-white');
            btn.classList.remove('bg-white', 'text-gray-700');
            currentTurno = btn.dataset.turno;
            renderCalendar();
        };
    });

    // Date picker
    const datePicker = document.getElementById('date-picker');
    if (datePicker) {
        datePicker.onchange = (e) => {
            if (!e.target.value) return;
            currentDate = new Date(e.target.value + 'T12:00:00');
            loadDayData();
        };
    }
}

/**
 * Carrega dados do dia selecionado e inicializa listener em tempo real
 */
async function loadDayData() {
    const dateISO = formatDateISO(currentDate);

    // Atualiza label do dia (ex: "Quarta-feira, 24 de Setembro de 2026")
    const dayLabel = document.getElementById('calendar-day-label') || document.getElementById('week-label');
    if (dayLabel) {
        dayLabel.innerHTML = `
            <span class="inline-flex items-center gap-1.5 font-semibold text-gray-800">
                📅 ${getDayLabel(currentDate)}
                ${isToday(currentDate) ? '<span class="ml-1 text-[11px] px-2 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-700">Hoje</span>' : ''}
            </span>
        `;
    }

    // Atualiza valor do input date picker
    const datePicker = document.getElementById('date-picker');
    if (datePicker) datePicker.value = dateISO;

    // Remove listener anterior se existente
    if (unsubscribeReservas) unsubscribeReservas();

    // Skeletons de carregamento apenas se não houver dados em cache
    const desktopGrid = document.getElementById('desktop-grid');
    const mobileCards = document.getElementById('mobile-cards');
    if (laboratorios.length === 0) {
        if (desktopGrid) desktopGrid.innerHTML = `
            <div class="p-12 text-center text-gray-400">
                <div class="loader-spinner mx-auto mb-3"></div>
                <p class="text-sm font-medium">Carregando horários do dia...</p>
            </div>`;
        if (mobileCards) mobileCards.innerHTML = createSkeletonCards(3);
    }

    // Escuta reservas para o dia específico em tempo real
    unsubscribeReservas = onReservasChange([dateISO], (reservas) => {
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
 * Retorna os laboratórios ativos
 */
function getActiveLabs() {
    return laboratorios.filter(l => l.ativo !== false);
}

/**
 * Extrai o Nome do Curso, Sigla e Nome do Professor para o card
 */
function getReservaDisplayData(reserva) {
    let displayCursoNome = reserva.cursoNome || '';
    let displayCursoSigla = reserva.cursoSigla || '';

    // Se não houver curso salvo diretamente mas houver cursoId, busca no cache de cursos
    if (!displayCursoNome && reserva.cursoId && cursosCache.length > 0) {
        const cObj = cursosCache.find(c => c.id === reserva.cursoId);
        if (cObj) {
            displayCursoNome = cObj.nome || '';
            if (!displayCursoSigla) displayCursoSigla = cObj.sigla || '';
        }
    }

    // Se ainda não tiver curso, usa a Turma como referência
    if (!displayCursoNome) {
        displayCursoNome = reserva.turmaNome || reserva.turma || '';
    }

    if (!displayCursoSigla && displayCursoNome) {
        displayCursoSigla = getCursoSigla(displayCursoNome);
    }

    const turmaRaw = reserva.turmaNome || reserva.turma || '';
    let turmaCurta = turmaRaw;
    if (turmaCurta.length > 8) {
        const mDiv = turmaCurta.match(/(\d+-DIV|INT)/i);
        if (mDiv) turmaCurta = mDiv[1].toUpperCase();
    }

    const professorNome = reserva.professorNome || 'Sem professor';
    const professorCurto = formatShortProfessorName(professorNome);

    // Obtém a sigla da disciplina
    let discSigla = reserva.disciplinaSigla || '';
    const rawDisc = reserva.disciplinaNome || reserva.disciplina || '';
    if (!discSigla && rawDisc) {
        const discObj = disciplinasCache.find(d =>
            d.nome?.toLowerCase().trim() === rawDisc.toLowerCase().trim() ||
            String(d.id) === String(rawDisc)
        );
        discSigla = discObj?.sigla || getDisciplinaSigla(rawDisc);
    }
    if (!discSigla && rawDisc) {
        discSigla = getDisciplinaSigla(rawDisc) || rawDisc;
    }

    return {
        cursoNome: displayCursoNome || 'Sem curso',
        cursoSigla: displayCursoSigla || displayCursoNome || 'Curso',
        turmaNome: turmaRaw,
        turmaCurta: turmaCurta,
        professorNome,
        professorCurto,
        disciplinaNome: rawDisc || discSigla,
        disciplinaSigla: discSigla || rawDisc
    };
}

/**
 * Renderiza a grade para visualização de UM DIA no Desktop
 */
function renderDesktopGrid() {
    const container = document.getElementById('desktop-grid');
    if (!container) return;

    const turnoConfig = SCHEDULE_CONFIG[currentTurno];
    const labs = getActiveLabs();
    const dateISO = formatDateISO(currentDate);

    if (labs.length === 0) {
        container.innerHTML = `
            <div class="p-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-200">
                <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                </svg>
                <p class="text-lg font-medium">Nenhum laboratório cadastrado</p>
                <p class="text-sm mt-1">Cadastre laboratórios no Painel Administrativo.</p>
            </div>`;
        return;
    }

    const isCompact = labs.length >= 6;
    const isUltraCompact = labs.length >= 9;

    const cellPadding = isUltraCompact ? 'p-0.5' : (isCompact ? 'p-1' : 'p-1.5');
    const cardPadding = isUltraCompact ? 'p-1' : (isCompact ? 'p-1.5' : 'p-2');
    const discTextSize = isUltraCompact ? 'text-[11px]' : (isCompact ? 'text-xs' : 'text-xs');
    const turmaBadgeSize = isUltraCompact ? 'text-[8px] px-0.5 py-0.2' : 'text-[9px] px-1 py-0.5';
    const subTextSize = isUltraCompact ? 'text-[9px]' : (isCompact ? 'text-[10px]' : 'text-[11px]');
    const emptyMinHeight = isUltraCompact ? 'min-h-[38px]' : (isCompact ? 'min-h-[42px]' : 'min-h-[46px]');
    const aulaColWidth = isUltraCompact ? 'w-[72px] min-w-[70px]' : (isCompact ? 'w-[80px] min-w-[76px]' : 'w-[92px] min-w-[85px]');

    let html = `
        <div class="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <!-- Cabeçalho do Dia e Turno -->
            <div class="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                    <span class="text-xl">${turnoConfig.icon}</span>
                    <div>
                        <div class="font-extrabold text-sm sm:text-base tracking-wide flex items-center gap-2">
                            ${getDayName(currentDate)}, ${formatDateBR(currentDate)}
                            ${isToday(currentDate) ? '<span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500 text-white shadow-sm">HOJE</span>' : ''}
                        </div>
                        <div class="text-xs text-slate-300 font-normal">Turno da ${turnoConfig.label} · ${labs.length} ${labs.length === 1 ? 'Laboratório' : 'Laboratórios'}</div>
                    </div>
                </div>
                <div class="text-xs text-slate-300 hidden sm:flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Atualização em tempo real</span>
                </div>
            </div>

            <table class="w-full table-fixed border-collapse">
                <thead>
                    <tr class="bg-slate-100 border-b border-gray-200">
                        <th class="px-1 sm:px-1.5 py-2 text-center text-xs font-bold text-gray-700 border-r border-gray-200 ${aulaColWidth} sticky left-0 bg-slate-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            Aula
                        </th>
                        ${labs.map(lab => `
                            <th class="px-1 sm:px-2 py-2 text-center border-r border-gray-200 min-w-0">
                                <div class="font-extrabold text-gray-900 ${isUltraCompact ? 'text-[11px]' : 'text-xs'} truncate" title="${escapeHTML(lab.nome)}">
                                    ${escapeHTML(lab.nome)}
                                </div>
                                ${lab.descricao ? `
                                    <div class="text-[9px] text-gray-400 font-normal mt-0.5 truncate ${isUltraCompact ? 'hidden xl:block' : ''}" title="${escapeHTML(lab.descricao)}">
                                        ${escapeHTML(lab.descricao)}
                                    </div>` : ''}
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>`;

    // Linhas: cada aula do turno selecionado
    turnoConfig.aulas.forEach((aula) => {
        // Indicador de Intervalo entre as aulas
        if (turnoConfig.intervalo && aula.numero === turnoConfig.intervalo.aposAula + 1) {
            html += `
                <tr class="bg-amber-50/70 border-y border-amber-200">
                    <td colspan="${1 + labs.length}" class="py-1.5 px-2 text-center text-xs font-bold text-amber-800 sticky left-0 bg-amber-50/90 z-10">
                        ☕ Intervalo do Turno (${turnoConfig.intervalo.inicio} às ${turnoConfig.intervalo.fim})
                    </td>
                </tr>`;
        }

        html += `
            <tr class="hover:bg-slate-50/60 transition-colors border-b border-gray-100">
                <td class="px-1 sm:px-1.5 py-2 border-r border-gray-200 text-center sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] ${aulaColWidth}">
                    <div class="font-extrabold text-gray-900 whitespace-nowrap ${isCompact ? 'text-[11px]' : 'text-xs'}">${aula.numero}ª Aula</div>
                    <div class="text-gray-500 whitespace-nowrap ${isCompact ? 'text-[9px]' : 'text-[10px]'} mt-0.5 font-medium">${aula.inicio} - ${aula.fim}</div>
                </td>`;

        labs.forEach(lab => {
            const reserva = reservasCache.find(r =>
                String(r.labId) === String(lab.id) &&
                normalizeDate(r.data) === dateISO &&
                r.turno === currentTurno &&
                (r.aulas || []).includes(aula.numero)
            );

            if (reserva) {
                const statusCfg = STATUS_CONFIG[reserva.status] || STATUS_CONFIG.livre;
                const { cursoNome, cursoSigla, turmaCurta, professorNome, professorCurto, disciplinaNome, disciplinaSigla } = getReservaDisplayData(reserva);

                html += `
                    <td class="${cellPadding} border-r border-gray-200 cursor-pointer transition-all hover:scale-[1.01] min-w-0"
                        onclick="window.dispatchEvent(new CustomEvent('view-reserva', {detail: '${reserva.id}'}))"
                        title="📖 Disciplina: ${escapeHTML(disciplinaNome)} (${escapeHTML(disciplinaSigla)})&#10;🎓 Curso: ${escapeHTML(cursoNome)}${turmaCurta ? ` · ${escapeHTML(turmaCurta)}` : ''}&#10;👤 Professor: ${escapeHTML(professorNome)}&#10;🏷️ Status: ${statusCfg.label}">
                        <div class="rounded-lg ${cardPadding} text-xs ${statusCfg.bgClass} ${statusCfg.textClass} shadow-xs border ${statusCfg.borderClass} hover:brightness-105 transition-all overflow-hidden">
                            <!-- Linha 1: SIGLA DA DISCIPLINA EM DESTAQUE + TURMA -->
                            <div class="flex items-center justify-between gap-1 leading-none mb-1 min-w-0">
                                <span class="font-black ${discTextSize} tracking-tight truncate drop-shadow-xs" title="${escapeHTML(disciplinaNome)}">${escapeHTML(disciplinaSigla)}</span>
                                ${turmaCurta ? `<span class="${turmaBadgeSize} rounded font-black bg-black/20 text-white flex-shrink-0 leading-none truncate max-w-[50%]" title="${escapeHTML(reserva.turmaNome || reserva.turma || '')}">${escapeHTML(turmaCurta)}</span>` : ''}
                            </div>

                            <!-- Linha 2: Curso Abreviado -->
                            <div class="truncate ${subTextSize} font-semibold opacity-90 leading-tight mb-0.5" title="${escapeHTML(cursoNome)}">
                                🎓 ${escapeHTML(cursoSigla)}
                            </div>

                            <!-- Linha 3: Professor Abreviado -->
                            <div class="truncate ${subTextSize} font-medium opacity-95 leading-tight" title="${escapeHTML(professorNome)}">
                                👤 ${escapeHTML(professorCurto)}
                            </div>
                        </div>
                    </td>`;
            } else {
                html += `
                    <td class="${cellPadding} border-r border-gray-200 cursor-pointer hover:bg-emerald-50/50 transition-colors group min-w-0"
                        onclick="window.dispatchEvent(new CustomEvent('new-reserva', {detail: {labId: '${lab.id}', labNome: '${escapeHTML(lab.nome)}', data: '${dateISO}', turno: '${currentTurno}', aula: ${aula.numero}}}))"
                        title="Disponível · Clique para reservar">
                        <div class="rounded-lg ${cardPadding} border-2 border-dashed border-gray-200 group-hover:border-emerald-400 h-full ${emptyMinHeight} flex items-center justify-center text-gray-300 group-hover:text-emerald-600 transition-all font-semibold overflow-hidden">
                            <span class="hidden group-hover:inline-flex items-center gap-0.5 ${subTextSize} font-bold text-emerald-600 truncate">+ Reservar</span>
                            <span class="group-hover:hidden text-gray-300 ${subTextSize} font-normal">Livre</span>
                        </div>
                    </td>`;
            }
        });

        html += `</tr>`;
    });

    html += `</tbody></table></div>`;

    // Legenda de Status
    html += `
        <div class="flex flex-wrap items-center justify-center gap-5 mt-4 py-2 px-4 bg-white rounded-xl border border-gray-100 text-xs text-gray-600 shadow-sm">
            <span class="font-bold text-gray-400 uppercase text-[10px] tracking-wider">Legenda:</span>
            ${Object.entries(STATUS_CONFIG).map(([key, cfg]) => `
                <div class="flex items-center gap-1.5">
                    <span class="w-3 h-3 rounded-full ${cfg.bgClass} shadow-xs"></span>
                    <span class="font-medium">${cfg.label}</span>
                </div>
            `).join('')}
        </div>`;

    container.innerHTML = html;
}

/**
 * Renderiza os cards para Mobile focando em UM DIA
 */
function renderMobileCards() {
    const container = document.getElementById('mobile-cards');
    if (!container) return;

    const turnoConfig = SCHEDULE_CONFIG[currentTurno];
    const labs = getActiveLabs();
    const dateISO = formatDateISO(currentDate);

    if (labs.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 py-8 bg-white rounded-2xl border border-gray-200">Nenhum laboratório cadastrado ou ativo.</div>`;
        return;
    }

    let html = `
        <!-- Card Resumo do Dia -->
        <div class="mb-4 bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-xl ${isToday(currentDate) ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-slate-100 text-slate-800'} flex items-center justify-center text-base font-extrabold shadow-sm">
                        ${currentDate.getDate()}
                    </div>
                    <div>
                        <div class="font-extrabold text-gray-900 text-sm flex items-center gap-2">
                            ${getDayName(currentDate)}
                            ${isToday(currentDate) ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">Hoje</span>' : ''}
                        </div>
                        <div class="text-xs text-gray-400 mt-0.5">${formatDateBR(currentDate)} · Turno da ${turnoConfig.label}</div>
                    </div>
                </div>
                <div class="text-2xl">${turnoConfig.icon}</div>
            </div>
        </div>
    `;

    labs.forEach(lab => {
        const labReservas = reservasCache.filter(r =>
            String(r.labId) === String(lab.id) &&
            normalizeDate(r.data) === dateISO &&
            r.turno === currentTurno
        );

        html += `
            <div class="mb-5 bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div class="flex items-center justify-between border-b border-gray-100 pb-2.5 mb-3">
                    <div>
                        <h3 class="font-bold text-gray-900 text-sm">${escapeHTML(lab.nome)}</h3>
                    </div>
                    <span class="text-xs px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold">
                        ${labReservas.length} / ${turnoConfig.aulas.length} ocupadas
                    </span>
                </div>
                <div class="space-y-2">`;

        turnoConfig.aulas.forEach(aula => {
            const reserva = labReservas.find(r => (r.aulas || []).includes(aula.numero));

            if (reserva) {
                const statusCfg = STATUS_CONFIG[reserva.status] || STATUS_CONFIG.livre;
                const { cursoNome, cursoSigla, turmaCurta, professorNome, professorCurto, disciplinaNome, disciplinaSigla } = getReservaDisplayData(reserva);

                html += `
                    <div class="rounded-xl overflow-hidden shadow-xs border border-gray-200 cursor-pointer active:scale-[0.98] transition-all bg-white"
                        onclick="window.dispatchEvent(new CustomEvent('view-reserva', {detail: '${reserva.id}'}))">
                        <div class="h-1.5 ${statusCfg.bgClass}"></div>
                        <div class="p-3">
                            <div class="flex items-center justify-between mb-1.5">
                                <span class="text-xs font-bold text-indigo-700">${aula.numero}ª Aula (${aula.inicio} - ${aula.fim})</span>
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCfg.badgeClass}">${statusCfg.label}</span>
                            </div>
                            <div class="flex items-center justify-between gap-2 mb-1.5">
                                <div class="flex items-center gap-1.5 truncate">
                                    <span class="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-xs font-black flex-shrink-0">${escapeHTML(disciplinaSigla)}</span>
                                    <span class="text-xs font-bold text-gray-800 truncate" title="${escapeHTML(disciplinaNome)}">${escapeHTML(disciplinaNome)}</span>
                                </div>
                                ${turmaCurta ? `<span class="text-[10px] px-1.5 py-0.5 rounded font-extrabold bg-gray-100 text-gray-800 flex-shrink-0">${escapeHTML(turmaCurta)}</span>` : ''}
                            </div>
                            <div class="flex items-center justify-between text-xs text-gray-600 font-medium pt-1.5 border-t border-gray-100">
                                <span class="truncate" title="${escapeHTML(cursoNome)}">🎓 ${escapeHTML(cursoSigla)}</span>
                                <span class="truncate font-semibold text-gray-800" title="${escapeHTML(professorNome)}">👤 ${escapeHTML(professorCurto)}</span>
                            </div>
                        </div>
                    </div>`;
            } else {
                html += `
                    <div class="rounded-xl border-2 border-dashed border-gray-200 p-3 flex items-center justify-between cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all active:scale-[0.98]"
                        onclick="window.dispatchEvent(new CustomEvent('new-reserva', {detail: {labId: '${lab.id}', labNome: '${escapeHTML(lab.nome)}', data: '${dateISO}', turno: '${currentTurno}', aula: ${aula.numero}}}))">
                        <div>
                            <div class="text-xs font-bold text-gray-700">${aula.numero}ª aula</div>
                            <div class="text-xs text-gray-400">${aula.inicio} - ${aula.fim}</div>
                        </div>
                        <span class="text-emerald-600 text-xs font-bold px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200">+ Reservar</span>
                    </div>`;
            }
        });

        html += `
                </div>
            </div>`;
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
 * Retorna a data selecionada atualmente
 */
export function getCurrentDate() {
    return currentDate;
}

/**
 * Retorna os laboratórios carregados
 */
export function getLoadedLabs() {
    return laboratorios;
}

/**
 * Recarrega os dados do dia e caches de labs/cursos
 */
export async function refreshCalendar() {
    await loadInitialData();
    await loadDayData();
}

/**
 * Sincroniza e exibe a nova reserva instantaneamente no calendário (0ms)
 * Se a reserva for para outra data ou turno, posiciona o calendário automaticamente
 */
export function syncNewReservaInstant(reserva) {
    if (!reserva) return;

    const resDateISO = normalizeDate(reserva.data);
    const resTurno = reserva.turno;

    // Posiciona o calendário na data da reserva
    if (resDateISO && formatDateISO(currentDate) !== resDateISO) {
        currentDate = new Date(resDateISO + 'T12:00:00');
    }

    // Posiciona o calendário no turno da reserva
    if (resTurno && SCHEDULE_CONFIG[resTurno]) {
        currentTurno = resTurno;
        document.querySelectorAll('[data-turno]').forEach(b => {
            if (b.dataset.turno === resTurno) {
                b.classList.add('active', 'bg-indigo-600', 'text-white');
                b.classList.remove('bg-white', 'text-gray-700');
            } else {
                b.classList.remove('active', 'bg-indigo-600', 'text-white');
                b.classList.add('bg-white', 'text-gray-700');
            }
        });
    }

    // Carrega e renderiza o calendário instantaneamente
    loadDayData();
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

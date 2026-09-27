// ============================================================
// export-service.js
// Exportação de dados do calendário para Excel (.xlsx) e CSV
// Permite download com ou sem reservas para visão geral dos administradores
// ============================================================

import { SCHEDULE_CONFIG } from './schedule-config.js';
import { formatDateBR, formatDateISO, getDayName, getWeekDates } from './utils.js';
import { getLaboratorios, getReservasSemana } from './sheet-service.js';
import { showToast, showLoader, openModal, closeModal } from './ui-helpers.js';
import { getCurrentDate, getCurrentTurno } from './calendar-view.js';
import { isAdmin } from './auth.js';
import { getSheetApiUrl, isApiConfigured } from './sheet-config.js';

/**
 * Inicializa os controles e eventos de exportação de planilha
 */
export function initExportService() {
    setupExportEventListeners();
}

/**
 * Configura listeners dos botões de exportação e do modal
 */
function setupExportEventListeners() {
    // Botão na barra de controles do calendário
    document.getElementById('admin-export-calendar-btn')?.addEventListener('click', () => {
        openExportModal();
    });

    // Botão no painel administrativo
    document.getElementById('admin-export-panel-btn')?.addEventListener('click', () => {
        openExportModal();
    });

    // Botão de confirmação de download dentro do modal
    document.getElementById('confirm-export-calendar-btn')?.addEventListener('click', async () => {
        await handleExportSubmit();
    });

    // Botão de abrir no Google Planilhas
    document.getElementById('open-in-google-sheets-btn')?.addEventListener('click', () => {
        handleOpenGoogleSheets();
    });

    // Fechar ao clicar no backdrop
    document.getElementById('export-calendar-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'export-calendar-modal' || e.target.classList.contains('modal-backdrop')) {
            closeModal('export-calendar-modal');
        }
    });

    // Feedback visual ao alternar opções de radio no modal
    document.querySelectorAll('#export-calendar-modal input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => {
            updateModalRadioVisuals();
        });
    });
}

/**
 * Atualiza o estilo dos cartões de seleção no modal de exportação
 */
function updateModalRadioVisuals() {
    ['export-mode', 'export-scope', 'export-format'].forEach(groupName => {
        const checked = document.querySelector(`input[name="${groupName}"]:checked`);
        document.querySelectorAll(`input[name="${groupName}"]`).forEach(r => {
            const card = r.closest('label');
            if (!card) return;
            if (r === checked) {
                card.classList.add('border-indigo-600', 'bg-indigo-50/50');
                card.classList.remove('border-gray-200');
            } else {
                card.classList.remove('border-indigo-600', 'bg-indigo-50/50');
                card.classList.add('border-gray-200');
            }
        });
    });
}

/**
 * Abre o modal de exportação com os dados do calendário atual preenchidos
 */
export function openExportModal() {
    if (!isAdmin()) {
        showToast('Apenas administradores podem exportar a grade de agendamentos.', 'warning');
        return;
    }

    const curDate = getCurrentDate() || new Date();
    const curTurno = getCurrentTurno() || 'noite';

    // Atualiza label do dia atual
    const dayLabelEl = document.getElementById('export-current-day-label');
    if (dayLabelEl) {
        dayLabelEl.textContent = `${getDayName(curDate)}, ${formatDateBR(curDate)}`;
    }

    // Atualiza label da semana atual (Segunda a Sexta)
    const weekLabelEl = document.getElementById('export-current-week-label');
    if (weekLabelEl) {
        const weekDates = getWeekDates(curDate);
        if (weekDates.length >= 5) {
            weekLabelEl.textContent = `${formatDateBR(weekDates[0])} a ${formatDateBR(weekDates[4])}`;
        }
    }

    // Atualiza label do turno atual
    const turnoAtualEl = document.getElementById('export-turno-atual-label');
    if (turnoAtualEl) {
        const tCfg = SCHEDULE_CONFIG[curTurno];
        turnoAtualEl.textContent = `${tCfg?.icon || '🌙'} ${tCfg?.label || 'Atual'}`;
    }

    updateModalRadioVisuals();
    openModal('export-calendar-modal');
}

/**
 * Processa a submissão e dispara o download da planilha
 */
async function handleExportSubmit() {
    if (!isAdmin()) {
        showToast('Apenas administradores podem exportar a planilha.', 'warning');
        return;
    }

    const mode = document.querySelector('input[name="export-mode"]:checked')?.value || 'com-reservas';
    const scope = document.querySelector('input[name="export-scope"]:checked')?.value || 'dia';
    const turnoOption = document.querySelector('input[name="export-turno"]:checked')?.value || 'atual';
    const format = document.querySelector('input[name="export-format"]:checked')?.value || 'xlsx';

    const curDate = getCurrentDate() || new Date();
    const curTurno = getCurrentTurno() || 'noite';

    const selectedTurno = turnoOption === 'atual' ? curTurno : turnoOption;

    try {
        showLoader(true, 'Gerando planilha do calendário...');
        await generateAndDownloadSpreadsheet({
            mode,
            scope,
            turno: selectedTurno,
            date: curDate,
            format
        });
        closeModal('export-calendar-modal');
    } catch (err) {
        console.error('Erro ao gerar planilha:', err);
        showToast('Erro ao exportar planilha: ' + (err.message || err), 'error');
    } finally {
        showLoader(false);
    }
}

/**
 * Abre o Google Planilhas (nova aba ou planilha conectada)
 */
function handleOpenGoogleSheets() {
    if (isApiConfigured()) {
        const apiUrl = getSheetApiUrl();
        // Se houver uma planilha conectada, abre nova planilha ou tela do Google Sheets
        window.open('https://sheets.new', '_blank');
        showToast('Para importar no Google Sheets: Arquivo > Importar > Fazer upload da planilha baixada.', 'info', 7000);
    } else {
        window.open('https://sheets.new', '_blank');
        showToast('Para importar no Google Sheets: Arquivo > Importar > Fazer upload do arquivo.', 'info', 7000);
    }
}

/**
 * Gera os dados da planilha e dispara o download no formato escolhido
 */
async function generateAndDownloadSpreadsheet({ mode, scope, turno, date, format }) {
    // 1. Carrega laboratórios ativos
    const allLabs = await getLaboratorios();
    const labs = allLabs.filter(l => l.ativo !== false);

    if (labs.length === 0) {
        throw new Error('Nenhum laboratório cadastrado ou ativo para exportar.');
    }

    // 2. Determina datas
    let dates = [];
    if (scope === 'semana') {
        dates = getWeekDates(date);
    } else {
        dates = [date];
    }

    // 3. Determina turnos
    let turnosList = [];
    if (turno === 'todos') {
        turnosList = ['manha', 'tarde', 'noite'];
    } else {
        turnosList = [turno];
    }

    // 4. Carrega reservas para o período
    const datesISO = dates.map(d => formatDateISO(d));
    const reservas = await getReservasSemana(datesISO);

    // Normaliza datas das reservas para comparação precisa
    const normalizedReservas = (reservas || []).map(r => ({
        ...r,
        normData: normalizeDate(r.data)
    }));

    // 5. Monta a Grade Matriz (Visual Aulas x Laboratórios)
    const gridAOA = buildCalendarGridAOA({
        dates,
        turnosList,
        labs,
        reservas: normalizedReservas,
        mode
    });

    // 6. Monta a Tabela Detalhada de Agendamentos
    const listAOA = buildReservasTableAOA({
        dates,
        turnosList,
        labs,
        reservas: normalizedReservas,
        mode
    });

    // 7. Nome do arquivo
    const prefix = mode === 'com-reservas' ? 'Calendario_Reservas_ETEC' : 'Modelo_Grade_Horaria_ETEC';
    const dateTag = scope === 'semana'
        ? `${formatDateISO(dates[0])}_a_${formatDateISO(dates[dates.length - 1])}`
        : formatDateISO(dates[0]);
    const fileName = `${prefix}_${dateTag}.${format}`;

    // 8. Exporta conforme formato
    if (format === 'xlsx' && typeof window.XLSX !== 'undefined') {
        exportViaSheetJS({
            fileName,
            gridAOA,
            listAOA,
            mode,
            labsCount: labs.length
        });
        showToast('Planilha Excel (.xlsx) baixada com sucesso!', 'success');
    } else {
        // Fallback para CSV estruturado com UTF-8 BOM
        exportViaCSV({
            fileName: fileName.replace('.xlsx', '.csv'),
            aoaData: gridAOA
        });
        showToast('Planilha CSV compatível com Excel e Google Sheets baixada com sucesso!', 'success');
    }
}

/**
 * Constrói a Matriz da Grade do Calendário (Linhas = Aulas, Colunas = Laboratórios)
 */
function buildCalendarGridAOA({ dates, turnosList, labs, reservas, mode }) {
    const aoa = [];

    // Cabeçalho institucional
    aoa.push(['SISTEMA DE RESERVAS DE LABORATÓRIOS - ETEC DR. DOMINGOS MINICUCCI FILHO (UNIDADE 051)']);
    aoa.push([mode === 'com-reservas' ? 'VISÃO GERAL DO CALENDÁRIO COM RESERVAS DOS PROFESSORES' : 'GRADE HORÁRIA DOS LABORATÓRIOS (MODELO SEM RESERVAS)']);
    aoa.push([`Gerado em: ${new Date().toLocaleString('pt-BR')}`]);
    aoa.push([]); // Linha em branco

    dates.forEach((d) => {
        const dISO = formatDateISO(d);
        const dBR = formatDateBR(d);
        const dNome = getDayName(d);

        turnosList.forEach(tKey => {
            const tCfg = SCHEDULE_CONFIG[tKey];
            if (!tCfg) return;

            // Seção do Dia e Turno
            aoa.push([`📅 ${dNome.toUpperCase()}, ${dBR} — TURNO DA ${tCfg.label.toUpperCase()}`]);

            // Linha de cabeçalho das colunas: Horário/Aula + Nome dos Laboratórios
            const colHeaders = ['Horário / Aula', ...labs.map(l => l.nome)];
            aoa.push(colHeaders);

            // Linhas de cada aula
            tCfg.aulas.forEach(aula => {
                // Indicador de Intervalo antes da aula, se configurado
                if (tCfg.intervalo && aula.numero === tCfg.intervalo.aposAula + 1) {
                    const intervaloRow = [
                        `☕ Intervalo (${tCfg.intervalo.inicio} às ${tCfg.intervalo.fim})`,
                        ...labs.map(() => 'INTERVALO')
                    ];
                    aoa.push(intervaloRow);
                }

                const row = [`${aula.numero}ª Aula (${aula.inicio} - ${aula.fim})`];

                labs.forEach(lab => {
                    if (mode === 'sem-reservas') {
                        row.push('Livre');
                    } else {
                        const res = reservas.find(r =>
                            String(r.labId) === String(lab.id) &&
                            r.normData === dISO &&
                            r.turno === tKey &&
                            (r.aulas || []).includes(aula.numero)
                        );

                        if (res) {
                            const details = [];
                            if (res.professorNome) details.push(`Prof: ${res.professorNome}`);
                            if (res.cursoNome || res.turma) details.push(`Curso: ${res.cursoNome || res.turma}`);
                            const disc = res.disciplinaSigla || res.disciplinaNome || res.disciplina;
                            if (disc) details.push(`Disc: ${disc}`);
                            if (res.status && res.status !== 'confirmado') {
                                details.push(`[${res.status.toUpperCase()}]`);
                            }
                            row.push(details.join(' | '));
                        } else {
                            row.push('Livre');
                        }
                    }
                });

                aoa.push(row);
            });

            aoa.push([]); // Espaço entre turnos
        });

        aoa.push([]); // Espaço entre dias
    });

    return aoa;
}

/**
 * Constrói tabela detalhada de agendamentos (linha a linha)
 */
function buildReservasTableAOA({ dates, turnosList, labs, reservas, mode }) {
    const aoa = [];

    // Cabeçalho da tabela de listagem
    aoa.push([
        'Data',
        'Dia da Semana',
        'Turno',
        'Aula(s)',
        'Laboratório',
        'Professor',
        'Curso',
        'Turma',
        'Disciplina',
        'Sigla',
        'Status',
        'Recursos Extras',
        'Observações',
        'Recorrente'
    ]);

    if (mode === 'sem-reservas') {
        aoa.push(['Nenhuma reserva incluída (Modelo de Grade em Branco).']);
        return aoa;
    }

    const datesISO = dates.map(d => formatDateISO(d));

    // Filtra reservas que pertencem às datas e turnos selecionados
    const filtered = reservas.filter(r =>
        datesISO.includes(r.normData) &&
        turnosList.includes(r.turno)
    );

    // Ordena por data, turno, laboratório e aula
    filtered.sort((a, b) => {
        const dCompare = (a.normData || '').localeCompare(b.normData || '');
        if (dCompare !== 0) return dCompare;
        return (a.labNome || '').localeCompare(b.labNome || '');
    });

    if (filtered.length === 0) {
        aoa.push(['Nenhum agendamento encontrado no período selecionado.']);
        return aoa;
    }

    filtered.forEach(r => {
        const dObj = new Date(r.normData + 'T00:00:00');
        const dBR = formatDateBR(dObj);
        const dNome = getDayName(dObj);
        const tLabel = SCHEDULE_CONFIG[r.turno]?.label || r.turno;
        const aulasTexto = (r.aulas || []).map(a => `${a}ª aula`).join(', ') || 'Todas';

        aoa.push([
            dBR,
            dNome,
            tLabel,
            aulasTexto,
            r.labNome || '',
            r.professorNome || '',
            r.cursoNome || '',
            r.turmaNome || r.turma || '',
            r.disciplinaNome || r.disciplina || '',
            r.disciplinaSigla || '',
            (r.status || 'confirmado').toUpperCase(),
            (r.recursos || r.recursosExtras || []).join(', '),
            r.observacoes || '',
            r.recorrente ? 'Sim' : 'Não'
        ]);
    });

    return aoa;
}

/**
 * Exporta para arquivo Excel (.xlsx) nativo utilizando SheetJS
 */
function exportViaSheetJS({ fileName, gridAOA, listAOA, mode, labsCount }) {
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();

    // 1. Aba: Grade do Calendário (Matriz)
    const wsGrid = XLSX.utils.aoa_to_sheet(gridAOA);
    // Configura largura das colunas
    wsGrid['!cols'] = [
        { wch: 26 }, // Coluna de Horário/Aula
        ...Array(labsCount).fill({ wch: 34 }) // Colunas de cada Laboratório
    ];
    XLSX.utils.book_append_sheet(wb, wsGrid, 'Grade_Calendario');

    // 2. Aba: Listagem Geral de Reservas (apenas se com reservas)
    if (mode === 'com-reservas') {
        const wsList = XLSX.utils.aoa_to_sheet(listAOA);
        wsList['!cols'] = [
            { wch: 12 }, // Data
            { wch: 14 }, // Dia
            { wch: 10 }, // Turno
            { wch: 16 }, // Aulas
            { wch: 22 }, // Lab
            { wch: 25 }, // Professor
            { wch: 25 }, // Curso
            { wch: 25 }, // Turma
            { wch: 25 }, // Disciplina
            { wch: 10 }, // Sigla
            { wch: 14 }, // Status
            { wch: 20 }, // Recursos
            { wch: 30 }, // Observações
            { wch: 12 }  // Recorrente
        ];
        XLSX.utils.book_append_sheet(wb, wsList, 'Lista_Agendamentos');
    }

    XLSX.writeFile(wb, fileName);
}

/**
 * Fallback: Exporta para CSV com UTF-8 BOM e delimitador ponto e vírgula
 */
function exportViaCSV({ fileName, aoaData }) {
    const csvContent = aoaData.map(row => {
        return row.map(cell => {
            const text = String(cell ?? '').replace(/"/g, '""');
            return `"${text}"`;
        }).join(';');
    }).join('\r\n');

    // Adiciona UTF-8 BOM (\uFEFF) para garantir acentos corretos no Excel brasileiro
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

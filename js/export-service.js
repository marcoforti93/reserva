// ============================================================
// export-service.js
// Exportação de dados do calendário para Excel (.xlsx) e CSV
// Formatação fidedigna à grade visual do calendário online
// ============================================================

import { SCHEDULE_CONFIG, STATUS_CONFIG, getDisciplinaSigla } from './schedule-config.js';
import { formatDateBR, formatDateISO, getDayName, getWeekDates } from './utils.js';
import { getLaboratorios, getCursos, getDisciplinas, getReservasSemana, normalizeDate } from './sheet-service.js';
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
        showLoader(true, 'Gerando planilha formatada do calendário...');
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
 * Abre o Google Planilhas para importação
 */
function handleOpenGoogleSheets() {
    window.open('https://sheets.new', '_blank');
    showToast('Dica: No Google Sheets, clique em Arquivo > Importar > Fazer upload para abrir a planilha gerada.', 'info', 7000);
}

/**
 * Configurações visuais e temas de cores por turno (idêntico ao modelo da imagem)
 */
const TURNO_THEMES = {
    manha: {
        label: 'MANHÃ',
        bg: 'D9E1F2', // Azul pastel claro
        aulasCount: 7
    },
    tarde: {
        label: 'TARDE',
        bg: 'FCE4D6', // Pêssego pastel claro
        aulasCount: 6
    },
    noite: {
        label: 'NOITE',
        bg: 'FFF2CC', // Amarelo pastel claro
        aulasCount: 5
    }
};

const HEADER_BG = 'D9D9D9'; // Cinza claro padrão do cabeçalho dos laboratórios

const THIN_BORDER = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } }
};

const FONT_HEADER = { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } };
const FONT_DAY = { name: 'Calibri', sz: 11, bold: true, color: { rgb: '000000' } };
const FONT_SHIFT = { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } };
const FONT_AULA = { name: 'Calibri', sz: 9, bold: true, color: { rgb: '000000' } };
const FONT_CELL = { name: 'Calibri', sz: 9, bold: true, color: { rgb: '000000' } };
const FONT_MAINT = { name: 'Calibri', sz: 9, bold: true, color: { rgb: '991B1B' } };

/**
 * Formata um texto com quebra de linha entre cada letra para exibição vertical (ex: S\nE\nG\nU\nN\nD\nA)
 */
function formatVerticalLetters(text) {
    if (!text) return '';
    return String(text).toUpperCase().split('').join('\n');
}

/**
 * Extrai sigla curta da turma (ex: "3D", "1A", "2B", "1G", "1J", "3C")
 */
function extractShortTurma(turmaStr) {
    if (!turmaStr) return '';
    const clean = String(turmaStr).trim();
    if (clean.length <= 4) return clean.toUpperCase();

    // Procura padrão como 1A, 2B, 3C, 3D, 1G, 1J, 2D, 3-DIV
    const m = clean.match(/\b([1-4][º°]?\s*[A-Z](?:-DIV)?)\b/i) || clean.match(/\b([1-4][A-Z])\b/i);
    if (m) {
        return m[1].replace(/[º°\s]/g, '').toUpperCase();
    }

    // Se tiver parênteses, ex: "(1A)"
    const mParen = clean.match(/\(([^)]+)\)/);
    if (mParen && mParen[1].trim().length <= 4) {
        return mParen[1].trim().toUpperCase();
    }

    // Padrão de curso abreviado com ano: "1º M-TEC Logística" -> "1LOG"
    const mNum = clean.match(/^([1-4])[º°]/);
    if (mNum) {
        const n = mNum[1];
        if (/desenvolvimento/i.test(clean)) return `${n}DS`;
        if (/internet|info/i.test(clean)) return `${n}II`;
        if (/administra/i.test(clean)) return `${n}ADM`;
        if (/log[ií]stica/i.test(clean)) return `${n}LOG`;
        if (/recursos/i.test(clean)) return `${n}RH`;
        if (/marketing/i.test(clean)) return `${n}MKT`;
        if (/contabilidade/i.test(clean)) return `${n}CONT`;
        if (/enfermagem/i.test(clean)) return `${n}ENF`;
        return `${n}º`;
    }

    return clean.substring(0, 5);
}

/**
 * Formata o conteúdo resumido da célula conforme modelo (ex: "EAM 3D", "Juliano 3B", "xxxx")
 */
function formatCompactScheduleCell(res, discList = []) {
    if (!res) return '';

    if (res.status === 'manutencao') {
        return 'xxxx';
    }

    // 1. Sigla da Disciplina
    let sigla = res.disciplinaSigla || '';
    const rawDisc = res.disciplinaNome || res.disciplina || '';
    if (!sigla && rawDisc) {
        const found = discList.find(d =>
            d.nome?.toLowerCase().trim() === rawDisc.toLowerCase().trim() ||
            String(d.id) === String(rawDisc)
        );
        sigla = found?.sigla || getDisciplinaSigla(rawDisc) || '';
    }
    if (!sigla && rawDisc) {
        sigla = getDisciplinaSigla(rawDisc) || rawDisc;
    }
    if (sigla.length > 9) {
        sigla = sigla.substring(0, 9);
    }

    // 2. Primeiro nome do Professor
    const profRaw = (res.professorNome || '').replace(/^(prof\.|profª\.|professor|professora)\s+/i, '').trim();
    const profPrimeiro = profRaw.split(/\s+/)[0] || '';

    // 3. Turma curta
    const turmaRaw = res.turmaNome || res.turma || '';
    const turmaCurta = extractShortTurma(turmaRaw);

    // Prioriza Sigla da Disciplina + Turma; se não houver disciplina, usa Professor + Turma
    if (sigla && sigla.toLowerCase() !== 'sem disciplina') {
        return turmaCurta ? `${sigla} ${turmaCurta}`.trim() : sigla;
    } else if (profPrimeiro) {
        return turmaCurta ? `${profPrimeiro} ${turmaCurta}`.trim() : profPrimeiro;
    } else if (turmaCurta) {
        return turmaCurta;
    }

    return 'Ocupado';
}

/**
 * Constrói a planilha compacta e estilizada em guia única com SheetJS / xlsx-js-style
 */
function buildCompactScheduleWorksheet(XLSX, { dates, turnosList, labs, reservas, mode, discList }) {
    const ws = {};
    const merges = [];
    const rowHeights = [];

    // Linha 0: Cabeçalho dos Laboratórios
    // Colunas A, B, C vazias com fundo cinza e borda
    for (let c = 0; c < 3; c++) {
        const ref = XLSX.utils.encode_cell({ r: 0, c });
        ws[ref] = {
            t: 's',
            v: '',
            s: {
                fill: { patternType: 'solid', fgColor: { rgb: HEADER_BG } },
                border: THIN_BORDER
            }
        };
    }

    // Colunas D em diante: Nome de cada laboratório
    labs.forEach((lab, idx) => {
        const c = 3 + idx;
        const ref = XLSX.utils.encode_cell({ r: 0, c });
        ws[ref] = {
            t: 's',
            v: lab.nome || `LAB ${idx + 1}`,
            s: {
                fill: { patternType: 'solid', fgColor: { rgb: HEADER_BG } },
                font: FONT_HEADER,
                alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
                border: THIN_BORDER
            }
        };
    });
    rowHeights.push({ hpt: 24 });

    let currentRow = 1;

    // Itera por cada dia da semana (empilhados um abaixo do outro)
    dates.forEach((d) => {
        const dISO = formatDateISO(d);
        const dayBase = getDayName(d).replace('-feira', '').toUpperCase();
        const dayVertical = formatVerticalLetters(dayBase);
        const dayStartRow = currentRow;

        turnosList.forEach((tKey) => {
            const theme = TURNO_THEMES[tKey] || { label: tKey.toUpperCase(), bg: 'F2F2F2', aulasCount: 5 };
            const shiftVertical = formatVerticalLetters(theme.label);
            const tCfg = SCHEDULE_CONFIG[tKey];
            const aulas = tCfg?.aulas || Array.from({ length: theme.aulasCount }, (_, i) => ({ numero: i + 1 }));
            const shiftStartRow = currentRow;

            aulas.forEach((aula) => {
                const r = currentRow;

                // Coluna A (Dia da Semana - mesclada depois)
                const refDia = XLSX.utils.encode_cell({ r, c: 0 });
                ws[refDia] = {
                    t: 's',
                    v: r === dayStartRow ? dayVertical : '',
                    s: {
                        fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
                        font: FONT_DAY,
                        alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
                        border: THIN_BORDER
                    }
                };

                // Coluna B (Turno - mesclada depois)
                const refTurno = XLSX.utils.encode_cell({ r, c: 1 });
                ws[refTurno] = {
                    t: 's',
                    v: r === shiftStartRow ? shiftVertical : '',
                    s: {
                        fill: { patternType: 'solid', fgColor: { rgb: theme.bg } },
                        font: FONT_SHIFT,
                        alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
                        border: THIN_BORDER
                    }
                };

                // Coluna C (Aula: 1a., 2a., 3a., ...)
                const refAula = XLSX.utils.encode_cell({ r, c: 2 });
                ws[refAula] = {
                    t: 's',
                    v: `${aula.numero}a.`,
                    s: {
                        fill: { patternType: 'solid', fgColor: { rgb: theme.bg } },
                        font: FONT_AULA,
                        alignment: { vertical: 'center', horizontal: 'center' },
                        border: THIN_BORDER
                    }
                };

                // Colunas dos Laboratórios
                labs.forEach((lab, labIdx) => {
                    const c = 3 + labIdx;
                    const refCell = XLSX.utils.encode_cell({ r, c });

                    let cellText = '';
                    let isMaint = false;

                    if (mode !== 'sem-reservas') {
                        const res = reservas.find(resItem =>
                            String(resItem.labId) === String(lab.id) &&
                            resItem.normData === dISO &&
                            resItem.turno === tKey &&
                            (resItem.aulas || []).includes(aula.numero)
                        );
                        if (res) {
                            cellText = formatCompactScheduleCell(res, discList);
                            isMaint = res.status === 'manutencao';
                        }
                    }

                    ws[refCell] = {
                        t: 's',
                        v: cellText,
                        s: {
                            fill: { patternType: 'solid', fgColor: { rgb: theme.bg } },
                            font: isMaint ? FONT_MAINT : FONT_CELL,
                            alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
                            border: THIN_BORDER
                        }
                    };
                });

                rowHeights.push({ hpt: 19 });
                currentRow++;
            });

            // Mescla células do Turno (Coluna B)
            const shiftEndRow = currentRow - 1;
            if (shiftEndRow >= shiftStartRow) {
                merges.push({
                    s: { r: shiftStartRow, c: 1 },
                    e: { r: shiftEndRow, c: 1 }
                });
            }
        });

        // Mescla células do Dia da Semana (Coluna A)
        const dayEndRow = currentRow - 1;
        if (dayEndRow >= dayStartRow) {
            merges.push({
                s: { r: dayStartRow, c: 0 },
                e: { r: dayEndRow, c: 0 }
            });
        }
    });

    const totalCols = 3 + labs.length;
    const maxRow = currentRow - 1;

    ws['!ref'] = XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: maxRow, c: totalCols - 1 }
    });
    ws['!merges'] = merges;
    ws['!rows'] = rowHeights;
    ws['!cols'] = [
        { wch: 4.5 }, // Coluna A: Dia
        { wch: 4 },   // Coluna B: Turno
        { wch: 4.5 }, // Coluna C: Aula
        ...labs.map(l => ({ wch: Math.max(10, (l.nome || '').length + 2) }))
    ];

    // Congela a linha do cabeçalho para navegação confortável
    ws['!views'] = [{ state: 'frozen', xSplit: 3, ySplit: 1 }];

    return ws;
}

/**
 * Constrói array bidimensional para fallback em CSV estruturado
 */
function buildCompactScheduleAOA({ dates, turnosList, labs, reservas, mode, discList }) {
    const aoa = [];

    // Cabeçalho
    aoa.push(['DIA', 'TURNO', 'AULA', ...labs.map(l => l.nome || 'LAB')]);

    dates.forEach(d => {
        const dISO = formatDateISO(d);
        const dayName = getDayName(d).replace('-feira', '').toUpperCase();

        turnosList.forEach(tKey => {
            const theme = TURNO_THEMES[tKey] || { label: tKey.toUpperCase(), aulasCount: 5 };
            const tCfg = SCHEDULE_CONFIG[tKey];
            const aulas = tCfg?.aulas || Array.from({ length: theme.aulasCount }, (_, i) => ({ numero: i + 1 }));

            aulas.forEach((aula, idx) => {
                const row = [
                    idx === 0 ? dayName : '',
                    idx === 0 ? theme.label : '',
                    `${aula.numero}a.`
                ];

                labs.forEach(lab => {
                    let cellVal = '';
                    if (mode !== 'sem-reservas') {
                        const res = reservas.find(r =>
                            String(r.labId) === String(lab.id) &&
                            r.normData === dISO &&
                            r.turno === tKey &&
                            (r.aulas || []).includes(aula.numero)
                        );
                        if (res) cellVal = formatCompactScheduleCell(res, discList);
                    }
                    row.push(cellVal);
                });

                aoa.push(row);
            });
        });
    });

    return aoa;
}

/**
 * Gera os dados da planilha e dispara o download no formato escolhido
 */
async function generateAndDownloadSpreadsheet({ mode, scope, turno, date, format }) {
    // 1. Carrega dados essenciais em paralelo
    const [allLabs, cursosList, discList] = await Promise.all([
        getLaboratorios(),
        getCursos().catch(() => []),
        getDisciplinas().catch(() => [])
    ]);

    const labs = allLabs.filter(l => l.ativo !== false);
    if (labs.length === 0) {
        throw new Error('Nenhum laboratório ativo encontrado para exportar.');
    }

    // 2. Determina datas do período selecionado
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

    const normalizedReservas = (reservas || []).map(r => ({
        ...r,
        normData: normalizeDate(r.data)
    }));

    // Se a exportação for da semana e houver agendamentos cadastrados no sábado, inclui o sábado
    if (scope === 'semana' && dates.length === 5) {
        const saturday = new Date(dates[0]);
        saturday.setDate(saturday.getDate() + 5);
        const satISO = formatDateISO(saturday);
        if (normalizedReservas.some(r => r.normData === satISO)) {
            dates.push(saturday);
        }
    }

    // 5. Define o nome do arquivo gerado
    const prefix = mode === 'com-reservas' ? 'Grade_Horaria_Laboratorios' : 'Modelo_Grade_Horaria';
    const dateTag = scope === 'semana'
        ? `${formatDateISO(dates[0])}_a_${formatDateISO(dates[dates.length - 1])}`
        : formatDateISO(dates[0]);
    const fileName = `${prefix}_${dateTag}.${format}`;

    // 6. Exportação Excel (.xlsx) ultracompacta em guia única
    if (format === 'xlsx') {
        const XLSX = await ensureXLSX();
        if (XLSX) {
            const wb = XLSX.utils.book_new();
            const ws = buildCompactScheduleWorksheet(XLSX, {
                dates,
                turnosList,
                labs,
                reservas: normalizedReservas,
                mode,
                discList
            });

            // Adiciona APENAS UMA GUIA conforme solicitação do usuário
            XLSX.utils.book_append_sheet(wb, ws, 'Grade_Horaria');

            triggerExcelDownload(XLSX, wb, fileName);
            showToast('Grade horária resumida em guia única baixada com sucesso!', 'success');
            return;
        }
    }

    // 7. Fallback para CSV estruturado com UTF-8 BOM
    const aoa = buildCompactScheduleAOA({
        dates,
        turnosList,
        labs,
        reservas: normalizedReservas,
        mode,
        discList
    });
    exportViaCSV({
        fileName: fileName.replace('.xlsx', '.csv'),
        aoaData: aoa
    });
    showToast('Planilha CSV da grade horária baixada com sucesso!', 'success');
}

/**
 * Garante que a biblioteca SheetJS/xlsx-js-style esteja carregada e pronta para uso
 */
async function ensureXLSX() {
    if (typeof window.XLSX !== 'undefined') return window.XLSX;

    return new Promise((resolve) => {
        const localScript = document.createElement('script');
        localScript.src = 'js/xlsx-style.bundle.js';
        localScript.onload = () => resolve(window.XLSX || null);
        localScript.onerror = () => {
            const fallback = document.createElement('script');
            fallback.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
            fallback.onload = () => resolve(window.XLSX || null);
            fallback.onerror = () => resolve(null);
            document.head.appendChild(fallback);
        };
        document.head.appendChild(localScript);
    });
}

/**
 * Dispara o download do arquivo Excel (.xlsx) com fallback por Blob
 */
function triggerExcelDownload(XLSX, wb, fileName) {
    try {
        XLSX.writeFile(wb, fileName);
    } catch (writeErr) {
        console.warn('XLSX.writeFile direto falhou, usando download por Blob:', writeErr);
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
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

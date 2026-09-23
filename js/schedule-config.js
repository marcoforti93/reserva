// ============================================================
// schedule-config.js
// Configuração dos Horários de Aulas por Turno
// Estrutura facilmente editável para alteração de horários.
// ============================================================

/**
 * Configuração completa dos turnos e suas aulas.
 * Para alterar horários, basta editar os campos `inicio` e `fim` de cada aula.
 * O campo `aposAula` no intervalo indica após qual aula o intervalo ocorre.
 */
export const SCHEDULE_CONFIG = {
    manha: {
        label: 'Manhã',
        icon: '☀️',
        aulas: [
            { numero: 1, inicio: '07:00', fim: '07:50' },
            { numero: 2, inicio: '07:50', fim: '08:40' },
            { numero: 3, inicio: '08:40', fim: '09:30' },
            { numero: 4, inicio: '09:45', fim: '10:35' },
            { numero: 5, inicio: '10:35', fim: '11:25' },
            { numero: 6, inicio: '11:25', fim: '12:15' },
            { numero: 7, inicio: '12:15', fim: '13:05' },
        ],
        intervalo: { inicio: '09:30', fim: '09:45', aposAula: 3 }
    },
    tarde: {
        label: 'Tarde',
        icon: '🌤️',
        aulas: [
            { numero: 1, inicio: '13:10', fim: '14:00' },
            { numero: 2, inicio: '14:00', fim: '14:50' },
            { numero: 3, inicio: '14:50', fim: '15:40' },
            { numero: 4, inicio: '15:55', fim: '16:45' },
            { numero: 5, inicio: '16:45', fim: '17:35' },
            { numero: 6, inicio: '17:35', fim: '18:25' },
        ],
        intervalo: { inicio: '15:40', fim: '15:55', aposAula: 3 }
    },
    noite: {
        label: 'Noite',
        icon: '🌙',
        aulas: [
            { numero: 1, inicio: '18:30', fim: '19:15' },
            { numero: 2, inicio: '19:15', fim: '20:00' },
            { numero: 3, inicio: '20:15', fim: '21:00' },
            { numero: 4, inicio: '21:00', fim: '21:45' },
            { numero: 5, inicio: '21:45', fim: '22:30' },
        ],
        intervalo: { inicio: '20:00', fim: '20:15', aposAula: 2 }
    }
};

/**
 * Cores e labels dos status de reserva
 */
export const STATUS_CONFIG = {
    confirmado: {
        label: 'Confirmado',
        bgClass: 'bg-violet-600',
        textClass: 'text-white',
        borderClass: 'border-violet-700',
        badgeClass: 'bg-violet-100 text-violet-800',
        hex: '#7C3AED'
    },
    pendente: {
        label: 'Pendente',
        bgClass: 'bg-amber-500',
        textClass: 'text-white',
        borderClass: 'border-amber-600',
        badgeClass: 'bg-amber-100 text-amber-800',
        hex: '#F59E0B'
    },
    manutencao: {
        label: 'Manutenção',
        bgClass: 'bg-red-500',
        textClass: 'text-white',
        borderClass: 'border-red-600',
        badgeClass: 'bg-red-100 text-red-800',
        hex: '#EF4444'
    },
    livre: {
        label: 'Livre',
        bgClass: 'bg-emerald-500',
        textClass: 'text-white',
        borderClass: 'border-emerald-600',
        badgeClass: 'bg-emerald-100 text-emerald-800',
        hex: '#10B981'
    }
};

/**
 * Recursos extras disponíveis para reserva
 */
export const RECURSOS_DISPONIVEIS = [
    { id: 'projetor', label: 'Projetor', icon: '📽️' },
    { id: 'som', label: 'Sistema de Som', icon: '🔊' },
    { id: 'software', label: 'Software Específico', icon: '💻' },
    { id: 'webcam', label: 'Webcam/Câmera', icon: '📷' },
    { id: 'impressora', label: 'Impressora', icon: '🖨️' },
];

/**
 * Dias da semana para a grade (seg a sex)
 */
export const DIAS_SEMANA = [
    { key: 1, label: 'Segunda', short: 'Seg' },
    { key: 2, label: 'Terça', short: 'Ter' },
    { key: 3, label: 'Quarta', short: 'Qua' },
    { key: 4, label: 'Quinta', short: 'Qui' },
    { key: 5, label: 'Sexta', short: 'Sex' },
];

/**
 * Retorna a label formatada de uma aula (ex: "1ª aula: 07:30 - 08:15")
 */
export function getAulaLabel(turno, numeroAula) {
    const config = SCHEDULE_CONFIG[turno];
    if (!config) return '';
    const aula = config.aulas.find(a => a.numero === numeroAula);
    if (!aula) return '';
    return `${aula.numero}ª aula: ${aula.inicio} - ${aula.fim}`;
}

/**
 * Retorna a label curta de uma aula (ex: "07:30-08:15")
 */
export function getAulaShortLabel(turno, numeroAula) {
    const config = SCHEDULE_CONFIG[turno];
    if (!config) return '';
    const aula = config.aulas.find(a => a.numero === numeroAula);
    if (!aula) return '';
    return `${aula.inicio}-${aula.fim}`;
}

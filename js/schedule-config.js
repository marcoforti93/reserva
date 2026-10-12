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

/**
 * Turmas padrão para seleção em lista dropdown
 */
export const DEFAULT_TURMAS = [
    '1º M-TEC Informática para Internet',
    '2º M-TEC Informática para Internet',
    '3º M-TEC Informática para Internet',
    '1º M-TEC Desenvolvimento de Sistemas',
    '2º M-TEC Desenvolvimento de Sistemas',
    '3º M-TEC Desenvolvimento de Sistemas',
    '1º M-TEC Administração',
    '2º M-TEC Administração',
    '3º M-TEC Administração',
    '1º M-TEC Logística',
    '2º M-TEC Logística',
    '3º M-TEC Logística',
    '1º M-TEC Recursos Humanos',
    '2º M-TEC Recursos Humanos',
    '3º M-TEC Recursos Humanos',
    '1º M-TEC Marketing',
    '2º M-TEC Marketing',
    '1º M-TEC Contabilidade',
    '2º M-TEC Contabilidade',
    '1º Desenvolvimento de Sistemas (Noturno)',
    '2º Desenvolvimento de Sistemas (Noturno)',
    '3º Desenvolvimento de Sistemas (Noturno)',
    '1º Informática para Internet (Noturno)',
    '2º Informática para Internet (Noturno)',
    '3º Informática para Internet (Noturno)',
    '1º Administração (Noturno)',
    '2º Administração (Noturno)',
    '3º Administração (Noturno)',
    '1º Logística (Noturno)',
    '2º Logística (Noturno)',
    '3º Logística (Noturno)',
    '1º Recursos Humanos (Noturno)',
    '2º Recursos Humanos (Noturno)',
    '1º Enfermagem',
    '2º Enfermagem',
    '3º Enfermagem',
    '4º Enfermagem'
];

/**
 * Disciplinas padrão para seleção em lista dropdown
 */
export const DEFAULT_DISCIPLINAS = [
    'Análise e Projeto de Sistemas',
    'Banco de Dados I',
    'Banco de Dados II',
    'Cálculo Financeiro',
    'Contabilidade Geral',
    'Design Digital',
    'Desenvolvimento de Sistemas',
    'Desenvolvimento Web I',
    'Desenvolvimento Web II',
    'Desenvolvimento Web III',
    'Ética e Cidadania Organizacional',
    'Fundamentos da Informática',
    'Gestão de Conteúdo Web',
    'Gestão de Pessoas',
    'Gestão Empresarial',
    'Inglês Instrumental',
    'Inteligência Artificial Aplicada',
    'Interface Web e Acessibilidade',
    'Internet das Coisas (IoT)',
    'Língua Portuguesa e Comunicação',
    'Logística Empresarial',
    'Lógica de Programação e Algoritmos',
    'Marketing Digital',
    'Matemática Aplicada',
    'Planejamento e Desenvolvimento do TCC',
    'Programação de Aplicativos Mobile I',
    'Programação de Aplicativos Mobile II',
    'Programação Web e Mobile',
    'Redes de Computadores',
    'Segurança da Informação',
    'Sistemas Operacionais',
    'Técnicas de Programação'
];

/**
 * Mapeamento das siglas padrão das disciplinas (ETEC / Ensino Técnico)
 */
export const DISCIPLINAS_SIGLAS_MAP = {
    'Programação Web I': 'PW-I',
    'Programação Web II': 'PW-II',
    'Programação Web III': 'PW-III',
    'Desenvolvimento Web I': 'DW-I',
    'Desenvolvimento Web II': 'DW-II',
    'Desenvolvimento Web III': 'DW-III',
    'Banco de Dados I': 'BD-I',
    'Banco de Dados II': 'BD-II',
    'Banco de Dados': 'BD',
    'Análise e Projeto de Sistemas': 'APS',
    'Desenvolvimento de Sistemas': 'DS',
    'Design Digital': 'DD',
    'Ética e Cidadania Organizacional': 'ECO',
    'Fundamentos da Informática': 'FI',
    'Gestão de Conteúdo Web': 'GCW',
    'Gestão de Pessoas': 'GP',
    'Gestão Empresarial': 'GE',
    'Inglês Instrumental': 'II',
    'Inteligência Artificial Aplicada': 'IAA',
    'Interface Web e Acessibilidade': 'IWA',
    'Internet das Coisas (IoT)': 'IoT',
    'Internet das Coisas': 'IoT',
    'Língua Portuguesa e Comunicação': 'LPC',
    'Logística Empresarial': 'LE',
    'Lógica de Programação e Algoritmos': 'LPA',
    'Lógica de Programação': 'LP',
    'Marketing Digital': 'MD',
    'Matemática Aplicada': 'MA',
    'Planejamento e Desenvolvimento do TCC': 'TCC',
    'Programação de Aplicativos Mobile I': 'PAM-I',
    'Programação de Aplicativos Mobile II': 'PAM-II',
    'Programação Web e Mobile': 'PWM',
    'Redes de Computadores': 'RC',
    'Segurança da Informação': 'SI',
    'Sistemas Operacionais': 'SO',
    'Técnicas de Programação': 'TP',
    'Técnicas de Programação I': 'TP-I',
    'Técnicas de Programação II': 'TP-II',
    'Cálculo Financeiro': 'CF',
    'Contabilidade Geral': 'CG',
    'Qualidade e Teste de Software': 'QTS',
    'Sistemas Embarcados': 'SE',
    'Sistemas Embarcados e IoT': 'SEI',
    'Programação e Algoritmos': 'PAL',
    'Tecnologia da Informação': 'TI',
    'Projetos de Tecnologia de Informação e Comunicação': 'PTIC',
    'Internet, Protocolos e Segurança de Sistemas da Informação': 'IPSSI',
    'Planejamento e Desenvolvimento do Trabalho de Conclusão de Curso (TCC) em Desenvolvimento de Sistemas': 'PDTCC',
    'Aplicativos Informatizados': 'AI'
};

/**
 * Mapeamento dos nomes resumidos/abreviados para disciplinas com nomes extensos
 */
export const DISCIPLINAS_NOMES_CURTOS_MAP = {
    'Planejamento e Desenvolvimento do Trabalho de Conclusão de Curso (TCC) em Desenvolvimento de Sistemas': 'Planejamento e Desenv. TCC',
    'Planejamento e Desenvolvimento do Trabalho de Conclusão de Curso (TCC)': 'Planejamento e Desenv. TCC',
    'Planejamento e Desenvolvimento do TCC': 'Planejamento do TCC',
    'Internet, Protocolos e Segurança de Sistemas da Informação': 'Internet e Seg. da Informação',
    'Projetos de Tecnologia de Informação e Comunicação': 'Projetos de TIC',
    'Programação de Aplicativos Mobile I': 'Prog. Aplicativos Mobile I',
    'Programação de Aplicativos Mobile II': 'Prog. Aplicativos Mobile II',
    'Programação Web e Mobile': 'Prog. Web e Mobile',
    'Ética e Cidadania Organizacional': 'Ética e Cidadania Org.',
    'Interface Web e Acessibilidade': 'Interface Web e Acessibilidade',
    'Lógica de Programação e Algoritmos': 'Lógica de Programação',
    'Língua Portuguesa e Comunicação': 'Língua Portuguesa',
    'Inteligência Artificial Aplicada': 'IA Aplicada',
    'Qualidade e Teste de Software': 'Qualidade e Teste Softw.',
    'Sistemas Embarcados e IoT': 'Sistemas Embarcados (IoT)',
    'Análise e Projeto de Sistemas': 'Análise e Proj. Sistemas',
    'Técnicas de Programação I': 'Técnicas de Prog. I',
    'Técnicas de Programação II': 'Técnicas de Prog. II',
    'Técnicas de Programação': 'Técnicas de Prog.'
};

/**
 * Retorna o nome abreviado/resumido da disciplina para exibição compacta
 * Ex: "Planejamento e Desenvolvimento do Trabalho de Conclusão de Curso (TCC) em Desenvolvimento de Sistemas" -> "Planejamento e Desenv. TCC"
 */
export function formatShortDisciplinaNome(nome) {
    if (!nome) return '';
    const clean = String(nome).trim();

    // 1. Mapeamento direto ou case-insensitive
    if (DISCIPLINAS_NOMES_CURTOS_MAP[clean]) {
        return DISCIPLINAS_NOMES_CURTOS_MAP[clean];
    }
    const foundKey = Object.keys(DISCIPLINAS_NOMES_CURTOS_MAP).find(k => k.toLowerCase() === clean.toLowerCase());
    if (foundKey) {
        return DISCIPLINAS_NOMES_CURTOS_MAP[foundKey];
    }

    // 2. Se já tem tamanho razoável (até 28 caracteres), retorna limpo
    if (clean.length <= 28) {
        return clean;
    }

    // 3. Aplica abreviações comuns de palavras longas
    let short = clean
        .replace(/\bDesenvolvimento\b/gi, 'Desenv.')
        .replace(/\bProgramação\b/gi, 'Prog.')
        .replace(/\bInformação\b/gi, 'Inform.')
        .replace(/\bInformações\b/gi, 'Inform.')
        .replace(/\bOrganizacional\b/gi, 'Org.')
        .replace(/\bAplicativos\b/gi, 'Aplic.')
        .replace(/\bTecnologia\b/gi, 'Tecnol.')
        .replace(/\bTecnologias\b/gi, 'Tecnol.')
        .replace(/\bAdministração\b/gi, 'Admin.')
        .replace(/\bInstrumental\b/gi, 'Instr.')
        .replace(/\bInteligência Artificial\b/gi, 'IA')
        .replace(/\bTrabalho de Conclusão de Curso\b/gi, 'TCC')
        .replace(/\bComunicação\b/gi, 'Comun.')
        .replace(/\bFundamentos\b/gi, 'Fund.');

    // 4. Se ainda ultrapassar 34 caracteres, trunca suavemente
    if (short.length > 34) {
        short = short.substring(0, 31).trim() + '...';
    }

    return short;
}

/**
 * Formata o label da disciplina para exibição em selects (ex: "PDTCC — Planejamento e Desenv. TCC")
 */
export function formatDisciplinaSelectLabel(nome, sigla = null) {
    if (!nome) return '';
    const s = getDisciplinaSigla(nome, sigla);
    const shortNome = formatShortDisciplinaNome(nome);

    if (s && shortNome) {
        if (s.toLowerCase() === shortNome.toLowerCase()) {
            return s;
        }
        return `${s} — ${shortNome}`;
    }
    return s || shortNome || nome;
}

/**
 * Retorna a sigla de uma disciplina a partir do nome ou sigla explícita
 * Ex: "Programação Web I" -> "PW-I"
 */
export function getDisciplinaSigla(nome, sigla = null) {
    if (sigla && typeof sigla === 'string' && sigla.trim()) {
        return sigla.trim();
    }
    if (!nome) return '';

    // 1. Se o nome já tiver parênteses contendo uma sigla curta, ex: "Programação Web I (PW-I)"
    const match = nome.match(/\(([^)]+)\)/);
    if (match && match[1].trim().length <= 8) {
        return match[1].trim();
    }

    const clean = nome.replace(/\s*\([^)]+\)/, '').trim();

    // 2. Busca exata ou case-insensitive no mapeamento padrão
    if (DISCIPLINAS_SIGLAS_MAP[clean]) {
        return DISCIPLINAS_SIGLAS_MAP[clean];
    }
    const foundKey = Object.keys(DISCIPLINAS_SIGLAS_MAP).find(k => k.toLowerCase() === clean.toLowerCase());
    if (foundKey) {
        return DISCIPLINAS_SIGLAS_MAP[foundKey];
    }

    // 3. Se o nome já for curto (até 6 caracteres, como "PW-I" ou "BD"), usa diretamente
    if (clean.length <= 6) {
        return clean;
    }

    // 4. Se não encontrar, tenta gerar acrônimo a partir das iniciais relevantes
    const stopwords = ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com'];
    const words = clean.split(/\s+/).filter(w => !stopwords.includes(w.toLowerCase()));
    if (words.length >= 2) {
        return words.map(w => w[0].toUpperCase()).join('').substring(0, 8);
    }

    return clean;
}

/**
 * Retorna a sigla de um curso (ex: "MTec N Desenvolvimento de Sistemas" -> "M-DS (N)")
 */
export function getCursoSigla(nome, sigla = null) {
    if (sigla && typeof sigla === 'string' && sigla.trim()) {
        return sigla.trim();
    }
    if (!nome) return '';

    // Se já tiver parênteses com sigla curta, ex: "Desenvolvimento de Sistemas (DS)"
    const match = nome.match(/\(([^)]+)\)/);
    if (match && match[1].trim().length <= 8) {
        return match[1].trim();
    }

    const clean = String(nome).trim();
    const lower = clean.toLowerCase();
    const unaccented = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const isNoturno = lower.includes(' n ') || lower.includes('(noturno)') || lower.includes(' n') || lower.endsWith(' n') || lower.startsWith('noturno') || unaccented.endsWith(' n');

    if (unaccented.includes('desenvolvimento de sistemas') || unaccented.includes('desenvolvimento sistemas')) {
        return isNoturno ? 'M-DS (N)' : 'M-DS';
    }
    if (unaccented.includes('nutricao')) {
        return isNoturno ? 'M-NUT (N)' : 'M-NUT';
    }
    if (unaccented.includes('administracao')) {
        return isNoturno ? 'M-ADM (N)' : 'M-ADM';
    }
    if (unaccented.includes('mecanica')) {
        return isNoturno ? 'M-MEC (N)' : 'M-MEC';
    }
    if (unaccented.includes('informatica para internet') || unaccented.includes('informatica internet')) {
        return isNoturno ? 'M-INFO (N)' : 'M-INFO';
    }
    if (unaccented.includes('logistica')) {
        return isNoturno ? 'M-LOG (N)' : 'M-LOG';
    }
    if (unaccented.includes('recursos humanos')) {
        return isNoturno ? 'M-RH (N)' : 'M-RH';
    }
    if (unaccented.includes('contabilidade')) {
        return isNoturno ? 'M-CONT (N)' : 'M-CONT';
    }
    if (unaccented.includes('enfermagem')) {
        return isNoturno ? 'ENF (N)' : 'ENF';
    }

    if (clean.length <= 7) return clean;

    const stopwords = ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com', 'mtec', 'm-tec'];
    const words = clean.split(/\s+/).filter(w => !stopwords.includes(w.toLowerCase()));
    const acr = words.map(w => w[0].toUpperCase()).join('').substring(0, 6);
    return isNoturno ? `${acr} (N)` : acr;
}

/**
 * Abrevia o nome do professor para exibição ultracompacta no card
 * Ex: "JOSE EDUARDO BARBOSA" -> "José Barbosa"
 * Ex: "MARCO AURELIO FORTI" -> "Marco Forti"
 * Ex: "SIMONE MONTANHA ANDALAFT" -> "Simone Andalaft"
 * Ex: "JOSE RAFAEL FRANCO" -> "José Franco"
 */
export function formatShortProfessorName(fullName) {
    if (!fullName) return '—';
    const clean = String(fullName).trim();
    if (!clean) return '—';

    // Remove prefixos
    const semPrefixo = clean.replace(/^(prof\.|profª\.|professor|professora)\s+/i, '').trim();
    const parts = semPrefixo.split(/\s+/).filter(Boolean);

    const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

    if (parts.length === 1) return cap(parts[0]);

    const first = cap(parts[0]);
    const last = cap(parts[parts.length - 1]);

    return `${first} ${last}`;
}

/**
 * ============================================================
 * SISTEMA DE RESERVAS DE LABORATÓRIOS - GOOGLE APPS SCRIPT API
 * ETEC Unidade 051 - Dr. Domingos Minicucci Filho
 * ============================================================
 * 
 * Este script transforma sua planilha Google Sheets em uma API
 * REST rápida, segura e 100% gratuita para o GitHub Pages.
 * 
 * INSTRUÇÕES RÁPIDAS DE INSTALAÇÃO:
 * 1. Crie uma nova Planilha no Google Drive (https://sheets.new)
 * 2. No menu superior, clique em: Extensões > Apps Script
 * 3. Apague qualquer código existente e cole TODO este arquivo
 * 4. No canto superior direito, clique em "Implantar" > "Nova implantação"
 * 5. Tipo: Selecione o ícone de engrenagem ⚙️ > "App da Web" (Web App)
 * 6. Configurações:
 *    - Descrição: API Reserva de Salas
 *    - Executar como: Eu (seu email)
 *    - Quem pode acessar: Qualquer pessoa (Anyone)  <-- IMPORTANTE!
 * 7. Clique em "Implantar" e autorize o acesso com sua conta Google
 * 8. Copie a "URL do app da Web" gerada
 * 9. Cole essa URL no arquivo 'js/sheet-config.js' do seu projeto!
 * ============================================================
 */

// Nomes das abas da planilha
const SHEETS = {
  LABS: 'laboratorios',
  PROFS: 'professores',
  CURSOS: 'cursos',
  TURMAS: 'turmas',
  DISCIPLINAS: 'disciplinas',
  RESERVAS: 'reservas',
  USUARIOS: 'usuarios'
};

// Definição dos cabeçalhos de cada aba
const HEADERS = {
  laboratorios: ['id', 'nome', 'capacidade', 'descricao', 'recursos', 'ativo', 'criadoEm', 'atualizadoEm'],
  professores: ['id', 'nome', 'email', 'disciplinas', 'criadoEm', 'atualizadoEm'],
  cursos: ['id', 'nome', 'periodo', 'ativo', 'criadoEm', 'atualizadoEm'],
  turmas: ['id', 'nome', 'turno', 'ativo', 'criadoEm', 'atualizadoEm'],
  disciplinas: ['id', 'nome', 'sigla', 'ativo', 'criadoEm', 'atualizadoEm'],
  reservas: [
    'id', 'data', 'turno', 'labId', 'labNome', 
    'professorId', 'professorNome', 'cursoId', 'cursoNome', 
    'turmaId', 'turmaNome', 'disciplinaId', 'disciplinaNome', 
    'disciplinaSigla', 'aulas', 'recursosExtras', 'observacoes', 
    'status', 'recorrente', 'recorrenteAte', 'criadoEm', 'atualizadoEm'
  ],
  usuarios: ['id', 'email', 'senha', 'nome', 'perfil', 'professorId', 'criadoEm']
};

/**
 * Normaliza qualquer formato de data para YYYY-MM-DD
 */
function normalizeDateStr(d) {
  if (!d) return '';
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const s = String(d).trim();
  if (s.includes('T')) return s.split('T')[0];
  return s.substring(0, 10);
}

/**
 * Ponto de entrada GET (leitura de dados)
 */
function doGet(e) {
  try {
    ensureInitialized();
    const action = e.parameter.action || 'getInitialData';
    
    let result = {};
    
    switch (action) {
      case 'ping':
        result = { success: true, message: 'Google Sheets API ativa e conectada!' };
        break;
        
      case 'setup':
        ensureInitialized(true);
        result = { success: true, message: 'Estrutura da planilha inicializada com sucesso!' };
        break;
        
      case 'getInitialData':
        result = {
          success: true,
          data: {
            laboratorios: getSheetRows(SHEETS.LABS),
            professores: getSheetRows(SHEETS.PROFS),
            cursos: getSheetRows(SHEETS.CURSOS),
            turmas: getSheetRows(SHEETS.TURMAS),
            disciplinas: getSheetRows(SHEETS.DISCIPLINAS),
            reservas: getSheetRows(SHEETS.RESERVAS)
          }
        };
        break;
        
      case 'getReservas':
        const dataFiltro = e.parameter.data ? normalizeDateStr(e.parameter.data) : null;
        const semanaFiltro = e.parameter.semana ? e.parameter.semana.split(',').map(normalizeDateStr) : null;
        const profId = e.parameter.professorId;
        let reservas = getSheetRows(SHEETS.RESERVAS);
        
        if (dataFiltro) {
          reservas = reservas.filter(r => normalizeDateStr(r.data) === dataFiltro);
        } else if (semanaFiltro && semanaFiltro.length > 0) {
          reservas = reservas.filter(r => semanaFiltro.includes(normalizeDateStr(r.data)));
        }
        if (profId) {
          reservas = reservas.filter(r => String(r.professorId) === String(profId));
        }
        result = { success: true, data: reservas };
        break;
        
      case 'getItems':
        const table = e.parameter.table;
        if (!table || !HEADERS[table]) {
          throw new Error('Tabela não informada ou inválida: ' + table);
        }
        result = { success: true, data: getSheetRows(table) };
        break;
        
      default:
        result = { success: false, error: 'Ação desconhecida: ' + action };
    }
    
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

/**
 * Ponto de entrada POST (escrita e alteração de dados)
 */
function doPost(e) {
  try {
    ensureInitialized();
    
    let payload = {};
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        payload = e.parameter;
      }
    } else {
      payload = e.parameter || {};
    }
    
    const action = payload.action;
    let result = {};
    
    switch (action) {
      // Autenticação
      case 'login':
        result = handleLogin(payload.email, payload.senha);
        break;
        
      case 'registerUser':
        result = handleRegisterUser(payload);
        break;
        
      // Reservas
      case 'createReserva':
        result = handleCreateReserva(payload.data);
        break;
        
      case 'createReservaBatch':
        result = handleCreateReservaBatch(payload.list);
        break;
        
      case 'updateReservaStatus':
        result = handleUpdateReservaStatus(payload.id, payload.status);
        break;
        
      case 'deleteReserva':
        result = handleDeleteRow(SHEETS.RESERVAS, payload.id);
        break;
        
      // CRUD Genérico (Labs, Cursos, Turmas, Disciplinas, Professores)
      case 'addItem':
        result = handleAddItem(payload.table, payload.data);
        break;
        
      case 'updateItem':
        result = handleUpdateItem(payload.table, payload.id, payload.data);
        break;
        
      case 'deleteItem':
        result = handleDeleteItem(payload.table, payload.id, payload.softDelete !== false);
        break;
        
      case 'seedItems':
        result = handleSeedItems(payload.table, payload.items, payload.keyField || 'nome');
        break;
        
      default:
        result = { success: false, error: 'Ação POST desconhecida: ' + action };
    }
    
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

/**
 * Retorna resposta formatada em JSON com cabeçalho de resposta apropriado
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// FUNÇÕES DE MANIPULAÇÃO DA PLANILHA
// ============================================================

/**
 * Lê todas as linhas de uma aba e converte para array de objetos
 */
function getSheetRows(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol < 1) return [];
  
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  
  return values.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      let val = row[index];
      
      // Normalização automática de datas (como Date object do Sheets)
      if (val instanceof Date) {
        val = normalizeDateStr(val);
      }
      
      // Tenta fazer parse de arrays e objetos JSON salvos como texto
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
          try {
            val = JSON.parse(trimmed);
          } catch (e) {
            // Mantém valor original como string se falhar
          }
        }
      }
      
      // Converte strings booleanas
      if (val === 'true') val = true;
      if (val === 'false') val = false;
      obj[header] = val;
    });
    return obj;
  });
}

/**
 * Adiciona uma linha em uma aba
 */
function appendSheetRow(sheetName, obj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Aba não encontrada: ' + sheetName);
  
  const headers = HEADERS[sheetName] || sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(header => {
    let val = obj[header];
    if (val === undefined || val === null) return '';
    
    // Tratamento especial para coluna de data para manter como texto literal YYYY-MM-DD
    if (header === 'data' && val) {
      return "'" + normalizeDateStr(val);
    }
    
    if (typeof val === 'object') return JSON.stringify(val);
    return val;
  });
  
  sheet.appendRow(row);
  return obj;
}

/**
 * Atualiza uma linha existente pelo ID
 */
function updateSheetRowById(sheetName, id, updates) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Aba não encontrada: ' + sheetName);
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) throw new Error('Item não encontrado.');
  
  const headers = HEADERS[sheetName] || sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idColIndex = headers.indexOf('id') + 1;
  if (idColIndex === 0) throw new Error('Coluna ID não existe na aba: ' + sheetName);
  
  const idValues = sheet.getRange(2, idColIndex, lastRow - 1, 1).getValues();
  let targetRow = -1;
  
  for (let i = 0; i < idValues.length; i++) {
    if (String(idValues[i][0]) === String(id)) {
      targetRow = i + 2; // +2 porque o cabeçalho é linha 1 e o array é 0-indexado
      break;
    }
  }
  
  if (targetRow === -1) throw new Error('Registro com ID ' + id + ' não encontrado em ' + sheetName);
  
  headers.forEach((header, colIdx) => {
    if (updates.hasOwnProperty(header) && header !== 'id') {
      let val = updates[header];
      if (val === undefined || val === null) val = '';
      if (header === 'data' && val) val = "'" + normalizeDateStr(val);
      else if (typeof val === 'object') val = JSON.stringify(val);
      sheet.getRange(targetRow, colIdx + 1).setValue(val);
    }
  });
  
  return { success: true, id: id };
}

/**
 * Remove uma linha fisicamente pelo ID
 */
function handleDeleteRow(sheetName, id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Aba não encontrada: ' + sheetName);
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true };
  
  const headers = HEADERS[sheetName] || sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idColIndex = headers.indexOf('id') + 1;
  const idValues = sheet.getRange(2, idColIndex, lastRow - 1, 1).getValues();
  
  for (let i = 0; i < idValues.length; i++) {
    if (String(idValues[i][0]) === String(id)) {
      sheet.deleteRow(i + 2);
      return { success: true };
    }
  }
  
  return { success: true, message: 'Item não encontrado ou já excluído.' };
}

// ============================================================
// HANDLERS ESPECÍFICOS DE AÇÕES
// ============================================================

/**
 * Validação de Login
 */
function handleLogin(email, senha) {
  const users = getSheetRows(SHEETS.USUARIOS);
  const user = users.find(u => 
    String(u.email).toLowerCase().trim() === String(email).toLowerCase().trim()
  );
  
  if (!user) {
    return { success: false, error: 'Usuário não encontrado. Verifique o email digitado.' };
  }
  
  if (String(user.senha) !== String(senha)) {
    return { success: false, error: 'Senha incorreta.' };
  }
  
  // Retorna os dados do usuário sem expor a senha
  const { senha: _, ...safeUser } = user;
  return { success: true, user: safeUser };
}

/**
 * Cadastro de Usuário
 */
function handleRegisterUser(payload) {
  const users = getSheetRows(SHEETS.USUARIOS);
  const exists = users.some(u => 
    String(u.email).toLowerCase().trim() === String(payload.email).toLowerCase().trim()
  );
  
  if (exists) {
    return { success: false, error: 'Este email já está cadastrado.' };
  }
  
  const newUser = {
    id: generateId('usr'),
    email: payload.email,
    senha: payload.senha || 'admin',
    nome: payload.nome || payload.email.split('@')[0],
    perfil: payload.perfil || 'professor',
    professorId: payload.professorId || '',
    criadoEm: new Date().toISOString()
  };
  
  appendSheetRow(SHEETS.USUARIOS, newUser);
  
  const { senha: _, ...safeUser } = newUser;
  return { success: true, user: safeUser };
}

/**
 * Criação de Reserva com Verificação Anticonflito
 */
function handleCreateReserva(reservaData) {
  reservaData.data = normalizeDateStr(reservaData.data);
  
  const conflict = checkReservaConflict(reservaData);
  if (conflict.hasConflict) {
    return { 
      success: false, 
      error: 'Conflito de horário detectado.', 
      conflict: conflict.conflictingReserva 
    };
  }
  
  const id = generateId('res');
  const now = new Date().toISOString();
  const newReserva = {
    ...reservaData,
    id: id,
    status: reservaData.status || 'confirmado',
    criadoEm: now,
    atualizadoEm: now
  };
  
  appendSheetRow(SHEETS.RESERVAS, newReserva);
  return { success: true, id: id };
}

/**
 * Criação de Lote de Reservas (Recorrentes)
 */
function handleCreateReservaBatch(reservaList) {
  if (!Array.isArray(reservaList) || reservaList.length === 0) {
    return { success: false, error: 'Lista de reservas vazia.' };
  }
  
  let created = 0;
  let conflicts = 0;
  const now = new Date().toISOString();
  
  for (const item of reservaList) {
    item.data = normalizeDateStr(item.data);
    const conflict = checkReservaConflict(item);
    if (!conflict.hasConflict) {
      const newReserva = {
        ...item,
        id: generateId('res'),
        status: item.status || 'confirmado',
        criadoEm: now,
        atualizadoEm: now
      };
      appendSheetRow(SHEETS.RESERVAS, newReserva);
      created++;
    } else {
      conflicts++;
    }
  }
  
  return { success: true, created: created, conflicts: conflicts };
}

/**
 * Verifica se há conflito de reserva
 */
function checkReservaConflict(newRes, excludeId = '') {
  const reservas = getSheetRows(SHEETS.RESERVAS);
  const targetDate = normalizeDateStr(newRes.data);
  const targetAulas = Array.isArray(newRes.aulas) ? newRes.aulas : [];
  
  for (const r of reservas) {
    if (String(r.id) === String(excludeId)) continue;
    if (r.status === 'rejeitado') continue;
    
    const rDate = normalizeDateStr(r.data);
    
    // Mesmo laboratório, mesma data e mesmo turno
    if (
      String(r.labId) === String(newRes.labId) &&
      rDate === targetDate &&
      String(r.turno) === String(newRes.turno)
    ) {
      const existingAulas = Array.isArray(r.aulas) ? r.aulas : [];
      const hasIntersection = targetAulas.some(a => existingAulas.includes(Number(a)));
      if (hasIntersection) {
        return { hasConflict: true, conflictingReserva: r };
      }
    }
  }
  
  return { hasConflict: false, conflictingReserva: null };
}

/**
 * Atualiza status da reserva
 */
function handleUpdateReservaStatus(id, newStatus) {
  return updateSheetRowById(SHEETS.RESERVAS, id, {
    status: newStatus,
    atualizadoEm: new Date().toISOString()
  });
}

/**
 * Adiciona item a uma tabela genérica
 */
function handleAddItem(table, data) {
  if (!HEADERS[table]) throw new Error('Tabela desconhecida: ' + table);
  
  const id = generateId(table.substring(0, 3));
  const now = new Date().toISOString();
  const newItem = {
    ...data,
    id: id,
    ativo: data.ativo !== undefined ? data.ativo : true,
    criadoEm: now,
    atualizadoEm: now
  };
  
  appendSheetRow(table, newItem);
  return { success: true, id: id };
}

/**
 * Atualiza item em uma tabela genérica
 */
function handleUpdateItem(table, id, data) {
  if (!HEADERS[table]) throw new Error('Tabela desconhecida: ' + table);
  
  const updates = {
    ...data,
    atualizadoEm: new Date().toISOString()
  };
  
  updateSheetRowById(table, id, updates);
  return { success: true, id: id };
}

/**
 * Remove item de uma tabela genérica
 */
function handleDeleteItem(table, id, softDelete) {
  if (!HEADERS[table]) throw new Error('Tabela desconhecida: ' + table);
  
  if (softDelete && HEADERS[table].includes('ativo')) {
    updateSheetRowById(table, id, { 
      ativo: false,
      atualizadoEm: new Date().toISOString()
    });
    return { success: true };
  } else {
    return handleDeleteRow(table, id);
  }
}

/**
 * Adiciona múltiplos itens padrão (seed)
 */
function handleSeedItems(table, items, keyField) {
  if (!HEADERS[table]) throw new Error('Tabela desconhecida: ' + table);
  const existing = getSheetRows(table);
  const existingKeys = new Set(existing.map(x => String(x[keyField] || '').toLowerCase().trim()));
  
  let count = 0;
  const now = new Date().toISOString();
  
  for (const item of items) {
    const keyValue = String(item[keyField] || (typeof item === 'string' ? item : '')).toLowerCase().trim();
    if (!existingKeys.has(keyValue)) {
      const obj = typeof item === 'string' ? { [keyField]: item } : { ...item };
      obj.id = generateId(table.substring(0, 3));
      obj.ativo = true;
      obj.criadoEm = now;
      obj.atualizadoEm = now;
      appendSheetRow(table, obj);
      existingKeys.add(keyValue);
      count++;
    }
  }
  
  return { success: true, count: count };
}

/**
 * Gera um ID único simples
 */
function generateId(prefix) {
  const timestamp = new Date().getTime().toString(36);
  const rand = Math.random().toString(36).substring(2, 7);
  return `${prefix}_${timestamp}${rand}`;
}

// ============================================================
// INICIALIZAÇÃO AUTOMÁTICA DA PLANILHA
// ============================================================

/**
 * Garante que todas as abas e cabeçalhos existam.
 */
function ensureInitialized(force) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  Object.keys(HEADERS).forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    // Se a aba estiver vazia, cria os cabeçalhos
    if (sheet.getLastRow() === 0 || force) {
      sheet.clear();
      const headers = HEADERS[sheetName];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4F46E5');
      headerRange.setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }
  });
  
  // Remove a aba padrão se existirem outras abas
  const defaultSheet = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (e) {}
  }
  
  // Cria usuário administrador inicial se não existir nenhum usuário
  const userSheet = ss.getSheetByName(SHEETS.USUARIOS);
  if (userSheet && userSheet.getLastRow() <= 1) {
    appendSheetRow(SHEETS.USUARIOS, {
      id: 'usr_admin',
      email: 'admin@escola.edu.br',
      senha: 'admin',
      nome: 'Administrador TI / Coordenação',
      perfil: 'admin',
      professorId: '',
      criadoEm: new Date().toISOString()
    });
  }
}

// ============================================================
// firestore-service.js
// Serviço CRUD para todas as coleções do Firestore
// Inclui validação anticonflito e reservas recorrentes
// ============================================================

import { db } from './firebase-config.js';
import {
    collection, doc, addDoc, updateDoc, deleteDoc, getDoc,
    getDocs, query, where, orderBy, onSnapshot, serverTimestamp,
    writeBatch
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { hasAulaConflict, formatDateISO, getRecurringDates } from './utils.js';
import { showToast } from './ui-helpers.js';

// ========================
// LABORATÓRIOS
// ========================

/**
 * Busca todos os laboratórios ativos
 */
export async function getLaboratorios() {
    try {
        const q = query(collection(db, 'laboratorios'), orderBy('nome'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Erro ao buscar laboratórios:', error);
        return [];
    }
}

/**
 * Adiciona um novo laboratório
 */
export async function addLaboratorio(data) {
    try {
        const docRef = await addDoc(collection(db, 'laboratorios'), {
            ...data,
            ativo: true,
            criadoEm: serverTimestamp()
        });
        showToast('Laboratório cadastrado com sucesso!', 'success');
        return docRef.id;
    } catch (error) {
        console.error('Erro ao adicionar laboratório:', error);
        showToast('Erro ao cadastrar laboratório.', 'error');
        throw error;
    }
}

/**
 * Atualiza um laboratório
 */
export async function updateLaboratorio(id, data) {
    try {
        await updateDoc(doc(db, 'laboratorios', id), {
            ...data,
            atualizadoEm: serverTimestamp()
        });
        showToast('Laboratório atualizado!', 'success');
    } catch (error) {
        console.error('Erro ao atualizar laboratório:', error);
        showToast('Erro ao atualizar laboratório.', 'error');
        throw error;
    }
}

/**
 * Remove um laboratório (soft delete)
 */
export async function deleteLaboratorio(id) {
    try {
        await updateDoc(doc(db, 'laboratorios', id), { ativo: false });
        showToast('Laboratório removido.', 'info');
    } catch (error) {
        console.error('Erro ao remover laboratório:', error);
        showToast('Erro ao remover laboratório.', 'error');
        throw error;
    }
}

// ========================
// PROFESSORES
// ========================

/**
 * Busca todos os professores
 */
export async function getProfessores() {
    try {
        const q = query(collection(db, 'professores'), orderBy('nome'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Erro ao buscar professores:', error);
        return [];
    }
}

/**
 * Adiciona um novo professor
 */
export async function addProfessor(data) {
    try {
        const docRef = await addDoc(collection(db, 'professores'), {
            ...data,
            criadoEm: serverTimestamp()
        });
        showToast('Professor cadastrado com sucesso!', 'success');
        return docRef.id;
    } catch (error) {
        console.error('Erro ao adicionar professor:', error);
        showToast('Erro ao cadastrar professor.', 'error');
        throw error;
    }
}

/**
 * Atualiza um professor
 */
export async function updateProfessor(id, data) {
    try {
        await updateDoc(doc(db, 'professores', id), {
            ...data,
            atualizadoEm: serverTimestamp()
        });
        showToast('Professor atualizado!', 'success');
    } catch (error) {
        console.error('Erro ao atualizar professor:', error);
        showToast('Erro ao atualizar professor.', 'error');
        throw error;
    }
}

/**
 * Remove um professor
 */
export async function deleteProfessor(id) {
    try {
        await deleteDoc(doc(db, 'professores', id));
        showToast('Professor removido.', 'info');
    } catch (error) {
        console.error('Erro ao remover professor:', error);
        showToast('Erro ao remover professor.', 'error');
        throw error;
    }
}

// ========================
// CURSOS
// ========================

/**
 * Busca todos os cursos ativos
 */
export async function getCursos() {
    try {
        const q = query(collection(db, 'cursos'), orderBy('nome'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Erro ao buscar cursos:', error);
        return [];
    }
}

/**
 * Adiciona um novo curso
 */
export async function addCurso(data) {
    try {
        const docRef = await addDoc(collection(db, 'cursos'), {
            ...data,
            ativo: true,
            criadoEm: serverTimestamp()
        });
        showToast('Curso cadastrado com sucesso!', 'success');
        return docRef.id;
    } catch (error) {
        console.error('Erro ao adicionar curso:', error);
        showToast('Erro ao cadastrar curso.', 'error');
        throw error;
    }
}

/**
 * Atualiza um curso
 */
export async function updateCurso(id, data) {
    try {
        await updateDoc(doc(db, 'cursos', id), {
            ...data,
            atualizadoEm: serverTimestamp()
        });
        showToast('Curso atualizado!', 'success');
    } catch (error) {
        console.error('Erro ao atualizar curso:', error);
        showToast('Erro ao atualizar curso.', 'error');
        throw error;
    }
}

/**
 * Remove um curso (soft delete)
 */
export async function deleteCurso(id) {
    try {
        await updateDoc(doc(db, 'cursos', id), { ativo: false });
        showToast('Curso removido.', 'info');
    } catch (error) {
        console.error('Erro ao remover curso:', error);
        showToast('Erro ao remover curso.', 'error');
        throw error;
    }
}

// ========================
// RESERVAS
// ========================

/**
 * Busca reservas por data e (opcionalmente) laboratório e turno
 * @param {string} dataISO - Data no formato YYYY-MM-DD
 * @param {string} labId - ID do laboratório (opcional, '' para todos)
 * @param {string} turno - Turno (opcional, '' para todos)
 */
export async function getReservas(dataISO, labId = '', turno = '') {
    try {
        let q;
        const constraints = [where('data', '==', dataISO)];

        if (labId) constraints.push(where('labId', '==', labId));
        if (turno) constraints.push(where('turno', '==', turno));

        q = query(collection(db, 'reservas'), ...constraints);
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Erro ao buscar reservas:', error);
        return [];
    }
}

/**
 * Busca reservas de uma semana inteira (seg-sex)
 * @param {string[]} datesISO - Array de datas ISO
 */
export async function getReservasSemana(datesISO) {
    try {
        if (datesISO.length === 0) return [];
        const q = query(
            collection(db, 'reservas'),
            where('data', 'in', datesISO)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Erro ao buscar reservas da semana:', error);
        return [];
    }
}

/**
 * Busca reservas de um professor específico
 * @param {string} professorId
 */
export async function getReservasProfessor(professorId) {
    try {
        const q = query(
            collection(db, 'reservas'),
            where('professorId', '==', professorId),
            orderBy('data')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Erro ao buscar reservas do professor:', error);
        return [];
    }
}

/**
 * Busca reservas pendentes (para o painel admin)
 */
export async function getReservasPendentes() {
    try {
        const q = query(
            collection(db, 'reservas'),
            where('status', '==', 'pendente'),
            orderBy('data')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Erro ao buscar reservas pendentes:', error);
        return [];
    }
}

/**
 * Valida se há conflito de reserva (anticonflito)
 * Verifica se já existe reserva confirmada ou pendente no mesmo lab/data/turno/aulas
 * @param {string} labId
 * @param {string} dataISO
 * @param {string} turno
 * @param {number[]} aulas
 * @param {string} excludeId - ID da reserva a excluir da verificação (para edições)
 * @returns {{ hasConflict: boolean, conflictingReserva: object|null }}
 */
export async function checkConflict(labId, dataISO, turno, aulas, excludeId = '') {
    try {
        const q = query(
            collection(db, 'reservas'),
            where('labId', '==', labId),
            where('data', '==', dataISO),
            where('turno', '==', turno)
        );
        const snapshot = await getDocs(q);

        for (const docSnap of snapshot.docs) {
            if (docSnap.id === excludeId) continue;
            const reserva = docSnap.data();
            // Ignora reservas rejeitadas
            if (reserva.status === 'rejeitado') continue;
            // Verifica interseção de aulas
            if (hasAulaConflict(aulas, reserva.aulas || [])) {
                return {
                    hasConflict: true,
                    conflictingReserva: { id: docSnap.id, ...reserva }
                };
            }
        }

        return { hasConflict: false, conflictingReserva: null };
    } catch (error) {
        console.error('Erro na validação de conflito:', error);
        throw error;
    }
}

/**
 * Cria uma nova reserva (com validação anticonflito)
 * @param {object} reservaData
 * @param {boolean} isAdmin - Se admin, status direto = confirmado
 */
export async function createReserva(reservaData, isAdmin = false) {
    // Validação anticonflito
    const { hasConflict, conflictingReserva } = await checkConflict(
        reservaData.labId,
        reservaData.data,
        reservaData.turno,
        reservaData.aulas
    );

    if (hasConflict) {
        const msg = `Conflito: ${conflictingReserva.professorNome || 'Outro professor'} já reservou este laboratório neste horário (${conflictingReserva.status}).`;
        showToast(msg, 'error', 5000);
        return { success: false, conflict: conflictingReserva };
    }

    try {
        const docData = {
            ...reservaData,
            status: isAdmin ? 'confirmado' : 'pendente',
            criadoEm: serverTimestamp(),
            atualizadoEm: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, 'reservas'), docData);
        showToast(
            isAdmin ? 'Reserva confirmada com sucesso!' : 'Reserva enviada! Aguardando aprovação.',
            'success'
        );
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Erro ao criar reserva:', error);
        showToast('Erro ao criar reserva.', 'error');
        throw error;
    }
}

/**
 * Cria reservas recorrentes (uma por semana até a data final)
 * @param {object} baseData - Dados base da reserva
 * @param {string} dataFim - Data final da recorrência (ISO)
 * @param {boolean} isAdmin
 */
export async function createReservaRecorrente(baseData, dataFim, isAdmin = false) {
    const startDate = new Date(baseData.data + 'T00:00:00');
    const endDate = new Date(dataFim + 'T00:00:00');
    const dates = getRecurringDates(startDate, endDate);

    const results = { created: 0, conflicts: 0, errors: 0 };

    for (const date of dates) {
        const dataISO = formatDateISO(date);
        try {
            const reservaData = { ...baseData, data: dataISO, recorrente: true, recorrenteAte: dataFim };
            const result = await createReserva(reservaData, isAdmin);
            if (result.success) {
                results.created++;
            } else {
                results.conflicts++;
            }
        } catch {
            results.errors++;
        }
    }

    if (results.created > 0) {
        showToast(`${results.created} reserva(s) criada(s) com sucesso!${results.conflicts > 0 ? ` ${results.conflicts} conflito(s).` : ''}`, 'success', 5000);
    }

    return results;
}

/**
 * Atualiza o status de uma reserva
 * @param {string} id
 * @param {string} newStatus - confirmado|rejeitado|manutencao
 */
export async function updateReservaStatus(id, newStatus) {
    try {
        await updateDoc(doc(db, 'reservas', id), {
            status: newStatus,
            atualizadoEm: serverTimestamp()
        });
        const labels = { confirmado: 'aprovada', rejeitado: 'rejeitada', manutencao: 'marcada em manutenção' };
        showToast(`Reserva ${labels[newStatus] || 'atualizada'}!`, 'success');
    } catch (error) {
        console.error('Erro ao atualizar reserva:', error);
        showToast('Erro ao atualizar reserva.', 'error');
        throw error;
    }
}

/**
 * Cancela/remove uma reserva
 * @param {string} id
 */
export async function deleteReserva(id) {
    try {
        await deleteDoc(doc(db, 'reservas', id));
        showToast('Reserva cancelada.', 'info');
    } catch (error) {
        console.error('Erro ao cancelar reserva:', error);
        showToast('Erro ao cancelar reserva.', 'error');
        throw error;
    }
}

/**
 * Escuta reservas em tempo real para uma semana
 * @param {string[]} datesISO
 * @param {Function} callback
 * @returns {Function} Unsubscribe function
 */
export function onReservasChange(datesISO, callback) {
    if (datesISO.length === 0) return () => { };
    const q = query(
        collection(db, 'reservas'),
        where('data', 'in', datesISO)
    );
    return onSnapshot(q, (snapshot) => {
        const reservas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(reservas);
    }, (error) => {
        console.error('Erro no listener de reservas:', error);
    });
}

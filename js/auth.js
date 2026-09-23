// ============================================================
// auth.js
// Gerenciamento de autenticação Firebase e perfis de usuário
// ============================================================

import { auth, db } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
    doc, getDoc, setDoc
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { showToast, showLoader } from './ui-helpers.js';

/**
 * Estado do usuário atual
 */
let currentUser = null;
let currentUserProfile = null;
let authReadyResolve;
const authReadyPromise = new Promise(resolve => { authReadyResolve = resolve; });

/**
 * Retorna o usuário Firebase atual
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Retorna o perfil do usuário (doc do Firestore com role)
 */
export function getUserProfile() {
    return currentUserProfile;
}

/**
 * Verifica se o usuário é administrador
 */
export function isAdmin() {
    return currentUserProfile?.perfil === 'admin';
}

/**
 * Verifica se o usuário é professor
 */
export function isProfessor() {
    return currentUserProfile?.perfil === 'professor';
}

/**
 * Aguarda até que o estado de auth esteja pronto
 */
export function waitForAuth() {
    return authReadyPromise;
}

/**
 * Faz login com email e senha
 * @param {string} email
 * @param {string} password
 */
export async function login(email, password) {
    try {
        showLoader(true, 'Entrando...');
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        showToast('Login realizado com sucesso!', 'success');
        return userCredential.user;
    } catch (error) {
        console.error('Erro no login:', error);
        let msg = 'Erro ao fazer login.';
        switch (error.code) {
            case 'auth/user-not-found':
                msg = 'Usuário não encontrado.';
                break;
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                msg = 'Email ou senha incorretos.';
                break;
            case 'auth/invalid-email':
                msg = 'Email inválido.';
                break;
            case 'auth/too-many-requests':
                msg = 'Muitas tentativas. Tente novamente mais tarde.';
                break;
        }
        showToast(msg, 'error');
        throw error;
    } finally {
        showLoader(false);
    }
}

/**
 * Faz logout
 */
export async function logout() {
    try {
        await signOut(auth);
        currentUser = null;
        currentUserProfile = null;
        showToast('Logout realizado.', 'info');
    } catch (error) {
        console.error('Erro no logout:', error);
        showToast('Erro ao fazer logout.', 'error');
    }
}

/**
 * Registra um novo usuário (usado pelo admin para criar contas)
 * @param {string} email
 * @param {string} password
 * @param {object} profileData - { nome, perfil, professorId }
 */
export async function registerUser(email, password, profileData) {
    try {
        showLoader(true, 'Criando usuário...');
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        // Cria o perfil do usuário no Firestore
        await setDoc(doc(db, 'usuarios', uid), {
            email: email,
            nome: profileData.nome || '',
            perfil: profileData.perfil || 'professor',
            professorId: profileData.professorId || null,
            criadoEm: new Date().toISOString()
        });

        showToast('Usuário criado com sucesso!', 'success');
        return userCredential.user;
    } catch (error) {
        console.error('Erro ao registrar:', error);
        let msg = 'Erro ao criar usuário.';
        if (error.code === 'auth/email-already-in-use') {
            msg = 'Este email já está em uso.';
        } else if (error.code === 'auth/weak-password') {
            msg = 'A senha deve ter pelo menos 6 caracteres.';
        }
        showToast(msg, 'error');
        throw error;
    } finally {
        showLoader(false);
    }
}

/**
 * Carrega o perfil do usuário do Firestore
 * @param {string} uid
 */
async function loadUserProfile(uid) {
    try {
        const userDoc = await getDoc(doc(db, 'usuarios', uid));
        if (userDoc.exists()) {
            currentUserProfile = { id: uid, ...userDoc.data() };
        } else {
            // Se não tem perfil no Firestore, cria um padrão (professor)
            const defaultProfile = {
                email: currentUser.email,
                nome: currentUser.email.split('@')[0],
                perfil: 'professor',
                professorId: null,
                criadoEm: new Date().toISOString()
            };
            await setDoc(doc(db, 'usuarios', uid), defaultProfile);
            currentUserProfile = { id: uid, ...defaultProfile };
        }
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        currentUserProfile = {
            id: uid,
            email: currentUser?.email || '',
            nome: 'Usuário',
            perfil: 'professor',
            professorId: null
        };
    }
}

/**
 * Inicializa o observer de autenticação
 * @param {Function} onLogin - Callback quando o usuário loga
 * @param {Function} onLogout - Callback quando o usuário desloga
 */
export function initAuthObserver(onLogin, onLogout) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadUserProfile(user.uid);
            onLogin(user, currentUserProfile);
        } else {
            currentUser = null;
            currentUserProfile = null;
            onLogout();
        }
        authReadyResolve();
    });
}

/**
 * Atualiza o header com informações do usuário
 */
export function updateUserUI() {
    const userNameEl = document.getElementById('user-display-name');
    const userRoleEl = document.getElementById('user-role-badge');
    const userAvatarEl = document.getElementById('user-avatar-letter');

    if (currentUserProfile) {
        const nome = currentUserProfile.nome || currentUserProfile.email;
        if (userNameEl) userNameEl.textContent = nome;
        if (userRoleEl) {
            const isAdm = currentUserProfile.perfil === 'admin';
            userRoleEl.textContent = isAdm ? 'Administrador' : 'Professor';
            userRoleEl.className = `text-xs px-2 py-0.5 rounded-full font-medium ${isAdm ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`;
        }
        if (userAvatarEl) {
            userAvatarEl.textContent = nome.charAt(0).toUpperCase();
        }
    }
}

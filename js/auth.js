// ============================================================
// auth.js
// Gerenciamento de autenticação via Supabase (PostgreSQL) e Sessão Local
// ============================================================

import { getSupabaseClient, isSupabaseConfigured } from './supabase-config.js';
import { showToast, showLoader } from './ui-helpers.js';

/**
 * Estado do usuário autenticado na sessão
 */
let currentUser = null;
let currentUserProfile = null;
let authReadyResolve;
const authReadyPromise = new Promise(resolve => { authReadyResolve = resolve; });

let onLoginListener = null;
let onLogoutListener = null;

const STORAGE_KEY_USER = 'reserva_auth_user';

/**
 * Retorna o usuário atual
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Retorna o perfil do usuário atual (com role 'admin' ou 'professor')
 */
export function getUserProfile() {
    return currentUserProfile;
}

/**
 * Verifica se o usuário autenticado é administrador
 */
export function isAdmin() {
    return currentUserProfile?.perfil === 'admin';
}

/**
 * Verifica se o usuário autenticado é professor
 */
export function isProfessor() {
    return currentUserProfile?.perfil === 'professor';
}

/**
 * Aguarda a verificação de sessão estar pronta
 */
export function waitForAuth() {
    return authReadyPromise;
}

/**
 * Faz login com email e senha no Supabase
 * @param {string} email
 * @param {string} password
 */
export async function login(email, password) {
    const errorAlert = document.getElementById('login-error-alert');
    const errorText = document.getElementById('login-error-text');
    if (errorAlert) errorAlert.classList.add('hidden');

    try {
        showLoader(true, 'Entrando...');

        let userData = null;

        // Se o Supabase ainda não foi configurado, usa contas de demonstração local
        if (!isSupabaseConfigured()) {
            const cleanEmail = email.toLowerCase().trim();
            if (cleanEmail === 'admin@escola.edu.br' || cleanEmail.includes('admin')) {
                userData = {
                    id: 'usr_admin_mock',
                    email: email,
                    nome: 'Administrador (Demo Local)',
                    perfil: 'admin',
                    professorId: null
                };
            } else {
                userData = {
                    id: 'usr_prof_mock',
                    email: email,
                    nome: email.split('@')[0],
                    perfil: 'professor',
                    professorId: 'prof_1'
                };
            }
        } else {
            // Autenticação direta contra a tabela usuarios no Supabase
            const client = getSupabaseClient();
            if (!client) {
                throw new Error('Falha ao inicializar o cliente do Supabase.');
            }

            const { data, error } = await client
                .from('usuarios')
                .select('id, email, senha, nome, perfil, professor_id')
                .ilike('email', email.trim())
                .eq('senha', password)
                .maybeSingle();

            if (error) {
                throw new Error(`Erro no banco Supabase: ${error.message}`);
            }

            if (!data) {
                throw new Error('Credenciais inválidas. Verifique o email e senha informados.');
            }

            userData = {
                id: data.id,
                email: data.email,
                nome: data.nome,
                perfil: data.perfil,
                professorId: data.professor_id || null
            };
        }

        // Configura a sessão
        currentUser = { uid: userData.id, email: userData.email };
        currentUserProfile = userData;

        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userData));

        showToast('Login realizado com sucesso!', 'success');
        if (onLoginListener) {
            onLoginListener(currentUser, currentUserProfile);
        }

        return currentUser;

    } catch (error) {
        console.error('Erro detalhado no login:', error);
        const msg = error.message || 'Erro ao realizar login. Verifique suas credenciais.';

        if (errorAlert && errorText) {
            errorText.textContent = msg;
            errorAlert.classList.remove('hidden');
        }

        showToast(msg, 'error', 6000);
        throw error;
    } finally {
        showLoader(false);
    }
}

/**
 * Faz logout e limpa a sessão local
 */
export async function logout() {
    try {
        currentUser = null;
        currentUserProfile = null;
        localStorage.removeItem(STORAGE_KEY_USER);

        // Se houver sessão no Supabase Auth, efetua signOut
        const client = getSupabaseClient();
        if (client?.auth) {
            await client.auth.signOut().catch(() => {});
        }

        showToast('Logout realizado.', 'info');
        if (onLogoutListener) {
            onLogoutListener();
        }
    } catch (error) {
        console.error('Erro no logout:', error);
        showToast('Erro ao fazer logout.', 'error');
    }
}

/**
 * Registra um novo usuário no banco Supabase
 * @param {string} email
 * @param {string} password
 * @param {object} profileData - { nome, perfil, professorId }
 */
export async function registerUser(email, password, profileData) {
    try {
        showLoader(true, 'Criando usuário no Supabase...');

        if (!isSupabaseConfigured()) {
            showToast('Usuário cadastrado no modo local!', 'success');
            return { uid: 'usr_' + Date.now(), email };
        }

        const client = getSupabaseClient();
        if (!client) throw new Error('Cliente Supabase indisponível.');

        const cleanEmail = email.trim().toLowerCase();

        // Verifica duplicidade
        const { data: existing } = await client
            .from('usuarios')
            .select('id')
            .eq('email', cleanEmail)
            .maybeSingle();

        if (existing) {
            throw new Error('Este email já está cadastrado.');
        }

        const newUser = {
            id: 'usr_' + Date.now().toString(36),
            email: cleanEmail,
            senha: password,
            nome: profileData.nome || cleanEmail.split('@')[0],
            perfil: profileData.perfil || 'professor',
            professor_id: profileData.professorId || ''
        };

        const { error } = await client.from('usuarios').insert([newUser]);
        if (error) {
            throw new Error('Erro ao salvar usuário no Supabase: ' + error.message);
        }

        showToast('Usuário criado com sucesso no Supabase!', 'success');
        return { uid: newUser.id, email: newUser.email };

    } catch (error) {
        console.error('Erro ao registrar:', error);
        showToast(error.message || 'Erro ao criar usuário.', 'error');
        throw error;
    } finally {
        showLoader(false);
    }
}

/**
 * Inicializa o observador de autenticação
 * Restaura automaticamente o login a partir do localStorage
 */
export function initAuthObserver(onLogin, onLogout) {
    onLoginListener = onLogin;
    onLogoutListener = onLogout;

    try {
        const stored = localStorage.getItem(STORAGE_KEY_USER);
        if (stored) {
            const userData = JSON.parse(stored);
            currentUser = { uid: userData.id, email: userData.email };
            currentUserProfile = userData;
            onLogin(currentUser, currentUserProfile);
        } else {
            currentUser = null;
            currentUserProfile = null;
            onLogout();
        }
    } catch (err) {
        console.error('Erro ao restaurar sessão de login:', err);
        currentUser = null;
        currentUserProfile = null;
        onLogout();
    }

    authReadyResolve();
}

/**
 * Atualiza o header da aplicação com informações do usuário autenticado
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

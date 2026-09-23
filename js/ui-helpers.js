// ============================================================
// ui-helpers.js
// Componentes de UI reutilizáveis: toasts, modais, loaders
// ============================================================

/**
 * Exibe um toast de notificação
 * @param {string} message - Mensagem do toast
 * @param {'success'|'error'|'warning'|'info'} type - Tipo do toast
 * @param {number} duration - Duração em ms (default 3500)
 */
export function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
        success: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`,
        error: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
        warning: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M12 3l9.5 16.5H2.5L12 3z"/></svg>`,
        info: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"/></svg>`
    };

    const colors = {
        success: 'bg-emerald-600',
        error: 'bg-red-600',
        warning: 'bg-amber-500',
        info: 'bg-blue-600'
    };

    const toast = document.createElement('div');
    toast.className = `flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-white ${colors[type]} 
        transform translate-x-full opacity-0 transition-all duration-500 ease-out
        backdrop-blur-sm min-w-[300px] max-w-[420px]`;
    toast.innerHTML = `
        <span class="flex-shrink-0">${icons[type]}</span>
        <span class="text-sm font-medium flex-1">${message}</span>
        <button onclick="this.parentElement.remove()" class="flex-shrink-0 ml-2 opacity-70 hover:opacity-100 transition-opacity">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
    `;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
        toast.classList.add('translate-x-0', 'opacity-100');
    });

    // Auto-remove
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 500);
    }, duration);
}

/**
 * Exibe um modal de confirmação
 * @param {string} title - Título do modal
 * @param {string} message - Mensagem do modal
 * @param {string} confirmText - Texto do botão confirmar
 * @param {'danger'|'primary'} variant - Variante visual
 * @returns {Promise<boolean>}
 */
export function showConfirm(title, message, confirmText = 'Confirmar', variant = 'primary') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadeIn';
        overlay.innerHTML = `
            <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" id="confirm-backdrop"></div>
            <div class="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scaleIn">
                <h3 class="text-lg font-bold text-gray-900 mb-2">${title}</h3>
                <p class="text-gray-600 text-sm mb-6">${message}</p>
                <div class="flex gap-3 justify-end">
                    <button id="confirm-cancel" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">
                        Cancelar
                    </button>
                    <button id="confirm-ok" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors
                        ${variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}">
                        ${confirmText}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const close = (result) => {
            overlay.classList.add('animate-fadeOut');
            setTimeout(() => {
                overlay.remove();
                resolve(result);
            }, 200);
        };

        overlay.querySelector('#confirm-backdrop').addEventListener('click', () => close(false));
        overlay.querySelector('#confirm-cancel').addEventListener('click', () => close(false));
        overlay.querySelector('#confirm-ok').addEventListener('click', () => close(true));
    });
}

/**
 * Exibe/oculta o loader global
 * @param {boolean} show
 * @param {string} message
 */
export function showLoader(show, message = 'Carregando...') {
    let loader = document.getElementById('global-loader');
    if (show) {
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'global-loader';
            loader.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn';
            loader.innerHTML = `
                <div class="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 animate-scaleIn">
                    <div class="loader-spinner"></div>
                    <span class="text-sm font-medium text-gray-700" id="loader-message">${message}</span>
                </div>
            `;
            document.body.appendChild(loader);
        } else {
            const msg = loader.querySelector('#loader-message');
            if (msg) msg.textContent = message;
            loader.classList.remove('hidden');
        }
    } else if (loader) {
        loader.classList.add('hidden');
        setTimeout(() => loader.remove(), 100);
    }
}

/**
 * Abre um modal genérico (já existente no DOM por ID)
 * @param {string} modalId
 */
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    requestAnimationFrame(() => {
        modal.querySelector('.modal-content')?.classList.add('animate-scaleIn');
    });
    document.body.style.overflow = 'hidden';
}

/**
 * Fecha um modal genérico
 * @param {string} modalId
 */
export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const content = modal.querySelector('.modal-content');
    if (content) {
        content.classList.add('animate-scaleOut');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            content.classList.remove('animate-scaleOut', 'animate-scaleIn');
            document.body.style.overflow = '';
        }, 200);
    } else {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = '';
    }
}

/**
 * Cria um badge/chip de status com a cor adequada
 * @param {string} status - confirmado|pendente|manutencao|livre
 * @returns {string} HTML do badge
 */
export function createStatusBadge(status) {
    const configs = {
        confirmado: { label: 'Confirmado', cls: 'bg-violet-100 text-violet-800 border-violet-200' },
        pendente: { label: 'Pendente', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
        manutencao: { label: 'Manutenção', cls: 'bg-red-100 text-red-800 border-red-200' },
        livre: { label: 'Livre', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
        rejeitado: { label: 'Rejeitado', cls: 'bg-gray-100 text-gray-600 border-gray-200' }
    };
    const cfg = configs[status] || configs.livre;
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.cls}">${cfg.label}</span>`;
}

/**
 * Cria um skeleton loader para cards
 * @param {number} count
 * @returns {string}
 */
export function createSkeletonCards(count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="bg-white rounded-xl p-4 animate-pulse">
                <div class="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div class="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div class="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
                <div class="h-8 bg-gray-200 rounded w-1/3 mt-3"></div>
            </div>
        `;
    }
    return html;
}

// ============================================================
// firebase-config.js
// Inicialização do Firebase App, Firestore e Authentication.
// INSTRUÇÃO: Substitua os valores de firebaseConfig com as
// credenciais do seu projeto Firebase.
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

/**
 * ⚠️ IMPORTANTE: Substitua os valores abaixo com as credenciais
 * do seu projeto Firebase. Para obter estas credenciais:
 * 1. Acesse https://console.firebase.google.com
 * 2. Crie ou selecione um projeto
 * 3. Vá em Configurações do Projeto > Geral
 * 4. Na seção "Seus apps", copie a configuração do SDK
 */
const firebaseConfig = {
    apiKey: "SUA_API_KEY_AQUI",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJECT_ID",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
};

// Inicializa o Firebase App
const app = initializeApp(firebaseConfig);

// Inicializa o Firestore Database
const db = getFirestore(app);

// Inicializa o Firebase Authentication
const auth = getAuth(app);

export { app, db, auth };

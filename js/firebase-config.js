// ============================================================
// firebase-config.js
// Inicialização do Firebase App, Firestore e Authentication.
// INSTRUÇÃO: Substitua os valores de firebaseConfig com as
// credenciais do seu projeto Firebase.
// ============================================================

import { initializeApp } from 'firebase/app';


/**
 * ⚠️ IMPORTANTE: Substitua os valores abaixo com as credenciais
 * do seu projeto Firebase. Para obter estas credenciais:
 * 1. Acesse https://console.firebase.google.com
 * 2. Crie ou selecione um projeto
 * 3. Vá em Configurações do Projeto > Geral
 * 4. Na seção "Seus apps", copie a configuração do SDK
 */
const firebaseConfig = {
    apiKey: "AIzaSyCaXOPwCdWAPwhZa3nRGvupJjPOaciU47k",
    authDomain: "reserva-labs-etec.firebaseapp.com",
    projectId: "reserva-labs-etec",
    storageBucket: "reserva-labs-etec.firebasestorage.app",
    messagingSenderId: "119831259870",
    appId: "1:119831259870:web:7cea43c72a7200f21ff04f"
};

// Inicializa o Firebase App
const app = initializeApp(firebaseConfig);

// Inicializa o Firestore Database
const db = getFirestore(app);

// Inicializa o Firebase Authentication
const auth = getAuth(app);

export { app, db, auth };

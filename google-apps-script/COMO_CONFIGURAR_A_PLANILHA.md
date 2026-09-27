# 📋 Passo a Passo: Configuração da Planilha Google Sheets

Este guia explica como transformar uma planilha do Google Drive em um banco de dados 100% gratuito para o seu **Sistema de Reserva de Salas** hospedado no GitHub Pages.

---

## 🚀 Passo 1: Criar uma Nova Planilha no Google Drive

1. Acesse o seu Google Drive ou digite no navegador: [sheets.new](https://sheets.new)
2. Dê um nome para a planilha no canto superior esquerdo, por exemplo:
   **`Reserva de Laboratórios - ETEC 051`**

---

## ⚙️ Passo 2: Abrir o Editor do Google Apps Script

1. No menu superior da planilha, clique em: **Extensões** > **Apps Script**.
2. Uma nova aba do navegador será aberta com o editor de código.
3. Apague qualquer código existente (como `function myFunction() { ... }`).
4. Abra o arquivo [Codigo.gs](file:///g:/Meu%20Drive/Reserva%20de%20Salas/google-apps-script/Codigo.gs) deste projeto, copie todo o seu conteúdo e cole dentro do editor do Apps Script.
5. Clique no ícone de disquete 💾 (**Salvar projeto**) ou aperte `Ctrl + S`.

---

## 🌐 Passo 3: Implantar como App da Web (Web App)

1. No canto superior direito da tela do Apps Script, clique no botão azul **Implantar** (Deploy) > **Nova implantação** (New deployment).
2. Na janela que abrir, clique no ícone de engrenagem ⚙️ (ao lado de "Selecione o tipo") e escolha **App da Web** (Web App).
3. Preencha os campos com muita atenção:
   * **Descrição:** `API Reserva de Salas`
   * **Executar como:** `Eu (seu-email@gmail.com)`
   * **Quem pode acessar:** `Qualquer pessoa` *(Anyone)*  
     *(⚠️ **Muito importante:** Esta opção permite que o site no GitHub Pages consiga ler e salvar as reservas).*
4. Clique no botão azul **Implantar** (Deploy).
5. O Google solicitará autorização:
   * Clique em **Autorizar acesso**.
   * Escolha sua conta Google.
   * Se aparecer a tela *"O Google não verificou este app"*, clique em **Avançado** (no rodapé) e depois em **Acessar projeto (não seguro)**.
   * Clique em **Permitir**.
6. Uma tela final exibirá a **URL do app da Web** (termina com `/exec`).  
   Exemplo:
   `https://script.google.com/macros/s/AKfycbx.../exec`
7. Clique em **Copiar** para guardar essa URL.

---

## 🔗 Passo 4: Conectar a URL no Projeto

1. Abra o arquivo [js/sheet-config.js](file:///g:/Meu%20Drive/Reserva%20de%20Salas/js/sheet-config.js) no seu editor de código.
2. Cole a URL copiada na constante `SHEET_API_URL`:
   ```javascript
   export const SHEET_API_URL = "https://script.google.com/macros/s/SUA_CHAVE_AQUI/exec";
   ```
3. Salve o arquivo.

**Pronto! 🎉** 
Ao abrir o site (no GitHub Pages ou servidor local), o sistema criará automaticamente todas as abas necessárias na planilha:
* `laboratorios`
* `professores`
* `cursos`
* `turmas`
* `disciplinas`
* `reservas`
* `usuarios`

---

## 🔑 Contas de Acesso Padrão Criadas Automaticamente

| Perfil | Email | Senha |
| :--- | :--- | :--- |
| **Administrador** | `admin@escola.edu.br` | `admin` |
| **Professor** | `professor@escola.edu.br` | `prof` |

*(Você pode alterar as senhas ou criar novos usuários diretamente na aba `usuarios` da planilha ou pelo Painel do Administrador no sistema).*

// ============================================================
//  FRAGA — Popup Script
//  Toda comunicação com o backend passa por aqui.
//  A API key da Anthropic NUNCA aparece aqui — fica no backend.
// ============================================================

const API_URL = 'https://fraga-backend-cPe6-production.up.railway.app';

let currentTone   = 'auto';
let pageContext   = null;
let isLoading     = false;

// ── Inicialização ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const token = await getTestToken();
  if (token) {
    await initChat(token);
  }
  await loadPageContext();
});

// ── Pega token de teste (sem login) ───────────────────────────
async function getTestToken() {
  try {
    const res = await fetch(API_URL + '/auth/test-token');
    const data = await res.json();
    return data.token;
  } catch {
    return null;
  }
}

// ── Inicia chat ────────────────────────────────────────────────
async function initChat(token, userData = null) {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('chat-screen').classList.remove('hidden');

  if (!userData) {
    try {
      const res  = await fetch(API_URL + '/me', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) { location.reload(); return; }
      userData = await res.json();
    } catch {
      addMessage('Erro ao conectar. Verifique sua internet.', 'error');
      return;
    }
  }

  if (userData.usage_count !== undefined) {
    updateUsageDisplay(userData.usage_count, userData.usage_limit || 50);
  }

  const greeting = userData.name
    ? `Olá, ${userData.name.split(' ')[0]}! Como posso te ajudar hoje?`
    : 'Olá! Como posso te ajudar hoje?';
  addMessage(greeting, 'assistant');
}

// ── Contexto da página ────────────────────────────────────────
async function loadPageContext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    document.getElementById('page-url-display').textContent = tab.title || tab.url;

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        url:   location.href,
        title: document.title,
        text:  document.body?.innerText?.slice(0, 2000) || '',
      }),
    });

    if (results && results[0]?.result) {
      pageContext = results[0].result;
      document.getElementById('page-url-display').textContent =
        pageContext.title || pageContext.url;
    }
  } catch {
    document.getElementById('page-context-bar').classList.add('hidden');
  }
}

// ── Tom de resposta ───────────────────────────────────────────
function setTone(btn) {
  document.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentTone = btn.dataset.tone;
}

// ── Envio de mensagem ─────────────────────────────────────────
async function sendMessage() {
  if (isLoading) return;
  const input = document.getElementById('msg-input');
  const text  = input.value.trim();
  if (!text) return;

  const token = await getTestToken();
  if (!token) { 
    addMessage('Erro ao obter token. Recarregue a extensão.', 'error');
    return; 
  }

  input.value = '';
  input.style.height = 'auto';
  isLoading = true;
  document.getElementById('send-btn').disabled = true;

  addMessage(text, 'user');
  addTyping();

  try {
    const res = await fetch(API_URL + '/chat', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({
        message:     text,
        tone:        currentTone,
        pageContext: pageContext,
      }),
    });

    const data = await res.json();
    removeTyping();

    if (res.status === 402) {
      document.getElementById('limit-bar').classList.remove('hidden');
      document.getElementById('send-btn').disabled = true;
      input.disabled = true;
      addMessage('Você atingiu o limite do plano gratuito. Faça upgrade para continuar!', 'system');
      return;
    }

    if (!res.ok) {
      addMessage('Erro: ' + (data.error || 'Algo deu errado.'), 'error');
      return;
    }

    addMessage(data.reply, 'assistant');

    if (data.usage !== undefined) {
      updateUsageDisplay(data.usage, data.limit || 50);
    }

  } catch {
    removeTyping();
    addMessage('Erro de conexão. Verifique sua internet.', 'error');
  } finally {
    isLoading = false;
    document.getElementById('send-btn').disabled = false;
  }
}

// ── UI helpers ────────────────────────────────────────────────
function addMessage(text, role) {
  const container = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function addTyping() {
  const container = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'typing';
  div.id = 'typing-indicator';
  div.innerHTML = '<span></span><span></span><span></span>';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function removeTyping() {
  document.getElementById('typing-indicator')?.remove();
}

function updateUsageDisplay(used, limit) {
  const el = document.getElementById('usage-display');
  el.textContent = `${used}/${limit} perguntas`;
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

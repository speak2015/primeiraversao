// ============================================================
//  FRAGA — Content Script
//  Roda em todas as páginas. Só lê conteúdo — não modifica nada.
// ============================================================

// Escuta mensagens do popup pedindo conteúdo da página
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageContent') {
    sendResponse({
      url:   window.location.href,
      title: document.title,
      text:  document.body?.innerText?.slice(0, 2000) || '',
    });
  }
  return true;
});

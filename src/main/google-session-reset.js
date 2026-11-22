'use strict';
const { session } = require('electron');
const fs = require('fs');
const path = require('path');

const GOOGLE_DOMAINS = ['.google.com', '.gmail.com', '.youtube.com', '.google.pt', '.googleapis.com', '.gstatic.com'];

async function resetGoogleSession(targetSession) {
  try {
    const cookies = await targetSession.cookies.get({});
    for (const cookie of cookies) {
      if (GOOGLE_DOMAINS.some(d => cookie.domain.endsWith(d))) {
        await targetSession.cookies.remove(cookie.domain.startsWith('.') ? 'https://' + cookie.domain.substring(1) + cookie.path : 'https://' + cookie.domain + cookie.path, cookie.name);
      }
    }
    // Limpar storage local do Gmail e Login
    const origins = ['https://mail.google.com', 'https://accounts.google.com', 'https://www.youtube.com'];
    for (const origin of origins) {
      await targetSession.clearStorageData({ origin, storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers'] });
    }
    console.log('[Kortex] Sessao do Google limpa com sucesso.');
  } catch (e) {
    console.error('[Kortex] Erro ao limpar sessao:', e);
  }
}

module.exports = { resetGoogleSession };
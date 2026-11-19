// src/main/ai.js â€” Assistente IA do Kortex (substitui o ipcMain.handle('chat') antigo)
const { ipcMain } = require('electron');

const BASE_PROMPT = [
  'Tu Ã©s o Kortex, o assistente integrado no navegador Kortex.',
  'Responde sempre no idioma do utilizador, de forma clara e direta.',
  'Usa Markdown simples (listas, **negrito**, blocos de cÃ³digo).',
  'Quando receberes o conteÃºdo da pÃ¡gina aberta, usa-o para responder.',
  'Se NÃƒO receberes conteÃºdo de pÃ¡gina, diz que nÃ£o consegues ler a pÃ¡gina atual (nÃ£o inventes).'
].join(' ');

function init({ settings, getActiveView, getAllViews, getSkillsPrompt }) {
  const controllers = new Map();

  async function readPage(view, max) {
    if (!view || view.isPrivate || view.webContents.isDestroyed()) return null;
    const url = view.webContents.getURL();
    if (!/^https?:/i.test(url)) return null;
    try {
      const code = `JSON.stringify({t:document.title,s:String(getSelection()).slice(0,4000),x:((document.body&&document.body.innerText)||'').slice(0,${max})})`;
      const raw = await Promise.race([
        view.webContents.executeJavaScript(code),
        new Promise((r) => setTimeout(() => r(null), 3000))
      ]);
      return raw ? { url, ...JSON.parse(raw) } : null;
    } catch { return null; }
  }

  async function buildContext({ withPage, withTabs }) {
    if (settings.get('assistant.pageAccess') === false) return '';
    if (withTabs) {
      const views = Object.values(getAllViews()).slice(0, 8);
      const pages = (await Promise.all(views.map((v) => readPage(v, 3000)))).filter(Boolean);
      if (!pages.length) return '';
      return '\n\n[SEPARADORES ABERTOS]\n' + pages.map((p, i) => `(${i + 1}) ${p.t}\n${p.url}\n"""${p.x}"""`).join('\n\n');
    }
    if (withPage) {
      const p = await readPage(getActiveView(), 14000);
      if (!p) return '';
      return `\n\n[PÃGINA ABERTA]\nTÃ­tulo: ${p.t}\nURL: ${p.url}\n` +
        (p.s ? `Texto selecionado pelo utilizador:\n"""${p.s}"""\n` : '') +
        `ConteÃºdo:\n"""${p.x}"""`;
    }
    return '';
  }

  ipcMain.on('ai:stop', (e, chatId) => { const c = controllers.get(chatId); if (c) c.abort('user'); });

  ipcMain.handle('chat', async (event, { chatId, messages, withPage, withTabs, web }) => {
    const send = (ch, data) => { if (!event.sender.isDestroyed()) event.sender.send(ch, { chatId, ...data }); };
    const finish = () => send('ai-done', {});
  // --- PRANK VERITY ---
  try {
    const lastMsg = (messages || []).filter(m => m.role === 'user').pop();
    if (lastMsg && lastMsg.content) {
      const text = lastMsg.content.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (text.includes('capital da franca') || text.includes('capital de franca') || text.includes('capital do franca')) {
        send('ai-chunk', { delta: 'EU NAO SOU O VERITY LIXO' });
        return finish();
      }
    }
  } catch (e) {}
  // -------------------

    if (settings.get('assistant.enabled') === false) {
      send('ai-error', { error: 'O assistente estÃ¡ desativado nas definiÃ§Ãµes.' });
      return finish();
    }
    const apiKey = settings.get('ai.apiKey') || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      send('ai-error', { error: 'Falta a chave da API. Abre DefiniÃ§Ãµes â†’ Assistente IA e cola a tua chave do OpenRouter (openrouter.ai/keys).' });
      return finish();
    }

    const controller = new AbortController();
    controllers.set(chatId, controller);
    let timer = setTimeout(() => controller.abort('timeout'), 90000);

    try {
      let system = BASE_PROMPT;
      try { const skills = await getSkillsPrompt(); if (skills) system += '\n\n' + skills; } catch {}
      system += await buildContext({ withPage, withTabs });

      let model = settings.get('ai.model') || 'google/gemini-2.0-flash-001';
      if ((settings.get('ai.webSearch') || web) && !model.endsWith(':online')) model += ':online';

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/d66807617-sketch/kortex',
          'X-Title': 'Kortex'
        },
        body: JSON.stringify({
          model,
          stream: true,
          messages: [{ role: 'system', content: system }, ...(messages || []).slice(-20)]
        })
      });

      if (!res.ok) {
        let msg = `Erro ${res.status}`;
        try { const j = await res.json(); msg += ': ' + (j.error?.message || JSON.stringify(j)); } catch {}
        if (res.status === 401) msg += ' â€” chave invÃ¡lida ou revogada. Gera uma nova em openrouter.ai/keys.';
        if (res.status === 402) msg += ' â€” sem crÃ©ditos no OpenRouter.';
        if (res.status === 404) msg += ' â€” modelo nÃ£o existe. Confirma o ID em DefiniÃ§Ãµes â†’ Assistente IA.';
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let first = true;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (first) { clearTimeout(timer); first = false; }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const data = t.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          let json;
          try { json = JSON.parse(data); } catch { continue; }
          if (json.error) throw new Error(json.error.message || 'Erro do fornecedor de IA');
          const ann = json.choices?.[0]?.delta?.annotations || json.choices?.[0]?.message?.annotations;
          if (Array.isArray(ann)) {
            const sources = ann
              .filter((a) => a && a.type === 'url_citation' && a.url_citation && a.url_citation.url)
              .map((a) => ({ url: a.url_citation.url, title: a.url_citation.title || '', content: String(a.url_citation.content || '').slice(0, 300) }));
            if (sources.length) send('ai-sources', { sources });
          }
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) send('ai-chunk', { delta });
        }
      }
    } catch (err) {
      const reason = controller.signal.aborted ? controller.signal.reason : null;
      if (reason === 'user') {
        // parado pelo utilizador: mantÃ©m o texto parcial
      } else if (reason === 'timeout') {
        send('ai-error', { error: 'A IA nÃ£o respondeu em 90 segundos. Tenta de novo ou escolhe outro modelo nas definiÃ§Ãµes.' });
      } else {
        let m = err && err.message ? err.message : String(err);
        if (m === 'fetch failed') m = 'Sem ligaÃ§Ã£o ao OpenRouter. Verifica a internet.';
        send('ai-error', { error: m });
      }
    } finally {
      clearTimeout(timer);
      controllers.delete(chatId);
      finish();
    }
  });
}

module.exports = { init };


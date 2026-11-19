// src/main/ai.js — Assistente IA do Kortex
const { ipcMain } = require('electron');

const SEARCH_PROMPT = `Tu és o Kortex, um motor de busca com IA, semelhante ao Perplexity e Comet.
O teu objetivo é responder de forma direta, estruturada e com fontes.
REGRA DE FORMATAÇÃO:
1. Começa com um parágrafo direto a responder à pergunta.
2. Usa tabelas Markdown, listas e negritos para organizar a informação.
3. No final, adiciona uma secção "### Fontes" com links reais (https://...) que usaste para obter a informação.
Responde sempre em português.`;

const BASE_PROMPT = [
  'Tu és o Kortex, o assistente integrado no navegador Kortex.',
  'Responde sempre no idioma do utilizador, de forma clara e direta.',
  'Usa Markdown simples (listas, **negrito**, blocos de código).',
  'Quando receberes o conteúdo da página aberta, usa-o para responder.',
  'Se NÃO receberes conteúdo de página, diz que não consegues ler a página atual (não inventes).'
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
      return `\n\n[PÁGINA ABERTA]\nTítulo: ${p.t}\nURL: ${p.url}\n` +
        (p.s ? `Texto selecionado pelo utilizador:\n"""${p.s}"""\n` : '') +
        `Conteúdo:\n"""${p.x}"""`;
    }
    return '';
  }

  ipcMain.on('ai:stop', (e, chatId) => { const c = controllers.get(chatId); if (c) c.abort('user'); });

  ipcMain.handle('chat', async (event, { chatId, messages, withPage, withTabs, mode }) => {
    const send = (ch, data) => { if (!event.sender.isDestroyed()) event.sender.send(ch, { chatId, ...data }); };
    const finish = () => send('ai-done', {});

    if (settings.get('assistant.enabled') === false) {
      send('ai-error', { error: 'O assistente está desativado nas definições.' });
      return finish();
    }
    const apiKey = settings.get('ai.apiKey') || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      send('ai-error', { error: 'Falta a chave da API. Abre Definições → Assistente IA e cola a tua chave do OpenRouter (openrouter.ai/keys).' });
      return finish();
    }

    const controller = new AbortController();
    controllers.set(chatId, controller);
    let timer = setTimeout(() => controller.abort('timeout'), 30000);

    try {
      let system = mode === 'search' ? SEARCH_PROMPT : BASE_PROMPT;
      try { const skills = await getSkillsPrompt(); if (skills) system += '\n\n' + skills; } catch {}
      system += await buildContext({ withPage, withTabs });

      let model = settings.get('ai.model') || 'google/gemini-2.0-flash-001';
      if (settings.get('ai.webSearch') && !model.endsWith(':online')) model += ':online';

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
        if (res.status === 401) msg += ' — chave inválida ou revogada. Gera uma nova em openrouter.ai/keys.';
        if (res.status === 402) msg += ' — sem créditos no OpenRouter.';
        if (res.status === 404) msg += ' — modelo não existe. Confirma o ID em Definições → Assistente IA.';
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
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) send('ai-chunk', { delta });
        }
      }
    } catch (err) {
      const reason = controller.signal.aborted ? controller.signal.reason : null;
      if (reason === 'user') {
      } else if (reason === 'timeout') {
        send('ai-error', { error: 'A IA não respondeu em 30 segundos. Tenta de novo ou escolhe outro modelo nas definições.' });
      } else {
        let m = err && err.message ? err.message : String(err);
        if (m === 'fetch failed') m = 'Sem ligação ao OpenRouter. Verifica a internet.';
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
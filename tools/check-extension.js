#!/usr/bin/env node
// tools/check-extension.js — diagnostica porque é que o service worker de uma extensão (Manifest V3) falha a registar.
// Uso:  node tools/check-extension.js "C:\caminho\para\roblox-companion-natal_2"
//
// "Service worker registration failed. Status code: 2" significa que o Chromium não conseguiu CORRER o script
// do service worker. As causas habituais são todas verificáveis a partir do manifest e do próprio ficheiro.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const dir = process.argv[2];
if (!dir) { console.error('Uso: node tools/check-extension.js <pasta-da-extensão>'); process.exit(2); }

const problems = [];
const notes = [];
const fail = (m) => problems.push(m);

const manifestPath = path.join(dir, 'manifest.json');
if (!fs.existsSync(manifestPath)) { console.error('Não encontrei manifest.json em: ' + dir + '\n(Carregaste a pasta certa? Tem de ser a que contém o manifest.json diretamente.)'); process.exit(1); }

let manifest;
try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '')); }
catch (e) { console.error('manifest.json inválido (JSON):', e.message); process.exit(1); }

console.log(`Extensão: ${manifest.name} v${manifest.version} (manifest_version ${manifest.manifest_version})`);

const bg = manifest.background || {};
if (manifest.manifest_version !== 3) notes.push('Não é Manifest V3: o erro de service worker não vem daqui. Verifica "background.scripts"/"page".');

if (manifest.manifest_version === 3) {
  if (!bg.service_worker) {
    fail('Falta "background.service_worker" no manifest (em MV3 o campo é "service_worker", não "scripts").');
  } else {
    const sw = bg.service_worker;
    if (/^[/\\]/.test(sw) || /^[a-z]+:/i.test(sw)) fail(`"service_worker" tem de ser um caminho relativo à pasta da extensão (sem "/" inicial nem URL): "${sw}"`);
    const swPath = path.join(dir, sw);
    if (!fs.existsSync(swPath)) {
      fail(`O ficheiro do service worker não existe: ${sw}`);
      const base = path.basename(sw).toLowerCase();
      const all = fs.readdirSync(dir, { recursive: true }).map(String);
      const near = all.find((f) => path.basename(f).toLowerCase() === base);
      if (near) fail(`  → existe "${near}": o nome tem de coincidir letra a letra (maiúsculas incluídas).`);
    } else {
      const src = fs.readFileSync(swPath, 'utf8');

      // 1) Sintaxe
      const check = spawnSync(process.execPath, ['--check', swPath], { encoding: 'utf8' });
      const looksModule = /^\s*(import\s.+from|export\s)/m.test(src);
      if (check.status !== 0 && !(looksModule && bg.type !== 'module')) fail('Erro de sintaxe no service worker:\n    ' + check.stderr.split('\n').slice(0, 4).join('\n    '));

      // 2) ES modules sem "type": "module"
      if (looksModule && bg.type !== 'module') fail('O ficheiro usa import/export mas o manifest não tem "background": { "type": "module" }. Acrescenta-o.');
      if (!looksModule && bg.type === 'module') notes.push('"type": "module" definido mas o ficheiro não usa import/export (inofensivo).');

      // 3) importScripts / imports que apontam para ficheiros inexistentes
      const refs = [...src.matchAll(/importScripts\(([^)]*)\)/g)].flatMap((m) => [...m[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((x) => x[1]))
        .concat([...src.matchAll(/(?:import\s[^'"]*from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));
      refs.filter((r) => /^[./]/.test(r)).forEach((r) => {
        const target = r.startsWith('/') ? path.join(dir, r) : path.resolve(path.dirname(swPath), r);
        if (!fs.existsSync(target)) fail(`importScripts/import aponta para um ficheiro que não existe: ${r}`);
      });

      // 4) APIs que não existem num service worker (rebentam logo à carga)
      const topLevel = src.split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
      [
        [/\bdocument\./, 'usa "document" (não existe em service workers)'],
        [/\bwindow\./, 'usa "window" (usa "self" ou "globalThis")'],
        [/\blocalStorage\b|\bsessionStorage\b/, 'usa localStorage/sessionStorage (usa chrome.storage)'],
        [/\bXMLHttpRequest\b/, 'usa XMLHttpRequest (usa fetch)'],
        [/\bnew\s+Audio\(/, 'usa "new Audio()" (usa chrome.offscreen)']
      ].forEach(([re, msg]) => { if (re.test(topLevel)) notes.push('Possível causa: o script ' + msg + '. Só é problema se correr à carga, fora de uma função.'); });

      // 5) APIs de extensão que o Electron não implementa
      const unsupported = ['sidePanel', 'offscreen', 'declarativeNetRequest', 'identity', 'gcm', 'scripting.registerContentScripts'];
      unsupported.forEach((api) => { if (new RegExp('chrome\\.' + api.replace('.', '\\.')).test(topLevel)) notes.push(`Usa chrome.${api}: o Electron só suporta parte da API de extensões. Se for chamado à carga, pode impedir o registo.`); });
    }
  }
}

const perms = (manifest.permissions || []).filter((p) => typeof p === 'string');
const exotic = perms.filter((p) => ['sidePanel', 'offscreen', 'identity', 'gcm', 'nativeMessaging', 'debugger', 'tabGroups'].includes(p));
if (exotic.length) notes.push('Permissões com suporte limitado no Electron: ' + exotic.join(', '));

console.log('');
if (!problems.length) console.log('Nada de errado encontrado no manifest nem na estrutura do service worker.');
problems.forEach((p) => console.log('✗ ' + p));
notes.forEach((n) => console.log('• ' + n));
if (!problems.length) console.log('\nPróximo passo: corre o Kortex com "npm run dev" e procura linhas "[Kortex][SW]" na consola; mostram o erro real lançado pelo service worker.');
process.exit(problems.length ? 1 : 0);

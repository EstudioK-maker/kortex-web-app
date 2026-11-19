#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const fmt = (n) => (n >= 1073741824 ? (n / 1073741824).toFixed(2) + ' GB' : (n / 1048576).toFixed(1) + ' MB');
function size(p) {
  let total = 0; let st;
  try { st = fs.lstatSync(p); } catch (e) { return 0; }
  if (st.isSymbolicLink()) return 0;
  if (!st.isDirectory()) return st.size;
  let names = [];
  try { names = fs.readdirSync(p); } catch (e) { return 0; }
  for (const n of names) total += size(path.join(p, n));
  return total;
}
function table(entries, limit) { entries.sort((a, b) => b.size - a.size).slice(0, limit).forEach((e) => { console.log('  ' + fmt(e.size).padStart(10) + '  ' + e.name); }); }
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const outDir = (pkg.build && pkg.build.directories && pkg.build.directories.output) || 'dist';
console.log('\n== Raiz do projeto (sem node_modules) ==');
const top = fs.readdirSync(root).filter((n) => n !== 'node_modules' && n !== '.git').map((n) => ({ name: n + (fs.statSync(path.join(root, n)).isDirectory() ? '/' : ''), size: size(path.join(root, n)) }));
table(top, 15);
const nm = path.join(root, 'node_modules');
if (fs.existsSync(nm)) {
  console.log('\n== node_modules: os 15 pacotes mais pesados ==');
  const pk = [];
  for (const n of fs.readdirSync(nm)) {
    if (n.startsWith('.')) continue;
    const p = path.join(nm, n);
    if (n.startsWith('@')) fs.readdirSync(p).forEach((s) => pk.push({ name: n + '/' + s, size: size(path.join(p, s)) }));
    else pk.push({ name: n, size: size(p) });
  }
  table(pk, 15);
}
console.log('\n== Avisos ==');
const warn = [];
const deps = Object.keys(pkg.dependencies || {});
['electron', 'electron-builder', 'puppeteer', 'playwright', 'puppeteer-core'].forEach((d) => { if (deps.includes(d)) warn.push('"' + d + '" está em "dependencies": mete-o em "devDependencies".'); });
if (!pkg.build || !Array.isArray(pkg.build.files)) warn.push('build.files não está definido: o electron-builder empacota quase tudo da raiz.');
else if (!pkg.build.files.some((f) => /^src\b/.test(f))) warn.push('build.files não inclui "src/**/*".');
if (fs.existsSync(path.join(root, outDir))) warn.push('A pasta de saída "' + outDir + '/" (' + fmt(size(path.join(root, outDir))) + ') está dentro do projeto: sem build.files, cada build empacota os anteriores.');
console.log(warn.length ? warn.map((w) => '  - ' + w).join('\n') : '  (nenhum aviso)');
console.log('\nDepois de compilar: o tamanho real da app está em ' + outDir + '/win-unpacked/resources/app.asar\n');
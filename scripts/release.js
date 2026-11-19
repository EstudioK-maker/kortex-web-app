#!/usr/bin/env node
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const bump = process.argv[2] || 'patch';

function fail(msg) { console.error('\n✖ ' + msg + '\n'); process.exit(1); }
function run(cmd, args, env) {
  return spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true, env: env || process.env });
}
const readPkg = () => JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

if (!process.env.GH_TOKEN) {
  fail('Falta a variavel GH_TOKEN (token do GitHub com permissao para criar Releases).\n' +
       '  PowerShell (so nesta janela):  $env:GH_TOKEN = "ghp_..."\n' +
       '  CMD (so nesta janela):          set GH_TOKEN=ghp_...');
}

const pkg = readPkg();
const pub = pkg.build && pkg.build.publish;
if (!pub) fail('O package.json nao tem "build.publish". Ve o passo 2 do UPDATES-COMO-USAR.md.');
const publishConf = Array.isArray(pub) ? pub[0] : pub;
if (!publishConf || publishConf.provider !== 'github') fail('"build.publish" tem de ter "provider": "github".');
if (publishConf.releaseType && publishConf.releaseType !== 'release') {
  console.warn('⚠ releaseType = "' + publishConf.releaseType + '": rascunhos/pre-releases NAO chegam aos utilizadores. Usa "release".');
}

const before = pkg.version;
console.log('\nVersao atual: ' + before);

let r = run('npm', ['version', bump, '--no-git-tag-version']);
if (r.status !== 0) fail('Nao consegui subir a versao ("' + bump + '" e valido? use patch, minor, major ou x.y.z).');
const after = readPkg().version;
console.log('Nova versao:  ' + after + '\n\nA compilar e a publicar (pode demorar uns minutos)...\n');

r = run('npx', ['electron-builder', '--publish', 'always']);
if (r.status !== 0) {
  run('npm', ['version', before, '--no-git-tag-version', '--allow-same-version']);
  fail('A compilacao/publicacao falhou. A versao voltou a ' + before + '. Le o erro acima.');
}

console.log('\n✔ Versao ' + after + ' publicada.');
console.log('  Todos os utilizadores recebem a atualizacao obrigatoria (ao abrir, ou em ate ~15 min se ja estiverem com o Kortex aberto).\n');
const fs = require('fs');
const path = require('path');

const SUPORTADAS = new Set(['action', 'cookies', 'contextMenus', 'runtime', 'scripting', 'storage', 'tabs', 'webRequest', 'devtools', 'extension', 'management', 'i18n', 'webRequestBlocking']);
const PARCIAIS = { notifications: 'funciona, mas sem botões nas notificações', commands: 'os atalhos de teclado da extensão não são registados', webNavigation: 'faltam alguns eventos', downloads: 'a extensão não consegue gerir as transferências do Kortex', bookmarks: 'a extensão não consegue ler/editar os marcadores do Kortex', history: 'a extensão não consegue ler o histórico do Kortex', idle: 'o estado de atividade pode não ser reportado', alarms: 'os agendamentos periódicos podem não disparar', sessions: 'a lista de separadores recentes não está disponível', topSites: 'a lista de sites mais visitados não está disponível', pageAction: 'suporte limitado', browserAction: 'alias antigo do botão da barra', omnibox: 'pesquisa pela barra de endereço indisponível', search: 'pesquisa em separadores indisponível', pageCapture: 'captura de página em MHTML indisponível', contentSettings: 'controlo de permissões por site indisponível', declarativeContent: 'regras declarativas antigas (MV2) indisponíveis', favicon: 'acesso a favicons indisponível', readingList: 'lista de leitura do Chrome indisponível', fontSettings: 'tipos de letra do navegador indisponíveis', power: 'gestão de energia/ecrã indisponível', system: 'só o chrome.system.storage existe no Electron' };
const AUSENTES = { identity: 'login "Com a sua Conta Google" da própria extensão não funciona', offscreen: 'documentos offscreen não funcionam', sidePanel: 'o painel lateral da extensão não funciona', proxy: 'a configuração de proxy definida pela extensão não funciona', privacy: 'o controlo de definições de privacidade não funciona', declarativeNetRequest: 'a filtragem declarativa de pedidos (adblockers MV3) não funciona', gcm: 'as notificações push do Google não funcionam', instanceID: 'o registo push do Google não funciona', nativeMessaging: 'a comunicação com programas nativos do Windows não funciona', enterprise: 'as políticas empresariais não funcionam', bluetooth: 'o acesso a Bluetooth não funciona', serial: 'o acesso a portas série não funciona', usb: 'o acesso a dispositivos USB não funciona', hid: 'o acesso a dispositivos HID não funciona', fileSystem: 'o acesso a ficheiros locais (ChromeOS) não funciona', fileBrowserHandler: 'a integração com o explorador de ficheiros não funciona', fileSystemProvider: 'sistemas de ficheiros virtuais não funcionam', printerProvider: 'a integração com impressoras não funciona', printing: 'a impressão via extensão não funciona', printingMetrics: 'as métricas de impressão não funcionam', platformKeys: 'os certificados de cliente não funcionam', vpnProvider: 'extensões VPN não funcionam', input: 'o chrome.input.ime não funciona', tts: 'a síntese de voz via extensão não funciona', ttsEngine: 'motores de voz personalizados não funcionam', mediaGalleries: 'o acesso à biblioteca de média não funciona', syncFileSystem: 'a sincronização de ficheiros não funciona', documentScan: 'a digitalização de documentos não funciona', displaySource: 'a emissão de ecrã (casting) não funciona', dns: 'a resolução DNS manual não funciona', tabCapture: 'a captura de separadores pela extensão não funciona', desktopCapture: 'a partilha de ecrã via API da extensão não funciona', wallpaper: 'a alteração de fundo não funciona', webAuthenticationProxy: 'o proxy de autenticação web não funciona', accessibilityFeatures: 'o controlo de acessibilidade não funciona', signedInDevices: 'a lista de dispositivos iniciados não funciona', app: 'as APIs de aplicações ChromeOS não funcionam' };
const IGNORADAS = new Set(['activeTab', 'unlimitedStorage', 'clipboardRead', 'clipboardWrite', 'geolocation', 'videoCapture', 'audioCapture', 'experimental', 'background', 'certificateProvider', 'processes']);
const MSG_AVISO = 'Esta extensão pode não funcionar totalmente no Kortex';
const MAX_FICHEIROS = 400;
const MAX_FICHEIRO = 2 * 1024 * 1024;
const MAX_TOTAL = 16 * 1024 * 1024;
const PROFUNDIDADE_MAX = 6;
const PASTAS_SALTADAS = new Set(['_locales', 'node_modules', '.git', '__pycache__']);
const RE_API = /\b(?:chrome|browser)\s*\.\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:\.|\[)/g;

function scanCodigo(dir) {
  const apis = new Set();
  let ficheiros = 0, total = 0;
  const walk = (d, profundidade) => {
    if (profundidade > PROFUNDIDADE_MAX || ficheiros >= MAX_FICHEIROS || total >= MAX_TOTAL) return;
    let items; try { items = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const it of items) {
      if (ficheiros >= MAX_FICHEIROS || total >= MAX_TOTAL) return;
      const p = path.join(d, it.name);
      if (it.isDirectory()) { if (!PASTAS_SALTADAS.has(it.name)) walk(p, profundidade + 1); continue; }
      if (!/\.(js|mjs|cjs|html)$/i.test(it.name) || /\.map$/i.test(it.name)) continue;
      let st; try { st = fs.statSync(p); } catch (e) { continue; }
      if (st.size > MAX_FICHEIRO) continue;
      ficheiros++; total += st.size;
      let code; try { code = fs.readFileSync(p, 'utf8'); } catch (e) { continue; }
      for (const m of code.matchAll(RE_API)) apis.add(m[1]);
    }
  };
  walk(dir, 0);
  return [...apis];
}
const primeiroNivel = (ns) => String(ns || '').split('.')[0].trim();
function classificar(ns, origem) {
  const base = primeiroNivel(ns);
  if (IGNORADAS.has(base)) return null;
  if (SUPORTADAS.has(base)) return null;
  if (AUSENTES[base]) return { ns: base, estado: 'ausente', nota: AUSENTES[base], origem };
  if (PARCIAIS[base]) return { ns: base, estado: 'parcial', nota: PARCIAIS[base], origem };
  return { ns: base, estado: 'parcial', nota: 'API desconhecida pelo Electron (' + base + ' — pode não existir)', origem };
}
function fundir(encontradas) {
  const porNs = new Map();
  for (const { ns, origem } of encontradas) {
    const c = classificar(ns, [origem]);
    if (!c) continue;
    const anterior = porNs.get(c.ns);
    if (!anterior) { porNs.set(c.ns, c); continue; }
    if (!anterior.origem.includes(origem)) anterior.origem.push(origem);
    if (c.estado === 'ausente') anterior.estado = 'ausente';
    if (c.estado === 'ausente') anterior.nota = AUSENTES[c.ns] || anterior.nota;
  }
  return [...porNs.values()];
}
const cache = new Map();
const nivelDe = (apis) => apis.some((a) => a.estado === 'ausente') ? 'bad' : (apis.length ? 'warn' : 'ok');
function check(extPath) {
  const vazio = { level: 'ok', message: '', apis: [], verificadaEm: Date.now() };
  if (!extPath) return vazio;
  const manifestPath = path.join(extPath, 'manifest.json');
  let mtime = 0; try { mtime = fs.statSync(manifestPath).mtimeMs; } catch (e) { return vazio; }
  const chave = path.normalize(String(extPath)).toLowerCase();
  const emCache = cache.get(chave);
  if (emCache && emCache.mtime === mtime) return emCache.resultado;
  const encontradas = [];
  try {
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const lista of ['permissions', 'optional_permissions']) { for (const p of (m[lista] || [])) { if (typeof p === 'string' && !p.includes('://')) encontradas.push({ ns: p, origem: 'manifest' }); } }
  } catch (e) {}
  for (const ns of scanCodigo(extPath)) encontradas.push({ ns, origem: 'codigo' });
  const apis = fundir(encontradas);
  const level = nivelDe(apis);
  const resultado = { level, message: level === 'ok' ? '' : MSG_AVISO, apis, verificadaEm: Date.now() };
  cache.set(chave, { mtime, resultado });
  return resultado;
}
function limparCache() { cache.clear(); }
module.exports = { check, limparCache, classificar, MSG_AVISO };
// src/main/secrets.js — cifra de segredos (palavras-passe, chave da API) com o safeStorage do Electron.
// No Windows usa a DPAPI: só o mesmo utilizador do Windows, neste PC, consegue decifrar.
// Formato guardado: "enc:v1:<base64>". Texto sem este prefixo é tratado como valor antigo em texto simples (migração).
const { safeStorage } = require('electron');

const PREFIX = 'enc:v1:';

const available = () => { try { return safeStorage.isEncryptionAvailable(); } catch { return false; } };
const isEncrypted = (v) => typeof v === 'string' && v.startsWith(PREFIX);

// Devolve o valor cifrado; se a cifra não estiver disponível devolve null (quem chama decide o que fazer).
function encrypt(plain) {
  if (plain === '' || plain == null) return '';
  if (!available()) return null;
  return PREFIX + safeStorage.encryptString(String(plain)).toString('base64');
}

// Devolve { value, wasPlain }. Valores que não se conseguem decifrar (outro utilizador/PC) dão ''.
function decrypt(stored) {
  if (stored === '' || stored == null) return { value: '', wasPlain: false };
  if (!isEncrypted(stored)) return { value: String(stored), wasPlain: true };
  try { return { value: safeStorage.decryptString(Buffer.from(stored.slice(PREFIX.length), 'base64')), wasPlain: false }; }
  catch { return { value: '', wasPlain: false }; }
}

module.exports = { encrypt, decrypt, isEncrypted, available };

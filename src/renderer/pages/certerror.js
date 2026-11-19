// kortex://certerror — aviso de certificado inválido. Os parâmetros vêm do processo principal, mas esta página
// também é navegável por sites: tudo entra por textContent e o "continuar" é validado no processo principal.
(function () {
  const K = window.kortex;
  const params = new URLSearchParams(location.search);
  const target = params.get('url') || '';
  const code = params.get('desc') || 'ERR_CERT_INVALID';

  const REASONS = {
    ERR_CERT_AUTHORITY_INVALID: 'o certificado foi emitido por uma entidade em que o Kortex não confia (ou é autoassinado)',
    ERR_CERT_DATE_INVALID: 'o certificado expirou ou ainda não é válido (verifica a data do teu computador)',
    ERR_CERT_COMMON_NAME_INVALID: 'o certificado não corresponde ao endereço do site',
    ERR_CERT_REVOKED: 'o certificado foi revogado pela entidade que o emitiu',
    ERR_CERT_WEAK_KEY: 'o certificado usa uma chave de cifra fraca',
    ERR_CERT_NAME_CONSTRAINT_VIOLATED: 'o certificado viola as regras de nomes da entidade emissora'
  };

  let host = target;
  let https = false;
  try { const u = new URL(target); host = u.host; https = u.protocol === 'https:'; } catch (e) { /* endereço inválido */ }

  document.getElementById('host').textContent = host || 'este site';
  document.getElementById('host2').textContent = host;
  document.getElementById('reason').textContent = (REASONS[code] || 'o certificado não é válido') + ' [' + code + ']';
  document.title = 'A tua ligação não é privada';

  if (!https) document.querySelector('details').hidden = true;

  document.getElementById('back').addEventListener('click', () => {
    K.tabs.back();
    setTimeout(() => K.tabs.navigate('current', 'about:blank'), 250); // sem histórico para onde voltar
  });
  document.getElementById('proceed').addEventListener('click', async () => { await K.security.proceed(target); });
})();

export default {
  async fetch(request, env, ctx) {
    const html = `
<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kortex — O navegador do futuro</title>
  <style>
    body { font-family: "Segoe UI", system-ui, sans-serif; background: #1a1b1d; color: #e9e9eb; margin: 0; padding: 40px; line-height: 1.6; }
    a { color: #ff5722; text-decoration: none; font-weight: bold; }
    a:hover { text-decoration: underline; }
    header { margin-bottom: 60px; display: flex; justify-content: space-between; align-items: center; }
    nav a { margin-left: 20px; color: #e9e9eb; font-weight: normal; }
    .hero { max-width: 800px; }
    .btn { display: inline-block; background: #ff5722; color: #fff !important; padding: 15px 30px; border-radius: 8px; margin: 20px 0; font-size: 18px; text-decoration: none !important; }
    .btn:hover { background: #ff6d40; }
    h1 { font-size: 48px; line-height: 1.1; margin-bottom: 20px; }
    p { font-size: 18px; color: #9a9aa1; max-width: 600px; }
    .version { font-size: 14px; color: #6b6b72; margin-top: -10px; margin-bottom: 40px; }
  </style>
</head>
<body>
  <header>
    <strong>Kortex</strong>
    <nav>
      <a href="#">Funcionalidades</a>
      <a href="#">Download</a>
    </nav>
  </header>

  <div class="hero">
    <a href="https://github.com/d66807617-sketch/kortex/releases/download/1.0.3/Kortex.Setup.1.0.4.exe" class="btn">Baixar agora ⬇️</a>
    <div class="version">Versão Beta 1.0.4 · O essencial já funciona</div>

    <h1>O navegador<br>feito para quem pensa rápido.</h1>
    <p>Kortex combina IA nativa, bloqueio inteligente de anúncios e um motor leve numa interface que desaparece quando não precisas dela.</p>
  </div>
</body>
</html>
    `;
    return new Response(html, {
      headers: { "content-type": "text/html;charset=UTF-8" },
    });
  },
};

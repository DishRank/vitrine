import Link from 'next/link';

export default function RootNotFound() {
  return (
    <html lang="fr">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <title>Page introuvable — DishRank</title>
        <link rel="icon" type="image/png" href="/img/icon.png" />
        <style dangerouslySetInnerHTML={{ __html: `
          *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
          :root {
            --bg: #F8F7FC; --text: #2D3436; --text2: #636E72; --text3: #B2BEC3;
            --primary: #6C5CE7; --primary-light: #A29BFE;
            --primary-glow: rgba(108, 92, 231, 0.2);
            --border: rgba(0, 0, 0, 0.06);
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #0D0B1A; --text: #F8F7FC; --text2: #B2BEC3; --text3: #636E72;
              --border: rgba(255, 255, 255, 0.08);
            }
          }
          body {
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--bg); color: var(--text);
            min-height: 100svh; display: flex; flex-direction: column;
            -webkit-font-smoothing: antialiased;
          }
          a { text-decoration: none; color: inherit; }
          nav { padding: 0 clamp(20px, 5vw, 48px); display: flex; align-items: center; height: 72px; border-bottom: 1px solid var(--border); }
          .nav-logo { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 1.1rem; }
          .nav-logo img { width: 32px; height: 32px; border-radius: 10px; }
          .container { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px 24px; position: relative; overflow: hidden; }
          .glow { position: absolute; top: -30%; left: 50%; transform: translateX(-50%); width: 500px; height: 500px; background: radial-gradient(circle, var(--primary-glow) 0%, transparent 70%); pointer-events: none; }
          .content { position: relative; z-index: 1; }
          .code { font-size: clamp(5rem, 14vw, 9rem); font-weight: 900; line-height: 1; letter-spacing: -0.04em; color: var(--primary); opacity: 0.25; margin-bottom: -16px; }
          h1 { font-size: clamp(1.6rem, 3.5vw, 2.4rem); font-weight: 800; line-height: 1.2; margin-bottom: 12px; }
          em { font-style: normal; color: var(--primary-light); }
          .sub { color: var(--text2); font-size: clamp(0.95rem, 1.2vw, 1.1rem); max-width: 420px; margin: 0 auto 32px; line-height: 1.6; }
          .actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
          .btn { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 0.9rem; border-radius: 50px; transition: all 0.3s ease; }
          .btn-primary { padding: 14px 28px; background: var(--primary); color: #fff; }
          .btn-primary:hover { background: var(--primary-light); transform: translateY(-2px); box-shadow: 0 10px 30px var(--primary-glow); }
          .btn-outline { padding: 14px 28px; background: transparent; color: var(--text); border: 1px solid var(--border); }
          .btn-outline:hover { border-color: var(--primary); color: var(--primary-light); }
          footer { padding: 20px clamp(20px, 5vw, 48px); border-top: 1px solid var(--border); text-align: center; color: var(--text3); font-size: 0.8rem; }
        `}} />
      </head>
      <body>
        <nav>
          <Link href="/" className="nav-logo">
            <img src="/img/icon.png" alt="DishRank" />
            <span>DishRank</span>
          </Link>
        </nav>
        <main className="container">
          <div className="glow" />
          <div className="content">
            <p className="code">404</p>
            <h1>Ce plat n&apos;est pas <em>au menu</em>.</h1>
            <p className="sub">La page que tu cherches n&apos;existe pas ou a été déplacée. Pas de panique, il y a plein de bons plats ailleurs.</p>
            <div className="actions">
              <Link href="/" className="btn btn-primary">Retour à l&apos;accueil</Link>
              <a href="https://play.google.com/store/apps/details?id=com.dishrank.app" className="btn btn-outline" target="_blank" rel="noopener">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 0 1 0 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/></svg>
                Télécharger l&apos;app
              </a>
            </div>
          </div>
        </main>
        <footer>DishRank — Fait avec passion à Lyon</footer>
      </body>
    </html>
  );
}

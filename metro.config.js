// Configuration Metro : ajoute un proxy YouTube pour l'aperçu web.
//
// Pourquoi : dans un navigateur, les flux RSS et les pages YouTube sont
// bloqués par CORS. Sur mobile, fetch n'applique pas CORS — l'application
// native n'a donc pas besoin de ce proxy. Il n'existe que pour pouvoir tester
// l'interface et les fonctions sur http://localhost:8081 avant de passer au
// téléphone.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const PROXY_PREFIX = '/__youtube';
const ALLOWED_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'm.youtube.com',
  'youtu.be',
  'i.ytimg.com',
  'i1.ytimg.com',
  'i2.ytimg.com',
  'i3.ytimg.com',
  'i4.ytimg.com',
  'www.youtube-nocookie.com',
  'consent.youtube.com',
]);

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

function handleProxy(req, res) {
  let target;
  try {
    const parsed = new URL(req.url, 'http://localhost');
    target = new URL(parsed.searchParams.get('url'));
  } catch {
    res.statusCode = 400;
    res.end('url manquante ou invalide');
    return;
  }

  if (!ALLOWED_HOSTS.has(target.hostname)) {
    res.statusCode = 403;
    res.end('hôte non autorisé');
    return;
  }

  fetch(target, {
    method: req.method,
    redirect: 'follow',
    headers: {
      'user-agent': ANDROID_UA,
      'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8',
      // Écarte l'écran de consentement YouTube dans certaines régions.
      cookie: 'CONSENT=YES+cb.20210328-17-p0.en+FX+000; SOCS=CAI',
      accept: req.headers.accept || '*/*',
    },
  })
    .then(async (response) => {
      const isHead = req.method === 'HEAD';
      const body = isHead ? Buffer.alloc(0) : Buffer.from(await response.arrayBuffer());
      res.statusCode = response.status;
      res.setHeader(
        'content-type',
        response.headers.get('content-type') || 'text/plain; charset=utf-8',
      );
      res.setHeader('cache-control', 'no-store');
      // `fetch` décompresse le corps (gzip/br), mais l'en-tête `content-length`
      // de YouTube décrit la version compressée. Le relayer tel quel tronquait
      // chaque flux RSS à quelques entrées, ce qui faisait disparaître des
      // chaînes entières de l'accueil. On annonce donc toujours la taille du
      // corps réellement envoyé, et on retire `content-encoding` puisqu'il ne
      // correspond plus aux octets transmis.
      res.removeHeader('content-encoding');
      if (!isHead) res.setHeader('content-length', body.length);
      res.end(body);
    })
    .catch((error) => {
      res.statusCode = 502;
      res.end(`proxy: ${error.message}`);
    });
}

const defaultEnhance = config.server?.enhanceMiddleware;

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    const enhanced = defaultEnhance ? defaultEnhance(middleware) : middleware;
    return (req, res, next) => {
      if (req.url && req.url.startsWith(PROXY_PREFIX)) {
        handleProxy(req, res);
        return undefined;
      }
      return enhanced(req, res, next);
    };
  },
};

module.exports = config;

import AsyncStorage from '@react-native-async-storage/async-storage';

const SCRIPT_KEY = 'youtube-adaptive-player-script.v1';
const SCRIPT_TTL_MS = 12 * 60 * 60 * 1000;
const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';

function parseCipher(value) {
  const params = new URLSearchParams(value ?? '');
  return {
    url: params.get('url'),
    s: params.get('s'),
    sp: params.get('sp') || 'sig',
  };
}

function findBalanced(source, start) {
  const opening = source[start];
  const closing = opening === '{' ? '}' : ')';
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === opening) depth += 1;
    if (character === closing) {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return null;
}

function extractFunction(source, name) {
  const escaped = name.replace(/[.$]/g, '\\$&');
  const patterns = [
    new RegExp(`function\\s+${escaped}\\s*\\([^)]*\\)\\s*\\{`),
    new RegExp(`${escaped}\\s*=\\s*function\\s*\\([^)]*\\)\\s*\\{`),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(source);
    if (!match) continue;
    const opening = source.indexOf('{', match.index + match[0].length - 1);
    const body = findBalanced(source, opening);
    if (body) return `${name}=function${match[0].slice(match[0].indexOf('('), -1)}${body}`;
  }
  return null;
}

function extractReferencedObjects(source, functionSource) {
  const names = new Set();
  for (const match of functionSource.matchAll(/\b([\w$]+)\.[\w$]+\(/g)) names.add(match[1]);

  const definitions = [];
  for (const name of names) {
    const pattern = new RegExp(`(?:var|let|const)\\s+${name.replace(/[.$]/g, '\\$&')}\\s*=\\s*\\{`);
    const match = pattern.exec(source);
    if (!match) continue;
    const opening = source.indexOf('{', match.index + match[0].length - 1);
    const objectSource = findBalanced(source, opening);
    if (objectSource) definitions.push(`${name}=${objectSource}`);
  }
  return definitions.join(';');
}

function findSignatureFunction(source) {
  const patterns = [
    /\.sig\|\|([\w$]+)\(/,
    /set\("signature",([\w$]+)\(/,
    /signature\s*[,=:]\s*([\w$]+)\(/,
    /(?:^|[^\w$])([\w$]+)\(a\)\.join\(""\)/,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function evaluateSignature(source, functionName, signature) {
  const name = functionName || findSignatureFunction(source);
  if (!name) throw new Error('Fonction de signature YouTube introuvable.');
  const functionSource = extractFunction(source, name);
  if (!functionSource) throw new Error(`Fonction YouTube ${name} introuvable.`);

  // Le base.js contient uniquement les opérations de permutation nécessaires
  // ici. On isole la fonction trouvée afin de ne pas exécuter le lecteur.
  try {
    const helpers = extractReferencedObjects(source, functionSource);
    const transform = new Function(`${helpers}; ${functionSource}; return ${name};`)();
    const result = transform(signature);
    if (typeof result !== 'string' || result.length === 0) {
      throw new Error('La signature YouTube est vide.');
    }
    return result;
  } catch (error) {
    throw new Error(`Impossible de déchiffrer la signature YouTube: ${error.message}`);
  }
}

async function loadScript(url, { fetchImpl = fetch, storage = AsyncStorage } = {}) {
  if (!url) throw new Error('URL du base.js YouTube absente.');
  try {
    const raw = await storage.getItem(SCRIPT_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached.url === url && Date.now() - cached.savedAt < SCRIPT_TTL_MS && cached.source) {
        return cached.source;
      }
    }
  } catch {
    // On retente le téléchargement.
  }

  let response;
  try {
    response = await fetchImpl(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/javascript,*/*;q=0.8' },
    });
  } catch (error) {
    throw new Error(`Connexion au base.js YouTube impossible: ${error?.message ?? 'Network request failed'}`);
  }
  if (!response.ok) throw new Error(`Téléchargement du base.js impossible: ${response.status}`);
  const source = await response.text();
  await storage.setItem(SCRIPT_KEY, JSON.stringify({ url, savedAt: Date.now(), source }));
  return source;
}

export async function resolveStreamUrl(stream, playerJsUrl, options = {}) {
  if (stream?.url) return stream.url;
  if (!stream?.signatureCipher) throw new Error('Format YouTube sans URL ni signature.');
  const cipher = parseCipher(stream.signatureCipher);
  if (!cipher.url || !cipher.s) throw new Error('Signature YouTube incomplète.');
  const source = await loadScript(playerJsUrl, options);
  const signature = evaluateSignature(source, options.signFunc, cipher.s);
  const separator = cipher.url.includes('?') ? '&' : '?';
  return `${cipher.url}${separator}${cipher.sp}=${encodeURIComponent(signature)}`;
}

export { parseCipher, findSignatureFunction };

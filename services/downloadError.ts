// Mise en forme des erreurs yt-dlp avant stockage.
//
// yt-dlp répète la même erreur pour chaque flux (vidéo puis audio) et ajoute
// ses lignes de progression/retry. On supprime les lignes vides et les
// doublons, et on borne la longueur : l'interface n'affiche le détail que
// derrière un bouton « Détails ».

const MAX_LENGTH = 2000;

export function formatDownloadError(message?: string | null): string | null {
  if (!message) return null;

  const seen = new Set<string>();
  const lines: string[] = [];
  // `\r` : yt-dlp réécrit parfois la même ligne de progression.
  for (const raw of message.split(/\r?\n|\r/)) {
    const line = raw.trim();
    if (!line || seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }

  if (lines.length === 0) return null;
  const text = lines.join('\n');
  return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH)}…` : text;
}

// Classification des erreurs yt-dlp, côté JavaScript.
//
// Le module natif propose déjà un code, mais quelques motifs étaient trop
// larges (« connection », « unable to download », « timed out ») : une limite
// de débit YouTube ou une fusion ffmpeg trop longue finissait en
// `ERR_YTDLP_NETWORK`, ce qui mettait la file en pause et affichait « pas de
// connexion Internet » alors que la connexion était bonne.
//
// Cette fonction est la dernière étape avant l'affichage : elle affine le code
// à partir du message brut, et le laisse intact si rien ne correspond. Elle est
// pure, donc testable sans appareil.

const STORAGE_PATTERNS = [
  /no space left/i,
  /not enough space/i,
  /errno 28\b/i,
  /disk quota/i,
  /read-only file system/i,
  /errno 30\b/i,
];

const RATE_LIMIT_PATTERNS = [/http error 429/i, /too many requests/i, /rate.?limit/i];

/** Flux refusé par YouTube : format, jeton PO, signature. */
const FORMAT_PATTERNS = [
  /http error 403/i,
  /forbidden/i,
  /requested format is not available/i,
  /requested format not available/i,
  /no video formats found/i,
  /only images are available/i,
  /signature extraction failed/i,
  /unable to extract video data/i,
];

/** Vidéo réellement indisponible : privée, âge, pays, vérification. */
const AUTH_PATTERNS = [
  /sign in to confirm/i,
  /confirm you/i,
  /not a bot/i,
  /age.?restricted/i,
  /private video/i,
  /video unavailable/i,
  /this video is not available/i,
  /has been removed/i,
  /not available in your country/i,
];

const FILE_PATTERNS = [
  /unable to rename file/i,
  /no such file or directory/i,
  /permission denied/i,
  /errno 2\b/i,
  /errno 13\b/i,
];

const MERGE_PATTERNS = [/ffmpeg/i, /conversion failed/i, /postprocessing/i, /merger/i];

/** Marqueurs réseau précis, jamais des mots isolés trop courants. */
const NETWORK_PATTERNS = [
  /getaddrinfo/i,
  /no address associated/i,
  /name or service not known/i,
  /failed to resolve/i,
  /name resolution/i,
  /temporary failure/i,
  /network is unreachable/i,
  /network is down/i,
  /errno 7\b/i,
  /connection reset/i,
  /connection refused/i,
  /connection aborted/i,
  /remote end closed/i,
  /closed connection/i,
  /incompleteread/i,
  /read timed out/i,
  /urlopen error/i,
  /certificate verify/i,
  /unable to download webpage/i,
  /http error 50[0234]/i,
];

const RULES: [string, RegExp[]][] = [
  ['ERR_YTDLP_STORAGE', STORAGE_PATTERNS],
  ['ERR_YTDLP_RATE_LIMIT', RATE_LIMIT_PATTERNS],
  ['ERR_YTDLP_FORMAT', FORMAT_PATTERNS],
  ['ERR_YTDLP_UNAVAILABLE', AUTH_PATTERNS],
  ['ERR_YTDLP_FILE', FILE_PATTERNS],
  ['ERR_YTDLP_MERGE', MERGE_PATTERNS],
  ['ERR_YTDLP_NETWORK', NETWORK_PATTERNS],
];

/**
 * Renvoie le code d'erreur le plus juste pour un message yt-dlp donné.
 * Une annulation reste une annulation ; un message inconnu conserve son code.
 */
export function refineDownloadError(
  code: string | null | undefined,
  message?: string | null,
): string {
  const incoming = code || 'ERR_YTDLP_FAILED';
  if (incoming === 'ERR_YTDLP_CANCELED') return incoming;
  const text = (message ?? '').trim();
  if (!text) return incoming;
  for (const [ruleCode, patterns] of RULES) {
    if (patterns.some((pattern) => pattern.test(text))) return ruleCode;
  }
  return incoming;
}


/**
 * Convertit l'URI d'un fichier/dossier `expo-file-system` en chemin natif.
 *
 * `expo-file-system` expose ses emplacements sous la forme
 * `file:///data/user/0/<paquet>/files/...`. Les API natives qui utilisent
 * `java.io.File` (module yt-dlp) ne comprennent pas le préfixe `file://` :
 * elles l'interprètent comme un chemin relatif, ce qui casse la création des
 * dossiers sur Android. On normalise donc le chemin avant de le transmettre.
 *
 * Les URI non-`file:` (ex. `content://`) sont renvoyées telles quelles.
 */
export function toNativePath(uri) {
  if (typeof uri !== 'string' || uri.length === 0) return uri;
  if (!/^file:/i.test(uri)) return uri;

  let path = uri.replace(/^file:(\/\/)?(localhost)?/i, '');
  if (!path.startsWith('/')) path = `/${path}`;

  try {
    path = decodeURIComponent(path);
  } catch {
    // Un `%` littéral n'est pas une séquence d'échappement : on garde le chemin brut.
  }

  if (path.length > 1) path = path.replace(/\/+$/, '');
  return path;
}

/**
 * Convertit un chemin natif en URI `file://` utilisable par `expo-file-system`
 * et `expo-video`. Une URI déjà formée (`file:`, `content:`, `http:`, ...) est
 * renvoyée telle quelle.
 */
export function toFileUri(pathOrUri) {
  if (typeof pathOrUri !== 'string' || pathOrUri.length === 0) return pathOrUri;
  if (/^[a-z][a-z0-9+.-]*:/i.test(pathOrUri)) return pathOrUri;
  if (pathOrUri.startsWith('/')) return `file://${pathOrUri}`;
  return pathOrUri;
}

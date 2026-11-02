// Analyse des flux Atom publics de YouTube
// (https://www.youtube.com/feeds/videos.xml?channel_id=UC...).
// Volontairement sans dépendance XML : le format renvoyé est stable et
// l'analyse par expressions régulières suffit, y compris dans Hermes.

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeEntities(value = '') {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

function firstTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function attribute(tagText, name) {
  const match = tagText.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return match ? decodeEntities(match[1]) : '';
}

function parseEntry(entryXml, fallbackChannelId) {
  const videoId = decodeEntities(firstTag(entryXml, 'yt:videoId'));
  if (!videoId) return null;

  const mediaGroup = firstTag(entryXml, 'media:group');
  const thumbTag =
    (mediaGroup.match(/<media:thumbnail[^>]*\/?>/) ?? [])[0] ?? '';

  const channelId =
    decodeEntities(firstTag(entryXml, 'yt:channelId')) || fallbackChannelId;
  const authorName = decodeEntities(firstTag(firstTag(entryXml, 'author'), 'name'));
  const publishedAt = Date.parse(firstTag(entryXml, 'published')) || Date.now();

  const title =
    decodeEntities(firstTag(mediaGroup, 'media:title')) ||
    decodeEntities(firstTag(entryXml, 'title'));

  const description = decodeEntities(
    firstTag(mediaGroup, 'media:description'),
  ).trim();

  // YouTube distingue les Shorts dans le lien « alternate » de l'entrée :
  //   Short  → https://www.youtube.com/shorts/<id>
  //   Vidéo  → https://www.youtube.com/watch?v=<id>
  // Ce lien est la seule preuve fiable côté front, sans sonde réseau.
  const linkTag = (entryXml.match(/<link\b[^>]*rel="alternate"[^>]*\/?>/i) ?? [])[0] ?? '';
  const feedUrl = attribute(linkTag, 'href');
  const hasFeedUrl = /^https?:\/\/(?:www\.|m\.)?youtube\.com\//i.test(feedUrl);

  return {
    videoId,
    channelId,
    channelTitle: authorName,
    title,
    description,
    publishedAt,
    thumbnail:
      attribute(thumbTag, 'url') || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    url: hasFeedUrl ? feedUrl : `https://www.youtube.com/watch?v=${videoId}`,
    urlSource: hasFeedUrl ? 'feed' : 'generated',
  };
}

export function parseFeed(xml, fallbackChannelId = '') {
  if (typeof xml !== 'string' || !xml.includes('<entry')) {
    return { channelTitle: '', channelId: fallbackChannelId, videos: [] };
  }

  const firstEntryIndex = xml.indexOf('<entry');
  const headerXml = firstEntryIndex > 0 ? xml.slice(0, firstEntryIndex) : xml;
  const channelTitle = decodeEntities(firstTag(headerXml, 'title'));

  const videos = xml
    .split('<entry')
    .slice(1)
    .map((chunk) => parseEntry(`<entry${chunk}`, fallbackChannelId))
    .filter(Boolean);

  return { channelTitle, channelId: fallbackChannelId, videos };
}

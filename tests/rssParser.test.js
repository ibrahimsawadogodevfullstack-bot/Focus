import assert from 'node:assert/strict';
import test from 'node:test';

import { parseFeed } from '../services/rssParser.js';

const ENTRY = (id, link) => `
  <entry>
    <id>yt:video:${id}</id>
    <yt:videoId>${id}</yt:videoId>
    <yt:channelId>UC123</yt:channelId>
    <title>Vidéo ${id}</title>
    <link rel="alternate" href="${link}"/>
    <author><name>Chaîne</name></author>
    <published>2026-10-30T00:00:00+00:00</published>
    <media:group>
      <media:title>Vidéo ${id}</media:title>
      <media:thumbnail url="https://i.ytimg.com/vi/${id}/hqdefault.jpg" width="480" height="360"/>
    </media:group>
  </entry>`;

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <title>Chaîne test</title>
  <link rel="alternate" href="https://www.youtube.com/channel/UC123"/>
  ${ENTRY('short1', 'https://www.youtube.com/shorts/short1')}
  ${ENTRY('long1', 'https://www.youtube.com/watch?v=long1')}
</feed>`;

test('le lien RSS /shorts/ est conservé et marqué comme venant du flux', () => {
  const result = parseFeed(feed, 'UC123');
  const short = result.videos.find((video) => video.videoId === 'short1');

  assert.equal(short.url, 'https://www.youtube.com/shorts/short1');
  assert.equal(short.urlSource, 'feed');
});

test('le lien RSS /watch?v= est conservé et marqué comme venant du flux', () => {
  const result = parseFeed(feed, 'UC123');
  const long = result.videos.find((video) => video.videoId === 'long1');

  assert.equal(long.url, 'https://www.youtube.com/watch?v=long1');
  assert.equal(long.urlSource, 'feed');
});

test('une entrée sans lien alternate retombe sur un /watch généré', () => {
  const withoutLink = feed.replace(
    '<link rel="alternate" href="https://www.youtube.com/shorts/short1"/>',
    '',
  );
  const result = parseFeed(withoutLink, 'UC123');
  const video = result.videos.find((entry) => entry.videoId === 'short1');

  assert.equal(video.url, 'https://www.youtube.com/watch?v=short1');
  assert.equal(video.urlSource, 'generated');
});

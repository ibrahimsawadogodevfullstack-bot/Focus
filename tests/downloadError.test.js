import assert from 'node:assert/strict';
import test from 'node:test';

import { formatDownloadError, refineDownloadError } from '../services/downloadError';

test('download error removes empty lines and duplicate stream errors', () => {
  const message = [
    'ERROR: [download] Got error: [Errno 7] No address associated with hostname.',
    'ERROR: [download] Got error: [Errno 7] No address associated with hostname.',
    '',
    '  WARNING: [youtube] Retrying (1/3)…  ',
  ].join('\n');

  assert.equal(
    formatDownloadError(message),
    [
      'ERROR: [download] Got error: [Errno 7] No address associated with hostname.',
      'WARNING: [youtube] Retrying (1/3)…',
    ].join('\n'),
  );
});

test('download error handles carriage returns and empty input', () => {
  assert.equal(formatDownloadError('line 1\rline 2\rline 1'), 'line 1\nline 2');
  assert.equal(formatDownloadError('   \n\n'), null);
  assert.equal(formatDownloadError(null), null);
  assert.equal(formatDownloadError(undefined), null);
});

test('download error caps very long technical output', () => {
  const formatted = formatDownloadError('x'.repeat(5000));
  assert.ok(formatted);
  assert.equal(formatted.length, 2001);
  assert.ok(formatted.endsWith('…'));
});

test('refineDownloadError does not blame the connection for a rate limit', () => {
  assert.equal(
    refineDownloadError(
      'ERR_YTDLP_NETWORK',
      'ERROR: unable to download video data: HTTP Error 429: Too Many Requests',
    ),
    'ERR_YTDLP_RATE_LIMIT',
  );
});

test('refineDownloadError reports a blocked stream as a format problem', () => {
  assert.equal(
    refineDownloadError(
      'ERR_YTDLP_UNAVAILABLE',
      'ERROR: unable to download video data: HTTP Error 403: Forbidden',
    ),
    'ERR_YTDLP_FORMAT',
  );
  assert.equal(
    refineDownloadError('ERR_YTDLP_FAILED', 'ERROR: Requested format is not available'),
    'ERR_YTDLP_FORMAT',
  );
});

test('refineDownloadError separates storage, merge and file failures', () => {
  assert.equal(
    refineDownloadError('ERR_YTDLP_NETWORK', 'OSError: [Errno 28] No space left on device'),
    'ERR_YTDLP_STORAGE',
  );
  assert.equal(
    refineDownloadError('ERR_YTDLP_NETWORK', 'ffmpeg exited with code 1: Conversion failed!'),
    'ERR_YTDLP_MERGE',
  );
  assert.equal(
    refineDownloadError('ERR_YTDLP_FAILED', 'ERROR: unable to rename file: Permission denied'),
    'ERR_YTDLP_FILE',
  );
});

test('refineDownloadError keeps genuine network failures', () => {
  assert.equal(
    refineDownloadError('ERR_YTDLP_FAILED', '<urlopen error [Errno 104] Connection reset by peer>'),
    'ERR_YTDLP_NETWORK',
  );
  assert.equal(
    refineDownloadError('ERR_YTDLP_FAILED', 'getaddrinfo failed: Name or service not known'),
    'ERR_YTDLP_NETWORK',
  );
});

test('refineDownloadError keeps the incoming code when nothing matches', () => {
  assert.equal(refineDownloadError('ERR_YTDLP_NETWORK', 'ERROR: unable to download video data'), 'ERR_YTDLP_NETWORK');
  assert.equal(refineDownloadError('ERR_YTDLP_CANCELED', 'HTTP Error 403'), 'ERR_YTDLP_CANCELED');
  assert.equal(refineDownloadError('ERR_YTDLP_FAILED', null), 'ERR_YTDLP_FAILED');
  assert.equal(refineDownloadError(null, ''), 'ERR_YTDLP_FAILED');
});

test('refineDownloadError flags an unavailable video without inventing a code', () => {
  assert.equal(
    refineDownloadError(
      'ERR_YTDLP_FAILED',
      "ERROR: [youtube] Sign in to confirm you're not a bot",
    ),
    'ERR_YTDLP_UNAVAILABLE',
  );
});

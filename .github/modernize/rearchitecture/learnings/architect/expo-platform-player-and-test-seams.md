# Expo Platform Player and Test Seams

When restructuring an Expo app, keep platform-selected source siblings and Node test import paths intact alongside the module move.

## What Happened

In youtube-filter-v2 (t1), `PlayerScreen.js` imports `YoutubePlayer` without an extension. Metro selects `YoutubePlayer.web.js` on web and `YoutubePlayer.js` on native; the web iframe/postMessage bridge and native WebView bridge are not interchangeable. The Node test script separately imports JavaScript modules with explicit `.js` suffixes, so moving them to `.ts` is not covered by Metro's platform/module resolution.

## Takeaway

Move platform-specific siblings together and retain a common basename and extensionless runtime import. Before converting service modules that tests import as `.js`, decide how Node's test runner will resolve the TypeScript implementation (or retain a JS-compatible facade), then verify the exact project test command.

## History
- 2026-11-02 (youtube-filter-v2/t1): initial

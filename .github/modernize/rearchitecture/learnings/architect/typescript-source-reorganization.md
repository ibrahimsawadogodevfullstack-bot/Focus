# TypeScript Source Reorganization

During an Expo source move, preserve runtime and test resolution contracts separately from the directory architecture.

## What Happened

In youtube-filter-v2 (t1.1), the requested `src` boundaries intersect with platform-selected React Native modules and Node tests using exact `.js` imports. Expo SDK 54 supports `.tsx` for JSX, `.ts` otherwise, and a strict config extending `expo/tsconfig.base`; that does not make Node's test runner resolve `.ts` when a test imports `.js`.

## Takeaway

Move platform-specific siblings together with the same basename and keep extensionless imports. For service modules with explicit Node `.js` test imports, either retain JavaScript during the initial move or establish and verify a Node-compatible TypeScript loader/import strategy before conversion. Treat strict types for routes, providers, domain records, and player events as explicit seams.

## History
- 2026-11-02 (youtube-filter-v2/t1.1): initial

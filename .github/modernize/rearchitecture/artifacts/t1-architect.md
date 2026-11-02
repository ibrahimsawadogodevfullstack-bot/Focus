# t1 — Current Architecture and Migration Constraints

## Summary

The project is a single Expo SDK 54 / React Native application, not a monorepo or a server-backed full-stack app. Its current organization is layer-oriented (`screens/`, `components/`, `services/`, `constants/`, `utils/`) with a partially adopted TypeScript baseline. `App.js` currently acts as both bootstrap and application coordinator: it owns custom route state, shared data state, side effects, and screen composition. The requested restructuring is therefore a source-boundary migration, not a navigation-framework or state-management replacement.

The working tree is substantially dirty: the current status includes modified, deleted, and untracked application files. The directory inventory remains 24 component files, 10 screens, 23 services, 2 constants, 2 utilities, 1 domain file, and 7 test files; across those directories, 66 files are `.js`, 2 are `.ts`, and 1 is `.tsx`. Preserve the working-tree versions as the migration source of truth. No application source was changed for this task.

## Current Structure

The project profile records 12,699 LOC and JavaScript/TypeScript. The observed application-source inventory is:

| Area | Files | LOC | Current responsibility |
|---|---:|---:|---|
| `components/` | 24 | 3,603 | Shared and feed/player/settings React Native UI |
| `screens/` | 10 | 4,827 | Feed, channel, category, player, stats, settings, and offline screens |
| `services/` | 23 | 2,530 | Feed/network, persistence, tracking, format, settings/theme providers, media integrations |
| `constants/` | 2 | 158 | Default channels and theme/layout tokens |
| `utils/` | 2 | 137 | Date and display-format helpers |
| `domain/` | 1 | 18 | Settings types |
| `tests/` | 7 | 646 | Node test-runner tests for pure logic and selected integrations |
| Root entry files | `App.js`, `index.js` | — | Expo registration and app composition |

`i18n.js` and `locales/*.json` are also application source at the root. Native Android files, assets, Expo/package/lint/Metro configuration, and generated `dist/` are not feature source folders.

## Entry, Bootstrap, and Navigation

- `package.json` sets `main` to `index.js`; `index.js` calls Expo's `registerRootComponent(App)` and imports root `App.js`.
- `App.js` first reads persisted settings, waits for i18n initialization, and uses a 400 ms fallback before rendering. It then composes `SettingsProvider`, `ThemeProvider`, `SafeAreaProvider`, and `AppContent`.
- `AppContent` owns the feed/library/tracking/format/route state, initializes storage and services, handles refresh and library mutations, and selects a screen by a local route object. The navigation approach is a custom React state switch; there is no React Navigation, Expo Router, or Redux dependency.
- The five tabs are `feed`, `channels`, `categories`, `stats`, and `you` (`App.js:55`, `components/TabBar.tsx:9-14`). Nested route states are `player`, `categoryStats`, and `editor` (`App.js:469-575`). Android hardware-back handling is also in `App.js`.
- The existing settings and theme contexts are cross-feature providers. `TabBar.tsx` is already typed, while both providers remain JavaScript.

The root entrypoint and custom route semantics should remain stable through the file move. Moving bootstrap/navigation into `src/app` must not silently change route fallback, tab visibility, Android back behavior, or settings-before-render initialization.

## Feature and Layer Observations

- Feed UI and feed loading are separated imperfectly across `FeedScreen.js`, feed-specific components, and `services/feed.js`; root coordination in `App.js` owns the calls and their state.
- Channel resolution uses YouTube identifiers/handles/URLs and network resolution in `services/channelResolver.js`; library persistence is in `services/storage.js`.
- Categories are stored as IDs/names/channel-ID arrays and are managed through the `categories`, `editor`, and `categoryStats` route states.
- Playback is a cross-cutting feature: `PlayerScreen.js` owns queue/player UI and playback events; tracking state is persisted by `services/tracking.js` and aggregated by `services/stats.js`.
- Settings are the only established typed domain contract (`domain/settings.ts`); the settings implementation is `services/settings.ts`. The rest of the business data (video, channel, category, tracking, feed) is currently represented by untyped JavaScript objects.
- `constants/theme.js` supplies palettes/design tokens; `ThemeProvider.js` remaps style tokens for the selected theme. `utils/date.js` and `utils/format.js` are shared helpers.
- External integrations are currently in `services/`: AsyncStorage, Expo FileSystem, Expo Video, YouTube RSS/oEmbed/channel-page access, image/thumbnail handling, and player embedding. The UI/service boundary is mostly component props and callbacks; there is no backend API owned by this repository.

## Offline Reachability Finding

`screens/OfflineScreen.js`, `screens/LocalPlayerScreen.js`, and the offline/download/local-video services exist, but `App.js` does not import either screen, no current route selects them, and `TabBar.tsx` has no offline tab. Thus, offline source is present but is not reachable through the current application navigation. It belongs in the requested `features/offline` organization, but simply moving it should not be confused with wiring a new route or changing runtime behavior.

## TypeScript and Expo Constraints

Current typed application files are `components/TabBar.tsx`, `domain/settings.ts`, and `services/settings.ts`; the rest of the listed JavaScript/JSX source remains `.js`. `tsconfig.json` extends `expo/tsconfig.base`, enables `strict`, and sets `checkJs: false`, so existing JavaScript is not being checked as TypeScript. `package.json` already contains TypeScript, `@types/react`, and a `typecheck` script.

The requested SDK-version source was read: [Expo SDK 54 TypeScript guide](https://raw.githubusercontent.com/expo/expo/sdk-54/docs/pages/guides/typescript.mdx). It confirms the migration convention `.tsx` for JSX and `.ts` otherwise, and the standard Expo TypeScript config extends `expo/tsconfig.base`. The current config already uses that base. Path aliases are optional; the project currently uses relative imports, so moving files requires updating those imports consistently rather than introducing a new alias convention by default.

**Platform-specific player resolution is a hard constraint.** `PlayerScreen.js` imports `../components/YoutubePlayer` without an extension. Metro resolves `YoutubePlayer.web.js` on web and `YoutubePlayer.js` on native. The implementations are materially different: the web version uses a sandboxed YouTube iframe/postMessage bridge, while native uses a WebView and injected bridge. Keep same-basename platform siblings (for example, `.tsx` and `.web.tsx`) and keep the import platform-neutral; do not collapse them or hard-code an extension.

`metro.config.js` also contains the web-only `/__youtube` proxy middleware used by `services/net.js`; it must remain discoverable as root Metro configuration, with its path and host behavior intact. Expo's root `index.js` / `package.json` entry arrangement and `app.json` are configuration boundaries, not candidates to move wholesale into `src`.

## Test and Import Constraints

- `npm test` invokes Node's built-in test runner with `tests/*.test.js`.
- Existing tests import JavaScript modules using explicit `.js` suffixes (including `services/filters.js`, `services/rssParser.js`, `services/playerEmbed.js`, `services/stats.js`, and `utils/date.js`). Moving or converting these modules to TypeScript requires a compatible test-import/runner strategy or JavaScript-facing compatibility modules; extensionless Metro resolution alone does not satisfy Node's explicit `.js` imports.
- Current tests exercise feed parsing, filtering/format detection, stats/date rules, player embed behavior, and thumbnail selection/layout. They do not provide screen/navigation, provider/storage, or end-to-end coverage.
- `npm run typecheck`, `npm test`, `npm run lint`, and web export were not run in this analysis task; the assigned validation phase owns those checks.

## Migration Risks and Mitigations

| Severity | Evidence / failure mode | Mitigation constraint |
|---|---|---|
| HIGH | `App.js` combines bootstrap, async initialization, global state, route handling, callbacks, and screen composition. | Keep behavior contracts intact while separating app bootstrap/providers/navigation; use typed route state and typed feature props, without changing navigation technology. |
| HIGH | Native/web player files are a platform-resolved pair with distinct bridge semantics. | Move/rename both together, preserve the shared basename and extensionless import, then verify web and native resolution. |
| HIGH | The tree contains extensive pre-existing uncommitted changes, including `App.js`, screens, components, services, config, tests, and new TypeScript files. | Do not reset, restore, or replace broad files from HEAD. Inspect and integrate current content before each move. |
| HIGH | TypeScript is strict only for TS/TSX; JS is unchecked, and many components/services lack public types. | Type the files as they are moved/touched where feasible. Treat providers, route state, shared service records, and player event/handle contracts as high-risk typing seams. |
| HIGH | The Node tests depend on exact `.js` module paths. | Preserve/adjust test resolution deliberately; run the existing test command after every service move/conversion. |
| MEDIUM | The Metro YouTube proxy and package Expo entrypoint are root-discovered config/runtime seams. | Keep `metro.config.js`, `package.json`, and Expo registration resolvable from the repository root; update only the imports/config required by the move. |
| MEDIUM | Offline screens and local/offline services are currently unreachable, despite being in the requested destination feature list. | Relocate the extant implementation without assuming it is currently a navigable user flow; keep any activation decision separate from this source reorganization. |
| MEDIUM | Tests currently cover pure logic more than UI/runtime behavior. | Preserve all seven existing test files and perform the separately assigned typecheck, lint, test, and web-export validations. |

## Scope Boundary for the Next Phase

The requested change is to reorganize application source into the user-selected `src/app`, `src/features`, `src/domain`, `src/shared`, and `src/infrastructure` boundaries while retaining the existing Expo SDK 54 runtime and custom navigation behavior. The root Expo entry, app/Metro/package/lint configuration, Android project, assets, and generated export are not feature modules. The user explicitly included current `components/`, `screens/`, `services/`, `constants/`, `utils/`, `tests/`, and import/config changes in the work scope; the offline source is included even though it is not currently route-reachable. This report records constraints and does not decide the detailed file-by-file destination mapping.

## Upstream Artifacts Consumed

- `.github/modernize/rearchitecture/artifacts/project-profile.yaml` — used for project scale, language, and existing structure metadata.
- `.github/modernize/rearchitecture/artifacts/t1.1-architect.md` — used to confirm the five HIGH findings have explicit mitigation and downstream verification constraints.
- `.github/modernize/rearchitecture/board.md` — used to confirm task sequencing and that detailed module mapping and implementation remain downstream.
- `.github/modernize/rearchitecture/learnings/architect/expo-platform-player-and-test-seams.md` — used for native/web player and Node test-resolution constraints.
- `.github/modernize/rearchitecture/learnings/architect/typescript-source-reorganization.md` — used for the distinction between Expo/Metro resolution and Node `.js` test imports.

## Evidence Mapping

- `project-profile.yaml#project.loc/languages/structure` → **Current Structure**.
- `t1.1-architect.md#Remediation Decisions` → preserves the required bootstrap/navigation, player-pair, worktree, TypeScript, and Node-test safeguards in **Migration Risks and Mitigations**.
- `board.md#Tasks` → confirms this is the architecture-analysis task preceding module mapping and implementation.
- `package.json`, `tsconfig.json`, `index.js`, `App.js`, `components/TabBar.tsx` → **Entry, Bootstrap, and Navigation** and **TypeScript and Expo Constraints**.
- `App.js:55, 359-575`, `components/TabBar.tsx:9-14` → current routes/tabs and navigation constraints.
- `screens/OfflineScreen.js`, `screens/LocalPlayerScreen.js`, `services/offline.js`, `services/localVideos.js`, `services/downloads.js` → **Offline Reachability Finding**.
- `components/YoutubePlayer.js`, `components/YoutubePlayer.web.js`, `screens/PlayerScreen.js` → platform-pair constraint and player migration risk.
- `metro.config.js`, `services/net.js` → root web-proxy constraint.
- `tests/*.test.js`, `package.json#scripts.test` → **Test and Import Constraints**.
- Current `git status --short` and `find` inventory → working-tree preservation warning and source file counts.
- `AGENTS.md` and the exact Expo SDK 54 TypeScript guide at `https://raw.githubusercontent.com/expo/expo/sdk-54/docs/pages/guides/typescript.mdx` → version-pinned TypeScript extension/configuration conventions.

## Validation

- Source inventory, current `git status`, relevant entry/config/source files, assigned project metadata, and the t1.1 remediation artifact were inspected.
- The exact Expo SDK 54 TypeScript guide was fetched as requested; it confirms `.tsx` for JSX, `.ts` otherwise, `expo/tsconfig.base`, and optional path aliases.
- No application source files were edited and no test/build command was run in this analysis phase; typecheck, unit tests, lint, and web export remain assigned to validation.

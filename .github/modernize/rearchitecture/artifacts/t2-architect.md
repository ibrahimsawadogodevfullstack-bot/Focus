# t2 — Map Existing Modules to the Requested `src` Architecture

## Architecture Decision

Reorganize the existing single Expo application by responsibility without changing its runtime model. The first move keeps existing behavior and ownership intact; only then should typed seams or infrastructure adapters be extracted where needed.

- Keep `index.js` as the Expo registration entry. It imports `src/app/App`.
- Move the current app coordinator into `src/app/App.tsx`. Preserve its custom route state, initialization sequence, provider order, screen selection, and Android back behavior. Do not introduce Expo Router, React Navigation, or Redux.
- Put screens and UI used by one feature beside that feature. Put genuinely cross-feature UI and pure reusable utilities in `src/shared`.
- Keep shared business types and pure cross-feature rules in `src/domain`; `domain` must not depend on React Native, Expo, network, or persistence.
- Put direct network, storage, Expo, YouTube, and diagnostic integrations in `src/infrastructure`. Features may call infrastructure; infrastructure must not import feature code.
- Use `.tsx` for moved JSX and `.ts` for non-JSX code when conversion is safe. Keep platform-specific siblings on the same basename and keep the player import extensionless.
- Migrate from the current working tree, never from `HEAD`; inspect each destination and preserve pre-existing user edits. Upstream analysis recorded extensive dirty source changes, even though the status observed while mapping this phase showed only rearchitecture metadata changes.

## Source-to-Target Map

Targets below use `.tsx` for JSX and `.ts` for TypeScript logic. For modules imported by Node tests, retain a `.js` implementation temporarily if the existing test command cannot load the TypeScript target; do not weaken strict typechecking or assume Metro's resolver applies to Node.

### Application entry, providers, and shared configuration

| Existing source | Target | Ownership / preservation |
|---|---|---|
| `App.js` | `src/app/App.tsx` | Bootstrap and current route/state coordinator. Keep route cases `feed`, `channels`, `categories`, `stats`, `you`, and nested `player`, `categoryStats`, `editor` equivalent. |
| `index.js` | **Remain at repository root** | Keep Expo `registerRootComponent`; change only its import to `./src/app/App`. |
| `components/TabBar.tsx` | `src/app/navigation/TabBar.tsx` | App navigation UI; preserve the five existing tabs and visibility rules. |
| `components/ErrorBoundary.js` | `src/app/ErrorBoundary.tsx` | App-level boundary and crash screen. |
| `services/SettingsProvider.js` | `src/app/providers/SettingsProvider.tsx` | App-wide settings context and language update behavior. |
| `services/ThemeProvider.js` | `src/shared/theme/ThemeProvider.tsx` | Shared theme context/hooks; keep theme tokens in shared. Supply the selected theme from app provider composition rather than making shared UI depend on app modules. Preserve current provider behavior and order. |
| `constants/theme.js` | `src/shared/theme/tokens.ts` | Shared palettes, spacing, layout, and design tokens. |
| `i18n.js` | `src/shared/i18n/index.ts` | Shared translation initialization and language resolution. |
| `locales/*.json` | `src/shared/i18n/locales/*.json` | Keep all current translations and update the relative resource imports. |

`package.json`, `app.json`, `tsconfig.json`, `eslint.config.js`, `metro.config.js`, Android sources, assets, and generated `dist/` remain at their current root/project locations. Expo and Metro discover configuration there; in particular, preserve the root Metro `/__youtube` proxy and its allowed-host behavior.

### Feature screens and feature-owned components

| Existing source | Target |
|---|---|
| `screens/FeedScreen.js` | `src/features/feed/screens/FeedScreen.tsx` |
| `components/ActionSheet.js`, `AppBar.js`, `CategoryChips.js`, `FeedSkeleton.js`, `ShortCard.js`, `ShortsShelf.js`, `SyncBar.js`, `VideoCard.js` | `src/features/feed/components/<same-name>.tsx` |
| `screens/ChannelsScreen.js` | `src/features/channels/screens/ChannelsScreen.tsx` |
| `screens/CategoriesScreen.js`, `CategoryEditor.js` | `src/features/categories/screens/<same-name>.tsx` |
| `screens/PlayerScreen.js` | `src/features/player/screens/PlayerScreen.tsx` |
| `components/YoutubePlayer.js`, `YoutubePlayer.web.js` | `src/features/player/components/YoutubePlayer.tsx`, `YoutubePlayer.web.tsx` |
| `screens/StatsScreen.js`, `CategoryStatsScreen.js` | `src/features/stats/screens/<same-name>.tsx` |
| `screens/YouScreen.js` | `src/features/settings/screens/YouScreen.tsx` |
| `components/ChoiceSheet.js`, `SettingsRow.js`, `SettingsSection.js` | `src/features/settings/components/<same-name>.tsx` |
| `screens/OfflineScreen.js`, `LocalPlayerScreen.js` | `src/features/offline/screens/<same-name>.tsx` |

The offline screens are not currently reachable from the custom route switch or tab bar. Relocate them, but do not add a route or tab as a consequence of the move.

### Shared UI, domain rules, and utilities

| Existing source | Target | Reason |
|---|---|---|
| `components/BrandMark.js`, `ChannelAvatar.js`, `ConfirmSheet.js`, `EmptyState.js`, `FocusMark.js`, `Icons.js`, `ScreenHeader.js` | `src/shared/ui/<same-name>.tsx` | Reused by more than one screen/feature. |
| `components/ThumbnailFallback.js`, `VideoThumbnail.js` | `src/shared/ui/media/<same-name>.tsx` | Shared video/thumbnail presentation used by feed, player, or offline UI. |
| `domain/settings.ts` | `src/domain/settings.ts` | Existing typed shared settings contract. |
| `services/filters.js` | `src/domain/videoFormat.ts` | Pure video-format rules used by feed, player, and offline screens. |
| `constants/channels.js` | `src/domain/defaultChannels.ts` | Default channel records/IDs are shared by channel setup, feed loading, and persistence. |
| `services/thumbnailLayout.js` | `src/shared/media/thumbnailLayout.ts` | Pure thumbnail aspect/crop geometry. |
| `utils/date.js`, `utils/format.js` | `src/shared/utils/<same-name>.ts` | Pure helpers reused across stats, player, and offline UI. |

### Feature logic and infrastructure integrations

| Existing source | Target | Ownership / migration seam |
|---|---|---|
| `services/feed.js` | `src/features/feed/services/feed.ts` | Feed loading/use-case orchestration; call network, YouTube parsing, and persistence through infrastructure modules. |
| `services/formats.js` | `src/features/feed/services/formats.ts` | Feed format-detection behavior. It currently combines persisted state and YouTube thumbnail probing; isolate those I/O edges in infrastructure without changing its detection semantics. |
| `services/stats.js` | `src/features/stats/services/stats.ts` | Stats aggregation and insight rules. |
| `services/channelAvatars.js`, `channelCandidates.js`, `channelResolver.js` | `src/infrastructure/youtube/<same-name>.ts` | YouTube identity resolution and channel/avatar integration. Feature screens consume these through channel-facing calls. |
| `services/feedUrl.js`, `rssParser.js`, `playerEmbed.js`, `thumbnails.js` | `src/infrastructure/youtube/<same-name>.ts` | YouTube feed, embed, and thumbnail contracts/adapters. Keep parsing and embed behavior unchanged. |
| `services/net.js` | `src/infrastructure/network/net.ts` | Platform-aware fetch; web must continue using the root Metro proxy and native must fetch directly. |
| `services/storage.js` | `src/infrastructure/storage/appStore.ts` | AsyncStorage for feed cache, seen IDs, channels, and categories. Preserve keys, sanitization, and fallback behavior. |
| `services/settings.ts` | `src/infrastructure/storage/settings.ts` | Existing typed settings persistence and migration/sanitization. Keep `domain/settings.ts` as the contract and preserve schema migration/default behavior. |
| `services/tracking.js` | `src/infrastructure/storage/tracking.ts` | Persisted playback/tracking records consumed by app and stats/player features. Keep event semantics and stored format stable. |
| `services/offline.js` | `src/infrastructure/storage/offlineMetadata.ts` and, if separated, `src/infrastructure/expo/thumbnailCache.ts` | Preserve offline metadata and thumbnail-prefetch behavior. |
| `services/downloads.js` | `src/infrastructure/storage/downloads.ts` and, if separated, `src/infrastructure/expo/thumbnailCache.ts` | Preserve metadata-only YouTube “download” semantics; the official player does not save video files. Keep AsyncStorage and `Image.prefetch` behind infrastructure ownership. |
| `services/localVideos.js` | `src/infrastructure/expo/localVideos.ts` | Expo FileSystem, platform-specific local-video persistence, and byte formatting. Keep web `blob:` URI behavior distinct from native file copying. |
| `services/crashLog.js`, `performance.js` | `src/infrastructure/diagnostics/<same-name>.ts` | Crash persistence and performance instrumentation. |

The `offline.js`/`downloads.js` row is intentionally a small infrastructure split: metadata persistence belongs to storage; thumbnail prefetch belongs to the Expo/image adapter. Keep public behavior and failure handling stable while relocating. Do not turn the metadata-only saved-video list into actual video downloads.

## Import, TypeScript, and Test Contracts

- Keep Expo imports extensionless where platform resolution is needed. In particular, `PlayerScreen` imports `YoutubePlayer` without an extension; Metro must continue selecting `YoutubePlayer.web.tsx` for web and `YoutubePlayer.tsx` for native. Do not merge the iframe/postMessage and native WebView bridges.
- Keep all seven `tests/*.test.js` files and the existing Node test command at the repository root. Update test import paths when their source modules move. The tested modules include video-format filters, stats/date helpers, RSS parsing, thumbnails/layout, and player embeds. Node's explicit `.js` imports are a separate contract from Metro; verify any TypeScript loader/import change with the exact `npm test` command before converting these modules.
- Keep `tsconfig.json` extending `expo/tsconfig.base` with strict typechecking. Expo SDK 54 documents `.tsx` for JSX, `.ts` otherwise, and this base configuration; path aliases are optional, so prefer consistent relative-import updates unless an alias is justified and verified.
- Preserve existing settings keys/schema, AsyncStorage key formats, feed and channel parsing, player event bridge behavior, and network error/fallback behavior. This is a path/type migration, not a feature rewrite.

## Upstream Artifacts Consumed

- `.github/modernize/rearchitecture/artifacts/t1-architect.md` — current module inventory, app routes/providers, offline reachability, player/test import seams, and source-move scope.
- `.github/modernize/rearchitecture/artifacts/t1.1-architect.md` — required behavior, worktree, TypeScript, and Node test-resolution mitigations.
- `.github/modernize/rearchitecture/artifacts/t1.2-architect.md` — review confirming the mitigation decisions and evidence deferred to implementation/validation.
- `.github/modernize/rearchitecture/artifacts/project-profile.yaml` — project type, source structure, and migration intent.
- `.github/modernize/rearchitecture/board.md` — phase ordering and downstream frontend/runtime-validation responsibilities.
- `.github/modernize/rearchitecture/learnings/architect/expo-platform-player-and-test-seams.md` — platform-specific player and explicit Node import constraints.
- `.github/modernize/rearchitecture/learnings/architect/typescript-source-reorganization.md` — `.ts`/`.tsx` and TypeScript-vs-Node resolution guidance.

`context.md`, `decisions.md`, and a `*-fanout.md` topology were not present; no topology grouping was supplied.

## Evidence Mapping

- `t1-architect.md#Entry, Bootstrap, and Navigation` → `src/app` and navigation mapping plus preserved route contract.
- `t1-architect.md#Feature and Layer Observations` → screen, feature-service, domain, shared, and infrastructure mappings.
- `t1-architect.md#Offline Reachability Finding` → offline relocation without route activation.
- `t1-architect.md#TypeScript and Expo Constraints` → extension, platform-player, Metro, and Expo configuration contracts.
- `t1-architect.md#Test and Import Constraints` and `t1.1-architect.md#HIGH 5` → root Node test retention and explicit `.js` import verification requirement.
- `t1.1-architect.md#Remediation Decisions` → bootstrap, platform pair, dirty-worktree, strict TypeScript, and test safeguards.
- Current `App.js`, screen imports, service imports, `index.js`, `metro.config.js`, `package.json`, `tsconfig.json`, and the SDK 54 guide → file destinations and module-boundary details above.

## Verification Status

- Source inventory, relevant imports, app entry, Metro configuration, TypeScript configuration, and test imports were inspected.
- `AGENTS.md` was read; the requested versioned SDK 54 TypeScript guide was fetched from `https://raw.githubusercontent.com/expo/expo/sdk-54/docs/pages/guides/typescript.mdx`.
- No application source or configuration was changed. Build, typecheck, lint, test, and web-export execution remain assigned to later implementation and validation tasks.

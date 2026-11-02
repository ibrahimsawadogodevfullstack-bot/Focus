# Performance notes

## What this build measures

Development builds write structured `[perf]` entries to the JavaScript console:

- `feed.request`: one YouTube RSS request, including response status, response
  character count, and channel ID.
- `feed.load`: end-to-end feed load, including the selected source (`cache`,
  `network`, or `stale-cache`), video count, and failed-channel count.
- `thumbnail.probe`: the image-header probe for a thumbnail candidate.
- `thumbnail.image`: the image load after a candidate passes its probe.

These diagnostics are disabled in production builds. They contain timings for
the current run, not benchmark claims or user analytics.

## Behavior affecting loading

- A matching feed cache younger than 10 minutes is returned without network
  requests. An expired matching cache is shown while the refresh runs and remains
  available if every channel request fails.
- Feed requests remain limited to four concurrent channels.
- The data-saver preference restricts thumbnail candidates to YouTube's
  `hqdefault` and `mqdefault` variants. Normal mode retains the existing
  quality-first candidate sequence.
- Thumbnail metadata and image bytes are cached separately. The “clear
  thumbnail cache” action clears the Expo Image memory/disk cache and the
  in-memory thumbnail metadata.

No pagination, video preloading, or server-side caching is claimed: the current
source is public YouTube RSS and playback is an embedded YouTube player.

## Device measurement status

No physical Android device was available for this change, so cold-start,
time-to-first-video, playback-start, network-transfer, and low-end-device
measurements are **not available**. Do not interpret simulator, browser, or
Metro export timings as device performance.

For a reproducible follow-up, record the device model, Android version, app
build, network type, channel count, and whether the feed/image caches are cold
or warm. Capture at least 10 cold and 10 warm launches, then report medians and
95th percentiles separately. Keep measurements for feed load and playback
startup distinct; the latter includes YouTube's external player/network.

## Validation performed in this workspace

- `npm test`
- `npx expo export --platform android`

These validate source behavior and Android bundle generation; they are not
physical-device benchmarks.

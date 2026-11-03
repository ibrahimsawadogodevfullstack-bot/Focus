# Domain TypeScript in Node Tests

Use the project's Node runtime and test command to load pure TypeScript domain modules directly before adding a duplicated JavaScript compatibility layer.

## What Happened

In youtube-filter-v2 task t3.1a, the video-format rule module moved from JavaScript into `src/domain/videoFormat.ts`. The existing test command (`node --experimental-default-type=module --test`) successfully loaded the `.ts` module under Node 22.23.0, so test imports were changed to the new TypeScript path without adding a loader or duplicate implementation.

## Takeaway

When moving pure domain modules to TypeScript, first verify the repository's supported Node/test runtime can load the `.ts` target. If it can, import the single source directly in tests; otherwise retain a JavaScript implementation temporarily rather than assuming Metro resolution applies to Node.

## History
- 2026-11-02 (youtube-filter-v2/t3.1a): initial

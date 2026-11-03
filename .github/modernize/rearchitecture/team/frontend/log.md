## [t3.1a] Moved pure domain contracts and rules into src/domain
- Codebase/domain discoveries: format classification is pure; Node tests can import the `.ts` implementation with the current Node runtime and existing test command.
- Wrong assumptions and corrections: the strict typecheck caught optional `videoId` map indexing; guard the ID before probing the format map.
- Debugging dead-ends and what actually worked: keep test imports pointed at the TypeScript domain module; no duplicated JavaScript compatibility implementation was needed.
- Techniques/patterns worth reusing for future tasks: use `.ts` for shared contracts/rules and retain domain purity; let Expo Metro resolve extensionless app imports while Node tests use explicit `.ts` imports.
- Learnings consumed: []

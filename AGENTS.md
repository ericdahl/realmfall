# Notes for agents

The README's **Development** section has the commands and a map of the code. This file covers what isn't obvious from either.

## Releasing

Every change a player can notice is a release. Docs, tests and refactors are not.

1. Bump `version` in `package.json` and in both places in `package-lock.json`.
2. Add an entry to the top of `src/changelog.ts` (`tests/changelog.test.ts` fails if it doesn't match `package.json`). Players read it in game: say what they will see, in plain sentences, not what changed in the code.
3. Commit subject: `Realmfall X.Y.Z: <what changed>`.
4. Once it's on `master`, which deploys to GitHub Pages, `.github/workflows/release.yml` tags the last commit of the PR that brought in the release commit with `vX.Y.Z` and creates a GitHub release from the changelog notes. Don't do this by hand; if a run fails, re-run it. It only releases the version in `package.json`, so put one release in each PR.

## Rules the code relies on

- `src/game/` is the simulation and must not touch the DOM. Randomness goes through a seeded `Rng` (`src/game/rng.ts`), never `Math.random`, so `?seed=` and the tests stay reproducible. (`src/render/` and `src/ui/` may use `Math.random` for cosmetic things.)
- There are no image or audio files: all art and sound are drawn or synthesized in code.
- Heroes are saved in localStorage under `realmfall.chars` (`src/ui/save.ts`). Renaming the key loses players' heroes. If you change the shape of `CharSave`, bump `SAVE_VERSION` in `src/game/world.ts` and migrate old saves in `loadChars`.
- The simulation runs at a fixed 20 ticks a second (`World.tick`). `World.run(seconds)` runs it as fast as it can; tests use it to play out the war.

## Testing

- `npm test` takes about a minute; most of it is a 20-minute headless realm war.
- e2e needs `npx playwright install chromium` once (or `PW_CHROMIUM=/path/to/chromium`). Specs drive the game through `window.game` (`game.world`, `game.panels`, `game.controls`). `?autostart&class=<class>&realm=<0-2>&level=<n>` skips the title screen.
- Headless Chromium renders WebGL in software at a frame or two a second, so check frame rates with `?fps` on a real machine, not in tests.

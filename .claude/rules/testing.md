When writing or editing tests in `tests/`:

- Mock boundary is at provider API clients — mock `@octokit/rest` and `@gitbeaker/rest` instances, not the Provider class
- Never mock `existsSync` from `fs` in ESM Vitest tests — use real temp dirs (`fs.mkdtemp(join(os.tmpdir(), 'knowhub-test-'))`) and clean up with `fs.rm(dir, { recursive: true, force: true })`
- When mocking `src/utils/git.js`, include all functions the SUT calls — adding new git util functions requires updating mocks too
- Integration tests mock at the module boundary (`vi.mock('../../src/config/loader.js', ...)`) not at the function level
- `npm test` runs all tests — subagents cannot run this due to Bash permission restrictions, run from the parent session

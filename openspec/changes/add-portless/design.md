## Decisions

Use the pinned project dependency and `portless run vp dev`. Portless infers the
name from `package.json`, prefixes linked worktrees, and injects Vite's port,
host and strict-port flags. No additional Vite configuration is needed.

Keep `PORTLESS=0 pnpm dev` for direct HTTP access and local consumer installs.
Browser tests already accept `TEST_BASE_URL`. Production commands stay unchanged.

## Verification

Exercise the proxy with temporary state, plain HTTP, an unprivileged port and
hosts-file synchronization disabled. Check page and registry delivery, the Vite
WebSocket connection, and the direct-port bypass. Run repository checks and a
production build. Default HTTPS certificate trust requires interactive setup.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About This Project

FreqUI is a Vue 3 + TypeScript web interface for the [Freqtrade](https://www.freqtrade.io/) cryptocurrency trading bot. It communicates with a Freqtrade backend REST API (default: `http://127.0.0.1:8080`).

### Environment Variables

Defined in `src/env.d.ts`. Set these in a `.env.local` file:

```
VITE_CF_ACCESS_CLIENT_ID=       # Cloudflare Access client ID (injected on every request)
VITE_CF_ACCESS_CLIENT_SECRET=   # Cloudflare Access client secret
VITE_WS_TOKEN=                  # WebSocket auth token
```

## Commands

```bash
pnpm install          # Install dependencies
pnpm run dev          # Dev server on localhost:3000 (proxies /api/* to :8080)
pnpm run build        # Production build
pnpm run lint         # ESLint with auto-fix
pnpm run typecheck    # vue-tsc type checking

# Tests
pnpm run test:unit                                          # All unit tests (Vitest)
pnpm run test:unit -- tests/unit/formatters.spec.ts        # Single unit test file
pnpm run test:e2e                                          # Playwright e2e (all browsers)
pnpm run test:e2e-chromium                                 # Playwright e2e (Chromium only)
```

## Architecture

### State Management (Pinia)

The core of the app is a two-level Pinia store architecture in [src/stores/](src/stores/):

- **`useBotStore()` (`ftbotwrapper.ts`)** — Top-level wrapper that manages multiple bot connections. Holds the list of bots, the active bot selection, and global refresh control. Creates sub-stores per bot.
- **`createBotSubStore()` (`ftbot.ts`)** — Per-bot state: trades, balance, performance, strategy info, backtest results, and WebSocket connection for real-time updates.
- Supporting stores: `useSettingsStore`, `useLayoutStore`, `useColorStore`, `useAlertsStore`, `usePlotConfigStore`, `usePairlistConfigStore`, `useChartConfigStore`.

### API Layer

[src/composables/loginInfo.ts](src/composables/loginInfo.ts) (`useLoginInfo`) manages per-bot auth state: credentials are persisted in `localStorage` under the key `ftAuthLoginInfo` (keyed by `botId`). It owns token refresh and deduplicates concurrent 401s with a shared in-flight promise.

[src/composables/api.ts](src/composables/api.ts) creates an Axios instance per bot from `useLoginInfo`. Interceptors handle:
- Bearer token injection on every request (plus optional Cloudflare Access headers from env vars)
- Automatic token refresh on 401 via `loginInfo.refreshToken()`
- Marking the bot offline on 500 or network errors

### Routing

[src/router/index.ts](src/router/index.ts) uses lazy-loaded routes. A `beforeEach` guard redirects unauthenticated users to `/login` unless the route has `meta.allowAnonymous`. `initBots()` is called on every navigation.

### Auto-imports

Vite is configured with `unplugin-auto-import` and `unplugin-vue-components`. You do **not** need to manually import:
- Vue APIs (`ref`, `computed`, `watch`, etc.)
- Vue Router composables (`useRouter`, `useRoute`)
- `@vueuse/core` composables
- Pinia (`defineStore`, `storeToRefs`)
- Anything from `src/composables/`, `src/stores/`, `src/utils/`
- PrimeVue components and MDI icons (`MdiXxx` naming via `unplugin-icons`)

### Key Conventions

- **Component files**: Vue SFC with block order `<script setup lang="ts">` → `<template>` → `<style>`. PascalCase component names.
- **Imports**: Use `import type` for type-only imports (`@typescript-eslint/consistent-type-imports` is enforced).
- **Path alias**: `@/` maps to `src/`.
- **Formatting**: Prettier with `printWidth: 100`, single quotes, trailing commas everywhere.
- **Icons**: Use `MdiIconName` components (auto-resolved from `@mdi/js` via `unplugin-icons`).
- **UI**: PrimeVue 4 components + Tailwind CSS 4. Custom theme in `src/styles/ftTheme.ts`.

### Types

All Freqtrade API response shapes are defined in [src/types/](src/types/). Always use these types when working with API data — don't use `any` for API responses.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.

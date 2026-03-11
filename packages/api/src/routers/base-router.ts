/**
 * Re-exports BaseRouter from @fromcode119/sdk — the canonical source of truth.
 *
 * BaseRouter was moved to @fromcode119/sdk to break the circular dependency:
 *   api → @fromcode119/sdk → @fromcode119/api/routers  (crash)
 *
 * All internal api/routes/* files continue importing from '../routers/base-router'
 * unchanged; they now transparently receive the sdk-hosted implementation.
 */
export { BaseRouter } from '@fromcode119/core';

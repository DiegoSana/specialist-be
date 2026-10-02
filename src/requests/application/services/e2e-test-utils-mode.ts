import { ConfigService } from '@nestjs/config';

/**
 * Single safety-critical check gating the dev/CI-only E2E cleanup endpoint used by the
 * `specialist-e2e` Playwright suite's `global-teardown.ts` to bulk-delete the `[E2E]`-prefixed
 * Requests it created during a run.
 *
 * Unlike `isWhatsAppDevMode`, this is a single explicit opt-in env var with NO `NODE_ENV`
 * branch: `E2E_TEST_UTILS_ENABLED` must be left unset everywhere except local/CI (never set on
 * Fly/production) - defaulting it on for any non-production environment (the way
 * `isWhatsAppDevMode` does for `NODE_ENV !== 'production'`) would be wrong here, since this
 * endpoint destructively bulk-deletes data rather than merely faking an inbound message.
 */
export function isE2eTestUtilsEnabled(config: ConfigService): boolean {
  return config.get<string>('E2E_TEST_UTILS_ENABLED', 'false') === 'true';
}

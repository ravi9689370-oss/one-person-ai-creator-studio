/**
 * Per-file setup: guarantees required env vars exist before modules import
 * @/lib/env, and records which provider credentials are intentionally absent
 * so fixture behavior is the tested baseline.
 */
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "file:./db/test.db";
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? "test-secret-one-person-ai-creator-studio";
process.env.CRON_SECRET = process.env.CRON_SECRET ?? "test-cron-secret";

// Make sure no real provider keys leak into the test environment -
// tests below assert the labeled fixture mode explicitly.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.ELEVENLABS_API_KEY;
delete process.env.HIGGSFIELD_API_KEY;
delete process.env.STRIPE_SECRET_KEY;

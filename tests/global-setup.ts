/**
 * Global setup for the vitest run:
 * 1. Points DATABASE_URL at a dedicated throwaway test database.
 * 2. Applies migrations and idempotent seed against the test DB.
 * Individual test files create their own scoped fixtures.
 */
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const TEST_DB = "file:./db/test.db";

export default function globalSetup(): void {
  const root = path.resolve(__dirname, "..");
  const env = {
    ...process.env,
    DATABASE_URL: TEST_DB,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "test-secret-one-person-ai-creator-studio",
    NEXTAUTH_URL: "http://localhost:3000",
    CRON_SECRET: process.env.CRON_SECRET ?? "test-cron-secret",
    // The test suite owns its seed fixture: without SEED_CREATOR_PASSWORD the
    // seed skips account creation, which would leave route-level tests
    // unauthenticated (observed on CI where .env does not exist).
    SEED_CREATOR_EMAIL: "creator@example.com",
    SEED_CREATOR_PASSWORD: "studio-dev-2026",
    SEED_WORKSPACE_NAME: "Test Studio WS",
    SWAGGER: undefined,
  };

  rmSync(path.join(root, "prisma/db/test.db"), { force: true });
  rmSync(path.join(root, "prisma/db/test.db-journal"), { force: true });
  execSync("npx prisma migrate deploy", { cwd: root, stdio: "inherit", env });
  execSync("npx tsx prisma/seed.ts", { cwd: root, stdio: "inherit", env });

  // Keep env in this process as well for in-memory execution paths.
  process.env.DATABASE_URL = TEST_DB;
  process.env.NEXTAUTH_SECRET = env.NEXTAUTH_SECRET as string;
  process.env.CRON_SECRET = env.CRON_SECRET;
}

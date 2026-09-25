// Runs in every test worker before any test file imports app code, so
// getEnv() sees the test configuration.
import { config } from 'dotenv';

config({ quiet: true });

process.env.NODE_ENV = 'test';
process.env.BCRYPT_ROUNDS = process.env.BCRYPT_ROUNDS_TEST ?? '4';
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
process.env.JWT_ACCESS_SECRET ??= 'test-only-secret-that-is-at-least-thirty-two-chars';
process.env.CLIENT_ORIGINS ??= 'http://localhost:5173';

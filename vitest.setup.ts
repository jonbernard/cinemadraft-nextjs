import { config } from 'dotenv';
import '@testing-library/jest-dom/vitest';

// Vitest does not read .env files the way Next does, so database tests would
// otherwise start with DATABASE_URL unset.
//
// .env.local first and .env second, matching Next's precedence. Both point at
// the local Docker container — Neon is Preview/Production only, and a suite
// pointed at it would be mutating the only restored copy of production data.
config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

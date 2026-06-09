/**
 * @claude-flow/shared Vitest Configuration
 *
 * Without an explicit config, vitest 4 auto-discovers __tests__/setup.ts
 * and fails to import because the file doesn't exist (this package never
 * needed test-suite setup). Providing the config with an empty setupFiles
 * stops the auto-discovery probe.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    globals: false,
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});

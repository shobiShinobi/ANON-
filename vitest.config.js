import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['server/**/*.js'],
      exclude: ['server/server.js'], // entry point (timers/sockets) is covered by integration boot, not unit
      thresholds: {
        lines: 70,
        functions: 70,
        statements: 70,
        branches: 60,
      },
    },
  },
});

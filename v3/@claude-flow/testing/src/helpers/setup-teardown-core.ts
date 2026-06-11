/**
 * Setup-teardown — core
 *
 * Extracted verbatim during campaign-2 wave W307. Barrel stays.
 */
import { vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

import type {
  TestScope,
} from './setup-teardown-extended.js';

export interface SetupContext {
  /**
   * Register a cleanup function to be called during teardown
   */
  addCleanup(cleanup: CleanupFunction): void;

  /**
   * Register a resource that needs to be closed/disposed
   */
  registerResource<T extends Disposable>(resource: T): T;

  /**
   * Get a registered resource by name
   */
  getResource<T>(name: string): T | undefined;

  /**
   * Set a named resource
   */
  setResource<T>(name: string, resource: T): void;

  /**
   * Run all cleanup functions
   */
  runCleanup(): Promise<void>;
}

/**
 * Cleanup function type
 */
export type CleanupFunction = () => void | Promise<void>;

/**
 * Disposable interface
 */
export interface Disposable {
  dispose?(): void | Promise<void>;
  close?(): void | Promise<void>;
  destroy?(): void | Promise<void>;
  shutdown?(): void | Promise<void>;
}

/**
 * Create a setup context for managing test resources
 *
 * @example
 * const ctx = createSetupContext();
 * ctx.addCleanup(() => server.close());
 * ctx.registerResource(database);
 * // ... run tests
 * await ctx.runCleanup();
 */
export function createSetupContext(): SetupContext {
  const cleanups: CleanupFunction[] = [];
  const resources = new Map<string, unknown>();
  const disposables: Disposable[] = [];

  return {
    addCleanup(cleanup: CleanupFunction): void {
      cleanups.push(cleanup);
    },

    registerResource<T extends Disposable>(resource: T): T {
      disposables.push(resource);
      return resource;
    },

    getResource<T>(name: string): T | undefined {
      return resources.get(name) as T | undefined;
    },

    setResource<T>(name: string, resource: T): void {
      resources.set(name, resource);
    },

    async runCleanup(): Promise<void> {
      // Run cleanups in reverse order
      for (const cleanup of cleanups.reverse()) {
        try {
          await cleanup();
        } catch (error) {
          console.error('Cleanup error:', error);
        }
      }

      // Dispose resources
      for (const resource of disposables) {
        try {
          if (resource.dispose) {
            await resource.dispose();
          } else if (resource.close) {
            await resource.close();
          } else if (resource.destroy) {
            await resource.destroy();
          } else if (resource.shutdown) {
            await resource.shutdown();
          }
        } catch (error) {
          console.error('Resource disposal error:', error);
        }
      }

      cleanups.length = 0;
      resources.clear();
      disposables.length = 0;
    },
  };
}

/**
 * Global test context that persists across test files
 */
let globalContext: SetupContext | null = null;

/**
 * Get or create the global test context
 */
export function getGlobalContext(): SetupContext {
  if (!globalContext) {
    globalContext = createSetupContext();
  }
  return globalContext;
}

/**
 * Reset the global test context
 */
export async function resetGlobalContext(): Promise<void> {
  if (globalContext) {
    await globalContext.runCleanup();
    globalContext = null;
  }
}

/**
 * Test environment configuration
 */
export interface TestEnvironmentConfig {
  /**
   * Reset all mocks before each test
   */
  resetMocks?: boolean;

  /**
   * Use fake timers
   */
  fakeTimers?: boolean;

  /**
   * Initial fake time
   */
  initialTime?: Date | number;

  /**
   * Environment variables to set
   */
  env?: Record<string, string>;

  /**
   * Suppress console output during tests
   */
  suppressConsole?: boolean | ('log' | 'warn' | 'error' | 'info')[];

  /**
   * Timeout for async operations
   */
  timeout?: number;
}

/**
 * Configure test environment with standard settings
 *
 * @example
 * configureTestEnvironment({
 *   resetMocks: true,
 *   fakeTimers: true,
 *   suppressConsole: ['log', 'warn'],
 * });
 */
export function configureTestEnvironment(config: TestEnvironmentConfig = {}): void {
  const {
    resetMocks = true,
    fakeTimers = false,
    initialTime,
    env = {},
    suppressConsole = false,
  } = config;

  const originalEnv: Record<string, string | undefined> = {};
  const originalConsole: Partial<Console> = {};

  beforeAll(() => {
    // Set environment variables
    for (const [key, value] of Object.entries(env)) {
      originalEnv[key] = process.env[key];
      process.env[key] = value;
    }

    // Suppress console
    if (suppressConsole) {
      const methods = suppressConsole === true
        ? ['log', 'warn', 'error', 'info'] as const
        : suppressConsole;

      for (const method of methods) {
        originalConsole[method] = console[method];
        console[method] = vi.fn();
      }
    }
  });

  afterAll(() => {
    // Restore environment variables
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    // Restore console
    for (const [method, original] of Object.entries(originalConsole)) {
      if (original) {
        (console as unknown as Record<string, unknown>)[method] = original;
      }
    }
  });

  beforeEach(() => {
    if (resetMocks) {
      vi.clearAllMocks();
    }

    if (fakeTimers) {
      vi.useFakeTimers();
      if (initialTime) {
        vi.setSystemTime(initialTime);
      }
    }
  });

  afterEach(() => {
    if (fakeTimers) {
      vi.useRealTimers();
    }

    vi.restoreAllMocks();
  });
}

/**
 * Create a test suite with automatic setup/teardown
 *
 * @example
 * const { beforeEachTest, afterEachTest, getContext } = createTestSuite({
 *   resetMocks: true,
 * });
 */
export function createTestSuite(config: TestEnvironmentConfig = {}): TestSuiteHelpers {
  const context = createSetupContext();

  configureTestEnvironment(config);

  return {
    beforeEachTest: (fn: (ctx: SetupContext) => void | Promise<void>) => {
      beforeEach(async () => {
        await fn(context);
      });
    },

    afterEachTest: (fn: (ctx: SetupContext) => void | Promise<void>) => {
      afterEach(async () => {
        await fn(context);
        await context.runCleanup();
      });
    },

    getContext: () => context,
  };
}

/**
 * Test suite helpers interface
 */
export interface TestSuiteHelpers {
  beforeEachTest: (fn: (ctx: SetupContext) => void | Promise<void>) => void;
  afterEachTest: (fn: (ctx: SetupContext) => void | Promise<void>) => void;
  getContext: () => SetupContext;
}

/**
 * Create isolated test scope
 *
 * @example
 * const scope = createTestScope();
 * scope.addMock(mockService);
 * await scope.run(async () => {
 *   // test code
 * });
 */
export function createTestScope(): TestScope {
  const mocks: ReturnType<typeof vi.fn>[] = [];
  const cleanups: CleanupFunction[] = [];

  return {
    addMock<T extends ReturnType<typeof vi.fn>>(mock: T): T {
      mocks.push(mock);
      return mock;
    },

    addCleanup(cleanup: CleanupFunction): void {
      cleanups.push(cleanup);
    },

    async run<T>(fn: () => Promise<T>): Promise<T> {
      try {
        return await fn();
      } finally {
        // Clear all mocks
        for (const mock of mocks) {
          mock.mockClear();
        }

        // Run cleanups
        for (const cleanup of cleanups.reverse()) {
          await cleanup();
        }
      }
    },

    clear(): void {
      for (const mock of mocks) {
        mock.mockClear();
      }
    },

    reset(): void {
      for (const mock of mocks) {
        mock.mockReset();
      }
    },
  };
}

/**
 * Test scope interface
 */

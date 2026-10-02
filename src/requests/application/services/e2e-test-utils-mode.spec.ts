import { isE2eTestUtilsEnabled } from './e2e-test-utils-mode';

describe('isE2eTestUtilsEnabled', () => {
  const makeConfig = (values: { E2E_TEST_UTILS_ENABLED?: string } = {}) =>
    ({
      get: jest.fn((key: string, def?: string) =>
        key in values ? (values as any)[key] : def,
      ),
    }) as any;

  it('returns true when E2E_TEST_UTILS_ENABLED is exactly "true"', () => {
    expect(
      isE2eTestUtilsEnabled(makeConfig({ E2E_TEST_UTILS_ENABLED: 'true' })),
    ).toBe(true);
  });

  it('returns false when the var is unset (default off)', () => {
    expect(isE2eTestUtilsEnabled(makeConfig())).toBe(false);
  });

  it('returns false when the var is not exactly "true"', () => {
    expect(
      isE2eTestUtilsEnabled(makeConfig({ E2E_TEST_UTILS_ENABLED: 'yes' })),
    ).toBe(false);
  });

  it('returns false when the var is explicitly "false"', () => {
    expect(
      isE2eTestUtilsEnabled(makeConfig({ E2E_TEST_UTILS_ENABLED: 'false' })),
    ).toBe(false);
  });
});

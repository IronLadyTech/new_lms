import { describe, it, expect, vi, afterEach } from 'vitest';
import { assertNotProduction, PRODUCTION_PROJECT_ID } from './refuseProduction.js';

describe('assertNotProduction', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits for production project id', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    assertNotProduction(PRODUCTION_PROJECT_ID, 'unit');
    expect(exit).toHaveBeenCalledWith(1);
    expect(err).toHaveBeenCalled();
  });

  it('allows staging ids', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {});
    assertNotProduction('lmsironlady-staging', 'unit');
    expect(exit).not.toHaveBeenCalled();
  });
});

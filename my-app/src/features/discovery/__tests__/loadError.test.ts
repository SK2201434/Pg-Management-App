import { classifyLoadError, describeLoadError, FAILURE_TEXT } from '@/features/discovery/loadError';

describe('discovery load errors', () => {
  it('tells permission, index, network and other failures apart', () => {
    expect(classifyLoadError({ code: 'permission-denied' })).toBe('permission-denied');
    expect(classifyLoadError({ code: 'firestore/permission-denied' })).toBe('permission-denied');
    expect(classifyLoadError({ code: 'failed-precondition', message: 'The query requires an index.' })).toBe('missing-index');
    expect(classifyLoadError({ code: 'failed-precondition', message: 'something else' })).toBe('unknown');
    expect(classifyLoadError({ code: 'unavailable' })).toBe('network');
    expect(classifyLoadError(new Error('boom'))).toBe('unknown');
  });

  it('has user text for every failure and never mentions raw codes', () => {
    for (const failure of Object.values(FAILURE_TEXT)) expect(`${failure.title} ${failure.body}`).not.toMatch(/permission-denied|firestore/i);
  });

  it('keeps the Firebase code and message for the development log', () => {
    expect(describeLoadError({ code: 'permission-denied', message: 'Missing or insufficient permissions.' })).toEqual({ code: 'permission-denied', message: 'Missing or insufficient permissions.' });
    expect(describeLoadError('x').code).toBe('none');
  });
});

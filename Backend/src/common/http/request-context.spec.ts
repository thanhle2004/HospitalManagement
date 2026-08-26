import { getRequestId, resolveRequestId } from './request-context';

describe('request context', () => {
  it('keeps a safe upstream request id', () => {
    expect(resolveRequestId('edge-01:request_42')).toBe('edge-01:request_42');
  });

  it('replaces values that could inject into logs or headers', () => {
    const requestId = resolveRequestId('bad\nrequest-id');
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('reads the id attached by middleware', () => {
    expect(getRequestId({ requestId: 'request-1' } as never)).toBe('request-1');
  });
});

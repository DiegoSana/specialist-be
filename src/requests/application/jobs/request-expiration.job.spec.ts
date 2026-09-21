import { ConfigService } from '@nestjs/config';
import { RequestStatus } from '@prisma/client';
import { RequestExpirationJob } from './request-expiration.job';
import { createMockRequest } from '../../../__mocks__/test-utils';

describe('RequestExpirationJob', () => {
  const systemCtx = { userId: 'system', isSystem: true };
  let repo: { findStaleByStatus: jest.Mock };
  let service: { updateStatus: jest.Mock; buildSystemAuthContext: jest.Mock };
  let env: Record<string, string>;
  let job: RequestExpirationJob;

  const build = () => {
    const config = {
      get: (key: string, def?: string) => env[key] ?? def,
    } as unknown as ConfigService;
    job = new RequestExpirationJob(repo as any, service as any, config);
  };

  beforeEach(() => {
    env = { REQUEST_EXPIRATION_ENABLED: 'true' };
    repo = { findStaleByStatus: jest.fn().mockResolvedValue([]) };
    service = {
      updateStatus: jest.fn().mockResolvedValue(undefined),
      buildSystemAuthContext: jest.fn().mockReturnValue(systemCtx),
    };
    build();
  });

  it('does nothing when the flag is off', async () => {
    env.REQUEST_EXPIRATION_ENABLED = 'false';
    await job.applyExpirations();
    expect(repo.findStaleByStatus).not.toHaveBeenCalled();
  });

  it.each([
    [RequestStatus.PUBLISHED, RequestStatus.EXPIRED],
    [RequestStatus.SENT, RequestStatus.NO_RESPONSE],
    [RequestStatus.CONTACT_RELEASED, RequestStatus.ABANDONED],
    [RequestStatus.FINISHED, RequestStatus.CLOSED],
  ])('moves stale %s requests to %s as the system actor', async (from, to) => {
    const request = createMockRequest({ id: `r-${from}`, status: from });
    repo.findStaleByStatus.mockImplementation(async (s: RequestStatus) =>
      s === from ? [request] : [],
    );

    await job.applyExpirations();

    expect(service.updateStatus).toHaveBeenCalledTimes(1);
    expect(service.updateStatus).toHaveBeenCalledWith(request.id, systemCtx, {
      status: to,
    });
  });

  it('never touches IN_PROGRESS requests (open question in the spec)', async () => {
    await job.applyExpirations();
    const queried = repo.findStaleByStatus.mock.calls.map((c) => c[0]);
    expect(queried).not.toContain(RequestStatus.IN_PROGRESS);
  });

  it('uses env plazos with defaults as fallback', async () => {
    env.REQUEST_EXPIRY_DAYS_PUBLISHED = '10';
    build();
    const before = Date.now();
    await job.applyExpirations();
    const published = repo.findStaleByStatus.mock.calls.find(
      (c) => c[0] === RequestStatus.PUBLISHED,
    );
    const sent = repo.findStaleByStatus.mock.calls.find(
      (c) => c[0] === RequestStatus.SENT,
    );
    const day = 24 * 60 * 60 * 1000;
    expect(Math.round((before - published[1].getTime()) / day)).toBe(10);
    expect(Math.round((before - sent[1].getTime()) / day)).toBe(6);
  });

  it('skips requests that already left the expected status (idempotent)', async () => {
    repo.findStaleByStatus.mockImplementation(async (s: RequestStatus) =>
      s === RequestStatus.PUBLISHED
        ? [createMockRequest({ status: RequestStatus.EXPIRED })]
        : [],
    );
    await job.applyExpirations();
    expect(service.updateStatus).not.toHaveBeenCalled();
  });

  it('isolates per-item errors and keeps processing', async () => {
    const a = createMockRequest({ id: 'a', status: RequestStatus.PUBLISHED });
    const b = createMockRequest({ id: 'b', status: RequestStatus.PUBLISHED });
    repo.findStaleByStatus.mockImplementation(async (s: RequestStatus) =>
      s === RequestStatus.PUBLISHED ? [a, b] : [],
    );
    service.updateStatus.mockRejectedValueOnce(new Error('boom'));

    await expect(job.applyExpirations()).resolves.toBeUndefined();
    expect(service.updateStatus).toHaveBeenCalledTimes(2);
  });

  it('isolates repository failures per rule', async () => {
    repo.findStaleByStatus.mockRejectedValueOnce(new Error('db down'));
    await expect(job.applyExpirations()).resolves.toBeUndefined();
    expect(repo.findStaleByStatus).toHaveBeenCalledTimes(4);
  });
});

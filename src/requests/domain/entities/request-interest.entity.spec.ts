import { RequestInterestStatus } from '@prisma/client';
import { RequestInterestEntity } from './request-interest.entity';

const create = (status?: RequestInterestStatus) =>
  new RequestInterestEntity(
    'interest-1',
    'request-1',
    'sp-1',
    'Hello',
    new Date('2026-01-01'),
    status,
  );

describe('RequestInterestEntity', () => {
  it('defaults to INTERESTED', () => {
    const interest = create();
    expect(interest.status).toBe(RequestInterestStatus.INTERESTED);
    expect(interest.isInterested()).toBe(true);
  });

  it('transitions immutably (markChosen / markNotChosen / withdraw)', () => {
    const interest = create();
    const chosen = interest.markChosen();
    expect(chosen.isChosen()).toBe(true);
    expect(chosen).not.toBe(interest);
    expect(interest.isInterested()).toBe(true);
    expect(interest.markNotChosen().isNotChosen()).toBe(true);
    expect(interest.withdraw().isWithdrawn()).toBe(true);
  });

  it('keeps identity fields across transitions', () => {
    const withdrawn = create().withdraw();
    expect(withdrawn.id).toBe('interest-1');
    expect(withdrawn.requestId).toBe('request-1');
    expect(withdrawn.serviceProviderId).toBe('sp-1');
    expect(withdrawn.createdAt).toEqual(new Date('2026-01-01'));
  });

  it('reExpress goes back to INTERESTED with the new message', () => {
    const again = create(RequestInterestStatus.WITHDRAWN).reExpress('Again');
    expect(again.isInterested()).toBe(true);
    expect(again.message).toBe('Again');
  });

  it('reset goes back to INTERESTED keeping the message', () => {
    const reset = create(RequestInterestStatus.CHOSEN).reset();
    expect(reset.isInterested()).toBe(true);
    expect(reset.message).toBe('Hello');
  });

  describe('canBeWithdrawnBy', () => {
    it('allows the owner while undecided', () => {
      expect(create().canBeWithdrawnBy({ serviceProviderId: 'sp-1' })).toBe(
        true,
      );
    });

    it('denies other providers and anonymous contexts', () => {
      expect(create().canBeWithdrawnBy({ serviceProviderId: 'sp-2' })).toBe(
        false,
      );
      expect(create().canBeWithdrawnBy({ serviceProviderId: null })).toBe(
        false,
      );
    });

    it.each([
      RequestInterestStatus.CHOSEN,
      RequestInterestStatus.NOT_CHOSEN,
      RequestInterestStatus.WITHDRAWN,
    ])('denies once the interest is %s', (status) => {
      expect(
        create(status).canBeWithdrawnBy({ serviceProviderId: 'sp-1' }),
      ).toBe(false);
    });
  });
});

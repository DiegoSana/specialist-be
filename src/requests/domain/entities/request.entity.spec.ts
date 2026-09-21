import { RequestStatus } from '@prisma/client';
import { RequestAuthContext, RequestEntity } from './request.entity';
import { createMockRequest } from '../../../__mocks__/test-utils';

const CLIENT_ID = 'client-1';
const PROVIDER_ID = 'provider-1';

const client: RequestAuthContext = { userId: CLIENT_ID };
const provider: RequestAuthContext = {
  userId: 'provider-user',
  serviceProviderId: PROVIDER_ID,
};
const system: RequestAuthContext = { userId: 'system', isSystem: true };
const support: RequestAuthContext = { userId: 'support-1', isSupport: true };
const admin: RequestAuthContext = { userId: 'admin-1', isAdmin: true };
const stranger: RequestAuthContext = {
  userId: 'stranger',
  serviceProviderId: 'other-provider',
};

const at = (status: RequestStatus) =>
  createMockRequest({
    clientId: CLIENT_ID,
    providerId: PROVIDER_ID,
    status,
  });

describe('RequestEntity', () => {
  describe('createDraft', () => {
    it('should create a request in DRAFT with no status reason', () => {
      const draft = RequestEntity.createDraft({
        id: 'r1',
        clientId: CLIENT_ID,
        providerId: null,
        tradeId: 'trade-1',
        isPublic: true,
        title: 't',
        description: 'd',
        address: null,
        availability: null,
      });
      expect(draft.status).toBe(RequestStatus.DRAFT);
      expect(draft.isDraft()).toBe(true);
      expect(draft.statusReason).toBeNull();
    });
  });

  describe('canChangeStatusBy (transition table)', () => {
    const allowed: Array<
      [RequestStatus, RequestStatus, RequestAuthContext, string]
    > = [
      [RequestStatus.DRAFT, RequestStatus.PUBLISHED, client, 'client'],
      [RequestStatus.DRAFT, RequestStatus.SENT, client, 'client'],
      [
        RequestStatus.PUBLISHED,
        RequestStatus.CONTACT_RELEASED,
        client,
        'client',
      ],
      [RequestStatus.PUBLISHED, RequestStatus.CANCELLED, client, 'client'],
      [RequestStatus.PUBLISHED, RequestStatus.EXPIRED, system, 'system'],
      [
        RequestStatus.SENT,
        RequestStatus.CONTACT_RELEASED,
        provider,
        'provider',
      ],
      [RequestStatus.SENT, RequestStatus.REJECTED, provider, 'provider'],
      [RequestStatus.SENT, RequestStatus.CANCELLED, client, 'client'],
      [RequestStatus.SENT, RequestStatus.NO_RESPONSE, system, 'system'],
      [
        RequestStatus.CONTACT_RELEASED,
        RequestStatus.IN_PROGRESS,
        client,
        'client',
      ],
      [
        RequestStatus.CONTACT_RELEASED,
        RequestStatus.IN_PROGRESS,
        provider,
        'provider',
      ],
      [
        RequestStatus.CONTACT_RELEASED,
        RequestStatus.NOT_COMPLETED,
        client,
        'client',
      ],
      [
        RequestStatus.CONTACT_RELEASED,
        RequestStatus.NOT_COMPLETED,
        provider,
        'provider',
      ],
      [
        RequestStatus.CONTACT_RELEASED,
        RequestStatus.ABANDONED,
        system,
        'system',
      ],
      [RequestStatus.IN_PROGRESS, RequestStatus.FINISHED, provider, 'provider'],
      [
        RequestStatus.IN_PROGRESS,
        RequestStatus.INTERRUPTED,
        provider,
        'provider',
      ],
      [RequestStatus.FINISHED, RequestStatus.CLOSED, client, 'client'],
      [RequestStatus.FINISHED, RequestStatus.CLOSED, system, 'system'],
      [RequestStatus.FINISHED, RequestStatus.UNDER_REVIEW, client, 'client'],
      [RequestStatus.UNDER_REVIEW, RequestStatus.CLOSED, support, 'support'],
    ];

    it.each(allowed)('%s -> %s is allowed for %s', (from, to, ctx) => {
      expect(at(from).canChangeStatusBy(ctx, to)).toBe(true);
    });

    const denied: Array<
      [RequestStatus, RequestStatus, RequestAuthContext, string]
    > = [
      [RequestStatus.DRAFT, RequestStatus.PUBLISHED, provider, 'provider'],
      [
        RequestStatus.PUBLISHED,
        RequestStatus.CONTACT_RELEASED,
        provider,
        'provider',
      ],
      [RequestStatus.PUBLISHED, RequestStatus.EXPIRED, client, 'client'],
      [RequestStatus.SENT, RequestStatus.CONTACT_RELEASED, client, 'client'],
      [RequestStatus.SENT, RequestStatus.REJECTED, client, 'client'],
      [
        RequestStatus.CONTACT_RELEASED,
        RequestStatus.CANCELLED,
        client,
        'client',
      ],
      [
        RequestStatus.CONTACT_RELEASED,
        RequestStatus.IN_PROGRESS,
        stranger,
        'stranger',
      ],
      [RequestStatus.IN_PROGRESS, RequestStatus.FINISHED, client, 'client'],
      [RequestStatus.IN_PROGRESS, RequestStatus.ABANDONED, system, 'system'],
      [RequestStatus.FINISHED, RequestStatus.CLOSED, provider, 'provider'],
      [
        RequestStatus.FINISHED,
        RequestStatus.UNDER_REVIEW,
        provider,
        'provider',
      ],
      [RequestStatus.UNDER_REVIEW, RequestStatus.CLOSED, client, 'client'],
      [RequestStatus.UNDER_REVIEW, RequestStatus.CLOSED, system, 'system'],
      [RequestStatus.CLOSED, RequestStatus.CANCELLED, client, 'client'],
      [RequestStatus.CANCELLED, RequestStatus.PUBLISHED, client, 'client'],
    ];

    it.each(denied)('%s -> %s is denied for %s', (from, to, ctx) => {
      expect(at(from).canChangeStatusBy(ctx, to)).toBe(false);
    });

    it('should let admin make any transition', () => {
      expect(
        at(RequestStatus.CLOSED).canChangeStatusBy(admin, RequestStatus.DRAFT),
      ).toBe(true);
    });

    it('should deny strangers everything', () => {
      expect(
        at(RequestStatus.SENT).canChangeStatusBy(
          stranger,
          RequestStatus.CONTACT_RELEASED,
        ),
      ).toBe(false);
    });
  });

  describe('isTerminal', () => {
    it.each([
      RequestStatus.CLOSED,
      RequestStatus.EXPIRED,
      RequestStatus.NO_RESPONSE,
      RequestStatus.REJECTED,
      RequestStatus.CANCELLED,
      RequestStatus.NOT_COMPLETED,
      RequestStatus.INTERRUPTED,
      RequestStatus.ABANDONED,
    ])('%s is terminal', (status) => {
      expect(at(status).isTerminal()).toBe(true);
    });

    it.each([
      RequestStatus.DRAFT,
      RequestStatus.PUBLISHED,
      RequestStatus.SENT,
      RequestStatus.CONTACT_RELEASED,
      RequestStatus.IN_PROGRESS,
      RequestStatus.FINISHED,
      RequestStatus.UNDER_REVIEW,
    ])('%s is not terminal', (status) => {
      expect(at(status).isTerminal()).toBe(false);
    });
  });

  describe('canBeReviewed / canRateClientBy', () => {
    it('should only allow review once CLOSED', () => {
      expect(at(RequestStatus.CLOSED).canBeReviewed()).toBe(true);
      expect(at(RequestStatus.FINISHED).canBeReviewed()).toBe(false);
    });

    it('should only allow the assigned provider to rate the client after CLOSED', () => {
      expect(at(RequestStatus.CLOSED).canRateClientBy(provider)).toBe(true);
      expect(at(RequestStatus.FINISHED).canRateClientBy(provider)).toBe(false);
      expect(at(RequestStatus.CLOSED).canRateClientBy(client)).toBe(false);
    });
  });

  describe('bolsa rules', () => {
    it('should only allow interest / assignment while PUBLISHED and unassigned', () => {
      const published = createMockRequest({
        clientId: CLIENT_ID,
        providerId: null,
        isPublic: true,
        status: RequestStatus.PUBLISHED,
      });
      const activeProvider = { ...provider, hasActiveProviderProfile: true };
      expect(published.canExpressInterestBy(activeProvider)).toBe(true);
      expect(published.canAssignProviderBy(client)).toBe(true);

      const released = published.withChanges({
        status: RequestStatus.CONTACT_RELEASED,
      });
      expect(released.canExpressInterestBy(activeProvider)).toBe(false);
      expect(released.canAssignProviderBy(client)).toBe(false);
    });

    it('should allow unassigning only while CONTACT_RELEASED', () => {
      expect(
        at(RequestStatus.CONTACT_RELEASED).canUnassignProviderBy(client),
      ).toBe(true);
      expect(at(RequestStatus.IN_PROGRESS).canUnassignProviderBy(client)).toBe(
        false,
      );
    });
  });

  describe('withChanges', () => {
    it('should carry statusReason', () => {
      const changed = at(RequestStatus.CONTACT_RELEASED).withChanges({
        status: RequestStatus.NOT_COMPLETED,
        statusReason: 'no agreement',
      });
      expect(changed.statusReason).toBe('no agreement');
      expect(changed.isNotCompleted()).toBe(true);
    });
  });
});

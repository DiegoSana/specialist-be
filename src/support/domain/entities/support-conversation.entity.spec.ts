import { SupportConversationStatus } from '@prisma/client';
import { SupportConversationEntity } from './support-conversation.entity';

describe('SupportConversationEntity', () => {
  describe('createFromInboundMessage', () => {
    it('creates an OPEN conversation with lastInboundAt set and no resolution', () => {
      const now = new Date('2026-09-18T10:00:00.000Z');
      const conversation = SupportConversationEntity.createFromInboundMessage({
        id: 'conv-1',
        phoneNumber: '+5492944123456',
        userId: null,
        relatedRequestId: null,
        now,
      });

      expect(conversation.status).toBe(SupportConversationStatus.OPEN);
      expect(conversation.lastInboundAt).toEqual(now);
      expect(conversation.lastOutboundAt).toBeNull();
      expect(conversation.resolvedAt).toBeNull();
      expect(conversation.resolvedByUserId).toBeNull();
    });
  });

  describe('isWithinReplyWindow', () => {
    const lastInboundAt = new Date('2026-09-18T10:00:00.000Z');
    const build = () =>
      new SupportConversationEntity(
        'conv-1',
        '+5492944123456',
        null,
        null,
        SupportConversationStatus.OPEN,
        lastInboundAt,
        null,
        lastInboundAt,
        lastInboundAt,
        null,
        null,
      );

    it('is true just under 24h since the last inbound message', () => {
      const now = new Date(lastInboundAt.getTime() + 24 * 60 * 60 * 1000 - 1);
      expect(build().isWithinReplyWindow(now)).toBe(true);
    });

    it('is false at exactly 24h since the last inbound message', () => {
      const now = new Date(lastInboundAt.getTime() + 24 * 60 * 60 * 1000);
      expect(build().isWithinReplyWindow(now)).toBe(false);
    });

    it('is false past 24h since the last inbound message', () => {
      const now = new Date(lastInboundAt.getTime() + 25 * 60 * 60 * 1000);
      expect(build().isWithinReplyWindow(now)).toBe(false);
    });

    it('is false when there has never been an inbound message', () => {
      const conversation = new SupportConversationEntity(
        'conv-1',
        '+5492944123456',
        null,
        null,
        SupportConversationStatus.OPEN,
        null,
        null,
        lastInboundAt,
        lastInboundAt,
        null,
        null,
      );
      expect(conversation.isWithinReplyWindow(new Date())).toBe(false);
    });
  });

  describe('recordInboundMessage', () => {
    it('updates lastInboundAt and does not report reopened when already OPEN', () => {
      const createdAt = new Date('2026-09-01T00:00:00.000Z');
      const conversation = new SupportConversationEntity(
        'conv-1',
        '+5492944123456',
        'user-1',
        null,
        SupportConversationStatus.OPEN,
        createdAt,
        null,
        createdAt,
        createdAt,
        null,
        null,
      );
      const now = new Date('2026-09-18T10:00:00.000Z');

      const { conversation: updated, reopened } =
        conversation.recordInboundMessage(now);

      expect(reopened).toBe(false);
      expect(updated.status).toBe(SupportConversationStatus.OPEN);
      expect(updated.lastInboundAt).toEqual(now);
      expect(updated.userId).toBe('user-1');
    });

    it('reopens a RESOLVED conversation, clears resolution fields, and reports reopened', () => {
      const createdAt = new Date('2026-09-01T00:00:00.000Z');
      const resolvedAt = new Date('2026-09-10T00:00:00.000Z');
      const conversation = new SupportConversationEntity(
        'conv-1',
        '+5492944123456',
        null,
        null,
        SupportConversationStatus.RESOLVED,
        createdAt,
        null,
        createdAt,
        resolvedAt,
        resolvedAt,
        'admin-1',
      );
      const now = new Date('2026-09-18T10:00:00.000Z');

      const { conversation: updated, reopened } =
        conversation.recordInboundMessage(now);

      expect(reopened).toBe(true);
      expect(updated.status).toBe(SupportConversationStatus.OPEN);
      expect(updated.lastInboundAt).toEqual(now);
      expect(updated.resolvedAt).toBeNull();
      expect(updated.resolvedByUserId).toBeNull();
    });
  });

  describe('recordOutboundMessage', () => {
    it('updates lastOutboundAt without touching status', () => {
      const now = new Date('2026-09-18T10:00:00.000Z');
      const conversation = SupportConversationEntity.createFromInboundMessage({
        id: 'conv-1',
        phoneNumber: '+5492944123456',
        userId: null,
        relatedRequestId: null,
        now,
      });

      const sentAt = new Date('2026-09-18T10:05:00.000Z');
      const updated = conversation.recordOutboundMessage(sentAt);

      expect(updated.lastOutboundAt).toEqual(sentAt);
      expect(updated.status).toBe(SupportConversationStatus.OPEN);
    });
  });

  describe('resolve / reopen', () => {
    it('resolve() transitions OPEN -> RESOLVED and stamps resolver + time', () => {
      const conversation = SupportConversationEntity.createFromInboundMessage({
        id: 'conv-1',
        phoneNumber: '+5492944123456',
        userId: null,
        relatedRequestId: null,
      });

      const now = new Date('2026-09-18T10:00:00.000Z');
      const resolved = conversation.resolve('admin-1', now);

      expect(resolved.status).toBe(SupportConversationStatus.RESOLVED);
      expect(resolved.resolvedAt).toEqual(now);
      expect(resolved.resolvedByUserId).toBe('admin-1');
    });

    it('resolve() is idempotent on an already-resolved conversation', () => {
      const conversation = SupportConversationEntity.createFromInboundMessage({
        id: 'conv-1',
        phoneNumber: '+5492944123456',
        userId: null,
        relatedRequestId: null,
      }).resolve('admin-1', new Date('2026-09-18T10:00:00.000Z'));

      const secondResolve = conversation.resolve(
        'admin-2',
        new Date('2026-09-19T00:00:00.000Z'),
      );

      expect(secondResolve).toBe(conversation);
    });

    it('reopen() transitions RESOLVED -> OPEN and clears resolution fields', () => {
      const conversation = SupportConversationEntity.createFromInboundMessage({
        id: 'conv-1',
        phoneNumber: '+5492944123456',
        userId: null,
        relatedRequestId: null,
      }).resolve('admin-1', new Date('2026-09-18T10:00:00.000Z'));

      const reopened = conversation.reopen(
        new Date('2026-09-19T00:00:00.000Z'),
      );

      expect(reopened.status).toBe(SupportConversationStatus.OPEN);
      expect(reopened.resolvedAt).toBeNull();
      expect(reopened.resolvedByUserId).toBeNull();
    });

    it('reopen() is idempotent on an already-open conversation', () => {
      const conversation = SupportConversationEntity.createFromInboundMessage({
        id: 'conv-1',
        phoneNumber: '+5492944123456',
        userId: null,
        relatedRequestId: null,
      });

      const secondReopen = conversation.reopen(
        new Date('2026-09-19T00:00:00.000Z'),
      );

      expect(secondReopen).toBe(conversation);
    });
  });
});

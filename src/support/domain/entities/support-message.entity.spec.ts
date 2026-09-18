import { SupportMessageDirection } from '@prisma/client';
import { SupportMessageEntity } from './support-message.entity';

describe('SupportMessageEntity', () => {
  describe('createInbound', () => {
    it('builds an INBOUND message with no sentByUserId', () => {
      const message = SupportMessageEntity.createInbound({
        id: 'msg-1',
        conversationId: 'conv-1',
        body: 'Hola, necesito ayuda',
        twilioMessageSid: 'SM123',
      });

      expect(message.direction).toBe(SupportMessageDirection.INBOUND);
      expect(message.sentByUserId).toBeNull();
      expect(message.twilioMessageSid).toBe('SM123');
      expect(message.isInbound()).toBe(true);
    });
  });

  describe('createOutbound', () => {
    it('builds an OUTBOUND message with the admin sender and no twilioMessageSid by default', () => {
      const message = SupportMessageEntity.createOutbound({
        id: 'msg-2',
        conversationId: 'conv-1',
        body: 'Hola! En qué te puedo ayudar?',
        sentByUserId: 'admin-1',
      });

      expect(message.direction).toBe(SupportMessageDirection.OUTBOUND);
      expect(message.sentByUserId).toBe('admin-1');
      expect(message.twilioMessageSid).toBeNull();
      expect(message.isInbound()).toBe(false);
    });
  });
});

import { LocalWhatsAppAdapter } from './local-whatsapp.adapter';

describe('LocalWhatsAppAdapter', () => {
  let adapter: LocalWhatsAppAdapter;

  beforeEach(() => {
    adapter = new LocalWhatsAppAdapter();
  });

  describe('sendMessage', () => {
    it('should return a local- prefixed message id without any network call', async () => {
      const result = await adapter.sendMessage('+5492944123456', 'Hola!');

      expect(result.messageId).toMatch(/^local-[0-9a-f-]{36}$/);
    });

    it('should generate a different id on every call', async () => {
      const first = await adapter.sendMessage('+5492944123456', 'Hola!');
      const second = await adapter.sendMessage('+5492944123456', 'Hola!');

      expect(first.messageId).not.toEqual(second.messageId);
    });
  });

  describe('getMessageStatus', () => {
    it('should always resolve to delivered', async () => {
      const result = await adapter.getMessageStatus('local-any-id');

      expect(result).toEqual({ status: 'delivered' });
    });
  });
});

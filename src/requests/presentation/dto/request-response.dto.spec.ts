import { RequestStatus } from '@prisma/client';
import { createMockRequest } from '../../../__mocks__/test-utils';
import { RequestResponseDto } from './request-response.dto';
import { PrismaRequestMapper } from '../../infrastructure/mappers/request.prisma-mapper';

describe('RequestResponseDto', () => {
  it('returns statusReason in the full view', () => {
    const entity = createMockRequest({
      status: RequestStatus.NOT_COMPLETED,
      statusReason: 'No hubo acuerdo',
    });
    expect(RequestResponseDto.fromEntity(entity).statusReason).toBe(
      'No hubo acuerdo',
    );
  });

  it('omits statusReason in the limited view for interested providers', () => {
    const entity = createMockRequest({ statusReason: 'secret' });
    expect(
      RequestResponseDto.fromEntityLimited(entity).statusReason,
    ).toBeNull();
  });

  it('exposes interestsCount only when the query provided it', () => {
    const entity = createMockRequest();
    expect(
      RequestResponseDto.fromEntity(entity).interestsCount,
    ).toBeUndefined();
    (entity as any).interestsCount = 3;
    expect(RequestResponseDto.fromEntity(entity).interestsCount).toBe(3);
  });

  it('mapper attaches interestsCount from the Prisma _count', () => {
    const now = new Date();
    const entity = PrismaRequestMapper.toDomain({
      id: 'r1',
      clientId: 'c1',
      providerId: null,
      tradeId: null,
      isPublic: true,
      title: 't',
      description: 'd',
      address: null,
      availability: null,
      photos: [],
      status: RequestStatus.PUBLISHED,
      quoteAmount: null,
      quoteNotes: null,
      clientRating: null,
      clientRatingComment: null,
      statusReason: null,
      createdAt: now,
      updatedAt: now,
      _count: { interests: 2 },
    });
    expect((entity as any).interestsCount).toBe(2);
  });

  describe('counterpart contact visibility', () => {
    const withContact = (status: RequestStatus) => {
      const entity = createMockRequest({
        clientId: 'client-1',
        providerId: 'provider-1',
        status,
      });
      (entity as any).client = {
        id: 'client-1',
        firstName: 'C',
        lastName: 'L',
        phone: '+5491111',
      };
      (entity as any).professional = {
        id: 'p1',
        userId: 'pu1',
        user: { id: 'pu1', firstName: 'P', lastName: 'R', phone: '+5492222' },
      };
      return entity;
    };
    const providerCtx = { userId: 'pu1', serviceProviderId: 'provider-1' };
    const clientCtx = { userId: 'client-1' };

    it('gives the assigned provider the client phone once contact is released', () => {
      const dto = RequestResponseDto.fromEntity(
        withContact(RequestStatus.CONTACT_RELEASED),
        providerCtx,
      );
      expect(dto.client.phone).toBe('+5491111');
    });

    it('gives the client the provider phone once contact is released', () => {
      const dto = RequestResponseDto.fromEntity(
        withContact(RequestStatus.IN_PROGRESS),
        clientCtx,
      );
      expect(dto.professional.whatsapp).toBe('+5492222');
      expect(dto.professional.user.phone).toBe('+5492222');
    });

    it.each([
      RequestStatus.SENT,
      RequestStatus.PUBLISHED,
      RequestStatus.REJECTED,
    ])('hides all contact data in %s', (status) => {
      const forProvider = RequestResponseDto.fromEntity(
        withContact(status),
        providerCtx,
      );
      const forClient = RequestResponseDto.fromEntity(
        withContact(status),
        clientCtx,
      );
      expect(forProvider.client.phone).toBeUndefined();
      expect(forClient.professional.whatsapp).toBeNull();
      expect(forClient.professional.user.phone).toBeUndefined();
    });

    it('hides contact when no viewer context is given', () => {
      const dto = RequestResponseDto.fromEntity(
        withContact(RequestStatus.CLOSED),
      );
      expect(dto.client.phone).toBeUndefined();
      expect(dto.professional.whatsapp).toBeNull();
    });
  });
});

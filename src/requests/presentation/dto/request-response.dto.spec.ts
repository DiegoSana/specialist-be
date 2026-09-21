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
});

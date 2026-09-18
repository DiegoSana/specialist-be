import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus, ProviderType } from '@prisma/client';
import { RequestEntity } from '../../../requests/domain/entities/request.entity';
import { RequestInterestEntity } from '../../../requests/domain/entities/request-interest.entity';
import { InterestedProfessionalResponseDto } from '../../../requests/presentation/dto/interested-professional-response.dto';

class AdminRequestClientDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  profilePictureUrl: string | null;
}

class AdminRequestTradeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

class AdminRequestProviderTradeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

class AdminRequestProviderDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ProviderType })
  type: ProviderType;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({
    description: 'Owning user id, for linking to /admin/users/:id',
  })
  userId?: string;

  @ApiPropertyOptional({ type: [AdminRequestProviderTradeDto] })
  trades?: AdminRequestProviderTradeDto[];
}

/**
 * Full admin-facing view of a single request: base request fields, resolved
 * client/trade, a unified provider (Professional or Company) view and the
 * list of providers who expressed interest. Unlike the participant-facing
 * `GET /requests/:id`, this endpoint applies no `canBeViewedBy` ownership
 * check - any admin may view any request.
 */
export class AdminRequestDetailResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: RequestStatus })
  status: RequestStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  address: string | null;

  @ApiProperty({ type: [String] })
  photos: string[];

  @ApiPropertyOptional({ type: AdminRequestTradeDto })
  trade: AdminRequestTradeDto | null;

  @ApiPropertyOptional({ type: AdminRequestClientDto })
  client: AdminRequestClientDto | null;

  @ApiPropertyOptional({ type: AdminRequestProviderDto })
  provider: AdminRequestProviderDto | null;

  @ApiProperty({ type: [InterestedProfessionalResponseDto] })
  interestedProviders: InterestedProfessionalResponseDto[];

  static fromEntity(
    entity: RequestEntity,
    interestedProviders: RequestInterestEntity[],
  ): AdminRequestDetailResponseDto {
    const dto = new AdminRequestDetailResponseDto();
    const entityAny = entity as any;

    dto.id = entity.id;
    dto.title = entity.title;
    dto.description = entity.description;
    dto.status = entity.status;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    dto.address = entity.address;
    dto.photos = entity.photos;

    dto.trade = entityAny.trade
      ? { id: entityAny.trade.id, name: entityAny.trade.name }
      : null;

    dto.client = entityAny.client
      ? {
          id: entityAny.client.id,
          firstName: entityAny.client.firstName,
          lastName: entityAny.client.lastName,
          email: entityAny.client.email,
          profilePictureUrl: entityAny.client.profilePictureUrl ?? null,
        }
      : null;

    dto.provider = AdminRequestDetailResponseDto.resolveProvider(entityAny);

    dto.interestedProviders =
      InterestedProfessionalResponseDto.fromEntities(interestedProviders);

    return dto;
  }

  private static resolveProvider(
    entityAny: any,
  ): AdminRequestProviderDto | null {
    if (!entityAny.provider) return null;

    if (entityAny.professional) {
      const user = entityAny.professional.user;
      return {
        id: entityAny.provider.id,
        type: entityAny.provider.type,
        name: user ? `${user.firstName} ${user.lastName}`.trim() : '',
        userId: entityAny.professional.userId,
        trades: (entityAny.professional.trades || []).map((t: any) => ({
          id: t.id,
          name: t.name,
        })),
      };
    }

    if (entityAny.company) {
      return {
        id: entityAny.provider.id,
        type: entityAny.provider.type,
        name: entityAny.company.companyName,
        userId: entityAny.company.userId,
        trades: (entityAny.company.trades || []).map((t: any) => ({
          id: t.id,
          name: t.name,
        })),
      };
    }

    return null;
  }
}

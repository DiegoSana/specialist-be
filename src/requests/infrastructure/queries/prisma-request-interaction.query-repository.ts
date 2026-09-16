import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  ConversationSummary,
  RequestInteractionQueryRepository,
} from '../../domain/queries/request-interaction.query-repository';

const PREVIEW_MAX_LENGTH = 140;

@Injectable()
export class PrismaRequestInteractionQueryRepository
  implements RequestInteractionQueryRepository
{
  constructor(private readonly prisma: PrismaService) {}

  private readonly requestInclude = {
    client: {
      select: { firstName: true, lastName: true },
    },
    provider: {
      select: {
        professional: {
          select: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        company: {
          select: { companyName: true },
        },
      },
    },
  } as const;

  async findConversations(params: {
    skip: number;
    take: number;
    search?: string;
  }): Promise<{ items: ConversationSummary[]; total: number }> {
    const search = params.search?.trim().toLowerCase();

    if (!search) {
      const [groups, allGroups] = await Promise.all([
        this.prisma.requestInteraction.groupBy({
          by: ['requestId'],
          _max: { createdAt: true },
          orderBy: { _max: { createdAt: 'desc' } },
          skip: params.skip,
          take: params.take,
        }),
        this.prisma.requestInteraction.groupBy({ by: ['requestId'] }),
      ]);

      const items = await this.hydrate(groups.map((g) => g.requestId));
      return { items, total: allGroups.length };
    }

    // Prisma's groupBy cannot filter on joined Request/client/provider fields
    // in the same query that also needs the createdAt aggregation and ordering,
    // so when a search term is given we fetch every conversation group
    // unfiltered, hydrate it, filter in memory, then paginate the filtered
    // list. Documented tradeoff: acceptable for an admin tool at the current
    // data volume; a denormalized read model or raw SQL would be needed if
    // this list grows large.
    const allGroups = await this.prisma.requestInteraction.groupBy({
      by: ['requestId'],
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
    });

    const allItems = await this.hydrate(allGroups.map((g) => g.requestId));
    const filtered = allItems.filter(
      (item) =>
        item.requestTitle.toLowerCase().includes(search) ||
        item.clientName.toLowerCase().includes(search) ||
        (item.providerName?.toLowerCase().includes(search) ?? false),
    );

    return {
      items: filtered.slice(params.skip, params.skip + params.take),
      total: filtered.length,
    };
  }

  private async hydrate(requestIds: string[]): Promise<ConversationSummary[]> {
    if (requestIds.length === 0) return [];

    const [requests, lastInteractions] = await Promise.all([
      this.prisma.request.findMany({
        where: { id: { in: requestIds } },
        include: this.requestInclude,
      }),
      Promise.all(
        requestIds.map((requestId) =>
          this.prisma.requestInteraction.findFirst({
            where: { requestId },
            orderBy: { createdAt: 'desc' },
          }),
        ),
      ),
    ]);

    const requestById = new Map(requests.map((r) => [r.id, r]));
    const lastInteractionByRequestId = new Map(
      lastInteractions
        .filter((i): i is NonNullable<typeof i> => !!i)
        .map((i) => [i.requestId, i]),
    );

    const items: ConversationSummary[] = [];
    for (const requestId of requestIds) {
      const request = requestById.get(requestId);
      const lastInteraction = lastInteractionByRequestId.get(requestId);
      if (!request || !lastInteraction) continue;

      items.push({
        requestId: request.id,
        requestTitle: request.title || '',
        requestStatus: request.status,
        clientName:
          `${request.client.firstName} ${request.client.lastName}`.trim(),
        providerName: this.resolveProviderName(request.provider),
        lastMessagePreview: (
          lastInteraction.responseContent ??
          lastInteraction.messageContent ??
          ''
        ).slice(0, PREVIEW_MAX_LENGTH),
        lastMessageAt: lastInteraction.createdAt,
        lastMessageDirection: lastInteraction.direction,
        lastMessageStatus: lastInteraction.status,
      });
    }

    return items;
  }

  private resolveProviderName(provider: any): string | null {
    if (!provider) return null;
    if (provider.professional?.user) {
      const user = provider.professional.user;
      return `${user.firstName} ${user.lastName}`.trim();
    }
    if (provider.company) {
      return provider.company.companyName;
    }
    return null;
  }
}

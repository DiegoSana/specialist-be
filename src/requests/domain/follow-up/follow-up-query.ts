import { RequestStatus } from '@prisma/client';

/**
 * Describes how to fetch candidate requests for a follow-up rule.
 * Maps 1:1 to repository methods and their parameters.
 */
export type FollowUpQuery =
  | { type: 'BY_STATUS'; status: RequestStatus; days: number }
  | { type: 'PENDING_WITH_INTERESTS'; days: number };

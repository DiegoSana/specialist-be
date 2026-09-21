import {
  InteractionDirection,
  InteractionStatus,
  InteractionType,
  RequestStatus,
} from '@prisma/client';
import { FollowUpSchedulerJob } from './follow-up-scheduler.job';
import { LadderFollowUpRule } from '../follow-up/rules/ladder-follow-up-rule';
import { createMockRequest } from '../../../__mocks__/test-utils';

const rule = (step: number, days: number, extra: any = {}) =>
  new LadderFollowUpRule({
    name: `Q_${days}D`,
    ladder: 'Q',
    query: { type: 'BY_STATUS', status: RequestStatus.CONTACT_RELEASED, days },
    direction: InteractionDirection.TO_CLIENT,
    template: 'question_agreement',
    step,
    ...extra,
  });

const interaction = (over: any = {}) => ({
  interactionType: InteractionType.FOLLOW_UP,
  direction: InteractionDirection.TO_CLIENT,
  status: InteractionStatus.SENT,
  createdAt: new Date('2026-09-10T12:00:00Z'),
  metadata: { ladder: 'Q', requestStatus: RequestStatus.CONTACT_RELEASED },
  ...over,
});

describe('FollowUpSchedulerJob — ladder rules', () => {
  let interactions: any[];
  let interactionRepository: any;
  let interactionService: any;
  let attention: any;
  let config: Record<string, string>;
  let queryExecutor: any;

  const build = (rules: any[]) =>
    new FollowUpSchedulerJob(
      rules,
      queryExecutor,
      interactionRepository,
      { findById: jest.fn() } as any,
      interactionService,
      { get: (k: string, d?: any) => config[k] ?? d } as any,
      {
        findById: jest
          .fn()
          .mockResolvedValue({ phone: '+549', phoneVerified: true }),
      } as any,
      { findByServiceProviderId: jest.fn() } as any,
      { findByServiceProviderId: jest.fn() } as any,
      attention,
      { hasOpenConversation: jest.fn().mockResolvedValue(false) } as any,
    );

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-15T15:00:00Z')); // 12:00 Buenos Aires
    interactions = [];
    config = { WHATSAPP_FOLLOWUP_ENABLED: 'true' };
    interactionRepository = {
      findByRequestId: jest.fn(async () => interactions),
      hasRespondedInteraction: jest.fn().mockResolvedValue(false),
    };
    interactionService = { createFollowUp: jest.fn() };
    attention = { flag: jest.fn() };
    const request = createMockRequest({
      id: 'r1',
      status: RequestStatus.CONTACT_RELEASED,
    });
    queryExecutor = { getRequests: jest.fn().mockResolvedValue([request]) };
  });

  afterEach(() => jest.useRealTimers());

  it('sends step 0 when no message of the ladder was sent for this state', async () => {
    await build([rule(0, 2)]).scheduleFollowUps();
    expect(interactionService.createFollowUp).toHaveBeenCalledTimes(1);
    expect(interactionService.createFollowUp.mock.calls[0][0]).toMatchObject({
      messageTemplate: 'question_agreement',
      metadata: { ladder: 'Q', step: 0 },
    });
  });

  it('does not send step 1 until step 0 was sent, and step 0 is not repeated', async () => {
    await build([rule(1, 4)]).scheduleFollowUps();
    expect(interactionService.createFollowUp).not.toHaveBeenCalled();

    interactions = [interaction()];
    await build([rule(0, 2)]).scheduleFollowUps();
    expect(interactionService.createFollowUp).not.toHaveBeenCalled();
  });

  it('sends step 1 once exactly one ladder message exists and a day has passed', async () => {
    interactions = [interaction()];
    await build([rule(1, 4)]).scheduleFollowUps();
    expect(interactionService.createFollowUp).toHaveBeenCalledTimes(1);
  });

  it('never exceeds the ladder (3 messages already sent -> nothing more)', async () => {
    interactions = [interaction(), interaction(), interaction()];
    await build([rule(0, 2), rule(1, 4), rule(2, 6)]).scheduleFollowUps();
    expect(interactionService.createFollowUp).not.toHaveBeenCalled();
  });

  it('ignores messages sent in a previous state and FAILED ones when counting', async () => {
    interactions = [
      interaction({
        metadata: { ladder: 'Q', requestStatus: RequestStatus.SENT },
      }),
      interaction({ status: InteractionStatus.FAILED }),
    ];
    await build([rule(0, 2)]).scheduleFollowUps();
    expect(interactionService.createFollowUp).toHaveBeenCalledTimes(1);
  });

  it('waits when a message to the same recipient is still pending, but not for the other party', async () => {
    interactions = [
      interaction({ status: InteractionStatus.PENDING, metadata: {} }),
    ];
    await build([rule(0, 2)]).scheduleFollowUps();
    expect(interactionService.createFollowUp).not.toHaveBeenCalled();

    interactions = [
      interaction({
        status: InteractionStatus.PENDING,
        direction: InteractionDirection.TO_PROVIDER,
        metadata: {},
      }),
    ];
    await build([rule(0, 2)]).scheduleFollowUps();
    expect(interactionService.createFollowUp).toHaveBeenCalledTimes(1);
  });

  it('keeps >= 1 day between messages to the same recipient in the same state', async () => {
    interactions = [
      interaction({ createdAt: new Date('2026-09-15T10:00:00Z') }),
    ];
    await build([rule(1, 4)]).scheduleFollowUps();
    expect(interactionService.createFollowUp).not.toHaveBeenCalled();
  });

  it('does not send outside the daytime window (default 9-20h Buenos Aires)', async () => {
    jest.setSystemTime(new Date('2026-09-15T23:30:00Z')); // 20:30 Buenos Aires
    await build([rule(0, 2)]).scheduleFollowUps();
    expect(queryExecutor.getRequests).not.toHaveBeenCalled();

    jest.setSystemTime(new Date('2026-09-15T11:30:00Z')); // 08:30
    await build([rule(0, 2)]).scheduleFollowUps();
    expect(queryExecutor.getRequests).not.toHaveBeenCalled();
  });

  it('honours a custom window', async () => {
    config.WHATSAPP_FOLLOWUP_WINDOW_START_HOUR = '8';
    jest.setSystemTime(new Date('2026-09-15T11:30:00Z')); // 08:30
    await build([rule(0, 2)]).scheduleFollowUps();
    expect(interactionService.createFollowUp).toHaveBeenCalledTimes(1);
  });

  it('respects appliesTo', async () => {
    await build([rule(0, 2, { appliesTo: () => false })]).scheduleFollowUps();
    expect(interactionService.createFollowUp).not.toHaveBeenCalled();
  });

  it('flags AT_RISK on the last rung of a question ladder when nobody ever replied', async () => {
    interactions = [interaction(), interaction()];
    await build([
      rule(2, 6, { escalatesWhenUnanswered: true }),
    ]).scheduleFollowUps();
    expect(attention.flag).toHaveBeenCalledWith(
      'r1',
      'AT_RISK',
      expect.any(String),
    );
  });

  it('does not flag AT_RISK on notices', async () => {
    await build([rule(0, 0)]).scheduleFollowUps();
    expect(attention.flag).not.toHaveBeenCalled();
  });
});

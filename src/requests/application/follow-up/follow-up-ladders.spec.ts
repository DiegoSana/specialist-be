import { readFileSync } from 'fs';
import { join } from 'path';
import { InteractionDirection, RequestStatus } from '@prisma/client';
import { createMockRequest } from '../../../__mocks__/test-utils';
import { FOLLOW_UP_LADDERS, buildFollowUpRules } from './follow-up-ladders';

const templates = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '../../../shared/infrastructure/messaging/message-templates.json',
    ),
    'utf-8',
  ),
) as Record<string, { es: string; en: string }>;

const interestRepository = { findByRequestId: jest.fn() } as any;

describe('follow-up ladders (spec: Follow-up por WhatsApp)', () => {
  const rules = buildFollowUpRules(interestRepository);
  const byLadder = (ladder: string) =>
    rules.filter((r) => r.getLadder!() === ladder);

  it('only references templates that exist in message-templates.json (es + en)', () => {
    for (const rule of rules) {
      expect(templates[rule.getTemplate()]).toBeDefined();
      expect(templates[rule.getTemplate()].es).toBeTruthy();
      expect(templates[rule.getTemplate()].en).toBeTruthy();
    }
  });

  it('defines the 10 spec templates (A1-A7, P1-P3)', () => {
    const codes = [
      'notice_request_sent',
      'notice_interests_published',
      'notice_contact_released',
      'notice_request_rejected',
      'notice_no_agreement',
      'notice_request_closed',
      'notice_auto_closed',
      'question_agreement',
      'question_progress',
      'question_satisfaction',
    ];
    codes.forEach((c) => expect(templates[c]).toBeDefined());
    expect(
      Object.keys(templates).filter((k) => /^(notice|question)_/.test(k)),
    ).toHaveLength(10);
  });

  it('sends at most 3 messages per ladder and has unique rule names', () => {
    FOLLOW_UP_LADDERS.forEach((l) =>
      expect(l.days.length).toBeLessThanOrEqual(3),
    );
    const names = rules.map((r) => r.getName());
    expect(new Set(names).size).toBe(names.length);
  });

  it.each([
    [
      'SENT_NOTICE',
      RequestStatus.SENT,
      [0, 2, 4],
      InteractionDirection.TO_PROVIDER,
    ],
    [
      'CONTACT_RELEASED_QUESTION_CLIENT',
      RequestStatus.CONTACT_RELEASED,
      [2, 4, 6],
      InteractionDirection.TO_CLIENT,
    ],
    [
      'CONTACT_RELEASED_QUESTION_PROVIDER',
      RequestStatus.CONTACT_RELEASED,
      [2, 4, 6],
      InteractionDirection.TO_PROVIDER,
    ],
    [
      'IN_PROGRESS_QUESTION',
      RequestStatus.IN_PROGRESS,
      [7, 14, 21],
      InteractionDirection.TO_PROVIDER,
    ],
    [
      'FINISHED_QUESTION',
      RequestStatus.FINISHED,
      [0, 2, 4],
      InteractionDirection.TO_CLIENT,
    ],
    [
      'CLOSED_NOTICE_PROVIDER',
      RequestStatus.CLOSED,
      [0, 3],
      InteractionDirection.TO_PROVIDER,
    ],
  ])('%s follows the spec schedule', (ladder, status, days, direction) => {
    const ladderRules = byLadder(ladder);
    expect(ladderRules.map((r) => (r.getQuery() as any).days)).toEqual(days);
    ladderRules.forEach((r) => {
      expect(r.getQuery()).toMatchObject({ type: 'BY_STATUS', status });
      expect(r.getDirection()).toBe(direction);
    });
  });

  it('PUBLISHED notice uses the with-interests query at 0/2/4 days', () => {
    const l = byLadder('PUBLISHED_INTERESTS_NOTICE');
    expect(l.map((r) => r.getQuery())).toEqual([
      { type: 'PENDING_WITH_INTERESTS', days: 0 },
      { type: 'PENDING_WITH_INTERESTS', days: 2 },
      { type: 'PENDING_WITH_INTERESTS', days: 4 },
    ]);
  });

  it.each([
    [RequestStatus.EXPIRED, 'notice_no_agreement'],
    [RequestStatus.NO_RESPONSE, 'notice_no_agreement'],
    [RequestStatus.NOT_COMPLETED, 'notice_no_agreement'],
    [RequestStatus.ABANDONED, 'notice_no_agreement'],
    [RequestStatus.REJECTED, 'notice_request_rejected'],
  ])(
    '%s sends one notice to the client on entering (%s)',
    (status, template) => {
      const r = rules.filter(
        (x) =>
          (x.getQuery() as any).status === status &&
          x.getTemplate() === template,
      );
      expect(r).toHaveLength(1);
      expect(r[0].getDirection()).toBe(InteractionDirection.TO_CLIENT);
      expect((r[0].getQuery() as any).days).toBe(0);
    },
  );

  it('only the last rung of each question ladder escalates when unanswered', () => {
    const escalating = rules.filter((r) => r.escalatesWhenUnanswered!());
    expect(escalating.map((r) => r.getName()).sort()).toEqual([
      'CONTACT_RELEASED_QUESTION_CLIENT_6D',
      'CONTACT_RELEASED_QUESTION_PROVIDER_6D',
      'FINISHED_QUESTION_4D',
      'IN_PROGRESS_QUESTION_21D',
    ]);
  });

  it('sends the auto-closed notice (A7) instead of the regular one (A6) to the client', () => {
    const auto = createMockRequest({
      status: RequestStatus.CLOSED,
      statusReason: 'AUTO_CLOSED',
    });
    const confirmed = createMockRequest({ status: RequestStatus.CLOSED });
    const a6 = byLadder('CLOSED_NOTICE_CLIENT')[0];
    const a7 = byLadder('AUTO_CLOSED_NOTICE')[0];
    expect(a7.appliesTo!(auto)).toBe(true);
    expect(a6.appliesTo!(auto)).toBe(false);
    expect(a7.appliesTo!(confirmed)).toBe(false);
    expect(a6.appliesTo!(confirmed)).toBe(true);
  });

  it('sends no automatic WhatsApp while UNDER_REVIEW (support handles it)', () => {
    const statuses = rules.map((r) => {
      const q = r.getQuery();
      return q.type === 'BY_STATUS' ? q.status : null;
    });
    expect(statuses).not.toContain(RequestStatus.UNDER_REVIEW);
    const underReview = createMockRequest({
      status: RequestStatus.UNDER_REVIEW,
    });
    for (const rule of rules) {
      const q = rule.getQuery();
      if (q.type === 'BY_STATUS') expect(q.status).not.toBe(underReview.status);
    }
  });

  it('sends the regular closed notice (A6), not A7, when support closes a request', () => {
    const supportClosed = createMockRequest({
      status: RequestStatus.CLOSED,
      statusReason: 'Resuelto por soporte',
    });
    expect(byLadder('CLOSED_NOTICE_CLIENT')[0].appliesTo!(supportClosed)).toBe(
      true,
    );
    expect(byLadder('AUTO_CLOSED_NOTICE')[0].appliesTo!(supportClosed)).toBe(
      false,
    );
  });

  describe('payload', () => {
    const request = () => {
      const r: any = createMockRequest({
        id: 'req-1',
        title: 'Pintar living',
        status: RequestStatus.CONTACT_RELEASED,
      });
      r.client = { firstName: 'Ana', lastName: 'Perez' };
      r.professional = { user: { firstName: 'Luis', lastName: 'Gomez' } };
      return r;
    };

    it('resolves names, counterpart and deep link per recipient', async () => {
      const client = byLadder('CONTACT_RELEASED_NOTICE_CLIENT')[0];
      const provider = byLadder('CONTACT_RELEASED_NOTICE_PROVIDER')[0];
      const c = (await client.buildPayload(request())).templateVariables!;
      const p = (await provider.buildPayload(request())).templateVariables!;
      expect(c).toMatchObject({ nombre: 'Ana', contraparte: 'Luis Gomez' });
      expect(c.link).toMatch(/\/es\/client\/requests\/req-1$/);
      expect(p).toMatchObject({ nombre: 'Luis', contraparte: 'Ana Perez' });
      expect(p.link).toMatch(/\/es\/specialist\/requests\/req-1$/);
    });

    it('reminders (step > 0) add the "Te escribimos de nuevo" prefix, the first message does not', async () => {
      const [first, second] = byLadder('CONTACT_RELEASED_QUESTION_CLIENT');
      expect(
        (await first.buildPayload(request())).templateVariables!.reminder,
      ).toBe('');
      expect(
        (await second.buildPayload(request())).templateVariables!.reminder,
      ).toBe('Te escribimos de nuevo por "Pintar living". ');
    });

    it('records ladder, step and status in metadata (used to count messages per state)', async () => {
      const [, second] = byLadder('CONTACT_RELEASED_QUESTION_CLIENT');
      const { metadata } = await second.buildPayload(request());
      expect(metadata).toMatchObject({
        ladder: 'CONTACT_RELEASED_QUESTION_CLIENT',
        step: 1,
        requestStatus: RequestStatus.CONTACT_RELEASED,
      });
    });

    it('with-interests rule exposes the count and ordered provider ids', async () => {
      interestRepository.findByRequestId.mockResolvedValue([
        { serviceProviderId: 'b', createdAt: new Date(2) },
        { serviceProviderId: 'a', createdAt: new Date(1) },
      ]);
      const [first] = byLadder('PUBLISHED_INTERESTS_NOTICE');
      const payload = await first.buildPayload(
        createMockRequest({ status: RequestStatus.PUBLISHED }),
      );
      expect(payload.templateVariables!.cantidad).toBe('2');
      expect(payload.metadata.interestedProviderIds).toEqual(['a', 'b']);
    });

    it('the rendered spec templates leave no unresolved placeholders', async () => {
      const rendered = (tpl: string, vars: Record<string, string>) =>
        Object.entries(vars).reduce(
          (m, [k, v]) => m.replace(new RegExp(`\\{${k}\\}`, 'g'), v),
          templates[tpl].es,
        );
      for (const rule of rules.filter(
        (r) => r.getQuery().type === 'BY_STATUS',
      )) {
        const req = request();
        req.statusReason = 'AUTO_CLOSED';
        const { templateVariables } = await rule.buildPayload(req);
        expect(rendered(rule.getTemplate(), templateVariables!)).not.toMatch(
          /\{\w+\}/,
        );
      }
    });
  });
});

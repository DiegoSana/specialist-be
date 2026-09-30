import { InteractionDirection } from '@prisma/client';
import { createMockRequest } from '../../../__mocks__/test-utils';
import { buildFollowUpVariables } from './follow-up-variables';

describe('buildFollowUpVariables', () => {
  const attachClient = (request: any, phone: string | null) => {
    request.client = { firstName: 'Clara', lastName: 'Cliente', phone };
    return request;
  };

  const attachProfessional = (request: any, phone: string | null) => {
    request.professional = {
      user: { firstName: 'Pedro', lastName: 'Proveedor', phone },
    };
    return request;
  };

  const attachCompany = (request: any, phone: string | null) => {
    request.company = {
      companyName: 'Acme SRL',
      user: { firstName: 'Ana', lastName: 'Admin', phone },
    };
    return request;
  };

  it('builds a wa.me link from the provider phone when notifying the client (TO_CLIENT)', () => {
    const request = attachClient(
      attachProfessional(createMockRequest(), '+5492944123456'),
      '+5492944000000',
    );

    const variables = buildFollowUpVariables(
      request,
      InteractionDirection.TO_CLIENT,
      false,
    );

    expect(variables.whatsapp_link).toBe('https://wa.me/5492944123456');
  });

  it('builds a wa.me link from the client phone when notifying the provider (TO_PROVIDER)', () => {
    const request = attachClient(
      attachProfessional(createMockRequest(), '+5492944123456'),
      '+5492944000000',
    );

    const variables = buildFollowUpVariables(
      request,
      InteractionDirection.TO_PROVIDER,
      false,
    );

    expect(variables.whatsapp_link).toBe('https://wa.me/5492944000000');
  });

  it('uses the company user phone when the provider is a Company', () => {
    const request = attachClient(
      attachCompany(createMockRequest(), '+5492944999999'),
      '+5492944000000',
    );

    const variables = buildFollowUpVariables(
      request,
      InteractionDirection.TO_CLIENT,
      false,
    );

    expect(variables.whatsapp_link).toBe('https://wa.me/5492944999999');
  });

  it('falls back to the in-app link when the counterpart phone is missing', () => {
    const request = attachClient(
      attachProfessional(createMockRequest(), null),
      '+5492944000000',
    );

    const variables = buildFollowUpVariables(
      request,
      InteractionDirection.TO_CLIENT,
      false,
    );

    expect(variables.whatsapp_link).toBe(variables.link);
    expect(variables.whatsapp_link).not.toMatch(/^https:\/\/wa\.me\//);
  });

  it('still returns the generic {link} deep link unchanged', () => {
    const request = attachClient(
      attachProfessional(
        createMockRequest({ id: 'request-abc' }),
        '+5492944123456',
      ),
      '+5492944000000',
    );

    const variables = buildFollowUpVariables(
      request,
      InteractionDirection.TO_CLIENT,
      false,
    );

    expect(variables.link).toContain('/es/client/requests/request-abc');
  });
});

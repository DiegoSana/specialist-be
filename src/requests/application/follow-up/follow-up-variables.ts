import { InteractionDirection } from '@prisma/client';
import { RequestEntity } from '../../domain/entities/request.entity';

interface NamedUser {
  firstName?: string | null;
  lastName?: string | null;
}

function fullName(user?: NamedUser | null): string | null {
  if (!user?.firstName) return null;
  return [user.firstName, user.lastName].filter(Boolean).join(' ');
}

/** Provider display name from the relations PrismaRequestMapper attaches to the entity. */
export function providerDisplayName(request: RequestEntity): string {
  const e = request as any;
  return (
    e.company?.companyName ||
    fullName(e.professional?.user) ||
    'el especialista'
  );
}

export function clientDisplayName(request: RequestEntity): string {
  return fullName((request as any).client) || 'el cliente';
}

function firstNameOrDisplay(display: string, user?: NamedUser | null): string {
  return user?.firstName || display;
}

/**
 * Base variables shared by the spec's templates (docs/architecture/EspecialistBRC — Estados del pedido.md):
 * {nombre} = recipient, {contraparte} = the other party, {pedido}, {cliente}, {especialista},
 * {link} (deep link to the request in the recipient's side of the app). Templates only use the
 * subset they need; extra keys are ignored by MessageTemplateService.
 */
export function buildFollowUpVariables(
  request: RequestEntity,
  direction: InteractionDirection,
  reminder: boolean,
): Record<string, string> {
  const e = request as any;
  const clientName = clientDisplayName(request);
  const providerName = providerDisplayName(request);
  const toProvider = direction === InteractionDirection.TO_PROVIDER;
  const title = request.title || 'tu pedido';

  const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3001').replace(
    /\/$/,
    '',
  );
  const side = toProvider ? 'specialist' : 'client';

  return {
    title,
    pedido: `"${title}"`,
    cliente: clientName,
    especialista: providerName,
    nombre: toProvider
      ? e.company?.companyName ||
        firstNameOrDisplay(providerName, e.professional?.user)
      : firstNameOrDisplay(clientName, e.client),
    contraparte: toProvider ? clientName : providerName,
    link: `${baseUrl}/es/${side}/requests/${request.id}`,
    reminder: reminder ? `Te escribimos de nuevo por "${title}". ` : '',
  };
}

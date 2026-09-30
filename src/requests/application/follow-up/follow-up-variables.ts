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

/** Counterpart's phone (E.164) from the relations PrismaRequestMapper attaches to the entity. */
function counterpartPhone(
  request: RequestEntity,
  toProvider: boolean,
): string | null {
  const e = request as any;
  return toProvider
    ? e.client?.phone || null
    : e.professional?.user?.phone || e.company?.user?.phone || null;
}

/**
 * wa.me deep link to open a chat directly with the counterpart. Falls back to `fallbackLink`
 * (the in-app request detail link) in the unexpected case the phone is missing — contact is only
 * released once `RequestEntity.canViewCounterpartContactBy` is true, so this should be rare.
 */
function buildWhatsAppLink(
  request: RequestEntity,
  toProvider: boolean,
  fallbackLink: string,
): string {
  const phone = counterpartPhone(request, toProvider);
  return phone ? `https://wa.me/${phone.replace(/^\+/, '')}` : fallbackLink;
}

function firstNameOrDisplay(display: string, user?: NamedUser | null): string {
  return user?.firstName || display;
}

/**
 * Base variables shared by the spec's templates (docs/architecture/EspecialistBRC — Estados del pedido.md):
 * {nombre} = recipient, {contraparte} = the other party, {pedido}, {cliente}, {especialista},
 * {link} (deep link to the request in the recipient's side of the app), {whatsapp_link} (wa.me
 * deep link to open a chat directly with the counterpart, falls back to {link} if their phone is
 * missing). Templates only use the subset they need; extra keys are ignored by
 * MessageTemplateService.
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
  const link = `${baseUrl}/es/${side}/requests/${request.id}`;

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
    link,
    whatsapp_link: buildWhatsAppLink(request, toProvider, link),
    reminder: reminder ? `Te escribimos de nuevo por "${title}". ` : '',
  };
}

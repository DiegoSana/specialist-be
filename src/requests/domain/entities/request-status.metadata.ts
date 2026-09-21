import { RequestStatus } from '@prisma/client';

/**
 * Single source of truth for the Spanish (es-AR) label of each RequestStatus, per
 * docs/EspecialistBRC — Estados del pedido.md. Import this instead of keeping a
 * per-file partial label map.
 */
export const REQUEST_STATUS_LABELS_ES: Record<RequestStatus, string> = {
  [RequestStatus.DRAFT]: 'Borrador',
  [RequestStatus.PUBLISHED]: 'Publicado',
  [RequestStatus.SENT]: 'Enviado',
  [RequestStatus.CONTACT_RELEASED]: 'Contacto liberado',
  [RequestStatus.IN_PROGRESS]: 'En curso',
  [RequestStatus.FINISHED]: 'Terminado',
  [RequestStatus.CLOSED]: 'Cerrado',
  [RequestStatus.UNDER_REVIEW]: 'En revisión',
  [RequestStatus.EXPIRED]: 'Vencido',
  [RequestStatus.NO_RESPONSE]: 'Sin respuesta',
  [RequestStatus.REJECTED]: 'Rechazado',
  [RequestStatus.CANCELLED]: 'Cancelado',
  [RequestStatus.NOT_COMPLETED]: 'No se concretó',
  [RequestStatus.INTERRUPTED]: 'Interrumpido',
  [RequestStatus.ABANDONED]: 'Abandonado',
};

/**
 * `Request.statusReason` marker set by the Sistema actor when it closes a FINISHED request
 * because the client never answered (cierre automático). Lets follow-up rules send the
 * "closed automatically" notice (A7) instead of the regular closed notice (A6).
 */
export const AUTO_CLOSED_STATUS_REASON = 'AUTO_CLOSED';

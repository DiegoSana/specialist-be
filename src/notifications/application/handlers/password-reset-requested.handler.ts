import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS } from '../../../shared/domain/events/event-bus';
import { EMAIL_SENDER, EmailSender } from '../../domain/ports/email-sender';
import { PasswordResetRequestedEvent } from '../../../identity/domain/events/password-reset-requested.event';
import { PasswordResetOauthOnlyAttemptedEvent } from '../../../identity/domain/events/password-reset-oauth-only-attempted.event';

/**
 * Sends the password reset email directly through the EMAIL_SENDER port, bypassing
 * NotificationService/the delivery queue on purpose: that path would also create an in-app
 * notification showing the same body (and the same one-time link) in the user's notification
 * feed, which is a leak for a "forgot my password" flow. Mirrors UserWhatsAppOptedOutHandler's
 * cross-context subscription shape, but talks to the EMAIL_SENDER port instead of
 * NotificationService.
 */
@Injectable()
export class PasswordResetRequestedHandler implements OnModuleInit {
  private readonly logger = new Logger(PasswordResetRequestedHandler.name);

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: any,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
  ) {}

  onModuleInit(): void {
    if (typeof this.eventBus?.on !== 'function') {
      this.logger.warn(
        'EventBus does not support subscriptions; password reset emails will not be sent.',
      );
      return;
    }

    this.eventBus.on(
      PasswordResetRequestedEvent.EVENT_NAME,
      (event: PasswordResetRequestedEvent) => this.onRequested(event),
    );
    this.eventBus.on(
      PasswordResetOauthOnlyAttemptedEvent.EVENT_NAME,
      (event: PasswordResetOauthOnlyAttemptedEvent) =>
        this.onOauthOnlyAttempted(event),
    );
  }

  private async onRequested(event: PasswordResetRequestedEvent): Promise<void> {
    try {
      const { email, resetUrl } = event.payload;
      const subject = 'Restablecé tu contraseña';
      const text =
        `Recibimos un pedido para restablecer tu contraseña en Specialist. ` +
        `Entrá a este link para elegir una nueva: ${resetUrl}\n\n` +
        `Este link expira en 1 hora. Si vos no pediste esto, podés ignorar este mensaje.`;
      const html =
        `<p>Recibimos un pedido para restablecer tu contraseña en Specialist.</p>` +
        `<p><a href="${resetUrl}">Hacé clic acá para elegir una nueva contraseña</a></p>` +
        `<p>Este link expira en <strong>1 hora</strong>. Si vos no pediste esto, podés ignorar este mensaje.</p>`;

      await this.emailSender.send({ to: email, subject, text, html });
    } catch (err) {
      this.logger.error(
        `Failed handling ${event.name} (userId=${event.payload.userId})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async onOauthOnlyAttempted(
    event: PasswordResetOauthOnlyAttemptedEvent,
  ): Promise<void> {
    try {
      const { email, googleLinked, facebookLinked } = event.payload;
      const providers = [
        googleLinked ? 'Google' : null,
        facebookLinked ? 'Facebook' : null,
      ].filter((p): p is string => !!p);
      const providerList =
        providers.length > 0 ? providers.join(' y ') : 'una red social';

      const subject = 'Sobre tu pedido de restablecer contraseña';
      const text =
        `Alguien pidió restablecer la contraseña de esta cuenta en Specialist, pero tu cuenta ` +
        `inicia sesión con ${providerList} y no tiene una contraseña configurada. ` +
        `Entrá con ${providerList} como siempre. Si no fuiste vos, podés ignorar este mensaje.`;
      const html =
        `<p>Alguien pidió restablecer la contraseña de esta cuenta en Specialist, pero tu cuenta ` +
        `inicia sesión con <strong>${providerList}</strong> y no tiene una contraseña configurada.</p>` +
        `<p>Entrá con ${providerList} como siempre. Si no fuiste vos, podés ignorar este mensaje.</p>`;

      await this.emailSender.send({ to: email, subject, text, html });
    } catch (err) {
      this.logger.error(
        `Failed handling ${event.name} (userId=${event.payload.userId})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}

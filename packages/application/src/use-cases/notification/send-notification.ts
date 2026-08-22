import type { NotificationService } from '../../ports/notification-service';
import type { EventPublisher } from '../../ports/event-publisher';

export interface SendNotificationInput {
  recipientId: string;
  recipientType: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export class SendNotificationUseCase {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: SendNotificationInput): Promise<void> {
    await this.notificationService.notify(
      input.recipientId,
      input.recipientType,
      input.message,
      input.metadata,
    );

    await this.eventPublisher.publish('NOTIFICATION_SENT', {
      recipientId: input.recipientId,
      recipientType: input.recipientType,
      message: input.message,
      timestamp: new Date().toISOString(),
    });
  }
}

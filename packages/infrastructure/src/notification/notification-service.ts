import type { NotificationService, NotificationChannel } from '@restaurant-os/application';

export class MultiChannelNotificationService implements NotificationService {
  constructor(private readonly channels: NotificationChannel[]) {}

  async notify(recipientId: string, _recipientType: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
    await Promise.all(
      this.channels.map((channel) => channel.send(recipientId, message, metadata)),
    );
  }
}

import type { NotificationChannel } from '@restaurant-os/application';

export class InMemoryNotificationChannel implements NotificationChannel {
  private messages: Array<{ recipientId: string; message: string; metadata?: Record<string, unknown> }> = [];

  async send(recipientId: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
    this.messages.push({ recipientId, message, metadata });
    console.log(`[Notification] To ${recipientId}: ${message}`);
  }

  getMessages() {
    return this.messages;
  }

  clear() {
    this.messages = [];
  }
}

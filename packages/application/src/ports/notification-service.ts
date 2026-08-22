// Notification port — implemented by Infrastructure
// Supports multiple channels: push, SMS, email, in-app

export interface NotificationChannel {
  send(recipientId: string, message: string, metadata?: Record<string, unknown>): Promise<void>;
}

export interface NotificationService {
  notify(recipientId: string, recipientType: string, message: string, metadata?: Record<string, unknown>): Promise<void>;
}

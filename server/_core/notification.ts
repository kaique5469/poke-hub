// Owner notifications: no external service in the standalone deploy.
// Logs to console; wire up email/Discord/etc. here if desired.

export interface NotifyOwnerInput { title: string; content: string; }

export async function notifyOwner(input: NotifyOwnerInput): Promise<boolean> {
  console.log(`[Notification] ${input.title}: ${input.content}`);
  return true;
}

import { ENV } from "./env";

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(input: EmailInput): Promise<boolean> {
  if (!ENV.resendApiKey) {
    console.log(
      `[Email preview] To ${input.to} — ${input.subject}: ${input.text}`
    );
    return false;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: ENV.emailFrom,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    if (!response.ok) {
      console.error(
        "[Email] Delivery failed",
        response.status,
        await response.text()
      );
      return false;
    }
    return true;
  } catch (error) {
    // A temporary email-provider outage must never break prize claims or the
    // weekly finalization. The in-app notification remains the source of truth.
    console.error("[Email] Delivery request failed", error);
    return false;
  }
}

export interface NotifyOwnerInput {
  title: string;
  content: string;
  html?: string;
}

export async function notifyOwner(input: NotifyOwnerInput): Promise<boolean> {
  if (!ENV.ownerEmail) {
    console.log(`[Owner notification] ${input.title}: ${input.content}`);
    return false;
  }
  return sendEmail({
    to: ENV.ownerEmail,
    subject: input.title,
    text: input.content,
    html: input.html ?? `<p>${escapeHtml(input.content)}</p>`,
  });
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

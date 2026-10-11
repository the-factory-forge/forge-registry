export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Stable notification ID; reuse it on retries. */
  id?: string;
}

/** Server-only transport. The host supplies credentials and owns delivery/retry policy. */
export async function sendResendEmail(
  config: { apiKey: string | undefined; from: string | undefined },
  email: OutgoingEmail,
): Promise<void> {
  if (!config.apiKey || !config.from) throw new Error("Email delivery is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...(email.id ? { "Idempotency-Key": email.id } : {}),
    },
    body: JSON.stringify({
      from: config.from,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Email delivery failed.");
}

// Sends a message to the cafe's chat. Configured only through Vercel environment variables;
// with none set, nothing is sent.
//   WhatsApp via Fonnte: FONNTE_TOKEN, ALERT_WA_TARGET (phone number like 08123..., or a group id)
//   Telegram:            TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

export function notifyConfigured() {
  return Boolean(
    (process.env.FONNTE_TOKEN && process.env.ALERT_WA_TARGET) ||
      (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  );
}

export async function notify(message: string): Promise<{ sent: boolean; error?: string }> {
  try {
    if (process.env.FONNTE_TOKEN && process.env.ALERT_WA_TARGET) {
      const res = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: { Authorization: process.env.FONNTE_TOKEN },
        body: new URLSearchParams({ target: process.env.ALERT_WA_TARGET, message, countryCode: "62" }),
      });
      const body = (await res.json().catch(() => ({}))) as { status?: boolean; reason?: string };
      return body.status ? { sent: true } : { sent: false, error: body.reason ?? `HTTP ${res.status}` };
    }
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: message }),
      });
      return res.ok ? { sent: true } : { sent: false, error: `HTTP ${res.status}` };
    }
    return { sent: false };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

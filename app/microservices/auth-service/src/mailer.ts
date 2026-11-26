import nodemailer, { type Transporter } from "nodemailer";

let transport: Transporter | null | undefined;

function getTransport() {
  if (transport === undefined) {
    transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;
  }
  return transport;
}

/** SMTP readiness: "not_configured" without SMTP_URL, otherwise verifies the connection. */
export async function verifyMailTransport(): Promise<"ok" | "not_configured"> {
  const t = getTransport();
  if (!t) return "not_configured";
  await t.verify();
  return "ok";
}

/**
 * Sends an email. With no SMTP_URL in development it prints the message instead.
 * In production it never prints: the body can hold a password-reset token.
 */
export async function sendMail(to: string, subject: string, text: string, html: string) {
  const t = getTransport();
  if (!t) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP_URL is not configured; email was not sent");
    }
    console.log(`\n[dev mail] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  await t.sendMail({
    from: process.env.MAIL_FROM ?? "SquadSync <no-reply@squadsync.app>",
    to, subject, text, html,
  });
}
import nodemailer, { type Transporter } from "nodemailer";

let transport: Transporter | null | undefined;

function getTransport() {
  if (transport === undefined) {
    transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;
  }
  return transport;
}

/** Sends an email. With no SMTP_URL (development) it prints the message instead. */
export async function sendMail(to: string, subject: string, text: string, html: string) {
  const t = getTransport();
  if (!t) {
    console.log(`\n[dev mail] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  await t.sendMail({
    from: process.env.MAIL_FROM ?? "SquadSync <no-reply@squadsync.app>",
    to, subject, text, html,
  });
}
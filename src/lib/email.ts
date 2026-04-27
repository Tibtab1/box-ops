import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");
const FROM = process.env.RESEND_FROM ?? "BOX·OPS <noreply@box-ops.vercel.app>";

function baseUrl() {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${baseUrl()}/reset-password?token=${token}`;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Réinitialisation de votre mot de passe BOX·OPS",
    text: [
      "Bonjour,",
      "",
      "Vous avez demandé la réinitialisation de votre mot de passe BOX·OPS.",
      "Cliquez sur le lien ci-dessous (valable 1 heure) :",
      "",
      url,
      "",
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
      "",
      "— BOX·OPS",
    ].join("\n"),
    html: `
<div style="font-family:monospace;max-width:480px;margin:auto;padding:32px">
  <h2 style="font-size:20px;font-weight:900;margin-bottom:16px">BOX·OPS</h2>
  <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
  <p style="margin:24px 0">
    <a href="${url}" style="background:#1a1a1a;color:#fff;padding:12px 24px;text-decoration:none;font-weight:bold;display:inline-block">
      Réinitialiser le mot de passe
    </a>
  </p>
  <p style="color:#666;font-size:12px">Ce lien expire dans 1 heure.<br>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
</div>`,
  });
}

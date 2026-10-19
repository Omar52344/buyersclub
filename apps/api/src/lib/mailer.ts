import nodemailer from 'nodemailer';
import { config } from '../config';

const transport = nodemailer.createTransport(config.SMTP_URL);

const SUBJECTS: Record<string, string> = {
  login: 'Tu código para iniciar sesión en BuyersClub',
  reset: 'Restablece tu contraseña de BuyersClub',
  verify_email: 'Verifica tu correo en BuyersClub',
  verify_phone: 'Verifica tu celular en BuyersClub',
};

export async function sendOtpEmail(
  to: string,
  code: string,
  purpose: string,
): Promise<void> {
  if (config.NODE_ENV === 'test') {
    return;
  }

  const subject = SUBJECTS[purpose] ?? 'Tu código de BuyersClub';

  await transport.sendMail({
    from: config.MAIL_FROM,
    to,
    subject,
    text: `Tu código de BuyersClub es ${code}. Vence en 10 minutos.`,
    html: [
      '<div style="font-family:system-ui,sans-serif;max-width:420px">',
      '<h2>BuyersClub</h2>',
      `<p>Tu código es:</p>`,
      `<p style="font-size:30px;font-weight:700;letter-spacing:8px">${code}</p>`,
      '<p>Vence en 10 minutos. Si no fuiste tú, ignora este correo.</p>',
      '</div>',
    ].join(''),
  });
}

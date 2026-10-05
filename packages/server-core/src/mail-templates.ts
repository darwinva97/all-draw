/**
 * Plantillas de los correos de cuenta, en español e inglés según el idioma de la cuenta (`User.locale`). Cada una da el
 * asunto, el texto plano y un HTML sencillo: estilos en línea, sin imágenes, fuentes ni enlaces a recursos externos
 * (sólo el enlace de la acción). Los textos del usuario (nombres, extractos) se escapan.
 */
import type { MailMessage } from './mail';

export type MailLang = 'es' | 'en';
/** `es` | `en` a partir de un idioma de cuenta o un `Accept-Language` (`en-GB,en;q=0.9` → `en`); por defecto `es`. */
export function mailLang(v: string | null | undefined): MailLang {
  const first = (v ?? '').split(',')[0]?.trim().toLowerCase() ?? '';
  return first.startsWith('en') ? 'en' : 'es';
}

export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

type Body = Omit<MailMessage, 'to'>;
interface Parts { subject: string; greeting: string; paragraphs: string[]; action?: { label: string; url: string }; footer: string[] }

/** Compone texto y HTML con la misma estructura (saludo, párrafos, botón con el enlace también en claro, pie). */
function compose(p: Parts): Body {
  const text = [p.greeting, '', ...p.paragraphs.flatMap(x => [x, '']), ...(p.action ? [`${p.action.label}:`, p.action.url, ''] : []), '—', ...p.footer].join('\n');
  const para = (x: string) => `<p style="margin:0 0 14px;line-height:1.5">${escapeHtml(x)}</p>`;
  const button = p.action
    ? `<p style="margin:22px 0"><a href="${escapeHtml(p.action.url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600">${escapeHtml(p.action.label)}</a></p>`
      + `<p style="margin:0 0 14px;line-height:1.5;font-size:13px;color:#475569;word-break:break-all">${escapeHtml(p.action.url)}</p>`
    : '';
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(p.subject)}</title></head>`
    + `<body style="margin:0;padding:24px;background:#f8fafc;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:15px">`
    + `<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:24px">`
    + `<p style="margin:0 0 18px;font-weight:700;font-size:17px">all-draw</p>`
    + para(p.greeting) + p.paragraphs.map(para).join('') + button
    + `<hr style="border:none;border-top:1px solid #e2e8f0;margin:22px 0 14px">`
    + p.footer.map(x => `<p style="margin:0 0 6px;font-size:12px;color:#64748b;line-height:1.5">${escapeHtml(x)}</p>`).join('')
    + `</div></body></html>`;
  return { subject: p.subject, text, html };
}

const hello = (lang: MailLang, name: string) => (lang === 'en' ? `Hi ${name || 'there'},` : `Hola${name ? `, ${name}` : ''}:`);
const ignore = (lang: MailLang) => (lang === 'en' ? 'If you did not ask for this, ignore this email: nothing changes.' : 'Si no lo has pedido tú, ignora este correo: no cambia nada.');
const auto = (lang: MailLang) => (lang === 'en' ? 'Automatic message from all-draw. Please do not reply.' : 'Mensaje automático de all-draw. No respondas a este correo.');

/** Enlace para elegir una contraseña nueva (`#/restablecer?token=…`, una hora, un solo uso). */
export function resetPasswordEmail(o: { lang: MailLang; name: string; url: string; minutes: number }): Body {
  return o.lang === 'en'
    ? compose({ subject: 'Reset your all-draw password', greeting: hello('en', o.name), paragraphs: [`Someone (hopefully you) asked to reset the password of your all-draw account. The link works once and expires in ${o.minutes} minutes.`, 'When you set the new password, every open session is signed out.'], action: { label: 'Choose a new password', url: o.url }, footer: [ignore('en'), auto('en')] })
    : compose({ subject: 'Restablece tu contraseña de all-draw', greeting: hello('es', o.name), paragraphs: [`Alguien (esperamos que tú) ha pedido restablecer la contraseña de tu cuenta de all-draw. El enlace sirve una sola vez y caduca en ${o.minutes} minutos.`, 'Al elegir la contraseña nueva se cierran todas las sesiones abiertas.'], action: { label: 'Elegir una contraseña nueva', url: o.url }, footer: [ignore('es'), auto('es')] });
}

/** Verificar el correo (al registrarse o al cambiarlo: `change: true`). 24 horas, un solo uso. */
export function verifyEmailEmail(o: { lang: MailLang; name: string; url: string; hours: number; change: boolean }): Body {
  if (o.lang === 'en') {
    return compose({
      subject: o.change ? 'Confirm your new all-draw email' : 'Confirm your all-draw email',
      greeting: hello('en', o.name),
      paragraphs: [o.change ? 'You asked to change the email of your all-draw account to this address. It will not change until you confirm it.' : 'Thanks for signing up to all-draw. Confirm that this address is yours.', `The link works once and expires in ${o.hours} hours.`],
      action: { label: o.change ? 'Confirm the new email' : 'Confirm my email', url: o.url }, footer: [ignore('en'), auto('en')],
    });
  }
  return compose({
    subject: o.change ? 'Confirma tu nuevo correo de all-draw' : 'Confirma tu correo de all-draw',
    greeting: hello('es', o.name),
    paragraphs: [o.change ? 'Has pedido cambiar el correo de tu cuenta de all-draw a esta dirección. No cambiará hasta que lo confirmes.' : 'Gracias por crear una cuenta en all-draw. Confirma que esta dirección es tuya.', `El enlace sirve una sola vez y caduca en ${o.hours} horas.`],
    action: { label: o.change ? 'Confirmar el correo nuevo' : 'Confirmar mi correo', url: o.url }, footer: [ignore('es'), auto('es')],
  });
}

/** Aviso a la dirección anterior cuando se pide cambiar el correo (por si no fue la persona dueña). */
export function emailChangeNoticeEmail(o: { lang: MailLang; name: string; newEmail: string; accountUrl: string }): Body {
  return o.lang === 'en'
    ? compose({ subject: 'Your all-draw email is about to change', greeting: hello('en', o.name), paragraphs: [`Someone signed in to your all-draw account asked to change its email to ${o.newEmail}. It will change only when that address confirms it.`, 'If it was not you, change your password and sign out every session from your account page.'], action: { label: 'Open my account', url: o.accountUrl }, footer: [auto('en')] })
    : compose({ subject: 'El correo de tu cuenta de all-draw va a cambiar', greeting: hello('es', o.name), paragraphs: [`Desde una sesión de tu cuenta de all-draw se ha pedido cambiar el correo a ${o.newEmail}. Sólo cambiará cuando esa dirección lo confirme.`, 'Si no has sido tú, cambia la contraseña y cierra todas las sesiones desde la página de tu cuenta.'], action: { label: 'Abrir mi cuenta', url: o.accountUrl }, footer: [auto('es')] });
}

/** Resumen inmediato de una mención en un comentario (si la cuenta tiene «recibir por correo»). */
export function mentionEmail(o: { lang: MailLang; name: string; actor: string; workspace: string; excerpt: string; url: string; prefsUrl: string }): Body {
  return o.lang === 'en'
    ? compose({ subject: `${o.actor} mentioned you in “${o.workspace}”`, greeting: hello('en', o.name), paragraphs: [`${o.actor} mentioned you in a comment in “${o.workspace}”:`, `“${o.excerpt}”`], action: { label: 'Open the workspace', url: o.url }, footer: [`You get this because email notifications are on. Turn them off in your account: ${o.prefsUrl}`, auto('en')] })
    : compose({ subject: `${o.actor} te ha mencionado en «${o.workspace}»`, greeting: hello('es', o.name), paragraphs: [`${o.actor} te ha mencionado en un comentario de «${o.workspace}»:`, `«${o.excerpt}»`], action: { label: 'Abrir el espacio', url: o.url }, footer: [`Te llega porque tienes activados los avisos por correo. Puedes quitarlos en tu cuenta: ${o.prefsUrl}`, auto('es')] });
}

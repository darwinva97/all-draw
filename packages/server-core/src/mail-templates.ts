/**
 * Plantillas de los correos de cuenta, en español, inglés, portugués (Brasil) y francés según el idioma de la cuenta
 * (`User.locale`). Cada una da el
 * asunto, el texto plano y un HTML sencillo: estilos en línea, sin imágenes, fuentes ni enlaces a recursos externos
 * (sólo el enlace de la acción). Los textos del usuario (nombres, extractos) se escapan.
 */
import type { MailMessage } from './mail';

export type MailLang = 'es' | 'en' | 'pt' | 'fr';
export const MAIL_LANGS: readonly MailLang[] = ['es', 'en', 'pt', 'fr'];
/** Idioma a partir de un idioma de cuenta o un `Accept-Language` (`pt-BR,pt;q=0.9` → `pt`); por defecto `es`. */
export function mailLang(v: string | null | undefined): MailLang {
  const first = (v ?? '').split(',')[0]?.trim().toLowerCase().split(/[-_;]/)[0] ?? '';
  return (MAIL_LANGS as readonly string[]).includes(first) ? first as MailLang : 'es';
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

interface Texts {
  hello: (name: string) => string; ignore: string; auto: string;
  reset: { subject: string; p1: (minutes: number) => string; p2: string; action: string };
  verify: { subject: string; subjectChange: string; p1: string; p1Change: string; p2: (hours: number) => string; action: string; actionChange: string };
  change: { subject: string; p1: (email: string) => string; p2: string; action: string };
  mention: { subject: (actor: string, ws: string) => string; p1: (actor: string, ws: string) => string; quote: (x: string) => string; action: string; footer: (url: string) => string };
}

const TEXTS: Record<MailLang, Texts> = {
  es: {
    hello: name => `Hola${name ? `, ${name}` : ''}:`,
    ignore: 'Si no lo has pedido tú, ignora este correo: no cambia nada.',
    auto: 'Mensaje automático de all-draw. No respondas a este correo.',
    reset: { subject: 'Restablece tu contraseña de all-draw', p1: m => `Alguien (esperamos que tú) ha pedido restablecer la contraseña de tu cuenta de all-draw. El enlace sirve una sola vez y caduca en ${m} minutos.`, p2: 'Al elegir la contraseña nueva se cierran todas las sesiones abiertas.', action: 'Elegir una contraseña nueva' },
    verify: { subject: 'Confirma tu correo de all-draw', subjectChange: 'Confirma tu nuevo correo de all-draw', p1: 'Gracias por crear una cuenta en all-draw. Confirma que esta dirección es tuya.', p1Change: 'Has pedido cambiar el correo de tu cuenta de all-draw a esta dirección. No cambiará hasta que lo confirmes.', p2: h => `El enlace sirve una sola vez y caduca en ${h} horas.`, action: 'Confirmar mi correo', actionChange: 'Confirmar el correo nuevo' },
    change: { subject: 'El correo de tu cuenta de all-draw va a cambiar', p1: e => `Desde una sesión de tu cuenta de all-draw se ha pedido cambiar el correo a ${e}. Sólo cambiará cuando esa dirección lo confirme.`, p2: 'Si no has sido tú, cambia la contraseña y cierra todas las sesiones desde la página de tu cuenta.', action: 'Abrir mi cuenta' },
    mention: { subject: (a, w) => `${a} te ha mencionado en «${w}»`, p1: (a, w) => `${a} te ha mencionado en un comentario de «${w}»:`, quote: x => `«${x}»`, action: 'Abrir el espacio', footer: u => `Te llega porque tienes activados los avisos por correo. Puedes quitarlos en tu cuenta: ${u}` },
  },
  en: {
    hello: name => `Hi ${name || 'there'},`,
    ignore: 'If you did not ask for this, ignore this email: nothing changes.',
    auto: 'Automatic message from all-draw. Please do not reply.',
    reset: { subject: 'Reset your all-draw password', p1: m => `Someone (hopefully you) asked to reset the password of your all-draw account. The link works once and expires in ${m} minutes.`, p2: 'When you set the new password, every open session is signed out.', action: 'Choose a new password' },
    verify: { subject: 'Confirm your all-draw email', subjectChange: 'Confirm your new all-draw email', p1: 'Thanks for signing up to all-draw. Confirm that this address is yours.', p1Change: 'You asked to change the email of your all-draw account to this address. It will not change until you confirm it.', p2: h => `The link works once and expires in ${h} hours.`, action: 'Confirm my email', actionChange: 'Confirm the new email' },
    change: { subject: 'Your all-draw email is about to change', p1: e => `Someone signed in to your all-draw account asked to change its email to ${e}. It will change only when that address confirms it.`, p2: 'If it was not you, change your password and sign out every session from your account page.', action: 'Open my account' },
    mention: { subject: (a, w) => `${a} mentioned you in “${w}”`, p1: (a, w) => `${a} mentioned you in a comment in “${w}”:`, quote: x => `“${x}”`, action: 'Open the workspace', footer: u => `You get this because email notifications are on. Turn them off in your account: ${u}` },
  },
  pt: {
    hello: name => `Olá${name ? `, ${name}` : ''},`,
    ignore: 'Se não foi você que pediu, ignore este e-mail: nada muda.',
    auto: 'Mensagem automática do all-draw. Não responda a este e-mail.',
    reset: { subject: 'Redefina sua senha do all-draw', p1: m => `Alguém (esperamos que você) pediu para redefinir a senha da sua conta do all-draw. O link funciona uma única vez e expira em ${m} minutos.`, p2: 'Ao definir a nova senha, todas as sessões abertas são encerradas.', action: 'Escolher uma nova senha' },
    verify: { subject: 'Confirme seu e-mail do all-draw', subjectChange: 'Confirme seu novo e-mail do all-draw', p1: 'Obrigado por criar uma conta no all-draw. Confirme que este endereço é seu.', p1Change: 'Você pediu para alterar o e-mail da sua conta do all-draw para este endereço. Ele só muda depois que você confirmar.', p2: h => `O link funciona uma única vez e expira em ${h} horas.`, action: 'Confirmar meu e-mail', actionChange: 'Confirmar o novo e-mail' },
    change: { subject: 'O e-mail da sua conta do all-draw vai mudar', p1: e => `Em uma sessão da sua conta do all-draw, foi pedido alterar o e-mail para ${e}. Ele só muda quando esse endereço confirmar.`, p2: 'Se não foi você, altere a senha e encerre todas as sessões na página da sua conta.', action: 'Abrir minha conta' },
    mention: { subject: (a, w) => `${a} mencionou você em “${w}”`, p1: (a, w) => `${a} mencionou você em um comentário em “${w}”:`, quote: x => `“${x}”`, action: 'Abrir o espaço de trabalho', footer: u => `Você recebe isto porque os avisos por e-mail estão ativados. Desative-os na sua conta: ${u}` },
  },
  fr: {
    hello: name => `Bonjour${name ? ` ${name}` : ''},`,
    ignore: 'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail : rien ne change.',
    auto: 'Message automatique d’all-draw. Merci de ne pas y répondre.',
    reset: { subject: 'Réinitialisez votre mot de passe all-draw', p1: m => `Quelqu’un (vous, nous l’espérons) a demandé à réinitialiser le mot de passe de votre compte all-draw. Le lien ne fonctionne qu’une fois et expire dans ${m} minutes.`, p2: 'Lorsque vous définirez le nouveau mot de passe, toutes les sessions ouvertes seront fermées.', action: 'Choisir un nouveau mot de passe' },
    verify: { subject: 'Confirmez votre adresse e-mail all-draw', subjectChange: 'Confirmez votre nouvelle adresse e-mail all-draw', p1: 'Merci d’avoir créé un compte all-draw. Confirmez que cette adresse vous appartient.', p1Change: 'Vous avez demandé à remplacer l’adresse e-mail de votre compte all-draw par celle-ci. Elle ne changera qu’une fois confirmée.', p2: h => `Le lien ne fonctionne qu’une fois et expire dans ${h} heures.`, action: 'Confirmer mon adresse', actionChange: 'Confirmer la nouvelle adresse' },
    change: { subject: 'L’adresse e-mail de votre compte all-draw va changer', p1: e => `Depuis une session de votre compte all-draw, quelqu’un a demandé à remplacer l’adresse e-mail par ${e}. Elle ne changera que lorsque cette adresse l’aura confirmé.`, p2: 'Si ce n’est pas vous, changez votre mot de passe et fermez toutes les sessions depuis la page de votre compte.', action: 'Ouvrir mon compte' },
    mention: { subject: (a, w) => `${a} vous a mentionné dans « ${w} »`, p1: (a, w) => `${a} vous a mentionné dans un commentaire de « ${w} » :`, quote: x => `« ${x} »`, action: 'Ouvrir l’espace de travail', footer: u => `Vous recevez ce message car les notifications par e-mail sont activées. Vous pouvez les désactiver dans votre compte : ${u}` },
  },
};

/** Enlace para elegir una contraseña nueva (`#/restablecer?token=…`, una hora, un solo uso). */
export function resetPasswordEmail(o: { lang: MailLang; name: string; url: string; minutes: number }): Body {
  const T = TEXTS[o.lang] ?? TEXTS.es;
  return compose({ subject: T.reset.subject, greeting: T.hello(o.name), paragraphs: [T.reset.p1(o.minutes), T.reset.p2], action: { label: T.reset.action, url: o.url }, footer: [T.ignore, T.auto] });
}

/** Verificar el correo (al registrarse o al cambiarlo: `change: true`). 24 horas, un solo uso. */
export function verifyEmailEmail(o: { lang: MailLang; name: string; url: string; hours: number; change: boolean }): Body {
  const T = TEXTS[o.lang] ?? TEXTS.es, v = T.verify;
  return compose({
    subject: o.change ? v.subjectChange : v.subject, greeting: T.hello(o.name),
    paragraphs: [o.change ? v.p1Change : v.p1, v.p2(o.hours)],
    action: { label: o.change ? v.actionChange : v.action, url: o.url }, footer: [T.ignore, T.auto],
  });
}

/** Aviso a la dirección anterior cuando se pide cambiar el correo (por si no fue la persona dueña). */
export function emailChangeNoticeEmail(o: { lang: MailLang; name: string; newEmail: string; accountUrl: string }): Body {
  const T = TEXTS[o.lang] ?? TEXTS.es;
  return compose({ subject: T.change.subject, greeting: T.hello(o.name), paragraphs: [T.change.p1(o.newEmail), T.change.p2], action: { label: T.change.action, url: o.accountUrl }, footer: [T.auto] });
}

/** Resumen inmediato de una mención en un comentario (si la cuenta tiene «recibir por correo»). */
export function mentionEmail(o: { lang: MailLang; name: string; actor: string; workspace: string; excerpt: string; url: string; prefsUrl: string }): Body {
  const T = TEXTS[o.lang] ?? TEXTS.es, m = T.mention;
  return compose({ subject: m.subject(o.actor, o.workspace), greeting: T.hello(o.name), paragraphs: [m.p1(o.actor, o.workspace), m.quote(o.excerpt)], action: { label: m.action, url: o.url }, footer: [m.footer(o.prefsUrl), T.auto] });
}

/** Correos de cuenta en los cuatro idiomas: el idioma sale de la cuenta o del `Accept-Language`, y cada plantilla existe. */
import { describe, it, expect } from 'vitest';
import { MAIL_LANGS, emailChangeNoticeEmail, mailLang, mentionEmail, resetPasswordEmail, verifyEmailEmail } from '../src/mail-templates';

describe('plantillas de correo', () => {
  it('mailLang reconoce es, en, pt y fr (y por defecto español)', () => {
    expect(mailLang('pt-BR,pt;q=0.9,en;q=0.8')).toBe('pt');
    expect(mailLang('fr-CA')).toBe('fr');
    expect(mailLang('en-GB,en;q=0.9')).toBe('en');
    expect(mailLang('de-DE')).toBe('es');
    expect(mailLang(null)).toBe('es');
    expect(mailLang('fr')).toBe('fr');
  });

  it('cada idioma tiene su texto (distinto del resto) con el enlace y los datos', () => {
    const subjects = new Set<string>();
    for (const lang of MAIL_LANGS) {
      const r = resetPasswordEmail({ lang, name: 'Ana', url: 'https://x/#/restablecer?token=t', minutes: 60 });
      expect(r.text).toContain('https://x/#/restablecer?token=t');
      expect(r.text).toContain('60');
      subjects.add(r.subject);
      const v = verifyEmailEmail({ lang, name: '', url: 'https://x/v', hours: 24, change: true });
      expect(v.text).toContain('24');
      const c = emailChangeNoticeEmail({ lang, name: 'Ana', newEmail: 'b@x.com', accountUrl: 'https://x/a' });
      expect(c.text).toContain('b@x.com');
      const m = mentionEmail({ lang, name: 'Ana', actor: 'Luis', workspace: 'Ventas', excerpt: '<hola>', url: 'https://x/w', prefsUrl: 'https://x/p' });
      expect(m.subject).toContain('Luis');
      expect(m.html).toContain('&lt;hola&gt;');
    }
    expect(subjects.size).toBe(MAIL_LANGS.length);
    expect(resetPasswordEmail({ lang: 'pt', name: 'Ana', url: 'u', minutes: 60 }).subject).toMatch(/senha/);
    expect(resetPasswordEmail({ lang: 'fr', name: 'Ana', url: 'u', minutes: 60 }).subject).toMatch(/mot de passe/);
  });
});

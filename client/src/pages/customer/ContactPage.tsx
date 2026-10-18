import { useBranches } from '../../features/branches/branchesApi';
import { localPhone, whatsappUrl } from '../../features/branches/maps';
import { ContactForm } from '../../features/contact/ContactForm';
import { Footer } from '../../features/landing/Sections';
import { useLang, useT } from '../../i18n';
import { buttonClass } from '../../shared/ui/buttonClass';
import { Reveal } from '../../shared/ui/motion';
import { SocialLinks } from '../../shared/ui/SocialLinks';

/** "Contact us": every branch's phones and WhatsApp, social links, and the feedback form. */
export function ContactPage() {
  const t = useT();
  const lang = useLang();
  const { data: branches = [] } = useBranches();

  return (
    <>
      <main className="mx-auto w-full max-w-content px-5 pb-24 pt-10 md:px-10">
        <header className="motion-safe:animate-rise">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-flame-text">
            {t.contact.eyebrow}
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold md:text-5xl">{t.contact.title}</h1>
          <p className="mt-3 max-w-lg text-ink-muted">{t.contact.lead}</p>
          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
              {t.contact.follow}
            </p>
            <div className="mt-2">
              <SocialLinks />
            </div>
          </div>
        </header>

        <section className="mt-12 grid gap-6 md:grid-cols-2" aria-label={t.contact.phones}>
          {branches.map((b, i) => (
            <Reveal
              key={b.id}
              delay={i * 120}
              className="spotlight rounded-card border border-line bg-surface p-6"
            >
              <h2 className="font-display text-xl font-bold">{b.name[lang]}</h2>
              <p className="mt-1 text-sm text-ink-muted">{b.address[lang]}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {b.phones.map((p) => (
                  <li key={p}>
                    <a
                      href={`tel:${p}`}
                      dir="ltr"
                      aria-label={t.branches.callNumber(localPhone(p))}
                      className={`${buttonClass('ghost', 'sm')} tabular`}
                    >
                      {localPhone(p)}
                    </a>
                  </li>
                ))}
                {b.whatsapp && (
                  <li>
                    <a
                      href={whatsappUrl(b.whatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClass('primary', 'sm')}
                    >
                      {t.branches.whatsapp}
                    </a>
                  </li>
                )}
              </ul>
            </Reveal>
          ))}
        </section>

        <section aria-labelledby="feedback-title" className="mt-16">
          <Reveal>
            <h2 id="feedback-title" className="font-display text-3xl font-bold">
              {t.contact.formTitle}
            </h2>
            <p className="mt-2 max-w-xl text-ink-muted">{t.contact.formLead}</p>
          </Reveal>
          <div className="mt-6">
            <ContactForm branches={branches} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

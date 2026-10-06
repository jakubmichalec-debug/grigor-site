import Link from "next/link";
import s from "./Contact.module.css";

/**
 * The small one. Not a form — a form asks people to compose a brief into a
 * textarea before they know whether they want to; an address asks them to send
 * the email they were already writing in their head.
 *
 * Stays on paper, continuing the reviews section above it, so the page has one
 * light stretch rather than two separated by the footer.
 */
export function Contact() {
  return (
    <section id="contact" className={s.section} data-contact="" aria-labelledby="contact-heading">
      <div className={s.inner}>
        <p className={s.eyebrow} id="contact-heading">
          Start a project
        </p>

        {/*
          The address is the interface. Sized as display type because it is the
          one thing on this section anybody needs.
        */}
        <a className={s.address} href="mailto:hello@grigor.studio">
          hello@grigor.studio
        </a>

        <div className={s.meta}>
          <span className={s.metaItem}>
            <span className={s.metaLabel}>Studio</span>
            Antwerp, BE
          </span>
          <span className={s.metaItem}>
            <span className={s.metaLabel}>Phone</span>
            <a className={s.metaLink} href="tel:+3230000000">
              +32 3 000 00 00
            </a>
          </span>
          <span className={s.metaItem}>
            <span className={s.metaLabel}>Rates</span>
            <Link className={s.metaLink} href="/services">
              Day and project
            </Link>
          </span>
        </div>
      </div>
    </section>
  );
}

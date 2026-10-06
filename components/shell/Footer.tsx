import Link from "next/link";
import s from "./Footer.module.css";

/**
 * The handles and the link groups are still stand-ins to be replaced: each
 * social link goes to its platform's front page, and Privacy and Terms to the
 * About stub. The structure is the real deliverable.
 *
 * Back on ink after the light stretch of reviews and contact: the page opens
 * dark and closes dark, and the pale middle reads as an interlude rather than a
 * change of mind.
 */

/** Inline, not an icon font: four glyphs is not worth a network request. */
const SOCIALS = [
  {
    name: "Instagram",
    href: "https://instagram.com",
    path: "M12 2.2c3.2 0 3.6 0 4.9.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.86s0 3.6-.07 4.86c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.86.07s-3.6 0-4.86-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.21 15.6 2.2 15.2 2.2 12s0-3.6.07-4.86c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.46 2.21 8.84 2.2 12 2.2Zm0 3.18a6.62 6.62 0 1 0 0 13.24 6.62 6.62 0 0 0 0-13.24Zm0 10.92a4.3 4.3 0 1 1 0-8.6 4.3 4.3 0 0 1 0 8.6Zm6.88-11.18a1.55 1.55 0 1 1-3.1 0 1.55 1.55 0 0 1 3.1 0Z",
  },
  {
    name: "Vimeo",
    href: "https://vimeo.com",
    path: "M22.4 7.4c-.1 2.18-1.62 5.16-4.56 8.95-3.04 3.96-5.61 5.94-7.71 5.94-1.3 0-2.4-1.2-3.3-3.6l-1.8-6.6c-.67-2.4-1.38-3.6-2.14-3.6-.17 0-.75.35-1.74 1.04L0 8.19a292 292 0 0 0 3.23-2.88C4.68 4.05 5.77 3.4 6.5 3.33c1.72-.16 2.78 1.01 3.18 3.53.43 2.71.73 4.4.9 5.06.5 2.27 1.04 3.4 1.64 3.4.47 0 1.17-.73 2.1-2.2.94-1.48 1.44-2.6 1.5-3.37.13-1.23-.36-1.85-1.5-1.85-.53 0-1.08.12-1.65.36 1.1-3.6 3.2-5.35 6.3-5.25 2.3.07 3.38 1.56 3.24 4.47Z",
  },
  {
    name: "YouTube",
    href: "https://youtube.com",
    path: "M23.5 6.5a3 3 0 0 0-2.12-2.13C19.5 3.86 12 3.86 12 3.86s-7.5 0-9.38.51A3 3 0 0 0 .5 6.5C0 8.38 0 12 0 12s0 3.62.5 5.5a3 3 0 0 0 2.12 2.13c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3 3 0 0 0 2.12-2.13C24 15.62 24 12 24 12s0-3.62-.5-5.5ZM9.6 15.6V8.4l6.24 3.6-6.24 3.6Z",
  },
  {
    name: "LinkedIn",
    href: "https://linkedin.com",
    path: "M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14Zm1.78 13.02H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z",
  },
];

const GROUPS = [
  {
    title: "Work",
    links: [
      { label: "Gallery", href: "/gallery" },
      { label: "Projects", href: "/projects" },
      { label: "Services", href: "/services" },
    ],
  },
  {
    title: "Studio",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Rates", href: "/services" },
    ],
  },
];

export function Footer() {
  return (
    <footer className={s.footer} data-footer="">
      <div className={s.top}>
        <div className={s.brand}>
          <Link href="/" className={s.wordmark}>
            Grigor
          </Link>
          <p className={s.blurb}>
            Film, video and motion for sport: race recaps, event films and
            athlete stories, shot and cut in-house.
          </p>
        </div>

        <nav className={s.groups} aria-label="Footer">
          {GROUPS.map((group) => (
            <div className={s.group} key={group.title}>
              <h2 className={s.groupTitle}>{group.title}</h2>
              <ul className={s.list}>
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link className={s.link} href={link.href}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className={s.group}>
          <h2 className={s.groupTitle}>Elsewhere</h2>
          <ul className={s.socials}>
            {SOCIALS.map((social) => (
              <li key={social.name}>
                <a
                  className={s.social}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {/*
                    The name is the accessible name and the glyph is decorative,
                    so the link never reads as "link, graphic".
                  */}
                  <span className={s.srOnly}>{social.name}</span>
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d={social.path} fill="currentColor" />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={s.bottom}>
        <span>&#169; 2026 Grigor</span>
        <span className={s.legal}>
          <Link className={s.link} href="/about">
            Privacy
          </Link>
          <Link className={s.link} href="/about">
            Terms
          </Link>
        </span>
      </div>
    </footer>
  );
}

import Link from "next/link";

/**
 * Temporary. Keeps the intro's nav from 404-ing while we build section by
 * section — each of these becomes a real route in turn.
 */
export function StubPage({ title }: { title: string }) {
  return (
    <main
      style={{
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        gap: 18,
        alignContent: "center",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          font: "700 clamp(32px, 7vw, 88px)/0.95 var(--font-archivo), sans-serif",
          letterSpacing: "-0.03em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </h1>
      <Link
        href="/"
        style={{
          font: "500 10.5px/1 var(--font-mono), monospace",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        [ Back home ]
      </Link>
    </main>
  );
}

"use client";

import { useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { useGSAP } from "@gsap/react";
import { DUR, EASE } from "@/lib/motion/tokens";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";
import s from "./Gallery.module.css";

gsap.registerPlugin(Flip, useGSAP);

/**
 * The pieces. Each category still owns a colour — it is the ground a tile sits
 * on while its picture loads, and it keeps a filter legible at a glance on a
 * slow connection rather than something you have to read labels to verify.
 */
const CATEGORIES = ["All", "Sports", "Brands", "Custom"] as const;
type Category = (typeof CATEGORIES)[number];

type Piece = {
  id: number;
  category: Exclude<Category, "All">;
  /**
   * The shape the picture is cut to, and the tile's own shape when it has a
   * row to itself. In a shared row every tile takes the tallest one's height,
   * so the picture covers its box rather than fitting it exactly.
   */
  ratio: string;
  alt: string;
};

/** Mixed on purpose — a filter that only ever reflows a tidy grid proves nothing. */
const PIECES: Piece[] = [
  {
    id: 1,
    category: "Sports",
    ratio: "4 / 3",
    alt: "Road cyclists passing in a blur, in black and white.",
  },
  {
    id: 2,
    category: "Brands",
    ratio: "3 / 4",
    alt: "A runner in a North Face cap and tee, seen from behind in a forest.",
  },
  {
    id: 3,
    category: "Custom",
    ratio: "16 / 9",
    alt: "Two runners in silhouette against an orange sunset.",
  },
  {
    id: 4,
    category: "Brands",
    ratio: "1 / 1",
    alt: "A camera on a gimbal held up in front of a blue sports car.",
  },
  {
    id: 5,
    category: "Sports",
    ratio: "16 / 9",
    alt: "Riders in team kit resting on a kerb beside a cool box.",
  },
  {
    id: 6,
    category: "Custom",
    ratio: "4 / 3",
    alt: "Two runners as white cut-outs on a black ground.",
  },
  {
    id: 7,
    category: "Sports",
    ratio: "1 / 1",
    alt: "A runner with a headlamp coming out of the dark.",
  },
  {
    id: 8,
    category: "Brands",
    ratio: "4 / 3",
    alt: "A team van with race bikes lined up along its side.",
  },
  {
    id: 9,
    category: "Custom",
    ratio: "3 / 4",
    alt: "A paper cut-out of a sprinter on a track, carrying a handwritten note.",
  },
  {
    id: 10,
    category: "Sports",
    ratio: "3 / 4",
    alt: "A cyclist in a white helmet, close up, in black and white.",
  },
  {
    id: 11,
    category: "Brands",
    ratio: "16 / 9",
    alt: "A running shoe landing on a leaf-covered trail.",
  },
  {
    id: 12,
    category: "Custom",
    ratio: "1 / 1",
    alt: "A crumpled-paper cut-out of a runner seen from above.",
  },
  {
    id: 13,
    category: "Sports",
    ratio: "4 / 3",
    alt: "Two cyclists in matching kit riding side by side.",
  },
  {
    id: 14,
    category: "Brands",
    ratio: "1 / 1",
    alt: "A cyclist in team kit and a white helmet, close up.",
  },
  {
    id: 15,
    category: "Custom",
    ratio: "4 / 3",
    alt: "A camera operator carrying a gimbal rig.",
  },
];

/** `public/gallery/01.jpg` … — named by id so the manifest above is the only list. */
const srcOf = (piece: Piece) =>
  `/gallery/${String(piece.id).padStart(2, "0")}.jpg`;

export function Gallery() {
  const root = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLUListElement>(null);
  const reduced = useReducedMotion();
  const [active, setActive] = useState<Category>("All");

  /*
   * Flip reads the DOM *before* React changes it, so the state has to be
   * captured in the click handler rather than in an effect after the render.
   * The tween itself is fired from useGSAP once the new layout exists.
   */
  const pending = useRef<Flip.FlipState | null>(null);

  const choose = (category: Category) => {
    if (category === active) return;
    if (grid.current && !reduced) {
      /*
       * Every tile, including the ones currently hidden. Capturing only the
       * visible ones was the bug: React destroys and recreates the filtered-out
       * nodes, so on the way back to "All" the ten returning tiles had never
       * appeared in the captured state, Flip could not classify them as
       * entering, and they simply popped in at full opacity while the five
       * survivors glided. Keeping the whole set in the DOM and toggling
       * `display` gives Flip a stable element list to reason about.
       */
      pending.current = Flip.getState(
        grid.current.querySelectorAll<HTMLElement>("[data-piece]"),
        { props: "opacity" },
      );
    }
    setActive(category);
  };

  useGSAP(
    () => {
      const state = pending.current;
      pending.current = null;
      if (!state || reduced) return;

      Flip.from(state, {
        duration: DUR.overlay,
        ease: EASE.inout,
        /*
         * `absolute` is what lets the tiles pass through each other. Without it
         * every tile is still in flow while it moves, so the survivors shove
         * each other around instead of gliding across — the overlap mid-flight
         * is the whole character of this transition.
         */
        absolute: true,
        scale: true,
        stagger: 0.035,
        /* Arriving tiles have no "before" to flip from, so they get their own. */
        onEnter: (els) =>
          gsap.fromTo(
            els,
            { opacity: 0, scale: 0.62 },
            {
              opacity: 1,
              scale: 1,
              duration: DUR.overlay,
              ease: EASE.expo,
              stagger: 0.035,
            },
          ),
        onLeave: (els) =>
          gsap.to(els, {
            opacity: 0,
            scale: 0.62,
            duration: DUR.reveal,
            ease: EASE.quart,
          }),
      });
    },
    { dependencies: [active], scope: root },
  );

  const isShown = (piece: Piece) =>
    active === "All" || piece.category === active;
  const shownCount = PIECES.filter(isShown).length;

  return (
    <div className={s.page} ref={root}>
      <header className={s.head}>
        <Link href="/#header" className={s.back}>
          [ Back home ]
        </Link>
        <h1 className={s.title}>Gallery</h1>
        <p className={s.count}>
          {String(shownCount).padStart(2, "0")} /{" "}
          {String(PIECES.length).padStart(2, "0")}
        </p>
      </header>

      <ul className={s.grid} ref={grid}>
        {/*
          All fifteen are always rendered; `data-hidden` takes the filtered-out
          ones out of layout. See the note in `choose` for why they must not be
          unmounted.
        */}
        {PIECES.map((piece) => (
          <li
            key={piece.id}
            data-piece=""
            data-category={piece.category}
            data-hidden={isShown(piece) ? undefined : "true"}
            className={s.piece}
            style={{ "--ratio": piece.ratio } as CSSProperties}
          >
            {/*
              `sizes` is generous on purpose: a tile grows to fill its row, so
              the last one in a filtered set can be most of the page wide.
            */}
            <Image
              src={srcOf(piece)}
              alt={piece.alt}
              fill
              sizes="(max-width: 700px) 100vw, 50vw"
              /* The first row is the first screen; the rest can wait to be scrolled to. */
              loading={piece.id <= 4 ? "eager" : "lazy"}
              className={s.pieceImage}
            />
            <span className={s.pieceLabel}>
              {String(piece.id).padStart(2, "0")} &#183; {piece.category}
            </span>
          </li>
        ))}
      </ul>

      {/*
        Floating, bottom centre, translucent. It has to stay reachable through a
        long scroll, and a bar that scrolled away would mean returning to the top
        to change a filter.
      */}
      <nav className={s.filters} aria-label="Filter by category">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            className={s.filter}
            data-active={category === active ? "true" : undefined}
            aria-pressed={category === active}
            onClick={() => choose(category)}
          >
            {category}
          </button>
        ))}
      </nav>
    </div>
  );
}

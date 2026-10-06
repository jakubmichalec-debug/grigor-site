# Grigor — Videography

Portfolio site for a sports videographer: an intro wall that zooms into a
showreel, a spiral of selected frames, a camera that plays the edits, and a
filterable gallery.

Built with Next.js 16 (App Router), React 19, GSAP ScrollTrigger and Lenis.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

```bash
npm run check   # types, lint, and the geometry checks for the spiral and the camera
npm run build   # production build
```

## Where things are

| Path | What it holds |
| --- | --- |
| `app/` | Routes. The homepage is `app/page.tsx`; `/gallery` is the photo grid. |
| `components/home/` | One component per homepage section, each with its stylesheet. |
| `lib/motion/` | Scroll engine, motion tokens and the spiral's geometry. |
| `lib/camera/clips.ts` | The list of edits the camera shows. |
| `public/` | Every image and video the site serves. |
| `docs/` | The motion spec the animation follows. |

## Media

Everything in `public/` was cut from the original footage and photos by the
scripts in `Jalub Website videos & photos/_header-edit/pipeline/` (see the
README beside them). The originals are not in this repository: several are
larger than GitHub accepts, and the site does not need them to run.

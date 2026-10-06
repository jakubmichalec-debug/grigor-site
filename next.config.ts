import type { NextConfig } from "next";

/*
 * Two ways to build, chosen by the environment.
 *
 * Left alone, this is the ordinary build: a server at the root of a domain,
 * resizing images as they are asked for.
 *
 * With NEXT_OUTPUT=export it is a folder of plain files instead (`out/`), which
 * is what GitHub Pages can host. Pages serves a project from /<repository>, so
 * that build also sets NEXT_PUBLIC_BASE_PATH — read here for the routes and by
 * lib/media/asset.ts for everything in /public. Images go out as they are:
 * resizing them is a server's job and there is no server.
 */
const exporting = process.env.NEXT_OUTPUT === "export";

const nextConfig: NextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  ...(exporting && {
    output: "export",
    images: { unoptimized: true },
  }),
};

export default nextConfig;

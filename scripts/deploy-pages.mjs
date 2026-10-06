/**
 * Publish the site to GitHub Pages.
 *
 *   npm run deploy
 *
 * Builds the static export for the sub-path Pages serves this repository from,
 * then commits the result to the `gh-pages` branch and pushes it. Pages is set
 * to serve that branch, so the live site updates a minute or two later.
 *
 * Nothing in the working tree or on the current branch is touched: the commit
 * is assembled from `out/` through a throwaway index.
 */
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "out");

/* stderr is kept out of the way: git uses it for line-ending notices, one per file. */
const git = (args, env = {}) =>
  execFileSync("git", args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  })
    .toString()
    .trim();

/* A project site lives at /<repository>, so the repository's name is the base path. */
const repo = path.basename(git(["remote", "get-url", "origin"]), ".git");
const basePath = `/${repo}`;

console.log(`Building for ${basePath} ...`);
fs.rmSync(out, { recursive: true, force: true });
/* Through a shell, because npx is a .cmd on Windows and only a shell can start one. */
execSync("npx next build", {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, NEXT_OUTPUT: "export", NEXT_PUBLIC_BASE_PATH: basePath },
});

/*
 * Each route's prefetch data is requested as `__next.<segments joined by dots>.txt`.
 * On Windows the export writes the nested ones with a path separator where a
 * dot belongs — `__next.gallery/__PAGE__.txt` — so every link's prefetch would
 * 404 on the live site. Put them where the page looks for them. On other
 * systems there is nothing to move.
 */
const flatten = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    if (!entry.name.startsWith("__next.")) {
      flatten(full);
      continue;
    }
    const walk = (sub, parts) => {
      for (const inner of fs.readdirSync(sub, { withFileTypes: true })) {
        const next = path.join(sub, inner.name);
        if (inner.isDirectory()) walk(next, [...parts, inner.name]);
        else fs.renameSync(next, path.join(dir, [entry.name, ...parts, inner.name].join(".")));
      }
    };
    walk(full, []);
    fs.rmSync(full, { recursive: true });
  }
};
flatten(out);

/* Without this Pages runs the files through Jekyll, which drops every folder starting with "_" — including _next. */
fs.writeFileSync(path.join(out, ".nojekyll"), "");

const index = path.join(root, ".git", "pages-index");
fs.rmSync(index, { force: true });
const staging = { GIT_INDEX_FILE: index, GIT_WORK_TREE: out };
git(["add", "--all"], staging);
const tree = git(["write-tree"], staging);
fs.rmSync(index, { force: true });

let parent = [];
try {
  git(["fetch", "--quiet", "origin", "gh-pages"]);
  parent = ["-p", git(["rev-parse", "FETCH_HEAD"])];
} catch {
  /* First deploy: the branch does not exist yet. */
}

const source = git(["rev-parse", "--short", "HEAD"]);
const commit = git(["commit-tree", tree, ...parent, "-m", `Deploy ${source}`]);
console.log(`Publishing ${commit.slice(0, 7)} to gh-pages ...`);
execFileSync("git", ["push", "origin", `${commit}:refs/heads/gh-pages`], { cwd: root, stdio: "inherit" });

const owner = git(["remote", "get-url", "origin"]).match(/github\.com[:/]([^/]+)\//)?.[1];
console.log(`\nDone. Live in a minute or two at https://${owner}.github.io${basePath}/`);

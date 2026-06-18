# Deployment Guide

WorldClock is a static site — **no build step**. Deploy the repository root as-is.

## GitHub Pages (recommended)

The repo ships [`.github/workflows/pages.yml`](../.github/workflows/pages.yml), which publishes
the site on every push to `main`.

**One-time setup:** repo **Settings → Pages → Source: GitHub Actions**. After that, every push
deploys to `https://<user>.github.io/worldclock/`.

## Other static hosts

Plain static files, so you can also deploy to:

- **Netlify / Vercel / Cloudflare Pages** — no build command; publish directory = project root.
- **Any web server / S3 bucket** — upload the files and serve `index.html`.

> The app uses ES modules, so it must be served over `http(s)` (not opened as a `file://` URL).
> `python -m http.server` or `npx serve .` both work locally.

## Local preview

```bash
python -m http.server 8000     # or: npx serve .
# open http://localhost:8000
```

## CI checks

[`ci.yml`](../.github/workflows/ci.yml) runs on every push/PR and verifies that all JS modules
parse, required files exist, and no secrets/`.env` are committed.

# Security Policy

## Reporting a Vulnerability

Please **do not open a public issue** for security problems. Email
**aashish@marketdoctorsonline.com** with a description, reproduction steps, and impact.
You'll get an acknowledgement within a few days.

## Security posture

WorldClock is safe by construction:

- **No backend, no database, no accounts** — it's a static site.
- **No data leaves your device** — all time math runs locally via the `Intl` API. The only
  network request is loading the UI web font.
- **No secrets** — there are no API keys or credentials anywhere in this repo.
- **XSS-safe** — the city dataset is static and trusted; user input is limited to search text
  that filters that list (never injected as HTML).
- **No third-party runtime dependencies**, no `eval`, no remote code.

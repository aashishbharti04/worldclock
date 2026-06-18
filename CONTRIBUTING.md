# Contributing to WorldClock

Thanks for helping make global scheduling painless! 🌍 Adding cities is the easiest contribution.

## Development setup

No build step, no dependencies:

```bash
git clone https://github.com/aashishbharti04/worldclock
cd worldclock
python -m http.server 8000     # or: npx serve .
# open http://localhost:8000
```

Edit files and refresh. (ES modules require an `http(s)` origin — don't open `index.html` as a `file://`.)

## Project layout

| File | Responsibility |
|------|----------------|
| `assets/js/cities.js` | The city → IANA timezone dataset + `flagEmoji()`. |
| `assets/js/tz.js` | All timezone math via `Intl` (offsets, zoned parts, formatting, midnight instant). |
| `assets/js/app.js` | State, live clocks, the meeting-planner overlap logic, search, theme. |
| `assets/css/style.css` | Design system, clocks grid, and the planner grid. |

## Add a city

Append one entry to `CITIES` in `cities.js`:

```js
{ city: "Oslo", country: "Norway", cc: "NO", tz: "Europe/Oslo" },
```

- `tz` must be a valid **IANA** zone (e.g. `Europe/Oslo`, `America/Sao_Paulo`).
- `cc` is the ISO-3166 alpha-2 country code (drives the flag emoji).
- Keep the list roughly ordered west → east.

## Ground rules

- **Stay dependency-free and build-free** — vanilla HTML/CSS/JS only.
- **Use `Intl` for all time math** — never hardcode UTC offsets (they break with DST).
- **Keep everything client-side** — no servers, analytics, or external time APIs.

## Pull requests

1. Fork → feature branch.
2. Test in dark **and** light mode, on a narrow viewport, and verify the planner overlap looks right.
3. Open a PR using the template.

By contributing you agree your work is licensed under the [MIT License](LICENSE).

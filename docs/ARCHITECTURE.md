# Architecture

WorldClock is a **zero-dependency, fully client-side** app. The interesting part is doing
accurate, DST-aware timezone math with **no library and no data file** — by leaning on the
browser's built-in IANA database through the `Intl` API.

```
        cities.js  ──►  app.js  ◄──  tz.js
       (city → IANA)   (state, UI)  (Intl math)
                          │
              ┌───────────┼────────────┐
              ▼           ▼            ▼
        live clocks   planner grid   best windows
```

## Timezone math (`tz.js`)

Everything derives from one primitive — the **wall-clock parts** of an instant in a zone:

```js
new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", ... }).formatToParts(date)
```

From that we build:

- **`offsetMinutes(tz, date)`** — reconstruct the zone's wall time as if it were UTC
  (`Date.UTC(parts…)`) and subtract the real instant; the difference is the offset (DST-correct).
- **`zonedParts(tz, instant)`** — the year/month/day/hour for any instant in any zone.
- **`midnightInstant(tz, now)`** — the UTC instant of "today's midnight" in a zone, used as the
  planner's column origin.

Because the offsets come from the browser's timezone database, **DST is handled automatically** —
no rules to maintain.

## Meeting planner (`app.js`)

1. Pick a **reference** city (the first in your list). Compute its midnight instant.
2. Build 24 column instants: `midnight + h hours`, `h = 0…23`.
3. For each column, get every city's local hour via `zonedParts` and check it's within working
   hours. A column where **all** cities qualify is an **overlap**.
4. Render a grid (cities × 24 hours), color cells working/off, mark overlaps, the current hour,
   and a pinned hour. Consecutive overlap columns become the **best meeting windows**.

## Why these decisions

- **`Intl` over a TZ library** keeps the app at literally zero KB of dependencies while staying
  accurate and DST-aware — the OS already ships the database.
- **Reference-relative columns** make the planner intuitive: you read it in *your* hours.
- **localStorage persistence** means your cities and preferences are there when you return.

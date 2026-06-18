# Changelog

All notable changes to this project are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/); versioning follows [SemVer](https://semver.org/).

## [1.0.0] — 2026-06-18

### Added
- **Initial release** of WorldClock — time zones & meeting planner, 100% client-side.
- **Live world clocks** for ~65 major cities (searchable by city/country, with flag emoji),
  showing current time, date, day/night, and UTC offset, updating in real time.
- **Meeting planner**: a 24-hour grid that highlights overlapping working hours across all
  selected cities, with a **Best meeting windows** summary and a **pin-an-hour** detail view.
- Set any city as the **reference**; adjustable **working hours**; **12/24-hour** toggle.
- Accurate, **DST-aware** time math via the browser's `Intl` IANA timezone database.
- **Dark/light** mode; cities and settings persist in `localStorage`.
- Zero dependencies, zero build step; nothing leaves the browser.
- Open-source project files: README, MIT LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY,
  issue/PR templates, ARCHITECTURE & DEPLOYMENT docs, and CI + GitHub Pages workflows.

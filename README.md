# Weather App

A vanilla HTML / CSS / JS weather application built as part of [The Odin
Project](https://www.theodinproject.com/) curriculum. No build step, no
dependencies.

## Stack

- Plain HTML5, CSS3, and ES2020 JavaScript
- [Open-Meteo](https://open-meteo.com/) for geocoding + forecast data
  (no API key required)
- [erikflowers/weather-icons](https://github.com/erikflowers/weather-icons)
  via the jsDelivr CDN for the icon set

## Features

- Search any city in the world
- Current temperature, "feels like", humidity, wind speed, condition summary
- 7-day forecast with high/low temperatures and condition icons
- °C / °F unit toggle (re-runs the last search)
- Loading spinner during fetch
- Accessible form (`<label>`, `aria-live`-friendly error region, `hidden`
  toggles)

## Getting started

Open [`index.html`](index.html) in a browser. That's it.

```bash
# Or serve locally with any static server, e.g.:
python3 -m http.server 8000
# then visit http://localhost:8000
```

## File layout

```
weather-app/
├── index.html      # markup, links to CSS / JS
├── styles.css      # dark-theme styling
├── script.js       # fetch + processing + DOM rendering
├── .gitignore
└── README.md
```

## Architecture

The script is split into small, testable sections:

| Section | Responsibility |
| --- | --- |
| `getCoordinates(location)` | Hit the geocoding API, return the best match |
| `getWeather(lat, lon, unit)` | Hit the forecast API for current + 7 days |
| `WMO_CODES` + `describeCode` | Map WMO weather codes to human labels |
| `processWeatherData(place, raw)` | Shape the raw payload into a slim object |
| `renderWeather(weather)` | Push the slim object into the DOM |
| `handleSearch(location)` | Orchestrate the three steps above |

## License

MIT
/* =====================================================================
 * Weather App — vanilla JS, no build step
 *
 * API: Open-Meteo (no key required)
 *   - Geocoding: https://geocoding-api.open-meteo.com/v1/search
 *   - Forecast:  https://api.open-meteo.com/v1/forecast
 * ===================================================================== */

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

// ---------- 1. API call functions -----------------------------------

/**
 * Look up coordinates for a place name via Open-Meteo Geocoding.
 * @param {string} location - free-form city name
 * @returns {Promise<{name: string, country: string, admin1?: string,
 *                    latitude: number, longitude: number}>}
 */
async function getCoordinates(location) {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(location)}&count=1`;
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) {
    throw new Error(`Geocoding failed (${response.status})`);
  }
  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    throw new Error(`Location not found: "${location}"`);
  }
  console.log("[getCoordinates] raw:", data.results[0]);
  return data.results[0];
}

/**
 * Fetch current weather + 7-day forecast for given coordinates.
 * @param {number} latitude
 * @param {number} longitude
 * @param {"celsius"|"fahrenheit"} unit
 * @returns {Promise<object>} raw Open-Meteo forecast payload
 */
async function getWeather(latitude, longitude, unit = "celsius") {
  const tempUnit = unit === "fahrenheit" ? "fahrenheit" : "celsius";
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature," +
      "is_day,weather_code,wind_speed_10m",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min," +
      "sunrise,sunset,precipitation_probability_max",
    timezone: "auto",
    temperature_unit: tempUnit,
    wind_speed_unit: "kmh",
    forecast_days: "7",
  });
  const url = `${FORECAST_URL}?${params.toString()}`;
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) {
    throw new Error(`Forecast fetch failed (${response.status})`);
  }
  const data = await response.json();
  console.log("[getWeather] raw:", data);
  return data;
}

// ---------- 2. Data-processing functions ----------------------------

/** WMO weather code -> { label, icon } mapping.
 *  Codes: https://open-meteo.com/en/docs#weathervariables
 */
const WMO_CODES = {
  0:  { label: "Clear sky",                 icon: "sunny" },
  1:  { label: "Mainly clear",              icon: "sunny" },
  2:  { label: "Partly cloudy",             icon: "partly-cloudy" },
  3:  { label: "Overcast",                  icon: "cloudy" },
  45: { label: "Fog",                       icon: "fog" },
  48: { label: "Depositing rime fog",       icon: "fog" },
  51: { label: "Light drizzle",             icon: "drizzle" },
  53: { label: "Moderate drizzle",          icon: "drizzle" },
  55: { label: "Dense drizzle",             icon: "drizzle" },
  56: { label: "Light freezing drizzle",    icon: "sleet" },
  57: { label: "Dense freezing drizzle",    icon: "sleet" },
  61: { label: "Slight rain",               icon: "rainy" },
  63: { label: "Moderate rain",             icon: "rainy" },
  65: { label: "Heavy rain",                icon: "rainy" },
  66: { label: "Light freezing rain",       icon: "sleet" },
  67: { label: "Heavy freezing rain",       icon: "sleet" },
  71: { label: "Slight snow",               icon: "snowy" },
  73: { label: "Moderate snow",             icon: "snowy" },
  75: { label: "Heavy snow",                icon: "snowy" },
  77: { label: "Snow grains",               icon: "snowy" },
  80: { label: "Slight rain showers",       icon: "rainy" },
  81: { label: "Moderate rain showers",     icon: "rainy" },
  82: { label: "Violent rain showers",      icon: "rainy" },
  85: { label: "Slight snow showers",       icon: "snowy" },
  86: { label: "Heavy snow showers",        icon: "snowy" },
  95: { label: "Thunderstorm",              icon: "thunderstorm" },
  96: { label: "Thunderstorm with hail",    icon: "thunderstorm" },
  99: { label: "Thunderstorm with heavy hail", icon: "thunderstorm" },
};

function describeCode(code) {
  return WMO_CODES[code] || { label: "Unknown", icon: "cloudy" };
}

/**
 * Shape the Open-Meteo forecast payload into the slim object the UI needs.
 * @param {object} place - { name, country, admin1, latitude, longitude }
 * @param {object} raw  - raw forecast payload from getWeather()
 * @returns {{ place: object, current: object, daily: Array }}
 */
function processWeatherData(place, raw) {
  const c = raw.current;
  const d = raw.daily;
  const currentCode = describeCode(c.weather_code);

  const current = {
    temperature: Math.round(c.temperature_2m),
    feelsLike: Math.round(c.apparent_temperature),
    humidity: c.relative_humidity_2m,
    windSpeed: c.wind_speed_10m,
    summary: currentCode.label,
    iconName: currentCode.icon,
    iconUrl: iconUrlFor(currentCode.icon, c.is_day === 1),
    isDay: c.is_day === 1,
    unit: raw.current_units.temperature_2m,
  };

  const daily = d.time.map((iso, i) => {
    const code = describeCode(d.weather_code[i]);
    return {
      date: iso,
      dayName: formatDayName(iso),
      summary: code.label,
      iconName: code.icon,
      iconUrl: iconUrlFor(code.icon, true),
      high: Math.round(d.temperature_2m_max[i]),
      low: Math.round(d.temperature_2m_min[i]),
      precipChance: d.precipitation_probability_max?.[i] ?? null,
      unit: raw.daily_units.temperature_2m_max,
    };
  });

  return { place, current, daily };
}

/**
 * Build a weather-icons URL using the erikflowers/weather-icons set
 * served via jsDelivr (public CDN, no key required).
 * Icons are monochrome SVGs — `styles.css` colors them.
 */
function iconUrlFor(iconName, isDay) {
  // WMO summary -> day/night-neutral erikflowers slug
  const dayMap = {
    sunny: "wi-day-sunny",
    "partly-cloudy": "wi-day-cloudy",
    cloudy: "wi-cloudy",
    fog: "wi-day-fog",
    drizzle: "wi-day-sprinkle",
    rainy: "wi-day-rain",
    sleet: "wi-day-sleet",
    snowy: "wi-day-snow",
    thunderstorm: "wi-day-thunderstorm",
  };
  const nightMap = {
    sunny: "wi-night-clear",
    "partly-cloudy": "wi-night-alt-cloudy",
    cloudy: "wi-night-alt-cloudy",
    fog: "wi-night-fog",
    drizzle: "wi-night-sprinkle",
    rainy: "wi-night-alt-rain",
    sleet: "wi-night-alt-sleet",
    snowy: "wi-night-alt-snow",
    thunderstorm: "wi-night-alt-thunderstorm",
  };
  const slug = (isDay ? dayMap : nightMap)[iconName] || "wi-cloudy";
  return `https://cdn.jsdelivr.net/gh/erikflowers/weather-icons@master/svg/${slug}.svg`;
}

/** "2026-06-26" -> "Friday" (today: "Today") */
function formatDayName(iso) {
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return "Today";
  return d.toLocaleDateString(undefined, { weekday: "long" });
}

// ---------- 3. DOM rendering ---------------------------------------

function renderWeather(weather) {
  const { place, current, daily } = weather;

  // Current
  document.getElementById("place-name").textContent =
    [place.name, place.admin1, place.country].filter(Boolean).join(", ");
  document.getElementById("current-temp-value").textContent =
    `${current.temperature}°${current.unit === "°F" ? "F" : "C"}`;
  document.getElementById("current-summary").textContent = current.summary;
  document.getElementById("current-icon").src = current.iconUrl;
  document.getElementById("current-icon").alt = current.summary;
  document.getElementById("current-feels").textContent =
    `${current.feelsLike}°${current.unit === "°F" ? "F" : "C"}`;
  document.getElementById("current-humidity").textContent = `${current.humidity}%`;
  document.getElementById("current-wind").textContent = `${current.windSpeed} km/h`;
  document.getElementById("current-weather").hidden = false;

  // Forecast
  const cards = document.getElementById("forecast-cards");
  cards.innerHTML = "";
  daily.forEach((day) => {
    const card = document.createElement("div");
    card.className = "forecast-card";
    card.innerHTML = `
      <div class="day">${day.dayName}</div>
      <div class="date">${new Date(day.date + "T00:00:00")
        .toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
      <img src="${day.iconUrl}" alt="${day.summary}" />
      <div class="temps">
        <span class="high">${day.high}°</span>
        <span class="low">${day.low}°</span>
      </div>
    `;
    cards.appendChild(card);
  });
  document.getElementById("forecast").hidden = false;
}

function showError(message) {
  const el = document.getElementById("error");
  el.textContent = message;
  el.hidden = false;
}

function clearError() {
  const el = document.getElementById("error");
  el.textContent = "";
  el.hidden = true;
}

function setLoading(isLoading) {
  const el = document.getElementById("loading");
  el.hidden = !isLoading;
  // Disable form while loading
  document.getElementById("search-form")
    .querySelectorAll("input, button")
    .forEach((node) => {
      node.disabled = isLoading;
    });
}

// ---------- 4. Orchestration --------------------------------------

let currentUnit = "celsius"; // "celsius" | "fahrenheit"

async function handleSearch(location) {
  clearError();
  document.getElementById("current-weather").hidden = true;
  document.getElementById("forecast").hidden = true;
  setLoading(true);
  try {
    const coords = await getCoordinates(location);
    const place = {
      name: coords.name,
      country: coords.country,
      admin1: coords.admin1,
      latitude: coords.latitude,
      longitude: coords.longitude,
    };
    const raw = await getWeather(place.latitude, place.longitude, currentUnit);
    const weather = processWeatherData(place, raw);
    console.log("[handleSearch] processed:", weather);
    renderWeather(weather);
  } catch (err) {
    console.error(err);
    showError(err.message || "Something went wrong.");
  } finally {
    setLoading(false);
  }
}

// ---------- 5. Wire up form ----------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("search-form");
  const input = document.getElementById("location-input");
  const unitBtn = document.getElementById("unit-toggle");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    handleSearch(value);
  });

  unitBtn.addEventListener("click", () => {
    currentUnit = currentUnit === "celsius" ? "fahrenheit" : "celsius";
    unitBtn.textContent = currentUnit === "celsius" ? "°C" : "°F";
    // Re-run last search if we have one
    const last = input.value.trim();
    if (last) handleSearch(last);
  });
});
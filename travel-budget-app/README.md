# Travel Budget Estimator

A small static web app that answers one question: *roughly how much money do I need for this trip?*

Pick a country, a travel style, how many nights and how many travellers, and it gives you a total
estimate broken down by category — accommodation, food and drink, local transport, activities, and
the miscellaneous stuff (SIM cards, laundry, tips) — plus flights and a daily average. Costs are
shown in US dollars and, approximately, in the destination's own currency.

It covers **60 countries**: the ten most-visited in each of Africa, Asia, Europe, North America
(including Central America and the Caribbean), South America and Oceania.

## What it is (and isn't)

- **Static.** Plain HTML, CSS and JavaScript. No backend, no database, no build step, no frameworks,
  no CDN links, no analytics. Once the page is open it makes no network requests at all.
- **Read-only.** Nothing you type is saved or sent anywhere. Your selections live in the page URL
  and nowhere else.
- **Ballpark.** The figures are estimates, last reviewed **2026-09-04**. See
  [Where the numbers come from](#where-the-numbers-come-from).

## Running it locally

**Try double-clicking `index.html` first.** In Safari and Firefox it will usually just work.

In Chrome and Edge it probably won't: those browsers refuse to let a page opened from a `file://`
address read a local file with `fetch()`, and this app loads its cost data from
`data/countries.json`. You'll see an on-page message explaining this. That restriction is a browser
security rule, not a bug in the app, and the fix is one line:

```
python3 -m http.server
```

Run that from inside the `travel-budget-app` folder, then open <http://localhost:8000> in your
browser. That's it — nothing is installed, nothing is downloaded, and nothing leaves your machine.
Press `Ctrl+C` in the terminal to stop it when you're done.

(Any static file server works: `npx serve`, `php -S localhost:8000`, VS Code's Live Server
extension. `python3 -m http.server` is just the one you almost certainly already have.)

## How to edit the cost figures

All the data lives in **`data/countries.json`**. Open it in any text editor — TextEdit, Notepad, VS
Code — change a number, save, and reload the page in your browser. There is nothing to rebuild or
recompile.

Each country looks like this:

```json
{
  "name": "Peru",
  "continent": "South America",
  "iso": "PE",
  "currency": "PEN",
  "currency_name": "Peruvian sol",
  "usd_to_local": 3.75,
  "daily_costs": {
    "backpacker": { "accommodation": 12, "food_and_drink": 10, "local_transport": 6, "activities": 12, "miscellaneous": 5 },
    "budget":     { "accommodation": 30, "food_and_drink": 20, "local_transport": 12, "activities": 25, "miscellaneous": 7 },
    "midrange":   { "accommodation": 75, "food_and_drink": 40, "local_transport": 25, "activities": 55, "miscellaneous": 10 },
    "luxury":     { "accommodation": 230, "food_and_drink": 95, "local_transport": 70, "activities": 130, "miscellaneous": 18 }
  },
  "flights_usd": { "europe": 850, "north_america": 650, "asia_pacific": 1500 },
  "notes": [
    "May-September is the Andean dry season and the trekking window; the coast is best December-March.",
    "Machu Picchu tickets and the Inca Trail sell out months ahead and are a large one-off cost on top of the daily figures."
  ]
}
```

What each field means:

| Field | Meaning |
| --- | --- |
| `daily_costs` | **US dollars, per person, per day.** Four tiers, five categories each. |
| `flights_usd` | **US dollars for one round-trip ticket per person**, from each departure region. |
| `usd_to_local` | How many units of the local currency one US dollar buys. |
| `notes` | Short practical points shown under the results. One or two per country. |

A few rules to keep things sensible if you edit:

- Keep all numbers **positive whole numbers**.
- Keep the four tiers **increasing** — luxury should cost more than mid-range in every category.
- Don't add false precision. Daily figures are rounded to the nearest 5 dollars, flights to the
  nearest 25.
- Don't rename the keys (`accommodation`, `midrange`, `europe`, and so on) — the app looks for those
  exact names.

The travel tiers themselves:

| Tier | What it assumes |
| --- | --- |
| **Backpacker** | Hostel dorms, street food and self-catering, public buses, mostly free activities |
| **Budget** | Private hostel rooms or cheap guesthouses, local restaurants, the occasional taxi, some paid attractions |
| **Mid-range** | 3-star hotels or good Airbnbs, a mix of restaurants, comfortable transport, regular paid activities |
| **Luxury** | 4/5-star hotels, fine dining, private transfers and domestic flights, premium tours |

## How the total is worked out

```
total = (each daily category × travellers × nights) + (flight cost × travellers)
```

with two wrinkles:

- **Room sharing.** If you tick "sharing rooms", the app prices one room per two travellers at about
  1.4× the listed per-person rate — a double room costs more than a single but far less than two
  singles, so each person pays roughly 30% less. This doesn't apply to the Backpacker tier, where a
  dorm bed is already a per-person price.
- **Daily average.** The "per day" figure excludes flights, since a flight isn't a daily expense. The
  headline total includes them.

Displayed amounts are rounded to the nearest 5 dollars per category, so the parts may not add up to
the penny. That's deliberate — a total accurate to the dollar would be pretending to a precision
these estimates don't have.

## Where the numbers come from

**General knowledge of typical published cost-of-travel ranges** — the sort of figures that appear
consistently across travel guides, budget-travel blogs and cost-of-living comparisons. They are
**not** pulled from a live pricing API, a booking site, or anyone's actual receipts, and the app
makes no network calls to fetch them.

The exchange rates in `usd_to_local` are likewise **approximate rates from general knowledge, fixed
in the data file and labelled "as of 2026-09-04"**. They are not looked up live and they will drift —
sometimes fast. For a handful of countries the rate is genuinely unstable (Argentina, Turkey,
Venezuela, Cuba, Egypt), and the local-currency figures for those should be treated as illustrative
only. The US dollar amounts are the more reliable half of every conversion here.

**Sanity-check anything here before you book.** These are national averages across a whole tier of
travel. A single city, a single week, a festival or a school holiday can be a long way from the
average — Cartagena is not Bogotá, London is not Newcastle, and Rio at Carnival is not Rio in May.
Use this to decide whether a trip is roughly plausible, then check real listings for real dates.

Flight estimates deserve their own warning: they vary enormously by origin airport, booking window
and season. That's why the app asks for a broad **departure region** (Europe / North America /
Asia-Pacific) rather than pretending to quote a fare from your specific airport.

## Files

```
travel-budget-app/
├── index.html          the page
├── css/styles.css      all styling, including a print stylesheet
├── js/app.js           the picker, the maths and the rendering
├── data/countries.json all 60 countries — this is the file to edit
└── README.md           this file
```

## Extras

- **Compare two countries.** Pick a second country at the bottom of the form to see both side by
  side under the same trip settings.
- **Drop-a-tier hint.** Each result shows what the same trip would cost one tier down, and what you'd
  save.
- **Shareable link.** The URL updates as you change the options, so you can copy it to someone and
  they'll see exactly your settings. The "Copy shareable link" button does it for you.
- **Print friendly.** Printing (or saving to PDF) drops the form and prints just the results.
- **Dark mode.** Follows your system setting.

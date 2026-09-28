# CompShopper

CompShopper is a web-based price comparison tool for consumer electronics: smartphones, smart
watches, tablets, laptops, PC parts (CPUs, GPUs, memory, storage, motherboards, power supplies),
monitors, headphones and game consoles. It searches retailers **live at query time**, so the
prices you see are as fresh as the retailers' own pages.

## How it works

1. You pick an **item category** and fill in any attributes you care about: manufacturer, model
   number, storage, colour, carrier, case size, VRAM, wattage, etc. Every blank field means
   "any".
2. The server builds a search string from the filled-in fields and queries every enabled retailer
   in parallel (Newegg, eBay, Best Buy, Walmart, Micro Center).
3. Each retailer's results are parsed and normalised into a common shape: price, shipping,
   was-price, device name, model number, manufacturer, condition, and **pricing notes** such as
   "Bundle", "Activation / carrier plan required", "Trade-in offer", "Promo / coupon",
   "Financing offer", "Refurbished", "Third-party marketplace seller".
4. Listings are filtered against your attributes (128GB matches "128 GB", 44mm matches "44 mm",
   "WD" matches "Western Digital", accessories such as cases are dropped unless you asked for
   them) and returned sorted by price + shipping.
5. The results table is **sortable and filterable by every column**: Price, Device, Model number,
   Manufacturer, Seller website (linked to the product page), Pricing notes. A per-retailer status
   bar shows which sites answered, how many offers each returned, and which were blocked.

Results are cached for five minutes (configurable) so repeated searches are instant. The
**Refresh prices** button always fetches live.

## Quick start

```bash
npm install
npm run dev          # API on http://localhost:3001, web UI on http://localhost:5173
```

Production build (single process serving API + static UI):

```bash
npm run build
npm start            # http://localhost:3001
```

## Deploy on a Linux server with Docker

The repo ships a multi-stage `Dockerfile` (Node 22 Alpine, non-root user, health check) and a
`docker-compose.yml`. Requirements on the server: Docker Engine with the Compose plugin
(`docker compose version` should print a version) and git.

```bash
# 1. Get the code
git clone https://github.com/mcgrawja1/thegame.git compshopper
cd compshopper

# 2. Configure (API keys, proxy, Micro Center store, host port)
cp .env.example .env
nano .env

# 3. Build the image and start the container in the background
docker compose up -d --build

# 4. Check it
docker compose ps
docker compose logs -f compshopper
curl http://localhost:3001/api/health
```

Open `http://<server-ip>:3001` in a browser. The container restarts automatically after a
reboot (`restart: unless-stopped`). Set `COMPSHOPPER_PORT=8080` in `.env` to publish on a
different host port.

Day-to-day commands:

```bash
docker compose logs -f          # follow logs
docker compose restart          # restart (e.g. after editing .env)
docker compose down             # stop and remove the container
git pull && docker compose up -d --build   # update to the latest code
```

To put it behind HTTPS, point a reverse proxy (Caddy, Nginx Proxy Manager, Traefik) at port
3001 on the server; the app is a single HTTP service with no other ports.

Plain Docker without Compose:

```bash
docker build -t compshopper .
docker run -d --name compshopper --restart unless-stopped -p 3001:3001 --env-file .env compshopper
```

Tests (parsers against recorded-style fixtures, normaliser, matcher, API):

```bash
npm test
```

## Configuration

Copy `.env.example` and export the variables you need. The important ones:

| Variable | Purpose |
| --- | --- |
| `BESTBUY_API_KEY` | Use Best Buy's official Products API instead of scraping (much more reliable). |
| `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` | Use eBay's Browse API instead of scraping search pages. |
| `SCRAPER_PROXY_URL` | Send retailer requests through a proxy (residential proxies drastically reduce bot blocks). |
| `MICROCENTER_STORE_ID` | Micro Center prices are per store; pick yours. |
| `CACHE_TTL_SECONDS` | How long to reuse a result before re-scraping (default 300). |
| `COMPSHOPPER_DISABLE_<SOURCE>=1` | Turn a retailer off. |
| `COMPSHOPPER_DEMO=1` | Add a **fabricated** sample-data source so the UI can be exercised offline. Never use in production. |

## A note on scraping reliability

Large retailers actively block automated traffic. CompShopper sends browser-like headers,
retries once, detects challenge pages and reports each retailer's status honestly rather than
silently showing stale or missing data. In practice:

- **Best Buy** and **eBay** should be used through their official APIs (free developer keys).
- **Walmart** and **Newegg** work from residential IPs most of the time and are frequently
  blocked from cloud/data-centre IPs; a proxy (`SCRAPER_PROXY_URL`) helps.
- **Micro Center** is generally scrapable; prices are per store.

The retailer parsers were written against each site's current search-page markup and are
covered by fixture tests in `server/test/fixtures`. When a retailer changes its markup, update
the corresponding parser in `server/src/sources/` and its fixture.

## Adding a retailer

Create `server/src/sources/<name>.ts` implementing `SourceAdapter` (see `types.ts`): build the
search URL, fetch with `fetchText`/`fetchJson`, and return `RawListing[]`. Register it in
`server/src/sources/index.ts` and add its id to `SourceId` in `shared/src/types.ts`. Everything
else (normalisation, attribute matching, pricing notes, sorting, caching, UI) is shared.

## Adding a category or attribute

Categories live in `shared/src/categories.ts`. Each field declares how it is matched (`text`,
`capacity`, `size`, `exact`) and whether it is added to the retailer search string. The search
form renders the fields automatically.

## Project layout

```
shared/   types + category catalogue shared by server and web
server/   Express API, retailer adapters, normaliser, matcher, cache, tests
web/      React + Vite client (search form, sortable/filterable results table)
```

## API

- `POST /api/search` with a JSON `SearchQuery` (see `shared/src/types.ts`), or
  `GET /api/search?category=smartphone&manufacturer=Apple&attr[storage]=256GB&sources=newegg,ebay`
- `GET /api/sources` – retailer availability
- `GET /api/categories` – category catalogue
- `POST /api/cache/clear`

# HOSTELL web

The public website for HOSTELL: browse hostel and PG listings, view a property, and learn about the app. It is
read-only and has no sign-in. Built with Next.js (App Router), React and TypeScript.

Listings are read on the server from the Firestore `publicListings` collection (only documents with `listed == true`)
and returned through a small allowlist, so owner IDs, contact details and street-level locations are never exposed.

## Pages and API

| Route | Purpose |
| --- | --- |
| `/` | Home: hero search, property grid with city filter, mission, app promo |
| `/properties/[id]` | Property detail: photo slideshow, rooms, amenities, similar stays |
| `/about` | About HOSTELL |
| `GET /api/public/properties?limit=12&cursor=…` | Paginated listings (`limit` 1 to 24) |
| `GET /api/public/properties/[id]` | One listed property |

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the Firebase values
npm run dev                  # http://localhost:3000
```

### Environment variables

All are server-only except the download URL. See `.env.example` for details.

- `FIREBASE_PROJECT_ID`: the Firebase project that holds `publicListings`.
- `FIREBASE_SERVICE_ACCOUNT_PATH`, or `FIREBASE_CLIENT_EMAIL` with `FIREBASE_PRIVATE_KEY`: credentials for local development.
  On Google Cloud, leave these unset and Application Default Credentials are used.
- `PUBLIC_LISTINGS_CACHE_SECONDS`: CDN cache time for listing pages (default 60, max 3600).
- `SITE_URL`: the public address of the deployed site (for example `https://www.example.com`). It sets canonical links, social
  previews, structured data, `robots.txt` and `sitemap.xml`. Set it in production; it falls back to `http://localhost:3000`.
- `NEXT_PUBLIC_APP_DOWNLOAD_URL`: destination for the "Download the app" buttons. While unset, the site shows "Coming soon".

Never commit `.env.local` or a service-account key.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (Vitest) |

## Layout

```
src/app/          routes, layout, global styles, API route handlers
src/components/   home, properties, property-detail and about sections, header and footer
src/lib/          Firebase Admin setup and the listings query, serialization and formatting code
src/styles/       design tokens
tests/            Vitest tests
```

# foodprice

What does your food actually cost? Paste a product link from **Willys** or **ICA** (or search Willys by name) and
foodprice reads the price, the member offer and the nutrition. Combine products in the calculator or save them as
recipes to see:

- **Cost of what you use** (your share of each package) and the **shopping bill** (whole packages at the till)
- **Regular vs member price**: Willys Plus / ICA Stammis offers shown as a separate calculation
- **Per portion** cost, calories, protein, fat and carbs
- Value metrics per product: **kr/kg**, **kr per 100 kcal**, **kr per 10 g protein**

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The SQLite database is created automatically in `data/foodprice.db` (override with
`DATABASE_PATH`). On an empty install, “Load an example pantry” imports six real Willys products.

| Script               | What it does                                 |
| -------------------- | -------------------------------------------- |
| `npm run dev`        | Dev server                                   |
| `npm test`           | Unit tests (parsers against real store JSON, cost/macro maths) |
| `npm run typecheck`  | TypeScript                                   |
| `npm run lint`       | ESLint                                       |
| `npm run build`      | Production build (`output: standalone`)      |
| `npm run db:generate`| Generate a migration after editing `src/lib/db/schema.ts` |

## How prices are read

No HTML scraping. Both stores' websites are backed by JSON APIs, and foodprice calls those directly:

- **Willys**: `GET /axfood/rest/p/{code}` for product, price, `potentialPromotions` (with `campaignType: LOYALTY`
  for Willys Plus) and per‑100 g nutrition. `GET /search/clean?q=` for search.
- **ICA**: `GET /stores/{storeId}/api/webproductpagews/v5/products/bop?retailerProductId={id}` for price, unit price,
  promotions (member deals are marked “Stammispris”) and a nutrition table. Prices are per store, and the store
  comes from the link.

These are unofficial and can change; the parsers are covered by tests against saved real responses in
`src/lib/stores/__fixtures__`.

### ICA's bot protection

ICA's site sits behind AWS WAF, which lets a few automated requests through and then answers with a challenge for a
few minutes. foodprice spaces out refreshes and reports a clear error when that happens. The reliable path is the
**ICA browser helper** (`/ica-helper`): a bookmarklet that reads the product inside your own browser session on
ICA's page and hands it to foodprice via `postMessage` (origin-checked on both sides).

## Architecture

- **Next.js 16** (App Router, React 19, Turbopack) with **Tailwind CSS v4**
- **SQLite** via **Drizzle ORM** (`better-sqlite3`), migrations in `drizzle/` applied on startup
- `src/lib/domain`: pure pricing/macro maths shared by server and client (`calc.ts`)
- `src/lib/stores`: one adapter per store, normalizing into a common `ProductData`
- `src/lib/repo`: data access · `src/app/api`: route handlers (zod-validated, JSON-only)

User edits to store products (e.g. correcting a package size) are recorded as overrides and survive price refreshes.

### Hosting on Azure later

The build uses `output: "standalone"`, which runs on Azure App Service or Container Apps as-is. Before going public:

1. **Database**: SQLite on local disk won't survive scale-out. Move to Azure Database for PostgreSQL (switch the
   Drizzle dialect; the schema is small) or Azure SQL.
2. **Auth**: there is none; it's a single-user local tool. Add Entra ID / App Service Authentication and scope
   data per user.
3. **ICA from a datacenter IP** will be challenged far more often; the bookmarklet becomes the primary ICA path
   (it would then post to the deployed origin).

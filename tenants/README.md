# Tenant packs

Fork & Flame, the default tenant, lives in `client/src/tenants/forkandflame`. Any other restaurant
is a **private pack**: its own git repository, checked out here as `tenants/<id>/`. This folder is
ignored by the public repository (except this file), so a restaurant's name, menu, text and photos
never enter its history (ADR-036).

```
tenants/<id>/
  client/index.ts     exports `tenant: Tenant` (client/src/brand/types.ts)
  client/*.tsx        its own landing and pages, if any (import the app as `@client/...`)
  client/tsconfig.json  { "extends": "../../../client/tsconfig.json", "include": ["."] }
  site.json           { "title", "lang", "dir", "theme", "head"? } for the first paint
  assets/             photos, served at /tenants/<id>/ and copied only into its build
  server/index.ts     exports `tenant: SeedTenant` (server/prisma/seed/tenants/types.ts)
  server/tsconfig.json  { "extends": "../../../server/tsconfig.json", "include": ["."] }
  e2e/*.spec.ts       its Playwright specs, with an e2e/tsconfig.json like the others
```

- **Build and seed:** `VITE_TENANT=<id>` and `SEED_TENANT=<id>` (see the README's Tenants section).
- **Pages are loaders.** `home` and `pages.{about,branches,contact}` are
  `() => import('./X').then((m) => m.X)`, so the tenant module imports nothing from the app at run
  time. Branches and contact fall back to the generic pages; about has none.
- **Checks.** With a pack checked out, `npm run check` lints, type-checks and tests it too, and
  `VITE_TENANT=<id> npm run e2e` runs its specs.
- **Never** copy a pack's files, names or photos into the public repository, its docs or its tests.

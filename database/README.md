# sdkwork-agentstudio Database

This directory is the database lifecycle asset directory for the **sdkwork-agentstudio** application.

It follows the SDKWork database framework standard defined in:

- `../sdkwork-specs/DATABASE_FRAMEWORK_SPEC.md` (L0 standard)
- `../sdkwork-database/specs/DATABASE_FRAMEWORK_STANDARD.md` (L1 executable profile)

## Owner

- Module ID: `sdkwork-agentstudio`
- Service Code: `agentstudio`
- Owner team: `sdkwork-agentstudio`

## Engines

- Primary: `sqlite` (desktop/standalone mode)
- Secondary: `postgres` (cloud/shared deployments)

The application ships engine-separated migrations under `migrations/{engine}/` so the
same lifecycle model works for both SQLite (embedded desktop driver) and PostgreSQL
(shared server deployments).

## Layout

```text
database/
  README.md                    <- this file
  database.manifest.json       <- lifecycle manifest (module identity, paths, policy)
  contract/
    schema.yaml                <- portable schema contract (expected tables/columns)
    prefix-registry.json       <- owned table prefixes
    table-registry.json        <- owned tables
  migrations/
    postgres/                  <- PostgreSQL forward/backward migrations
    sqlite/                    <- SQLite forward/backward migrations
  seeds/
    seed.manifest.json         <- seed locale/profile plan
    common/                    <- language-neutral reference data
    locales/
      zh-CN/                   <- default locale seed data
  drift/
    policy.yaml                <- drift observation policy
```

## Bootstrap And Verification

The application consumes these assets through the `sdkwork-database` lifecycle
orchestrator and `DefaultDatabaseModule` SPI. Standard commands (per
`PNPM_SCRIPT_SPEC.md` and the L1 profile) are expected to be wired at the
application root:

```bash
pnpm run db:validate   # validate manifests, contracts, directories, naming
pnpm run db:plan       # show pending migrations, seed plans, drift summary
pnpm run db:migrate    # apply pending migrations
pnpm run db:seed       # apply seed plan for selected locale/profile
pnpm run db:status     # print lifecycle/installation state
pnpm run db:drift      # print drift report
```

The CLI backing implementation lives in `sdkwork-database-cli`:

```bash
cargo run --manifest-path ../sdkwork-database/Cargo.toml -p sdkwork-database-cli -- --app-root . validate
cargo run --manifest-path ../sdkwork-database/Cargo.toml -p sdkwork-database-cli -- --app-root . migrate
cargo run --manifest-path ../sdkwork-database/Cargo.toml -p sdkwork-database-cli -- --app-root . seed --locale zh-CN --profile standard
```

## Related Specs

- `../sdkwork-specs/DATABASE_SPEC.md` — table/field/index semantics, pool rules
- `../sdkwork-specs/DATABASE_FRAMEWORK_SPEC.md` — lifecycle, directory, SPI, drift, seed locale
- `../sdkwork-specs/MIGRATION_SPEC.md` — migration governance
- `../sdkwork-specs/PAGINATION_SPEC.md` — list/search pagination rules

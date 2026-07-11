# Common Seeds

This directory holds language-neutral reference seed data for the
sdkwork-agentstudio database.

Per `DATABASE_FRAMEWORK_SPEC.md` section 8.2, common seeds are
language-neutral reference rows (for example: country codes, currency codes,
permission codes, configuration keys). Locale-specific display or initialization
data belongs under `seeds/locales/{locale}/`.

Seed scripts here `MUST` be idempotent (prefer upsert semantics) and are
recorded in `ops_seed_history` by the lifecycle orchestrator.

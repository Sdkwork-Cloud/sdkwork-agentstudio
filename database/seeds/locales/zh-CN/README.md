# zh-CN Locale Seeds

This directory holds Simplified Chinese (zh-CN) locale-specific seed data for
the sdkwork-agentstudio database.

`zh-CN` is the default seed locale per `DATABASE_FRAMEWORK_SPEC.md` section 8.1
and `database/database.manifest.json#lifecycle.defaultSeedLocale`.

Locale seed scripts `MUST`:

- Be safe to re-run (prefer upsert semantics).
- Reference only rows owned by this module.
- Not mix multiple locales in a single file.
- Be listed in `database/seeds/seed.manifest.json#localeSets.zh-CN.files` in
  explicit execution order.

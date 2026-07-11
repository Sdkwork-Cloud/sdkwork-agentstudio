# Agent Studio Verification

Run the narrowest useful set first, then broaden before completion:

```bash
pnpm install
pnpm check:arch
pnpm check:parity
pnpm build
pnpm --filter <touched-package> typecheck
pnpm build:desktop
```

Use `pnpm build:desktop` when desktop host code, Tauri bridges, or desktop packaging changes were touched. For web-only work, a successful `pnpm build` plus the package-specific checks is the minimum bar.

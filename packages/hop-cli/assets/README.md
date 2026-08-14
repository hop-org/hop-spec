# Vendored report assets

`foundation.css` / `foundation.js` are the unbranded presentation layer used by
`hop report`. They provide the light/dark toggle, Save-as-PDF, print profile, and
responsive behaviour so this repo does not have to reimplement them.

**Do not hand-edit them for style or behaviour** — those changes belong upstream
and will be lost on the next re-vendor.

## Re-vendoring

These files originate in a private design system, so a copy is never enough.
Upstream carries the originating organisation's name, an internal hosting
domain, dated decisions attributed to named individuals, and vendor-prefixed
identifiers. None of that belongs in a public repository.

After copying a newer upstream file in:

1. Remove every organisation name, internal domain, and personal attribution.
   Keep the engineering rationale in those comments — only the name and date go.
2. Rename any vendor-prefixed identifier to the neutral form this repo uses.
   Currently that is the root class `.hop-doc` and the theme storage key
   `hop-doc-theme`.
3. Grep the result before committing, and build the pattern from what upstream
   actually contains rather than from a remembered list. The same attribution
   appears in several shapes — with a date, without one, bare parenthetical —
   and a first pass routinely catches only some of them:

```bash
grep -inE "<org>|<vendor-prefix>|<author-names>" foundation.css foundation.js
```

4. Regenerate the inlined module:

```bash
bun run gen-assets
```

`.hop-doc` is the structural root class the stylesheet keys off, so if it is
renamed here it must be renamed in `src/report.ts` to match.

`gen-assets` writes `src/assets.generated.ts`, which inlines both files as string
constants so the CLI bundle stays a single self-contained artifact and the emitted
HTML works offline with no external requests.

## Brand posture

The foundation defines a *token contract* — `--brand-primary`, `--header-bg`,
`--logo`, and friends — and ships neutral, non-brand defaults for every slot. No
theme is applied here and none should be: `hop report` output is deliberately
unbranded. Downstream users who want their own look can override the tokens in a
`:root` block pasted after the foundation styles, which is the documented
extension point.

The structural root class is `.hop-doc` with `data-doc-type="report"`. The
stylesheet keys off both, so renaming either here requires the same change in
`src/report.ts`.

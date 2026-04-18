---
name: file-cleanup
description: 'Find and remove unused files, relocate misplaced components, fix broken import paths. Use when: reorganizing code, cleaning dead code, moving components between folders, auditing unused CSS or TSX files.'
argument-hint: 'Describe what to clean up or reorganize, or say "audit" for a full scan'
---

# File Organization & Dead Code Cleanup

## When to Use

- User asks to find unused/dead files
- User asks to move components to a different folder
- User asks whether files are in the correct location
- After moving files, to fix broken import paths
- Periodic codebase hygiene audits

## Procedure

### 1. Audit for Unused Files

For each `.tsx`, `.ts`, and `.css` file under `src/`:

1. Search for imports of the file across the entire codebase
2. For **TSX/TS files**: search for the module name without extension (e.g., `from '...GoalDetailView'`)
3. For **CSS files**: search for the full filename with extension (e.g., `import '...GitHubSyncModal.css'`)
4. Skip entry points that are never imported: `main.tsx`, `App.tsx`, `vite-env.d.ts`
5. Check `index.html` for `<link>` or `<script>` references to files in `styles/` or `public/`

A file is **unused** if zero other files import or reference it.

### 2. Determine Correct Location

This project uses the following conventions:

| File type | Correct location | Rule |
|-----------|-----------------|------|
| CSS files | `src/styles/` (flat) | All CSS in one folder, named by component/page |
| Shared components | `src/components/` | Used by multiple pages or by `App.tsx` |
| Page-specific components | `src/pages/<page>/components/` | Only imported by that page's code |
| Hooks | `src/hooks/` or `src/pages/<page>/hooks/` | Shared vs page-specific |
| Types | `src/types.ts` or `src/pages/<page>/types.ts` | Shared vs page-specific |

To determine if a component is page-specific:
1. Find all files that import it
2. If every importer is under `src/pages/<X>/`, it belongs in `src/pages/<X>/components/`
3. If importers span multiple pages or include `App.tsx`, it belongs in `src/components/`

### 3. Move Files

When relocating files:

1. **Move the file** to the correct directory
2. **Fix ALL import paths** — both:
   - **External imports**: other files that import the moved file
   - **Internal imports**: imports *within* the moved file (CSS imports, sibling component imports, relative paths to utils/types)
3. **CSS imports are the most commonly missed** — when a component moves, its `import '../styles/Foo.css'` path changes too

### 4. Verify

After all moves and deletions:

1. Run `get_errors` to check for broken imports
2. Search for any remaining references to deleted files
3. Confirm no new TypeScript or Vite errors

## Common Pitfalls

- **Forgetting CSS imports inside moved files**: When moving `Foo.tsx` from `src/components/` to `src/pages/bar/components/`, the CSS import `import '../styles/Foo.css'` breaks because the relative path changed. Must update to `import '../../../styles/Foo.css'`.
- **Circular audit**: Don't flag files that are only imported by files you're also about to delete. Trace the full dependency chain.
- **index.html references**: `styles/app.css` and `styles/normalize.css` are loaded via `<link>` tags in `index.html`, not via JS imports. Don't flag them as unused.

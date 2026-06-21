# Taxes Page

## Overview
The Taxes page is the app’s document-prep workspace for a single tax year. Its primary job is to help the user assemble a year-specific checklist of tax documents, upload supporting files, organize items by owner (primary, partner, joint), track completion based on file attachment, and keep that metadata ready for storage, Drive surfacing, and GitHub sync.

## Layout
The page lives at `/taxes` and renders inside the main app shell.

1. **Header**
   - Gradient `Taxes` title
   - Optional storage usage indicator (`X MB used`)
   - Year switcher with previous/next arrows and current year label
   - Next-year button is disabled at the current calendar year
2. **Upload error region**
   - Inline alert shown above the body when uploads fail validation or storage
3. **Conditional body**
   - **Empty state** when the selected year has no tax prep yet
   - **Checklist body** when the year exists
4. **Checklist body structure**
   - Template bar: `Save as Template`, `Delete Year`
   - Owner sections in this order: **Primary**, **Partner** (only if profile has a partner), **Joint**
   - Separate **Tax Returns** section at the bottom
5. **Modal layer**
   - Add item modal
   - Suggest-from-accounts modal
   - Save template modal
   - Import template modal
   - Delete year confirmation modal

## Features

### Tax year selection
- **What it does**: Lets the user move between tax years. Each year has an independent checklist and file set.
- **Components**: `src/pages/taxes/Taxes.tsx`
- **Data sources**: `useTaxStore()` (`getYear`, `yearExists`)
- **User interactions**:
  - Click previous year arrow
  - Click next year arrow until the current year
- **States**:
  - **Empty**: selected year has no stored checklist
  - **Populated**: selected year has stored items
  - **Loading**: none
  - **Error**: none
- **Edge cases**:
  - Next-year navigation is blocked at the current year
  - Navigating to a year with no data shows that year’s empty state
  - Existing years are auto-backfilled with missing default paystub items on mount

### Empty state and year creation
- **What it does**: Creates tax prep for a year that does not yet exist.
- **Components**: `src/pages/taxes/Taxes.tsx`
- **Data sources**: `useProfile()`, `useTaxStore()`, `tax.templates`
- **User interactions**:
  - Click `Create {year} Tax Prep`
  - Click `Import from Template` if templates exist
- **States**:
  - **Empty**: headline `No tax prep for {year}` with create CTA
  - **Populated**: replaced by checklist body after creation/import
  - **Loading**: none
  - **Error**: none
- **Edge cases**:
  - New years created from scratch always seed a primary paystub item
  - If the profile has a partner, creation also seeds a partner paystub item
  - Import is only offered when at least one template exists

### Owner-based checklist sections
- **What it does**: Groups checklist items by owner and shows per-section completion counts.
- **Components**:
  - `src/pages/taxes/Taxes.tsx`
  - `src/pages/taxes/components/OwnerSection.tsx`
  - `src/pages/taxes/components/OwnerBadge.tsx`
- **Data sources**: `useProfile()`, `useTaxStore()`, `useData()` accounts
- **User interactions**:
  - Review sections for primary, partner, and joint documents
  - Use section-level actions to add items
- **States**:
  - **Empty**: section shows `No items yet`
  - **Populated**: section shows checklist rows and `done/total` badge
  - **Loading**: none
  - **Error**: none
- **Edge cases**:
  - Partner section only renders when `profile.partner` exists
  - Joint section always renders
  - Completion count is based only on file presence (`files.length > 0`)
  - Tax return items are excluded from owner sections and handled separately

### Owner badges
- **What it does**: Visually marks ownership using initials or profile avatars.
- **Components**: `src/pages/taxes/components/OwnerBadge.tsx`
- **Data sources**: `useProfile()` names and avatar data URLs
- **User interactions**: none
- **States**:
  - **Populated**: primary/partner show one avatar; joint shows overlapping pair
  - **Loading**: none
  - **Error**: none
- **Edge cases**:
  - Primary fallback initial is `P`
  - Partner fallback initial is `S`
  - Primary/partner display names fall back to `Primary` and `Partner`
  - Joint badge uses both owners even when only initials are available

### Checklist row completion tracking
- **What it does**: Marks an item complete when it has at least one uploaded file.
- **Components**: `src/pages/taxes/components/ChecklistRow.tsx`
- **Data sources**: `TaxChecklistItem.files`
- **User interactions**:
  - Review completion icon and chips
  - Upload additional files
- **States**:
  - **Not started**: empty square, `data-done="false"`, aria-label includes `(not started)`
  - **Complete**: checkmark, reduced-opacity row, `data-done="true"`, aria-label includes `(complete)`
  - **Loading**: none
  - **Error**: none
- **Edge cases**:
  - Removing the final file reverts the row to not started
  - Completion is binary; there is no partial or in-review status

### Add custom checklist item
- **What it does**: Adds a freeform checklist item to a specific owner section.
- **Components**:
  - `src/pages/taxes/components/AddItemModal.tsx`
  - `src/pages/taxes/components/OwnerSection.tsx`
  - `src/pages/taxes/Taxes.tsx`
- **Data sources**: `useTaxStore().addItem`
- **User interactions**:
  - Click `+ Add Item`
  - Type item name
  - Save with button or Enter
  - Cancel or click overlay to dismiss
- **States**:
  - **Empty**: disabled Add button until trimmed input has content
  - **Populated**: new `custom` item appears in the section
  - **Loading**: none
  - **Error**: none
- **Edge cases**:
  - Whitespace is trimmed
  - Empty Enter press does nothing
  - New items are created with no files and no linked accounts

### Paystub shortcut and paystub backfill
- **What it does**: Ensures owner sections can quickly add paystub checklist items and that legacy years are missing fewer defaults.
- **Components**:
  - `src/pages/taxes/Taxes.tsx`
  - `src/pages/taxes/components/OwnerSection.tsx`
- **Data sources**: `useProfile()`, `useTaxStore()`
- **User interactions**:
  - Click `+ Add Paystub` in primary or partner section
- **States**:
  - **Visible**: button appears when non-joint owner lacks a paystub item
  - **Hidden**: button disappears once that owner already has a paystub item
  - **Loading**: none
  - **Error**: none
- **Edge cases**:
  - Joint section never shows `+ Add Paystub`
  - Existing years are auto-backfilled with default primary and partner paystub items if missing

### Suggest from accounts
- **What it does**: Creates account-linked checklist items from Net Worth/Data accounts.
- **Components**:
  - `src/pages/taxes/components/SuggestModal.tsx`
  - `src/pages/taxes/components/OwnerSection.tsx`
  - `src/pages/taxes/Taxes.tsx`
- **Data sources**:
  - `useData().accounts`
  - `useTaxStore().addItem`
  - Current year’s linked `accountIds`
- **User interactions**:
  - Click `+ From Accounts`
  - Select one or more eligible accounts
  - Click `Add`
- **States**:
  - **Empty**: `All accounts already have items`
  - **Populated**: account rows with checkbox, name, optional inactive badge, optional institution
  - **Loading**: none
  - **Error**: none
- **Edge cases**:
  - Only unlinked accounts for that owner are shown
  - Joint uses `owner === 'joint'` accounts only
  - Multi-select creates one consolidated `account` item whose label is joined with ` / `
  - Linked account names later appear beside the checklist label

### Linked account display
- **What it does**: Shows the names of linked accounts inline on account-based checklist items.
- **Components**: `src/pages/taxes/components/ChecklistRow.tsx`
- **Data sources**: `TaxChecklistItem.accountIds`, `useData().accounts`
- **User interactions**: none
- **States**:
  - **Empty**: no account subtitle when `accountIds` is empty
  - **Populated**: comma-separated account names beside the label
  - **Loading**: none
  - **Error**: none
- **Edge cases**:
  - Unknown account IDs are filtered out silently

### Rename checklist item
- **What it does**: Renames a checklist item inline.
- **Components**: `src/pages/taxes/components/ChecklistRow.tsx`
- **Data sources**: `useTaxStore().updateItem`
- **User interactions**:
  - Double-click label or click pencil icon
  - Save with blur or Enter
  - Cancel with Escape
- **States**:
  - **Viewing**: label text with hidden-on-idle pencil button
  - **Editing**: inline input with autofocus
  - **Loading**: none
  - **Error**: none
- **Edge cases**:
  - Empty trimmed rename reverts to original label
  - Unchanged rename reverts to original label
  - Rename updates only the item label, not existing uploaded file names

### Document upload and storage
- **What it does**: Attaches one or more files to a checklist item and stores file metadata separately from file content.
- **Components**:
  - `src/pages/taxes/Taxes.tsx`
  - `src/pages/taxes/components/ChecklistRow.tsx`
  - `src/pages/taxes/utils/fileHelpers.ts`
  - `src/utils/taxFileDB.ts`
  - `src/pages/taxes/useTaxStore.ts`
- **Data sources**:
  - `useTaxStore().addFileToItemAsync`
  - `useEncryption()` via `useTaxStore`
  - `getStorageEstimate()`
- **User interactions**:
  - Click `Upload` or `Add`
  - Select one or multiple files
- **States**:
  - **Not started**: button label `Upload`
  - **Has files**: button label `Add`, file chips visible
  - **Loading**: no explicit spinner; storage indicator loads asynchronously on mount
  - **Error**: upload alert appears for invalid size, migration lock, or storage failure
- **Edge cases**:
  - Max file size is **10 MB per file**
  - Uploads during migration are blocked with `Please wait — migrating existing files to new storage…`
  - Any file extension is accepted; the extension is derived from the filename
  - Display name is rewritten to `{OwnerName}_{ItemLabel}.{ext}`
  - File metadata is stored in `tax-store`; file content is stripped from local metadata and stored in IndexedDB
  - If a `CryptoKey` exists, IndexedDB content is encrypted at rest
  - Legacy inline file content is migrated one time from local storage into IndexedDB on hook mount
  - Storage errors are surfaced as a temporary alert and auto-clear after 5 seconds

### File management on the page
- **What it does**: Lists attached files as chips and supports deleting individual file attachments.
- **Components**:
  - `src/pages/taxes/components/ChecklistRow.tsx`
  - `src/pages/taxes/components/TaxReturnSection.tsx`
  - `src/pages/taxes/Taxes.tsx`
- **Data sources**: `TaxChecklistItem.files`, `useTaxStore().removeFileFromItem`
- **User interactions**:
  - Review file chips
  - Remove a file with chip `×`
- **States**:
  - **Empty**: no chips
  - **Populated**: one chip per attached file
  - **Loading**: none
  - **Error**: none
- **Edge cases**:
  - Removing a file also triggers fire-and-forget cleanup in IndexedDB
  - Deleting the final file reverts the checklist row to incomplete
  - Long display names are visually truncated to avoid overflow
  - **Current limitation**: the Taxes page itself does **not** provide inline file preview or download actions; it only lists and deletes files

### Tax return section and filing workflow
- **What it does**: Tracks final filed return documents separately from source-document checklist items.
- **Components**:
  - `src/pages/taxes/components/TaxReturnSection.tsx`
  - `src/pages/taxes/components/OwnerBadge.tsx`
  - `src/pages/taxes/Taxes.tsx`
- **Data sources**: `useTaxStore().addItem`, `TaxChecklistItem.category === 'tax-return'`
- **User interactions**:
  - Open overflow menu (`⋯`)
  - Add a joint return row
  - Add a primary single return row
  - Add a partner single return row when partner exists
  - Upload/replace return file
  - Remove attached return file
- **States**:
  - **Empty**: `No return uploaded yet. Use the menu to add.`
  - **Populated**: one row per existing return entry with upload/replace control and file chips
  - **Loading**: none
  - **Error**: no section-specific errors; upload errors use shared alert region
- **Edge cases**:
  - Menu hides options that already exist
  - Joint return option is hidden if a joint return already exists or any single return exists
  - Single-return options can still be added individually if those rows do not exist
  - Return rows do not support rename or row deletion; only file removal is supported
  - If a return file is removed, the return row remains and can be uploaded again
  - Filing status is represented only by file presence; there is no explicit submitted/accepted/rejected state

### Template save, update, import, and delete
- **What it does**: Lets the user reuse checklist structure across years.
- **Components**:
  - `src/pages/taxes/components/SaveTemplateModal.tsx`
  - `src/pages/taxes/components/ImportTemplateModal.tsx`
  - `src/pages/taxes/Taxes.tsx`
  - `src/pages/taxes/useTaxStore.ts`
  - `src/pages/taxes/types.ts`
- **Data sources**:
  - `tax.templates`
  - `saveAsTemplate`, `updateTemplate`, `createYearFromTemplate`, `deleteTemplate`
- **User interactions**:
  - Save current year as a new template
  - Update an existing template with current year structure
  - Import a template into an empty year
  - Delete a saved template from the import modal
- **States**:
  - **Empty**: import modal shows `No templates saved yet.`
  - **Populated**: templates list with name and item count
  - **Loading**: none
  - **Error**: none
- **Edge cases**:
  - Templates store only `label`, `owner`, and `category`
  - Templates do **not** store files or `accountIds`
  - Save modal defaults to `update` mode when templates exist, otherwise `new`
  - Import only works for years that do not already exist

### Delete year workflow
- **What it does**: Removes all checklist metadata for the selected year and cleans up associated IndexedDB file blobs.
- **Components**:
  - `src/pages/taxes/Taxes.tsx`
  - `src/pages/taxes/useTaxStore.ts`
- **Data sources**: `useTaxStore().deleteYear`
- **User interactions**:
  - Click `Delete Year`
  - Confirm or cancel in modal
  - Click overlay to dismiss
- **States**:
  - **Confirmation open**: destructive warning modal
  - **Deleted**: page returns to selected year empty state
  - **Loading**: none
  - **Error**: none
- **Edge cases**:
  - Warning explicitly says deletion is irreversible
  - IndexedDB cleanup is batch, async, and fire-and-forget
  - Deleting a year only deletes that year’s file IDs; other years’ blobs remain

### Storage usage indicator
- **What it does**: Shows approximate file storage used by tax documents.
- **Components**: `src/pages/taxes/Taxes.tsx`, `src/utils/taxFileDB.ts`
- **Data sources**: `getStorageEstimate()`
- **User interactions**: none
- **States**:
  - **Hidden**: before estimate resolves
  - **Visible**: `{usedMB} MB used`
  - **Loading**: async on mount
  - **Error**: silent failure; indicator stays hidden
- **Edge cases**:
  - Uses `navigator.storage.estimate()` when available
  - Falls back to summing raw IndexedDB record sizes
  - UI shows used MB only, not quota

### Tax GitHub sync
- **What it does**: Syncs tax metadata and uploaded documents through the app’s GitHub sync system.
- **Components**:
  - `src/contexts/TaxSyncContext.tsx`
  - `src/pages/taxes/taxGitHubSync.ts`
  - `src/components/SidebarNavigation.tsx`
  - `src/pages/taxes/useTaxStore.ts`
- **Data sources**:
  - `useGitHubSyncContext()`
  - `useEncryption()`
  - `tax-store` and `tax-templates` in app storage
  - IndexedDB file content via `getFileContent()`
- **User interactions**:
  - Indirect only from the Taxes page; sync is initiated from global app settings/sidebar or debounced automatically after tax mutations
- **States**:
  - **Dirty**: any tax mutation dispatches `tax-store-changed`
  - **Auto-sync**: TaxSyncProvider debounces for 60 seconds
  - **Manual sync**: sidebar/settings can call `syncTaxNow`
  - **Error**: errors are caught/logged in sync context; no Taxes-page-specific UI
- **Edge cases**:
  - Sync payload includes `version`, `exportedAt`, `taxStore`, and `taxTemplates`
  - Individual file uploads go to `taxes/{year}/{owner_label}_{item_label}_{fileId}.{ext}` on GitHub
  - File sync retries up to 3 times on 409 conflicts/network errors
  - Uploaded GitHub content strips the data-URL prefix before PUT
  - **Current limitation**: `downloadAllTaxFiles()` exists, but `restoreTaxFromGitHub()` currently restores only `tax-store` and `tax-templates`; it does not repopulate IndexedDB file blobs

### Drive integration
- **What it does**: Exposes tax documents to the Drive feature as a top-level `Taxes` folder grouped by year.
- **Components**:
  - `src/pages/taxes/buildTaxTree.ts`
  - `src/pages/drive/buildBudgetTree.ts`
- **Data sources**:
  - `tax-store`
  - `data-accounts`
  - `user-profile`
- **User interactions**:
  - Not controlled from the Taxes page directly; surfaced through Drive
- **States**:
  - **Hidden**: no year with attached files
  - **Visible**: `Drive > Taxes > {year}` when at least one file exists
- **Edge cases**:
  - Years with checklist items but no files are omitted from Drive
  - File metadata includes owner name, optional account names, and mapped category labels for paystub and tax return
  - Unknown categories are left unlabeled in metadata

## Data Model

### Core types
- **`TaxDocOwner`**: `'primary' | 'partner' | 'joint'`
- **`ChecklistCategory`**: `'paystub' | 'account' | 'tax-return' | 'custom'`
- **`TaxDocFile`**
  - `id`: generated file identifier
  - `name`: display filename shown in chips
  - `content`: base64 data URL when inline, otherwise `undefined` after migration/storage split
  - `ext`: extension derived from filename
  - `uploadedAt`: ISO timestamp
- **`TaxChecklistItem`**
  - `id`
  - `label`
  - `owner`
  - `category`
  - `accountIds`: linked Data-page account IDs
  - `files`: attached `TaxDocFile[]`
- **`TaxYear`**: `{ items: TaxChecklistItem[] }`
- **`TaxStore`**: `{ years: Record<number, TaxYear> }`

### Template types
- **`TaxTemplateItem`**: `label`, `owner`, `category`
- **`TaxTemplate`**: `id`, `name`, `items`

### Storage model
- **Checklist metadata**: stored in encrypted app storage under `tax-store`
- **Templates**: stored under `tax-templates`
- **File content**: stored in IndexedDB database `finance-tracking-files`, object store `tax-files`
- **Encryption**: IndexedDB file content is AES-GCM encrypted when a `CryptoKey` is available
- **Migration behavior**: legacy inline file content is moved from local metadata into IndexedDB on hook mount
- **Event model**: every persisted store mutation dispatches `window.dispatchEvent(new Event('tax-store-changed'))`

### Checklist structure rules
- Year creation from scratch seeds default paystub rows
- Imported templates create items with empty `accountIds` and empty `files`
- Section completion is derived, not stored
- Tax returns are just checklist items with category `tax-return`, but rendered in a dedicated section

## Navigation
- The page is mounted at **`/taxes`**.
- Users reach it from the main sidebar via the **Taxes** navigation button.
- From the page, users can:
  - Switch between tax years with the header arrows
  - Open the global **Drive** view from the app shell footer to access document folders
  - Use global settings/sidebar controls for GitHub sync and restore
- There are no page-local links to other routes inside the Taxes content area.

## Dependencies
The Taxes page sits inside the app’s provider stack and depends on both page-local state and app-level contexts.

### Direct dependencies used by the page
- **`useProfile()`**: provides primary/partner names and avatars
- **`useData()` / `DataProvider`**: provides account list for account suggestions and linked-account labels
- **`useTaxStore()`**: owns year data, templates, file metadata, migration, and all checklist mutations
- **`useEncryption()`** inside `useTaxStore()`: provides optional crypto key for IndexedDB file encryption
- **`taxFileDB` utilities**: file blob persistence, deletion, and storage estimate

### Required app providers in practice
From the app shell/provider stack, the Taxes page is expected to run inside:
- `SettingsProvider`
- `EncryptionProvider`
- `LayoutProvider`
- `GoalsProvider` (indirectly, for profile access via hooks)
- `DataProvider`
- `GitHubSyncProvider`
- `FlagProvider`
- `BudgetSyncProvider`
- `TaxSyncProvider`
- `ImportExportProvider`

### Sync dependencies
- `TaxSyncProvider` listens for `tax-store-changed`
- `GitHubSyncContext` handles metadata snapshot sync/restore
- `taxGitHubSync.ts` handles per-file GitHub upload/download utilities

This is the current behavior implemented in `src/pages/taxes/` today.
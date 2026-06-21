# Drive & Settings Findings Memo

- **Status:** Current shipped behavior
- **Owner:** TBD
- **Last updated:** 2026-06-11

## Page summary
- **Purpose:** Help the user browse stored files in Drive and manage profile, backup, appearance, security, import/export, labs, and admin controls in Settings.
- **Primary user:** A returning user managing financial records, backups, privacy, and app preferences.
- **When they use it:** When they need to inspect uploaded files, move a budget month, back up or restore data, change appearance, lock down the app, or manage advanced settings.
- **Success looks like:** The user finds the file they need, updates preferences safely, backs up or restores data, and leaves with the app in the state they intended.

## What this page includes
| Area / feature | One-line purpose |
|---|---|
| Drive shell | Shows stored Budget and Tax files in a folder-style browser |
| Breadcrumbs and year tabs | Speed up movement through nested folders and year folders |
| Owner filter and sorting | Help the user narrow and reorder file lists where metadata exists |
| File preview | Opens CSV tables, PDFs, and other file content in place |
| CSV upload queue | Lets the user import budget CSVs from Drive and review them before saving |
| Budget month move | Reassigns a budget CSV from one month to another |
| Settings modal shell | Central entry point for all settings sections |
| Profile | Edit names, birthdays, avatars, and optional partner info |
| GitHub Sync | Configure backup repo access, sync state, and restore history |
| Appearance | Switch light/dark mode and accent color |
| Security | Enable, update, or disable app encryption |
| Advanced | Export, import, reset, and toggle Data-page CSV controls |
| Labs | Turn on experimental features and demo mode |
| Feature Flags | Let admins override flags locally and edit rollouts |

## Core user workflows
### Browse stored files in Drive
- **Start:** Open **Drive** from the sidebar.
- **User intent:** Find a budget CSV or tax document already stored in the app.
- **Steps:** Review the root folders, click into **Budget** or **Taxes**, use breadcrumbs or **..** to move around, and open a file.
- **End state:** The user reaches the needed folder or preview.
- **Notes:** Browser back/forward keeps Drive in sync with visible location.

### Filter and sort tax files
- **Start:** Open a Drive folder that shows owner-tagged documents.
- **User intent:** Narrow the list to the right person or reorder it.
- **Steps:** Use **Owner: All / {owner}** buttons, then choose **Sort: Name / Owner / Date**.
- **End state:** The file list updates within the current folder.
- **Notes:** Clicking the active owner again removes that filter.

### Upload budget CSVs from Drive
- **Start:** Open any non-root Drive folder.
- **User intent:** Import one or more budget CSVs without leaving Drive.
- **Steps:** Drag files onto the dropzone or click to browse, review each file in the preview flow, confirm or cancel, then continue through the queue.
- **End state:** Accepted files are imported into the budget data set and the Drive view refreshes.
- **Notes:** Drive accepts CSVs from any subfolder view, but the import always lands in budget data.

### Move a budget month to a different month
- **Start:** Open a budget year folder in Drive.
- **User intent:** Reassign a monthly budget file to the correct month key.
- **Steps:** Click the rename/move action on a file, choose a month in **Move to month:**, then click **Move** or **Replace** if the destination already has data.
- **End state:** The file appears under the destination month.
- **Notes:** The action is only available on budget files.

### Edit profile and app preferences
- **Start:** Click **Settings** in the sidebar, or open Settings from app search.
- **User intent:** Change identity info, appearance, or other preferences.
- **Steps:** Open Settings, switch to the needed tab, make changes, and save or close.
- **End state:** The setting takes effect immediately or after the relevant confirmation.
- **Notes:** Search shortcuts can open Settings directly to **Profile**, **GitHub Sync**, **Appearance**, **Advanced**, or **Labs**.

### Back up or restore with GitHub Sync
- **Start:** Open **Settings → GitHub Sync**.
- **User intent:** Connect a backup repo, unlock the token, sync current data, or restore a previous snapshot.
- **Steps:** Save or unlock the token, set **Owner** and **Repository**, optionally turn on **Auto-sync**, test the connection, click **Sync**, then use **History** and **Restore Latest** or **Restore** when needed.
- **End state:** The app is connected, synced, or restored.
- **Notes:** Sync state and restore behavior differ by domain; some areas still require manual sync.

### Turn encryption on or off
- **Start:** Open **Settings → Security**.
- **User intent:** Protect the app with a passphrase, change that passphrase, or remove encryption.
- **Steps:** Use **Enable Encryption**, **Change Passphrase**, or **Disable Encryption**, complete the passphrase form, and confirm.
- **End state:** The app becomes encrypted, updates its passphrase, or returns to unencrypted storage.
- **Notes:** Turning encryption off shows a destructive warning before confirmation.

## Exhaustive feature inventory
### Drive shell and navigation
- Page title: **Drive**.
- Root-level folders are created from the user's existing in-app files, not from a remote drive.
- Possible top-level folders:
  - **Budget**
  - **Taxes**
- Breadcrumb always starts at **Drive**.
- Non-root folders show a **..** back row and also support breadcrumb jumps.
- Year tabs appear when the current folder has sibling year folders, for example **2024** and **2025**.
- Folder rows show an item count such as **1 item** or **2 items**.

### Drive file list, metadata, filter, and sort
- File rows can show:
  - file name
  - owner tag
  - category tag
  - account-name tag
  - uploaded date
- When owner-tagged files are present, Drive shows:
  - **Owner:** with **All** plus one button per owner label
  - **Sort:** with **Name**, **Owner**, and **Date**
- Tax owner labels are personalized to profile names when available; otherwise they fall back to **Primary**, **Partner**, or **Joint**.
- Some tax files also show category labels such as **Paystub** or **Tax Return** and linked account-name tags.

### Drive file preview
- CSV preview shows:
  - **Back** button
  - file name as the heading
  - parsed table view
  - row count like **0 rows** or more
- PDF preview shows:
  - **Back** button
  - file name as the heading
  - embedded PDF preview
- Other file types fall back to raw text preview.

### Drive CSV upload flow
- Visible in any non-root Drive folder.
- Dropzone text:
  - default: **Drag & drop CSV files or click to browse**
  - drag state: **Drop CSV files here**
  - hint: **Filenames should contain YYYY-MM (e.g. 2025-05.csv) or match "Our Finances - MMM YYYY.csv"**
- Upload outcomes:
  - **No CSV files found. Drop .csv files to upload.**
  - **Skipped {n} file(s): couldn't determine month from filename**
  - **Uploaded successfully**
  - **Upload failed: {error}**
  - **Uploaded! New categories: ...**
  - **New categories: ...** when the user cancels out after categories were discovered earlier in the queue
- Each valid file enters the same preview-and-confirm flow already used elsewhere in the app.

### Drive budget month move
- Available only on budget files.
- Rename action opens a popover with:
  - label **Move to month:**
  - month picker
  - **Move**
  - **Cancel**
- If the destination month already has data, the popover shows a warning and changes the primary action to **Replace**.
- Choosing the same month simply exits without changing anything.

### Settings modal shell
- Sidebar trigger label: **Settings**.
- Modal title: **Settings**.
- Close methods:
  - **Close** button
  - **Escape**
  - clicking the backdrop
- Default open tab from the sidebar button is **Profile**.
- Standard tabs for most users:
  - **Profile**
  - **GitHub Sync**
  - **Appearance**
  - **Security**
  - **Advanced**
  - **Labs**
- Admin-only extra tab:
  - **Feature Flags**
- GitHub Sync itself contains two subtabs:
  - **Configuration**
  - **History**

### Profile
- View mode shows one or two profile cards.
- Empty names show **No name set**.
- Role labels shown in view mode:
  - **Primary**
  - **Partner**
- Main actions:
  - **Edit Profile**
  - **Profile saved!** success flash
- Edit mode fields and actions:
  - primary card title **You**
  - partner card title **Partner**
  - **Name**
  - placeholder **Your name**
  - partner placeholder **Partner's name**
  - **Birthday**
  - avatar upload controls for profile and partner pictures
  - **+ Add Partner** when no partner exists
  - **Remove** on the partner card
  - **Save Profile**
  - **Cancel**
- Birthday values are editable, but the saved birthdays are not shown in read-only view mode.

### GitHub Sync: token and repository setup
- Top labels and messages:
  - **Token Security**
  - **No token saved yet. Save one encrypted with a passphrase below.**
  - **Passphrase to unlock token**
  - **Unlock**
  - **Unlock your token to enable sync, test connection, and edit configuration.**
  - **Token unlocked for this session**
- Token actions and fields:
  - **Lock**
  - **Change token**
  - **New token** or **Replace token**
  - token placeholder **github_pat_...**
  - **Show / Hide** token text
  - **Passphrase for encryption** with placeholder **At least 8 characters**
  - **Save Token**
  - **Cancel** when replacing a token
- Repository setup fields:
  - **Owner** with placeholder **your-github-username**
  - **Repository** with placeholder **finance-backups**
  - repo summary shown as **Repo: {owner}/{repo}**
  - repo actions **Edit** and **Test**
  - **Connected** badge after a successful test
- Auto-sync control:
  - **Auto-sync (commits ~60 seconds after any change)**

### GitHub Sync: status, progress, and manual sync
- Inline status messages include:
  - **Missing configuration**
  - **Token not set up**
  - **Token locked**
  - **Ready to sync**
  - **Unsaved changes — sync when ready**
  - **Syncing…**
  - **Last synced ...** with relative and absolute time
  - **Sync failed: ...**
- Main action button: **Sync**.
- Additional success states:
  - **✓ Already up to date**
  - **✓ All synced**
  - **✓ Sync successful**
- Sync progress uses human-readable domain names:
  - **Goals**
  - **Balances**
  - **Tools**
  - **Allocation**
  - **Taxes**
  - **Budget**
- Connection-test results can also surface warnings after **Test**.

### GitHub Sync: history and restore
- Subtab labels:
  - **Configuration**
  - **History**
- History actions and states:
  - **Restore Latest**
  - **Restoring…**
  - **Connect and unlock token to view history.**
  - **No commits yet for this file.**
  - commit rows with **Restore**
- A restore can show success or error result text above the history list.

### Appearance
- Section heading: **Appearance**.
- Description: **Choose your preferred theme**.
- Theme choices:
  - **Light**
  - **Dark**
- Accent section label: **Accent color**.
- Accent choices:
  - **Blue accent**
  - **Teal accent**
  - **Purple accent**
  - **Green accent**
  - **Orange accent**
- Theme and accent choices apply immediately.

### Security
- Status labels:
  - **Encryption disabled**
  - **Encryption enabled ✓**
- When encryption is off:
  - description explains that the user can protect financial data with a passphrase
  - primary action **Enable Encryption**
  - setup form title **Set up encryption**
  - fields **New passphrase** and **Confirm passphrase**
  - warning: **If you forget your passphrase and don't have GitHub Sync enabled, your data cannot be recovered.**
  - actions **Cancel** and **Enable Encryption**
  - progress text **Encrypting…**
- When encryption is on:
  - description explains that a passphrase is required to access the app
  - actions **Change Passphrase** and **Disable Encryption**
  - reminder: **Keep your passphrase safe. Without it, your encrypted data cannot be accessed.**
- Change-passphrase flow:
  - heading **Change passphrase**
  - fields **Current passphrase**, **New passphrase**, **Confirm new passphrase**
  - actions **Cancel** and **Update Passphrase**
  - progress text **Updating…**
  - success flash **Passphrase updated ✓**
- Disable-encryption flow:
  - warning title **Disable encryption?**
  - warning text **Your data will be decrypted and stored in plain text. Anyone with access to this browser can view it.**
  - field **Enter passphrase to confirm**
  - actions **Cancel** and **Disable Encryption**
  - progress text **Disabling…**
- Passphrase fields also support **Show passphrase** and **Hide passphrase** controls.

### Advanced
- Description: **Manage app data and reset your application**.
- Toggle area:
  - **Allow CSV imports & resets**
  - hint **Show import and reset buttons on the Data page**
- Main actions:
  - **Export**
  - **Import**
  - **Factory Reset App**
- Reset confirmation:
  - **Permanently reset the app?**
  - **This will erase all goals, data, and settings. This action cannot be undone.**
  - **Cancel**
  - **Yes, Reset Everything**

### Labs
- Description: **Try experimental features. These may be incomplete or change without notice.**
- Toggles:
  - **PDF → CSV** with hint **Extract transaction tables from bank or brokerage PDFs into CSV format**
  - **Demo Mode** with one of two hints:
    - inactive: **Replace your data with realistic sample data for demos. Your real data is backed up and restored when you turn it off.**
    - active: **Currently active — your real data is safely backed up. Turn off to restore.**
- Demo mode also has a global keyboard shortcut elsewhere in the app, but the shortcut itself is not shown in this pane.

### Feature Flags
- This section is hidden unless the user is an admin.
- Loading state shows placeholder rows.
- Error state shows:
  - **Could not reach GitHub. Check your connection and try again.**
  - **Retry**
- If visible, the pane includes:
  - **My Overrides**
  - description **Override flags locally for testing. Changes only affect your browser.**
  - per-flag status text such as **Override: ...** or **using public config**
  - **Reset All Overrides**
  - screen-reader confirmation **All overrides cleared**
- Admin rollout controls include:
  - **Rollout Config**
  - description **Configure flag values and rollout percentages for all users. Changes are saved to the repository.**
  - environment badge **Production** or **Staging**
  - refresh action for rollout config
  - field labels **Rollout %** or **Value** depending on flag type
  - hint **% of users will see this enabled**
  - helper text **0% = disabled for all, 100% = enabled for all**
  - **Save Changes**
  - **Saved ✓** or **Error: {message}**

## Page-level states
- **First-time / empty:**
  - Drive root may show only the empty message **No budget files yet. Upload CSVs in the Budget page to see them here.**
  - Settings opens to **Profile** and shows empty-name placeholders when profile details are missing.
  - GitHub Sync can start in **Missing configuration** or **No token saved yet** state.
  - Security can start in **Encryption disabled** state.
- **Returning / populated:**
  - Drive can show **Budget** and/or **Taxes**, year folders, metadata tags, previews, and upload tools.
  - Settings can show saved profile info, active appearance choices, GitHub sync status, encryption enabled state, labs toggles, and admin controls.
  - GitHub history can show restoreable commit rows.
- **Error / blocked:**
  - Drive upload can reject non-CSV drops, unrecognized filenames, and failed uploads.
  - GitHub Sync can be blocked by missing config, locked token, failed connection tests, or sync/restore errors.
  - Security can block submission on mismatched or incorrect passphrases.
  - Feature Flags can show a GitHub reachability error for admins.

## Data and decisions
- **User inputs captured:**
  - Drive navigation choices, file uploads, owner filters, sort choices, and month-move targets
  - profile names, birthdays, avatars, and partner presence
  - GitHub token, passphrases, repo owner/name, auto-sync preference, sync and restore actions
  - appearance mode and accent choice
  - encryption passphrases and confirmations
  - import file selection, export request, factory reset confirmation, labs toggles, and flag overrides/rollout edits
- **Derived values shown:**
  - Drive folder counts, uploaded dates, file metadata tags, and CSV row counts
  - GitHub sync relative timestamps, progress by domain, and connected/dirty/success states
  - feature-flag resolved values and rollout status
- **Saved choices / preferences:**
  - profile and partner info
  - GitHub backup configuration and encrypted token setup
  - auto-sync preference
  - dark/light mode and accent color
  - encryption enabled/disabled state
  - **Allow CSV imports & resets** preference
  - labs toggles such as **PDF → CSV** and **Demo Mode**
  - local feature-flag overrides and admin rollout edits
- **Cross-page impact:**
  - Drive uploads feed the Budget area even when started from another Drive folder.
  - Moving a budget month changes which budget month holds that data.
  - Appearance changes affect the whole app.
  - Security settings can replace the entire app with an unlock screen when the app is locked.
  - GitHub Sync status spans Goals, Balances, Tools, Allocation, Taxes, and Budget.
  - **Allow CSV imports & resets** changes what controls appear on the Data page.
  - **PDF → CSV** in Labs adds a Budget upload-menu option.
  - **Demo Mode** swaps the app into sample data across the product.

## Open questions / known gaps
- Drive's empty message only mentions budget uploads even though Drive also surfaces tax documents.
- The Drive dropzone appears in any non-root folder, but uploads always go into budget data rather than into the currently viewed folder. If the raw spec implies folder-specific uploads, current behavior is narrower.
- GitHub Sync copy suggests broad auto-sync, but shipped behavior is mixed: some domains auto-sync on timers while others still depend on manual **Sync**.
- Restoring a specific historical backup from **History** does not fully time-travel every companion data set to that same moment.
- Profile view mode hides birthdays even though birthdays are editable and stored.
- Security currently has no explicit in-pane **Lock** action; locking happens through broader app behavior rather than a visible button here.
- The **Allow CSV imports & resets** label is easy to misread as a Budget control, but the current shipped effect is on the Data page.

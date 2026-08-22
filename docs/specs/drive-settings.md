# Drive & Settings Findings Memo

- **Status:** Current shipped behavior
- **Owner:** TBD
- **Last updated:** 2026-06-11

## Page summary
- **Purpose:** Help the user browse stored files in Drive and manage profile, data folder, appearance, import/export, labs, and admin controls in Settings.
- **Primary user:** A returning user managing financial records, data folder connection, appearance, and app preferences.
- **When they use it:** When they need to inspect uploaded files, move a budget month, change or reconnect the data folder, change appearance, or manage advanced settings.
- **Success looks like:** The user finds the file they need, updates preferences safely, and leaves with the app in the state they intended.

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
| Data Folder | Show connected folder name; change or disconnect the folder |
| Appearance | Switch light/dark mode and accent color |
| Advanced | Toggle Data-page CSV controls |
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
- **Notes:** Search shortcuts can open Settings directly to **Profile**, **Data Folder**, **Appearance**, **Advanced**, or **Labs**.

### Manage data folder connection
- **Start:** Open **Settings → Data Folder**.
- **User intent:** See what folder is connected, switch to a different folder, or disconnect.
- **Steps:** Read the **Current folder** label. Click **Change Folder** to pick a different directory and grant browser access. Click **Disconnect** to forget the handle without touching the files.
- **End state:** The app is connected to the chosen folder, or disconnected (returns to the folder picker screen on next use).
- **Notes:** Disconnecting only removes the stored handle; files on disk are untouched.

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
  - **Data Folder**
  - **Appearance**
  - **Advanced**
  - **Labs**
- Admin-only extra tab:
  - **Feature Flags**

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

### Data Folder
- Section heading: **Data Folder**.
- Description: **Every account, budget, goal and tax document is stored as a plain file in this folder on your machine.**
- Displays:
  - **Current folder** label with the connected folder name, or **Not connected** when no handle is stored
- Actions:
  - **Change Folder** — opens `showDirectoryPicker` and updates the handle
  - **Disconnect** — clears the stored handle and returns to the folder picker screen on next use; disabled when not ready
- Error messages surface below the actions for `AbortError` (no folder selected), `NotAllowedError` (permission denied), or unexpected failures.
- Footer note: **Disconnecting only forgets the folder — your files stay exactly where they are.**

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

### Advanced
- Description: **Turn on power-user tools for bulk data entry**.
- Toggle area:
  - **Allow CSV imports & resets**
  - hint **Show import and reset buttons on the Data page**

### Labs
- Description: **Try experimental features. These may be incomplete or change without notice.**
- Toggles:
  - **PDF → CSV** with hint **Extract transaction tables from bank or brokerage PDFs into CSV format**
  - **Demo Mode** with one of two hints:
    - inactive: **Explore the app with realistic sample data. Nothing is written to your data folder while demo mode is on.**
    - active: **Currently active — sample data only. Turn off to return to your data folder.**
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
  - Data Folder shows **Not connected** until a folder has been chosen.
- **Returning / populated:**
  - Drive can show **Budget** and/or **Taxes**, year folders, metadata tags, previews, and upload tools.
  - Settings can show saved profile info, connected folder name, active appearance choices, labs toggles, and admin controls.
- **Error / blocked:**
  - Drive upload can reject non-CSV drops, unrecognized filenames, and failed uploads.
  - Data Folder can show permission denied or folder-not-found errors.
  - Feature Flags can show a GitHub reachability error for admins.

## Data and decisions
- **User inputs captured:**
  - Drive navigation choices, file uploads, owner filters, sort choices, and month-move targets
  - profile names, birthdays, avatars, and partner presence
  - data folder selection and disconnect
  - appearance mode and accent choice
  - labs toggles, and flag overrides/rollout edits
- **Derived values shown:**
  - Drive folder counts, uploaded dates, file metadata tags, and CSV row counts
  - connected folder name and ready state
  - feature-flag resolved values and rollout status
- **Saved choices / preferences:**
  - profile and partner info
  - folder handle in IndexedDB (not in localStorage)
  - dark/light mode and accent color in localStorage
  - **Allow CSV imports & resets** preference in localStorage
  - labs toggles such as **PDF → CSV** and **Demo Mode** in localStorage
  - local feature-flag overrides and admin rollout edits in localStorage
- **Cross-page impact:**
  - Drive uploads feed the Budget area even when started from another Drive folder.
  - Moving a budget month changes which budget month holds that data.
  - Appearance changes affect the whole app.
  - **Allow CSV imports & resets** changes what controls appear on the Data page.
  - **PDF → CSV** in Labs adds a Budget upload-menu option.
  - **Demo Mode** swaps the app into an in-memory store seeded with sample data; nothing is written to the data folder while it is active.

## Open questions / known gaps
- Drive's empty message only mentions budget uploads even though Drive also surfaces tax documents.
- The Drive dropzone appears in any non-root folder, but uploads always go into budget data rather than into the currently viewed folder. If the raw spec implies folder-specific uploads, current behavior is narrower.
- Profile view mode hides birthdays even though birthdays are editable and stored.
- Security currently has no explicit in-pane **Lock** action; locking happens through broader app behavior rather than a visible button here.
- The **Allow CSV imports & resets** label is easy to misread as a Budget control, but the current shipped effect is on the Data page.

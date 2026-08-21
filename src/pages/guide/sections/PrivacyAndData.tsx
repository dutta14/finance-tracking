import { FC } from 'react'

const PrivacyAndData: FC = () => (
  <section className="guide-section" id="privacy">
    <h2>Privacy &amp; data</h2>
    <p>
      What follows is the literal version of the promise above. Where your data lives and what this app does not do.
    </p>

    <section className="guide-subsection" id="where-your-data-lives">
      <h3>Where your data lives</h3>
      <p>
        A folder on your computer. When you first open the app, you pick (or create) a folder and the app stores
        everything there as plain JSON and CSV files: accounts, balances, transactions, goals, tax checklists, budget
        categories, and everything else. The folder is yours. You can browse it in Finder, back it up however you like,
        or move it to another machine.
      </p>
      <p>
        The app uses the{' '}
        <a
          href="https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API"
          target="_blank"
          rel="noopener noreferrer"
        >
          File System Access API
        </a>{' '}
        (Chrome and Edge) to read and write directly to this folder. Your browser remembers which folder you picked so
        you don&apos;t have to re-select it every time, but it will ask for permission again after a restart.
      </p>
    </section>

    <section className="guide-subsection" id="plain-files">
      <h3>Plain files, no encryption</h3>
      <p>
        Your data is stored as readable files. There is no passphrase, no encryption layer, and no unlock screen. If you
        want to protect the folder, use your operating system&apos;s full-disk encryption (FileVault on macOS, BitLocker
        on Windows) or store the folder in an encrypted volume. The app does not add its own encryption on top.
      </p>
    </section>

    <section className="guide-subsection" id="what-this-app-does-not-do">
      <h3>What this app does not do</h3>
      <p>
        No analytics. No third-party scripts. No accounts. No backend. No telemetry, no error reporting, no
        fingerprinting. No data ever leaves your computer. You can verify this by opening the Network tab in devtools
        and watching the app do nothing.
      </p>
    </section>

    <section className="guide-subsection" id="trade-off">
      <h3>The trade-off, stated honestly</h3>
      <p>
        If you delete the folder, your data is gone. There is no cloud backup, no recycle bin inside the app, and no
        support team that can recover it. Back up the folder the same way you&apos;d back up any important files on your
        computer.
      </p>
    </section>
  </section>
)

export default PrivacyAndData

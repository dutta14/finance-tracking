import { FC } from 'react'

const PrivacyAndData: FC = () => (
  <section className="guide-section" id="privacy">
    <h2>Privacy &amp; data</h2>
    <p>
      What follows is the literal version of the promise above. Where your data lives, how it&apos;s encrypted, and what
      this app does not do.
    </p>

    <section className="guide-subsection" id="where-your-data-lives">
      <h3>Where your data lives</h3>
      <p>
        Your browser. Not the cloud. Every account, balance, transaction, goal, tax checklist item, uploaded file, and
        budget record is stored in <code>localStorage</code> and <code>IndexedDB</code> on the device you&apos;re using
        right now. Close the tab, reopen it, the data is still there. Open it on a different device and you&apos;ll
        start from scratch unless you turn on GitHub Sync or import a backup.
      </p>
    </section>

    <section className="guide-subsection" id="encrypted-at-rest">
      <h3>What &quot;encrypted at rest&quot; means</h3>
      <p>
        When you set a passphrase, sensitive data is encrypted with AES-256-GCM before it&apos;s written to your
        browser. That includes account balances, transactions, goals, tax documents, sync credentials, and the rest of
        the app state that would be awkward to leave lying around in plaintext. If someone opens devtools and inspects
        your storage, they see ciphertext. The encryption key is derived from your passphrase using PBKDF2 with 600,000
        iterations, and the key itself is never stored. It exists in memory only while the app is unlocked.
      </p>
    </section>

    <section className="guide-subsection" id="github-sync">
      <h3>What GitHub Sync does</h3>
      <p>
        GitHub Sync is opt-in. When you turn it on, the app pushes an encrypted snapshot of your data to a private
        GitHub repo that you create and own. You provide a personal access token with <code>repo</code> scope. The token
        is stored encrypted in your browser. The repo is yours, the data in it is already encrypted, and you can revoke
        the token from GitHub settings at any time.
      </p>
    </section>

    <section className="guide-subsection" id="what-this-app-does-not-do">
      <h3>What this app does not do</h3>
      <p>
        No analytics. No third-party scripts. No accounts. No backend. No telemetry, no error reporting, no
        fingerprinting. No data ever leaves your browser unless you turn on GitHub Sync. You can verify this by opening
        the Network tab in devtools and watching the app do nothing.
      </p>
    </section>

    <section className="guide-subsection" id="trade-off">
      <h3>The trade-off, stated honestly</h3>
      <p>
        If you lose your passphrase, your encrypted data is unrecoverable. There is no password reset. There is no
        support team with a backdoor. There is no recovery email. This is by design.
      </p>
    </section>
  </section>
)

export default PrivacyAndData

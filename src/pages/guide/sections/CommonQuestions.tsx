import { FC } from 'react'

const questions = [
  {
    id: 'faq-free',
    question: 'Is this free?',
    answer: 'Yes. Forever. No paid tier, no premium features, no upsell. The app is open source under MIT.',
  },
  {
    id: 'faq-data',
    question: 'Where does my data go?',
    answer:
      "Your browser. It stays in localStorage and IndexedDB on the device you're using. If you turn on GitHub Sync, an encrypted copy also goes to a private GitHub repo that you own. That's it.",
  },
  {
    id: 'faq-switch-devices',
    question: 'What if I switch devices?',
    answer:
      'You have two options. Turn on GitHub Sync to keep devices in sync automatically, or use Export on one device and Import on the other. Without one of those, each device is independent.',
  },
  {
    id: 'faq-passphrase',
    question: 'What if I lose my passphrase?',
    answer:
      'Your encrypted data is unrecoverable. There is no reset, no backdoor. Store your passphrase in a password manager. See “The trade-off, stated honestly” above for the full reasoning.',
  },
  {
    id: 'faq-export',
    question: 'Can I export my data?',
    answer:
      'Yes. Settings has a one-click export as JSON. You can export encrypted or plaintext. Plaintext is portable and human-readable. Encrypted is safer to park in generic cloud storage.',
  },
  {
    id: 'faq-open-source',
    question: 'Is this open source?',
    answer: 'Yes. MIT license. Source is at github.com/dutta14/finance-tracking. Read it, fork it, run it yourself.',
  },
  {
    id: 'faq-offline',
    question: 'Does it work offline?',
    answer:
      'Yes, once loaded. The app is a static bundle. After the first visit, your browser caches it and you can use it on a plane, in a tunnel, or with your wifi off. GitHub Sync just waits until you are back online.',
  },
  {
    id: 'faq-budget-vs-transactions',
    question: "What's the difference between Budget and Transactions?",
    answer:
      'Transactions is for the raw list: filter, inspect, correct, categorize. Budget is for the roll-up: detailed, aggregated, or cashflow views across a whole year. If you are fixing individual entries, start in Transactions. If you are asking where the money went, start in Budget.',
  },
  {
    id: 'faq-use-every-page',
    question: 'Do I need to use every page?',
    answer:
      'No. The app works fine as a net-worth tracker with goals. Or as a budget tool with tax storage. Or as a private archive for documents. Use the parts that solve your actual problem.',
  },
  {
    id: 'faq-mobile',
    question: 'Why no mobile app?',
    answer:
      'The web app works on mobile browsers, and a native app would require an account system, an app store, and a backend. The whole point of this app is that none of those exist. Add the site to your home screen on iOS or Android and it behaves like an app.',
  },
  {
    id: 'faq-audit',
    question: 'Is this audited or production-grade?',
    answer:
      "No formal audit. One person built it. It's used daily by its author. The crypto uses standard Web Crypto primitives, AES-256-GCM and PBKDF2 at 600,000 iterations. Treat it as a personal tool, not a bank.",
  },
  {
    id: 'faq-trust',
    question: 'Why should I trust this?',
    answer:
      "You shouldn't blindly trust anything with your financial data. Here's what's true: the source code is public, the app makes no network calls except optional GitHub Sync, which you can verify in devtools, and your data never leaves your browser. Read the code. Or just try it with one account and see for yourself.",
  },
]

const CommonQuestions: FC = () => (
  <section className="guide-section" id="common-questions">
    <h2>Common questions</h2>
    <dl className="guide-faq-list">
      {questions.map(item => (
        <div className="guide-faq-item" id={item.id} key={item.id}>
          <dt>{item.question}</dt>
          <dd>{item.answer}</dd>
        </div>
      ))}
    </dl>
  </section>
)

export default CommonQuestions

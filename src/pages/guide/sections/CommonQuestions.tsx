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
      "A folder on your computer that you choose. The app reads and writes plain JSON and CSV files using the File System Access API. Your data never leaves your machine.",
  },
  {
    id: 'faq-switch-devices',
    question: 'What if I switch devices?',
    answer:
      'Copy your data folder to the new device. It contains standard JSON and CSV files that the app reads directly. You can also keep the folder in a synced location like iCloud Drive or Dropbox.',
  },
  {
    id: 'faq-export',
    question: 'Can I export my data?',
    answer:
      'Your data is already in a folder as plain JSON and CSV files. You can browse it, copy it, back it up, or open the files in any text editor or spreadsheet app.',
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
      'Yes, once loaded. The app is a static bundle. After the first visit, your browser caches it and you can use it on a plane, in a tunnel, or with your wifi off.',
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
      'The web app works on mobile browsers (Chrome or Edge required for folder access), and a native app would require an account system, an app store, and a backend. The whole point of this app is that none of those exist.',
  },
  {
    id: 'faq-browser',
    question: 'Which browsers are supported?',
    answer:
      'Chrome and Edge. The app uses the File System Access API which is not available in Firefox or Safari. On mobile, use Chrome for Android.',
  },
  {
    id: 'faq-trust',
    question: 'Why should I trust this?',
    answer:
      "You shouldn't blindly trust anything with your financial data. Here's what's true: the source code is public, the app makes zero network calls (verify in devtools), and your data lives in a folder you control. Read the code. Or just try it with one account and see for yourself.",
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

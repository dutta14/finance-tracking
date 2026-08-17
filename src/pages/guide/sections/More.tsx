import { FC } from 'react'

const More: FC = () => (
  <section className="guide-section" id="more">
    <h2>More</h2>
    <ul className="guide-link-list">
      <li>
        <a
          href="https://github.com/dutta14/finance-tracking/blob/main/CONTRIBUTING.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          Self-host or contribute
        </a>
      </li>
      <li>
        <a href="https://github.com/dutta14/finance-tracking" target="_blank" rel="noopener noreferrer">
          Source code
        </a>
      </li>
      <li>
        <a href="https://anindya.dev/blog" target="_blank" rel="noopener noreferrer">
          Anindya&apos;s blog
        </a>
      </li>
      <li>
        <a
          href="https://github.com/dutta14/finance-tracking/blob/main/LICENSE"
          target="_blank"
          rel="noopener noreferrer"
        >
          License
        </a>
      </li>
    </ul>
    <p>Built in the open, for an audience of one. Useful to anyone who wants the same thing.</p>
  </section>
)

export default More

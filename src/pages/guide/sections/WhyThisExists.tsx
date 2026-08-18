import { FC } from 'react'

const WhyThisExists: FC = () => (
  <section className="guide-section" id="why-this-exists">
    <h2>Why this exists</h2>
    <p>
      It is a Sunday morning and I have a spreadsheet open that I have kept, on and off, for the better part of a
      decade. The date column is wider than it needs to be, in a green I never quite picked on purpose, and the formula
      in the last row has been broken for two months without me noticing. Before this spreadsheet there were others.
      There was Mint, while it lasted; there was a subscription app that asked, very politely, for the login to my bank;
      there was a notebook I kept for one quarter and then misplaced behind a stack of books I was meaning to read. None
      of them stayed. The spreadsheet stayed, in its half-broken way, because nobody could take it from me.
    </p>
    <p>
      The pattern repeats. The good apps die or get bought and become something else; the subscriptions keep charging
      long after I have stopped opening them; the free ones want my bank credentials, and somewhere down in the terms of
      service is a sentence about how my data may be used to improve the product, which is the polite phrasing for sold.
      The spreadsheets survive in a quieter way, but they live in browser tabs I forget to close and folders I forget to
      back up, and the formulas drift, and one day a cell refers to a sheet that no longer exists. None of it ever felt
      like mine. It always felt borrowed. And there is a small embarrassment, after a while, in handing the keys to your
      financial life to a company that needs to grow every quarter to keep its lights on, and pretending the arrangement
      is normal.
    </p>
    <p>
      So this is small, on purpose. It runs in your browser. If you set a passphrase, the data is encrypted before it
      touches your disk, and the key stays with you; if you want a backup, you can sync to a private GitHub repository
      of your own, and that is the only place it ever leaves your machine. There is no account to create. There is no
      server I run. There is no analytics pixel sitting in the corner of the page, quietly counting how long you spent
      on the budget screen. It is a small app for one person to keep their own books, on a Sunday morning, in a green
      they did not quite pick on purpose.
    </p>
  </section>
)

export default WhyThisExists

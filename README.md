# jakeliu.me

Personal site of Jake Liu. Static HTML and CSS, plus a short script, served by GitHub Pages. No trackers, cookies, or third-party scripts.

Fonts are Source Serif 4, Inter, and IBM Plex Mono, self-hosted under the SIL Open Font License. License texts are in `assets/fonts/`.

## Personal trading

Citi Compliance has not cleared personal trading for publication.

Each page sets `data-show-trading` on `<body>`. `"true"` shows the trading sections. `"false"` hides them. The attribute has to match on `index.html`, `404.html`, and `colophon/index.html`. Search the repository for `data-show-trading`.

Hiding is visual. The copy stays in the HTML until every element marked `data-trading` is removed, and a search engine can still read text that is only hidden with CSS.

If the public site must not describe trading at all, also replace the `<title>`, the meta description, and `og.png`. The banker-safe title and description are commented at the top of `index.html`.

The internal name of the trading practice is intentionally absent from this repository.

## Resume

`/Jake-Liu-Resume.pdf` is the current public resume. It does not describe the independent trading practice. Replace the file with the trading draft only after that draft’s open items are confirmed, and only if compliance allows the PDF to mention the trading.

## Domain

`CNAME` is `jakeliu.me`. Leave it in place. Enforce HTTPS is a GitHub Pages setting, not a file in this repository.

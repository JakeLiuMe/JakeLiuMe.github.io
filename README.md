# jakeliu.me

Personal site of Jake Liu. Static HTML and CSS, plus a short script, served by GitHub Pages. No trackers, cookies, or third-party scripts.

Fonts are Source Serif 4, Inter, and IBM Plex Mono, self-hosted under the SIL Open Font License. License texts are in `assets/fonts/`.

Trading sections use `data-show-trading` on `<body>` in `index.html`, `404.html`, and `colophon/index.html`. `"true"` shows them. `"false"` hides them.

`/data/daily.json` feeds the performance charts. It is a list of `{ "date", "net_pnl_usd", "settled_trades" }`. An empty list, or a missing file, draws nothing.

## Resume

`/Jake-Liu-Resume.pdf` is the current public resume.

## Domain

`CNAME` is `jakeliu.me`. Leave it in place. Enforce HTTPS is a GitHub Pages setting, not a file in this repository.

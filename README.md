# jakeliu.me

Source for [jakeliu.me](https://jakeliu.me), Jake Liu's personal site. Plain HTML and CSS; no build step.

## Layout

- `index.html` — the site
- `assets/site.css` — styles
- `404.html` — shown by GitHub Pages for unknown paths
- `CNAME` — custom domain for GitHub Pages
- `.nojekyll` — serve files as-is (skip Jekyll)

## Publishing

GitHub Pages serves the `main` branch root. Pushing to `main` publishes within a minute or two.

DNS (managed at Squarespace Domains):

| Type  | Name | Value |
|-------|------|-------|
| A     | @    | 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153 |
| CNAME | www  | jakeliume.github.io |

The MX and TXT records serve Google Workspace email for Jake@JakeLiu.me; leave them unchanged.

## Content rules

- Citi results as percentages only; no client dollar amounts, screenshots, or internal data.
- Trading content describes engineering and risk controls, never recommendations.

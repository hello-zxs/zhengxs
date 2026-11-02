# zhengxs.com

The personal academic site of **Zheng Xiangsheng** — physics MSc at Western University, working on transformation optics, geodesic lenses and quantum optics.

The site is deliberately **static**: hand-written HTML, CSS and a little JavaScript, no build step, no framework, no analytics. It is hosted on GitHub Pages at [zhengxs.com](https://zhengxs.com).

## What is here

```
index.html                     Home: live Luneburg ray tracer, research index, thesis, notes
research/index.html            Three research threads with interactive figures
notes/index.html               Field notes index
notes/*/index.html             Three long-form notes (KaTeX, figures, code)
publications/index.html        Thesis, notes, work in progress
papers/morse-lens/index.html   The BSc thesis, typeset for the web
cv/index.html                  Curriculum vitae (archive; the Record is canonical)
about/index.html               Profile, method, colophon
zh/index.html                  Chinese introduction
matrix/index.html              The three-site matrix: roles, canonical map, dock spec
404.html                       Ray not found

assets/css/site.css            The whole design system
assets/js/site.js              Navigation, clock, reveals, math, copy buttons
assets/js/labs.js             Four computed figures (canvas, no libraries)
assets/matrix/                 The portable matrix dock (matrix.css + matrix.js)
assets/figures/                Scientific SVG figures (computed, not traced)
assets/fonts/                  Self-hosted Newsreader and IBM Plex
assets/vendor/katex/           Self-hosted KaTeX
assets/pdf/                    Web editions of the thesis and CV
feed.xml, sitemap.xml          RSS and sitemap
CNAME                          zhengxs.com
.nojekyll                      Serve files as-is on GitHub Pages
```

## The matrix

zhengxs.com is the **Index** of a three-site matrix:

| Role | Domain | What it is for |
|---|---|---|
| **Index** | [zhengxs.com](https://zhengxs.com) | The person, now: profile, selected work, field notes |
| **Lab** | [qmentropy.com](https://qmentropy.com) | Instruments, papers and computations in light and geometry |
| **Record** | [zhengxiangsheng.com](https://zhengxiangsheng.com) | CV, education, publications and the formal record |

The sites share a typographic hand, three role colours (Index orange, Lab cyan, Record cobalt) and one small dock. They do **not** share a CMS or a deployment pipeline. The rule is **one artifact, one canonical home**: notes on the Index, full papers in the Lab, the CV in the Record.

The dock is portable. On any site:

```html
<link rel="stylesheet" href="/assets/matrix/matrix.css">
<script defer src="/assets/matrix/matrix.js"></script>
<meta name="matrix-site" content="index">
```

Copy `assets/matrix/` and the two font files (`newsreader-var.woff2`, `plex-mono-400/500.woff2`) into the target site; edit the `ROLES` array in `matrix.js` to add a fourth node. The dock is hidden on phones (it would cover content); the footer strip and each site's mobile menu carry the same links. The full specification is at [zhengxs.com/matrix](https://zhengxs.com/matrix/).

## Local preview

From the repository root:

```bash
python -m http.server 8000
# open http://127.0.0.1:8000
```

Any static server works. Open the site through the server, not as a `file://` URL: the fonts, canvas figures and absolute paths assume a server root.

## Deploying to GitHub Pages

1. Push this directory to the repository `hello-zxs/zhengxs` (branch `main`).
2. In the repository: **Settings → Pages → Build and deployment → Deploy from a branch**.
3. Choose **main** and **/ (root)**, then save.
4. Custom domain: **zhengxs.com**. The `CNAME` file is already present, so the setting should survive a push.
5. Enable **Enforce HTTPS** once the certificate is issued.

### DNS

At the domain registrar, point the apex domain at GitHub Pages:

| Type | Host | Value |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | hello-zxs.github.io |

Remove any old A/AAAA/CNAME records for the apex first. DNS can take up to 24 hours; the GitHub Pages certificate is issued after the records resolve.

> **Note on the repository subpath.** All asset URLs are root-absolute (`/assets/...`) because the site is served from the apex domain. Before the custom domain resolves, `https://hello-zxs.github.io/zhengxs/` will not load its styles or figures. Use the custom domain, or serve the folder locally, for previews.

## Editing

- **Pages** are complete HTML files. Shared navigation and footer are repeated in each file; if you add a section, update every page's nav and the mobile menu.
- **Design tokens** live at the top of `assets/css/site.css` (`:root`): colours, typefaces, spacing, the navigation height.
- **Notes** are self-contained pages. To add one: copy an existing note folder, change the title, metadata, body, figure and previous/next links; add a row to `notes/index.html` and `publications/index.html`; add the URL to `sitemap.xml` and `feed.xml`.
- **Thesis PDF** and **CV PDF** in `assets/pdf/` are web editions printed from the HTML with Chrome's print-to-PDF. The HTML is the source of truth; reprint after substantive edits.
- **Figures** are SVG files in `assets/figures/`. The light figures are computed from the same equations described in the notes; the dark plates are instrument-style renders for the home and research pages.
- **Fonts** are self-hosted under the SIL Open Font License: [Newsreader](https://github.com/productiontype/Newsreader) and [IBM Plex](https://github.com/IBM/plex). Math is typeset with [KaTeX](https://katex.org/) (MIT).

## Content and licence

Text, figures and the design are © 2026 Zheng Xiangsheng. The code is available for reading and learning; please do not republish the written content or the thesis as your own. For permissions, corrections or collaboration, write to `helloworld.3a@gmail.com`.

The thesis PDF is a **web edition** typeset from the HTML; the examined submission is the document held by Xiamen University Malaysia.

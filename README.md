# Dog Pill Log (URL-Only)

Static HTML/CSS/JS tracker for a dog pill schedule (morning and evening).

No Node.js runtime is required for deployment or use.

The entire log is encoded in the URL hash (`#d=...`). No database, cookies, or local storage are used.

## How It Works

- Each day has 2 bits of state:
  - Morning not given / given
  - Evening not given / given
- The app stores a rolling 365-day window.
- Data is packed into bytes and encoded as [Base64url](https://en.wikipedia.org/wiki/Base64#URL_applications).
- A small [checksum](https://en.wikipedia.org/wiki/Checksum) is included for corruption detection.

## Run Locally

Open `index.html` in a browser.

Optional: use any simple static file server for local testing, but the app itself is pure client-side JavaScript.

## Deploy To GitHub Pages

1. Push this repo to GitHub.
2. In repository settings, open Pages.
3. Set source to deploy from the branch (usually `main`) and root (`/`).
4. Save.
5. Open the provided Pages URL.

GitHub Pages only serves static assets, which is exactly what this project uses (`index.html`, `styles.css`, `app.js`).

## Usage

1. Check morning/evening boxes for each day.
2. The URL updates automatically.
3. Share or bookmark the URL to keep the log state.

## Notes

- This is strict URL-only persistence.
- If URL data is invalid, the app starts a fresh log.
- A warning appears if URL length approaches conservative browser limits.
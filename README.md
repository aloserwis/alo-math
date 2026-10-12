Failed to create stream fd: Operation not permitted
Failed to create stream fd: Operation not permitted
Failed to create stream fd: Operation not permitted
# Math Adventure V3

Polish–Vietnamese grade 4 math practice app with 100 fixed questions, step-by-step hints, saved progress, a parent area protected by a PIN, and CSV export.

## Files

- `index.html` is the complete self-contained web app. Its fixed question bank is embedded in the page so the app works without a server or API.
- `questions.json` is the matching standalone question bank for review and reuse; the app does not fetch it at runtime.
- `CNAME` reserves `math.aloserwis.com` for GitHub Pages.
- `.github/workflows/pages.yml` deploys the repository root to GitHub Pages on every push to `main` and on manual workflow dispatch.

## Deploy

Create a repository named `alo-math`, push these files to its `main` branch, then in **Settings → Pages** choose **GitHub Actions** as the build and deployment source. The workflow publishes the site on each subsequent push to `main`.

Set the repository's Pages custom domain to `math.aloserwis.com`. At the DNS provider, create `CNAME` record `math` pointing to `<GitHub account>.github.io`; enable HTTPS in Pages after GitHub provisions the certificate.

## Data and privacy

Question progress and the parent PIN are stored in that browser's local storage. They do not synchronize between devices. The PIN is an accidental-entry guard in the app UI, not strong authentication. CSV export is available in the parent panel.

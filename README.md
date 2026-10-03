# Fieldnotes — Trading research journal

A small, local-first journal for structured 4H and 15M trading research. Real and Backtest records are stored separately in the current browser and share the same entry and analytics structure.

## Run

Open `index.html` in a modern browser. No install, server, or account is required. Records are saved in that browser's local storage; clearing browser data removes them.

## Host on GitHub Pages

This repository includes a GitHub Actions workflow that deploys the site whenever you push to the `main` branch.

1. Create a GitHub repository and push these files to its `main` branch.
2. In the repository, open **Settings → Pages** and set the build and deployment source to **GitHub Actions**.
3. Open the **Actions** tab and wait for **Deploy journal to GitHub Pages** to finish. The deployment job shows the published URL.

The app is static and needs no build step, server, or secrets. The workflow publishes the repository files as-is. If your default branch is not named `main`, update the branch under `on.push.branches` in `.github/workflows/pages.yml`.

## Record structure

- Every record includes pair, timeframe, 4H direction, POI, liquidity, entry model, and outcome.
- 15M records also require one of the six configured strategy phases and keep their 4H direction context.
- Model 3 records only `Retracement: Yes/No`; Yes means wait for the engulfed candle's head, while No means enter after the engulf. Model 4 records confirmation-leg liquidity and its retracement level. Models 1 and 2 have no extra conditions.
- R and the 25%, 50%, and 75% SL/TP checkpoints are recorded only for entered 15M trades with Win or Loss outcomes. The 100% SL threshold is derived from 15M Loss outcomes; the 100% TP threshold is derived from 15M Win outcomes.
- Analytics can be filtered by pair, timeframe, context, setup, model-specific detail, and outcome. Model 3 compares Retracement Yes vs No; Model 4 compares confirmation-leg liquidity Yes vs No and each liquidity/level combination. The model and level comparison rows drill directly into those filters.
- Outcome counts show Win, Loss, Missed, and Never Reached Zone. Win/loss percentages in the overview and comparison tables are shares of all matching occurrences; average R uses entered trades with R recorded. Filtered 15M SL/TP progression tables report actual frequencies and eventual outcomes for the 25%, 50%, 75%, and 100% thresholds.

## Privacy

Journal entries remain in this browser's local storage and are not sent to a server or GitHub. Hosting the app does not sync data across browsers or devices. GitHub Pages uses a different browser origin than opening `index.html` as a local file, so existing local-file entries will not automatically appear on the hosted site.

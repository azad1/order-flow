# Nifty & Sensex Estimator — custom edition

This is a personal, non-commercial adaptation of **Order Flow**, created by
[Mr. Chartist](https://mrchartist.com). Original source:
[MrChartist/order-flow](https://github.com/MrChartist/order-flow).
The public custom edition lives in the linked GitHub fork
[azad1/order-flow](https://github.com/azad1/order-flow).
The local work started at upstream commit
`767b9db2cfb2bbf2ad4ce87566dc2b83860e6ba6`.

The original copyright, PolyForm Noncommercial 1.0.0 licence, third-party notices,
font licences and asset attribution remain in this repository. This edition is
not an official release or endorsement from the original author or the exchanges.
See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md). Commercial use requires the
separate licence described by the original project.

## What changed

- The custom edition is named **Nifty & Sensex Estimator**, with the original Order Flow credit retained.
- Nifty 50 and Sensex tabs with one combined constituent list for each index.
- Sort stocks by descending published weight or largest absolute estimated impact.
- Distinct futures price, futures percentage move, index weight and estimated point-impact labels.
- A narrower stock list, wider connection area and animated directional paths with pause controls.
- Colour intensity based on impact, price movement or index weight.
- An interactive comparison chart for the index future and weighted constituent estimate.
- Recorded replay is the recommended comparison mode. Both the basket and benchmark readings, prices and rankings use the latest observed minute shared by available futures.
- A data-quality card distinguishes recorded, reconstructed, simulated and connected sources; shows session, shared candle time, coverage and weight date; and discloses expiry differences and older weights.
- The comparison chart preserves observed opening gaps and reports **Future − estimate** in percentage points at the selected shared minute. It never forces the curves to agree.
- `npm.cmd run check:comparison` audits recorded-session coverage, timestamps, price bases and contracts without broker credentials.
- Top five daily contributors in each direction, plus top five recent risers and fallers over a shared 15-minute window.
- Stock detail panels opened from the left list or the contributor cards.
- Tests for rankings, futures-only prices, chart calculations, recent movers and the index switch.

## What the numbers mean

Stock prices displayed by this edition come from futures. An unavailable future
is shown as unavailable; a cash price is not silently substituted.

Estimated percentage-point impact = index weight (%) × stock futures move (%) ÷ 100.
Estimated point impact = that percentage-point impact × the cash index's previous
close ÷ 100. The cash-index reference is used only to convert the estimate into
index points; it is not presented as a futures quote.

These are futures-based estimates using dated weights, not official spot-index
attribution. Futures basis, the selected contract and incomplete coverage can
make the estimate differ from the actual index future. The comparison chart
uses shared candle timestamps rather than inventing missing observations.

- Nifty weights: NSE Indices snapshot dated **30 October 2026**; source links are
  retained in `src/features/market-flow/nifty50-weights.json`.
- Sensex weights: secondary reproduction dated **7 September 2026**, labelled as
  such in the board; constituent membership checked against BSE on **30 October
  2026**. See `src/features/market-flow/sensex-weights.json` for source and caveats.

## Data status

The verified local setup uses the bundled **6 November 2026 archive replay**.
Its closing prices and open interest come from exchange archives. Its intraday
paths are reconstructed for replay; they are not recorded live ticks. Moving
connectors indicate visual activity, not proof of a live exchange connection.

No working Kotak Neo, Angel One or direct NSE/BSE live adapter has been added.
Broker credentials, login details, local configuration, logs and diagnostic
scratch files are not part of this repository. `.env` and encrypted token files
are ignored by Git. `.env.example` contains examples only.

The optional Kotak encryption helper files are an unfinished experiment. They
are not used by archive mode, have no credentials, and have not been verified
under the local Windows script policy. Do not treat them as a working live-feed
or enabled encryption feature. No Windows policy changes are required to run
the dashboard in archive mode.

## Run on Windows

For software checks, Git or ZIP download, troubleshooting and restart instructions,
see the [Windows setup guide](docs/WINDOWS_SETUP.md). The
[screenshot gallery](docs/screenshots/README.md) shows the current custom layout.

Install Node.js 22.18 or newer if needed. Open PowerShell in this repository's
folder, then install the project's local packages:

```powershell
npm.cmd install
```

Start the archive replay:

```powershell
npm.cmd run dev:archive
```

Open **http://127.0.0.1:5195**. Stop the app with **Ctrl+C** in that terminal.
If Windows asks whether to terminate the batch job, type **Y** and press Enter.
No broker account or API key is needed for this mode.

Exchange archives are stored in `data/archive/`; recorded sessions are in
`data/recorded/`. Runtime snapshots are stored in `server/data/` and excluded
from Git. To fetch a newer completed exchange session, stop the app, run
`npm.cmd run fetch:nse`, then start archive mode again.

The original project's API integration guide remains in [PROVIDERS.md](PROVIDERS.md).
A future live integration should keep credentials on the local server, show
the source and freshness clearly, and verify futures contracts and timestamps
before switching the dashboard from replay to live.

This dashboard is an information and research tool, not investment advice.

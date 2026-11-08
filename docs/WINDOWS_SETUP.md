# Windows setup — Nifty & Sensex Estimator

This guide is for the public fork at [azad1/order-flow](https://github.com/azad1/order-flow). It uses Windows PowerShell and the bundled archive replay. You do not need a broker account, API key or Python.

[Back to the README](../README.md) · [See the current screenshots](screenshots/README.md)

## 1. Check what is installed

Open a normal PowerShell window. You do not need to run it as administrator.

Check Node.js:

```powershell
node --version
```

The project requires **22.18 or newer**. If Node is missing, download the Windows **LTS** installer from [nodejs.org](https://nodejs.org/en/download), install it, then close all terminal windows and open PowerShell again. Do not install optional extra development tools just for this app.

Check npm, which comes with Node.js:

```powershell
npm.cmd --version
```

Git is optional. Check it if you want to use the Git download route:

```powershell
git --version
```

If Git is missing, use the ZIP route below. You can also install it yourself from [Git for Windows](https://git-scm.com/downloads/win). There is no need to install npm packages globally or change PowerShell's execution policy.

## 2. Download this fork

Choose one route.

### Route A: no Git — download a ZIP

1. Open [azad1/order-flow](https://github.com/azad1/order-flow).
2. Click **Code → Download ZIP**.
3. In File Explorer, right-click the downloaded ZIP and choose **Extract All**.
4. Keep the extracted project in a folder you own, such as Documents. Do not install it inside `C:\Windows\System32`.
5. Open the extracted **order-flow-main** folder. Confirm that it contains `package.json`, `src` and `server`.
6. Click File Explorer's address bar, type `powershell`, then press Enter. This opens PowerShell in that folder.

### Route B: Git is installed

Open PowerShell in the parent folder where you want the project, then download it:

```powershell
git clone https://github.com/azad1/order-flow.git
```

Enter the new project folder:

```powershell
Set-Location .\order-flow
```

For either route, check that you are in the right place:

```powershell
Test-Path .\package.json
```

The answer should be **True**.

## 3. Install the local packages

Run this in the project folder:

```powershell
npm.cmd install
```

This downloads the app's dependencies into its `node_modules` folder. It needs internet access and does not install packages globally. Wait until the normal PowerShell prompt returns. If it reports an error, resolve that error before continuing.

## 4. Start the archive replay

```powershell
npm.cmd run dev:archive
```

Keep this terminal open and visit **http://127.0.0.1:5195/**.

Check that:

- The page shows **Nifty 50** and **Sensex** tabs.
- The status says **NSE archive [date] · replay**. The bundled date is **6 November 2026**.
- The futures-loading counter finishes. A genuinely unavailable future can still be marked unavailable.
- Prices, futures percentage moves, weights and estimated point impacts appear.
- Clicking a stock in the left list opens its detail panel.
- Scrolling down reveals the daily contributors and recent movers.

The replay date is the date of the stored session, not a claim that the app is receiving today's live prices. Animated lines are decorative.

## 5. Start again or stop

**Start again:** open PowerShell in the same project folder and run:

```powershell
npm.cmd run dev:archive
```

**Stop:** return to that terminal and press **Ctrl+C**. If Windows asks to terminate the batch job, type **Y** and press Enter. Closing the browser tab alone does not stop the server.

You do not need to run `npm.cmd install` on every start.

## 6. Try the controls

1. Choose **Nifty 50** or **Sensex** at the top.
2. Choose **Impact** to rank the largest effects, positive or negative, first; choose **Weight** for highest index weight first.
3. Switch **Shade by** between Impact, Move and Weight.
4. Try **Full list** to see the extra columns, then return to **Flow + chart**.
5. Use the chart's **Session / 1 hour / 15 min** buttons and time slider.
6. Compare the **Top 5 pushing up / pulling down** with the **Recent movers**. They answer different questions.
7. Click a stock row or card for its details. Close it using **×** or **Escape**.
8. Try the theme switch and the connector motion control.

[Current interface screenshots](screenshots/README.md)

## 7. Get a newer completed exchange session

Stop the app with Ctrl+C first, then fetch the latest published archive:

```powershell
npm.cmd run fetch:nse
```

After a successful download, start archive replay again:

```powershell
npm.cmd run dev:archive
```

Check the date in the status line. Downloads depend on the exchanges having published the files and being reachable. This fetches completed-session data, not live market ticks. The archive's minute-by-minute path is reconstructed from daily figures.

## 8. Run the built app in one process

Stop the development server first. Build the page:

```powershell
npm.cmd run build
```

Start the page and API together in archive mode:

```powershell
npm.cmd run start:archive
```

Open **http://127.0.0.1:8787/**. Stop with Ctrl+C. This is a local app; you do not need to publish it or open a firewall port.

## Files and data

| Folder or file | Purpose |
|---|---|
| `data/archive/` | Completed exchange archive sessions. |
| `data/archive/.cache/` | Download cache, ignored by Git. |
| `data/recorded/` | Bundled or recorded sessions. |
| `server/data/` | Generated local snapshots, ignored by Git. |
| `node_modules/` | Installed project packages, ignored by Git. |
| `.env` | Optional private provider settings, ignored by Git. Not needed for archive replay. |
| `docs/screenshots/` | Public screenshots of the custom dashboard. |

For a future live provider, follow [the provider setup section](../README.md#connect-any-api). The current launcher does not automatically read `.env`; that section gives explicit commands to load it. Never put real credentials in `.env.example`, a screenshot or a GitHub issue.

## Common Windows problems

| What you see | What to do |
|---|---|
| `node` or `npm.cmd` is not recognized | Close all terminal windows and open a new one after installing Node. If it still fails, use the checks below before reinstalling anything. |
| `npm.ps1 cannot be loaded` / scripts are disabled | Use **`npm.cmd`**, as shown here. Do not change the system execution policy. |
| `package.json` cannot be found / `ENOENT` | Open PowerShell in the extracted project folder, not its parent or the ZIP file. `Test-Path .\package.json` should return True. |
| `EADDRINUSE` / port 8787 is already in use | Stop the other Estimator server in its terminal, then retry. Do not stop unrelated processes. |
| The terminal prints port 5196 or another page address | Port 5195 was occupied, so Vite selected another port. Use the exact Local address printed, or stop the earlier app instance and restart. |
| The page shows loading, pending or unavailable futures | Wait for the first collection to finish and read the status line. Missing futures are not replaced with cash prices. Check terminal errors if loading never completes. |
| It says Demo or shows an older date | Start with `npm.cmd run dev:archive` and read the replay date. Fetching an archive does not establish a live connection. |
| Archive download fails | Read the terminal message. Retry when the exchange files are available; the bundled session remains available. |
| Changes do not appear in the built app | Stop it, rebuild with `npm.cmd run build`, then run `npm.cmd run start:archive` again. |

If Windows still cannot find Node, check the normal installation location:

```powershell
Test-Path "C:\Program Files\nodejs\node.exe"
```

If that says **True**, check its version directly:

```powershell
& "C:\Program Files\nodejs\node.exe" --version
```

You can add that existing installation to **this PowerShell window only**:

```powershell
$env:Path = "C:\Program Files\nodejs;" + $env:Path
```

Then retry `node --version` and `npm.cmd --version`. This does not change saved Windows settings. If the file check says False, return to the official Node download step.

When asking for help, share the error text and the command that caused it, with any private information removed. Never share keys, tokens, PINs or login codes.

This is an information and research tool, not investment advice. Original software: [Mr. Chartist](https://mrchartist.com); [licence and required notice](../LICENSE).

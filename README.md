# AURUM — Gold Trading Terminal (local Node.js app)

A standalone local dashboard for XAUUSD with:
- Simple mode and detailed analysis mode
- H1 / M15 / M5 / M1 technical filters
- RSI, EMA, MACD histogram and approximate ATR
- BUY SETUP / SELL SETUP / WAIT guidance
- Overbought / oversold warnings
- Risk and margin estimate calculator
- Demo candles, CSV import and optional MT5 Expert Advisor bridge

## Important limitations
This is an educational decision-support prototype, not a profitable strategy or a broker terminal.
It does not place, manage, or close trades. Signals are filters, not recommendations.
The demo feed is synthetic. CSV data is historical. The MT5 bridge sends candles from your terminal.
Confirm Valetax symbol contract size, margin factor, leverage tier, spread and commission in MT5.
The default risk calculator assumes 100 USC = USD 1 and a 1 oz contract; edit these inputs to match your account specification.
Do not use signals with real money until you have tested them on historical data and demo trading.

## Requirements
- Windows 10/11
- Node.js 18 or newer (https://nodejs.org/)

## Run
1. Extract this ZIP to a folder such as `C:\GoldTerminal`.
2. Install Node.js LTS if not already installed.
3. Double-click `START-WINDOWS.bat`.
4. Your browser opens at http://127.0.0.1:3030

No npm install is needed; the backend uses Node.js built-in modules.
The chart library and fonts load from public CDNs, so an internet connection is needed for those visual assets. The signal engine works locally.

## Data options
### Demo
Click "Use demo data". It is synthetic sample data and must never be interpreted as a live market signal.

### CSV import
Use "Import MT5 CSV". Expected headers: time, open, high, low, close, volume.
The app uses M1 candles and aggregates them to M5/M15/H1. MT5 CSV date formats can vary; check the imported candle count and chart.

### MT5 live bridge (optional)
1. Copy `mt5-bridge/AurumBridge.mq5` into your MT5 `MQL5/Experts` folder.
2. Open MetaEditor from MT5, compile the EA.
3. In MT5: Tools > Options > Expert Advisors > Allow WebRequest for listed URL; add:
   http://127.0.0.1:3030
4. Attach AurumBridge to an XAUUSD.vxc chart. Enable Algo Trading if required for the EA to run. This EA only sends market candles to the local app; it does not trade.
5. The EA sends up to 300 bars per timeframe every 5 seconds. Keep Node app running.

If WebRequest fails, inspect the Experts tab in MT5. Ensure the Node app is running and URL is allow-listed.

## Signal logic (transparent)
- H1 bullish: last completed H1 close > EMA50 > EMA200
- H1 bearish: last completed H1 close < EMA50 < EMA200
- M15 bullish momentum: RSI(14) > 50 and MACD histogram > 0
- M15 bearish momentum: RSI(14) < 50 and MACD histogram < 0
- M5 setup: close / EMA20 / EMA50 aligned
- BUY SETUP or SELL SETUP means H1 + M15 + M5 filters align. It is not a guaranteed entry.
- WAIT means filters are mixed.
- RSI >= 70 / <= 30 is only an overbought / oversold warning, not an automatic reversal signal.
- The app's current M1 pattern flag is a very simple candle check, not a validated BOS/liquidity-sweep detector.

## Local privacy
The server binds to 127.0.0.1 only. It is not exposed to your local network by default.
Data is held in memory and resets when the Node server restarts.


## Additional prototype features
- Swing-based liquidity sweep and BOS heuristics are displayed where structure data is available.
- Provisional entry/SL/TP levels use recent M5 range and ATR; they are planning references, not instructions.
- Rule alignment is a checklist percentage, not a statistically validated probability.
- Trade journal is stored in browser localStorage.
- Sound plays when the signal status changes after the first reading.
- News warning is a placeholder; connect a licensed calendar API for live scheduled events.
- CHoCH classification, validated order blocks, and tested strategy statistics are not yet implemented.

\n## Visible Pro workspace updates\nThe dashboard includes provisional entry/SL/TP1/TP2 planning, heuristic swing sweep and BOS flags, M5/M15 structure readouts, a rule-alignment checklist score, browser-local trade journal, and a sound on signal-status changes. The score is not a win probability. Sweep/BOS logic is preliminary and must be visually confirmed. The economic-news area is a warning placeholder only; no live calendar provider is connected. If the external chart library is unavailable, the app draws a basic local SVG candlestick fallback.\n
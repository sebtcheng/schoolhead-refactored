---
description: Start the turbo development server and open the app in Brave's incognito mode.
---

# Launch Dev (Brave Incognito)

This workflow starts the local development environment using the turbo dev configuration and automatically opens the application in a Brave incognito window.

## Phase 1: Start Dev Server
Ensure all previous instances are cleared and start the concurrent server.

// turbo
1. **Run Turbo Dev**
   ```powershell
   npm run dev:turbo
   ```

## Phase 2: Open Browser
Once the server is ready, launch the browser.

// turbo
2. **Launch Brave Incognito**
   ```powershell
   & "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe" --incognito http://localhost:5173
   ```

> [!TIP]
> If Brave is installed in a different location, update the path in Step 2. The default path for Brave on Windows is `C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe`.

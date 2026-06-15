---
description: Trigger this workflow to fetch and pull the latest changes from the official main branch to keep the local environment synchronized.
---

# Git Pull: Sync from Main

This workflow ensures your local environment is synchronized with the latest official updates from the `main` branch.

## Phase 1: Status Check
Ensure you are on the main branch and the working directory is clean.

// turbo
1. **Checkout Main**
   ```powershell
   git checkout main
   ```

2. **Check Working Tree**
   ```powershell
   git status
   ```

2. **Stash Local Work (Optional)**
   If you have uncommitted changes:
   ```powershell
   git stash
   ```

## Phase 2: Pulling from Main
Retrieve updates directly from the official source.

// turbo
3. **Fetch & Pull Main**
   ```powershell
   git fetch origin
   git pull origin main
   ```

## Phase 3: Post-Sync
Restore state and verify.

// turbo
4. **Pop Stash (If Applicable)**
   ```powershell
   git stash pop
   ```

5. **Verify Development Server**
   ```powershell
   npm run dev:turbo
   ```

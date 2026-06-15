---
description: Trigger this workflow to safely push current changes directly to the official main branch of InsightEd-SchoolHead-Official.
---

# Git Push: Direct to Main

This workflow provides a streamlined path for pushing code directly to the `main` branch, ensuring stability and synchronization.

## Phase 1: Pre-Push Validation
Ensure you are on the main branch and the current code is production-ready.

// turbo
1. **Checkout Main**
   ```powershell
   git checkout main
   ```

2. **Production Build Test**
   Verify the build passes before pushing to the official branch.
   ```powershell
   npm run build
   ```

## Phase 2: Staging & Committing
Prepare the changes for the official repository.

// turbo
2. **Stage All Changes**
   ```powershell
   git add .
   ```

3. **Commit Changes**
   *Note: If you have already committed, you can skip this step or the agent will prompt for a message.*
   ```powershell
   git commit -m "Refactor and stabilization updates"
   ```

## Phase 3: Synchronize & Push
Ensure alignment with the remote `main` and push.

// turbo
4. **Pull with Rebase**
   Sync with remote `main` using rebase to maintain a clean history.
   ```powershell
   git pull origin main --rebase
   ```

5. **Push to Origin Main**
   ```powershell
   git push origin main
   ```


# HOWTO: GIF Asset Migration to GitHub CDN

This document outlines the technical steps used to migrate local GIF assets from the `public/` directory to GitHub's Raw Content Delivery Network (CDN) to resolve staging server disk space exhaustion.

---

## The Migration Workflow

To move large GIFs from the local server to the cloud while keeping them "autoplay" compatible, follow these steps:

### 1. Stage and Commit GIFs to GitHub
Ensure the large GIFs are added to the git history. 
```bash
git add public/*.gif
git commit -m "feat: commit raw guide assets for CDN usage"
git push origin main
```

### 2. Extract Immutable Commit Hash
To ensure the links never break (even if you delete the files later), use a specific **Commit Hash** instead of `main` in the URL.
1. Go to your GitHub repository.
2. Click on the GIF file.
3. Click the **"Raw"** button.
4. Copy the URL. It will look like: 
   `https://raw.githubusercontent.com/sebtcheng/InsightEd-Mobile-PWA/main/public/filename.gif`
5. Replace `main` with the latest commit hash (e.g., `2a4874ba604994c6710b1ce38135db8fe2951f7b`).

### 3. Update Source Code
Update all `<img>` tags in your `.html` and `.jsx` files to use the external URL.
```html
<!-- OLD (Local) -->
<img src="/Unit_1_Complete_Guide.gif" />

<!-- NEW (GitHub CDN) -->
<img src="https://raw.githubusercontent.com/sebtcheng/InsightEd-Mobile-PWA/2a4874ba604994c6710b1ce38135db8fe2951f7b/public/Unit_1_Complete_Guide.gif" />
```

### 4. Local Cleanup
Once the code is updated and the files are pushed, delete the local copies from the `public/` folder to save ~300MB of space.
```bash
rm public/*.gif
```

---

## Why This Works
- **Autoplay Preservation**: Browsers treat `raw.githubusercontent.com` URLs as standard image sources, so GIFs autoplay natively without the complex `<video>` tag setup required for MP4s.
- **Zero Server Overhead**: The staging server only needs to transfer a ~20MB archive instead of ~320MB.
- **Immutability**: By using the **Commit Hash** in the URL, the guide remains functional and pointing to that specific version of the file, even if you delete the GIF from the `main` branch later.

---

## Verification
You can verify the migration by checking the **Network Tab** in Chrome DevTools. You should see the GIFs being loaded from `raw.githubusercontent.com` instead of the local staging domain.

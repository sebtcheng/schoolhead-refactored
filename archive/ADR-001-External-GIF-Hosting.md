# ADR 001: External GIF Hosting for Storage Optimization

## Status
Accepted

## Context
The staging server was experiencing `ENOSPC` (No space left on device) errors during deployment. Investigation revealed that the `public/` directory contained numerous large GIF files (some >50MB), which were being bundled into the deployment archive and extracted on the server, quickly exhausting disk space.

## Decision
We decided to offload these heavy GIF assets to an external CDN while maintaining the "autoplay" behavior expected by the user.

Instead of setting up a new paid cloud storage service (like S3 or GCS), we leveraged the existing GitHub repository as a "Raw CDN." 

### Technical Details:
1. **Source Host**: `https://raw.githubusercontent.com/sebtcheng/InsightEd-Mobile-PWA/<commit-hash>/public/`
2. **Immutability**: Every URL uses a specific git commit hash (`2a4874ba604994c6710b1ce38135db8fe2951f7b`) to ensure that even if local files are deleted or modified, the production guides remain functional and stable.
3. **MIME Type**: GitHub Raw serves files with the correct `image/gif` MIME type, which allows browsers to render and autoplay them natively using standard `<img>` tags.

## Alternatives Considered
1. **Firebase Storage**: Already used in the project, but requires additional SDK setup or public URL management.
2. **MP4 Conversion**: Offers superior compression (~90% reduction), but requires changing `<img>` to `<video>` with specific attributes (`autoplay muted loop playsinline`) and encoding steps.
3. **Local Compression**: Using Python/Pillow to reduce resolution. This was already being done but was insufficient for the scale of several 50MB+ files.

## Consequences
- **Pros**:
    - Zero cost for hosting.
    - Zero server-side disk usage for GIF assets.
    - Faster deployment (deployment archive reduced from ~300MB+ to ~20MB).
    - Native "autoplay" preserved.
- **Cons**:
    - Dependency on GitHub's availability for guide media.
    - Large files still transfer over the network to the client (bandwidth usage).

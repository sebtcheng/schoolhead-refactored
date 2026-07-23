// ─── BACKWARD COMPATIBILITY RE-EXPORT ────────────────────────────────────────
// The canonical location for SIIF constants is now:
//   modules/siif/constants/siifConstants.js
//
// This file stays to avoid breaking card components that still import from here.
// Migrate imports at your own pace: from './cards/siifConstants' → from '../constants/siifConstants'

export * from '../../constants/siifConstants';

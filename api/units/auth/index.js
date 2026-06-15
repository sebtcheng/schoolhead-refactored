/**
 * auth/index.js — Auth Unit Orchestrator
 *
 * This file is intentionally thin. It combines two focused modules:
 *   - login.js       → session, password, PIN, profile, feedback
 *   - registration.js → account creation and school-ID verification
 *
 * To debug a specific concern, open the relevant sub-file directly.
 */

import express from 'express';
import loginRouter from './login.js';
import registrationRouter from './registration.js';

const router = express.Router();

router.use(loginRouter);
router.use(registrationRouter);

export { router as authRouter };
export default router;

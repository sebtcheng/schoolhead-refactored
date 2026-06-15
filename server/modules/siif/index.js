import { Router } from 'express';

import allocationRouter from './routes/allocation.js';
import feedbackRouter from './routes/feedback.js';
import healthRouter from './routes/health.js';
import monitoringRouter from './routes/monitoring.js';
import profileRouter from './routes/profile.js';
import settingsRouter from './routes/settings.js';
import submissionRouter from './routes/submission.js';
import systemRouter from './routes/system.js';
import utilizationRouter from './routes/utilization.js';

const siifRouter = Router();

siifRouter.use(allocationRouter);
siifRouter.use(feedbackRouter);
siifRouter.use(healthRouter);
siifRouter.use(monitoringRouter);
siifRouter.use(profileRouter);
siifRouter.use(settingsRouter);
siifRouter.use(submissionRouter);
siifRouter.use(systemRouter);
siifRouter.use(utilizationRouter);

export default siifRouter;

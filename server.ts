import { startBackgroundJobs, startServer } from './backend/app';

// TODO: estrarre in backend/jobs/
startServer()
  .then(() => {
    startBackgroundJobs();
  })
  .catch((error) => {
    console.error('FATAL ERROR: Server failed to start:', error);
    process.exit(1);
  });

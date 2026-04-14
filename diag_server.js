import('./api/index.js').catch(err => {
    console.error('CRITICAL_ERROR:', err);
    process.exit(1);
});

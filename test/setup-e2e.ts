process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ??
  'e2e-test-access-secret-must-be-long-enough-for-hs256';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ??
  'e2e-test-refresh-secret-must-be-long-enough-for-hs256';
process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

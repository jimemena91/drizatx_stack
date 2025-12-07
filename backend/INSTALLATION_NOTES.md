# Backend Installation Notes

Attempts to regenerate `package-lock.json` via `npm install` currently fail in this environment because outbound HTTPS requests to the npm registry (e.g. `@nestjs/cli`) are blocked by the proxy, returning HTTP 403 errors. As a result, the lock file could not be recreated here.

To refresh the lock file on a machine with internet access:

1. Remove the existing `backend/package-lock.json`.
2. Run `npm install` inside `backend/` using Node.js 20.
3. Commit the newly generated `package-lock.json`.
4. Verify the installation with `npm ci`.

These steps will produce a complete lock file once network access to the npm registry is available.

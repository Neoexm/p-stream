P-Stream backend extension compatibility (bot integration)

This project can talk to a browser extension or a backend that implements the same message API. If an extension is not available, the frontend will forward extension messages to a configured BACKEND_URL. Use `VITE_BACKEND_URL` or `window.__CONFIG__.VITE_BACKEND_URL` to configure.

Expected HTTP endpoints (POST/GET) on BACKEND_URL:

1) GET /api/extension/hello
- Request: none
- Response: { success: true, version: string, allowed: boolean, hasPermission: boolean }

2) POST /api/extension/makeRequest
- Request body: { url: string, method: string, headers?: Record<string,string>, body?: any }
- Response: { success: true, response: { statusCode: number, headers: Record<string,string>, finalUrl: string, body: any } }

3) POST /api/extension/prepareStream
- Request body: { ruleId: number, targetDomains: string[], requestHeaders?: Record<string,string>, responseHeaders?: Record<string,string> }
- Response: { success: true }

4) POST /api/extension/openPage
- Request body: { page: string, redirectUrl: string }
- Response: { success: true }

Notes for bot implementers
- Implement these endpoints to mirror the Plasmo extension's behavior.
- `prepareStream` should configure any proxying or request header rules necessary for the player to fetch HLS segments, or return success if the bot will handle proxying.
- `makeRequest` is used by the client to perform arbitrary HTTP requests (for scrapers). Return the response body and headers exactly so the frontend can consume them.

Security
- If your bot is publicly accessible, protect these endpoints with authentication and CORS rules. They can be used to make arbitrary requests.

Example: If your bot runs at https://my-bot.example.com, set `VITE_BACKEND_URL=https://my-bot.example.com` when building the frontend.

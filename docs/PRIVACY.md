# Privacy and local data lifecycle

- This is a static browser application. Local files are read and parsed by a local Web Worker; deterministic analysis stays in that browser.
- Model/profile data is kept only in page/worker memory. There is no localStorage/sessionStorage/IndexedDB persistence, recents list, telemetry, account, server storage, or model-upload endpoint.
- Loading the bundled sample fetches a static file from the application's own origin. Application assets and the worker are also same-origin requests. In development, Vite uses its ordinary local development connection.
- **Open another**, import cancellation, recovery, reload, or leaving the page disposes of the active worker and/or workspace. This is an application lifecycle statement, not a secure memory-erasure guarantee; browser/OS memory and user-controlled extensions are outside the app's control.
- No AI provider client or API token entry exists. Optional AI is explicitly deferred until destination, token permissions, terms/CORS, minimal payload schemas, exact preview, separate profile-value consent, and credential handling are approved.
- Render-failure logging uses a generic message without model/profile content. User-visible diagnostics include local JSON paths and model facts; do not paste sensitive exports into public issues.
- Standard browser extensions, devtools, screenshots, host access logs, and third-party hosting infrastructure can have their own data policies. Use a trusted browser/device and approved hosting.

Runtime tests check that opening/tracing a model does not create persisted app state. A scoped loopback-only review observed no model upload. These checks are not a full security/privacy certification; a formal review remains a release gate.

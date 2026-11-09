# Desktop app for Windows and Mac

The desktop version runs the existing React app in an isolated Electron window.
It includes Chromium, Node and the architecture-matching official Copilot SDK
runtime; those do not need separate end-user installation. It is still a
local-only exploratory viewer with unverified scoring and companion mappings,
not a certified Pega scorer.

## Build and launch

Use Node 24 LTS and `npm ci` for development:

| Command | Result |
|---|---|
| `npm run desktop` | Builds and opens the native desktop window |
| `npm run desktop:package:win` | Windows x64 per-user NSIS installer and portable executable |
| `npm run desktop:package:mac:intel` | Intel Mac app ZIP and DMG; requires macOS |
| `npm run desktop:package:mac:apple` | Apple Silicon app ZIP and DMG; requires macOS |

Outputs live in the ignored `release` directory. Windows artifacts are
`ExperienceAGB-0.1.0-win-x64-Setup.exe` and
`ExperienceAGB-0.1.0-win-x64-Portable.exe`. macOS ZIP/DMG files use
`ExperienceAGB-0.1.0-mac-x64` or `ExperienceAGB-0.1.0-mac-arm64`.
Native Mac ZIPs contain `ExperienceAGB.app`; install it into Applications.
Choose the architecture matching your Mac rather than assuming Rosetta.
The pinned Electron release requires Windows 10 or newer and macOS Ventura
(13) or newer; the Mac bundle declares that minimum explicitly. Windows ARM
and older operating systems are not targets.

Each packaging run creates an explicit staging tree with only the built UI,
desktop entry points and production dependencies installed from the lockfile
for the requested OS/architecture. It does not copy the checkout wholesale.
Private exports, attachments, credentials, test evidence, source plans and
developer dependency folders are excluded. Copilot native helpers and Koffi
prebuilds are unpacked from ASAR so the bundled runtime can execute. The desktop
host explicitly supplies the physical `app.asar.unpacked` helper path to the
SDK: Electron's `spawn` cannot execute the SDK's default ASAR virtual path.
That failure and the corrected helper startup were reproduced in real Electron
without credentials or inference. Dependency
install scripts are not needed for these prebuilt production artifacts.

The Windows executable ships alongside its bundled resources; do not copy only
the inner `win-unpacked` EXE. Use the installer or the portable EXE instead.
The portable EXE extracts its resources to a temporary location while running;
it does not persist models as a portability feature. Prefer the installer:
portable extraction is substantial and took about 100 seconds on the local
Windows acceptance machine. This is launcher unpacking, not model processing;
closing the app stops its backend promptly while the wrapper can take longer
to delete its temporary resources.

## Optional AI, without a terminal

AI is disabled initially. No credentials are embedded in installers or inherited
from the browser server, chat, GitHub CLI/keyring or ambient environment.

Use **File > Load AI credentials...** in the native menu. Review the dialog,
then select a private UTF-8 JSON file containing one or both supported fields:

```json
{
  "copilotToken": "YOUR_EXPLICIT_ENTITLED_GITHUB_TOKEN",
  "anthropicApiKey": "YOUR_EXPLICIT_ANTHROPIC_KEY"
}
```

These are placeholders, not credentials. Omit a provider field when unused.
Unknown/duplicate keys, empty credentials, invalid UTF-8 and files over 4 KiB
are rejected with safe messages. The read itself is bounded, not just a
post-read length check. Never put actual credentials in the repository, chat,
model exports or distributed packages. Protect and manage the selected file:
it remains on disk until you delete it, independently of the application.

Credentials are held only in the desktop backend's memory. They are not returned
to the renderer, saved in browser storage or written to the app's settings.
**File > Clear AI credentials** or quitting drops the app's references; this is
not guaranteed secure erasure of OS memory, swap, dumps or the selected file.
Loading/clearing resets old AI output and approval without discarding the model,
profile or evolution. It does not send inference. Finish or cancel an active
AI request before changing credentials. A cleanup-blocked runtime still requires
quitting/relaunching rather than silently bypassing its existing safeguard.

Enable the bottom AI panel and follow the unchanged provider terms, evidence
sharing and exact one-request approval workflow. An entitled account and
applicable organization/data-owner approval remain required. The existing
Copilot/Anthropic payloads, bounds, per-request runtime isolation, timeouts and
no-fallback rules are unchanged. See [AI.md](AI.md).

## Local data and native behavior

The desktop app owns a new `127.0.0.1` backend on a random free port. It does not
reuse or stop the separate browser host at 5183, and does not expose a LAN
listener. Its renderer has Node integration disabled, context isolation and
sandboxing enabled, the existing strict CSP and same-origin network policy.
There is no raw-file filesystem API, general IPC/RPC bridge, external shell
launcher or credentials getter exposed to the app page. The preload exposes
only a configuration-changed subscription with no payload.

External navigations/popups and webviews are blocked with a native explanation.
Device/clipboard-read/file-system permissions are denied; diagram fullscreen is
allowed only for the owned page. Explicit prepared Blob downloads open a native
save dialog. The app never automatically downloads an imported model or
overwrites its source file. Normal analysis/import, snapshot comparison, local
audit HTML/JSON, exact numbers, companion imports, keyboard interactions and
native diagram fullscreen use the same application code as the web version.

The renderer uses an in-memory, uncached session; model/profile data is not
intentionally persisted. Chromium/OS can still produce temporary metadata,
caches and memory/swap/crash traces. The app attempts to clear its session and
remove its own temporary session directory when quitting, not secure erase.
Native saved downloads and the selected credential file persist independently.
On Windows, closing the last window quits; on Mac, closing the window leaves
the normal menu-bar app active until **Quit**. Reopening creates a fresh model
workspace. Single-instance behavior focuses the existing desktop window.

## Native verification and distribution

```powershell
npm run test:desktop:unit
npm run desktop:build
npm run test:desktop
npm run desktop:package:win
npm run test:desktop:packaged
npm run test:desktop:runtime
```

`test:desktop` exercises the real development Electron window with synthetic
data and mocked native file dialogs, without provider inference. It covers
native worker/sample import, complete diagram fullscreen, native audit saves,
credential load/clear, profile edits, companion mappings, narrow reflow,
single-frame axe A/AA and owned-backend shutdown. Axe's single-frame mode is
needed because Electron does not support Playwright creating a second browser
target; the app has no remote frames.

`test:desktop:packaged` launches the actual packaged executable from a different
working directory, checks the bundled sample/worker/insights, isolated renderer,
unconfigured AI and shutdown. It verifies distribution fuses: no RunAsNode,
NODE_OPTIONS or Node inspector arguments; ASAR-only loading and embedded ASAR
integrity; no extra `file:` privileges. The test briefly opens a loopback-only
Chromium debugging port for its owned executable, not a normal-launch service.
`test:desktop:runtime` runs inside actual development Electron and reproduces
the ASAR virtual-path failure, then starts the architecture-matching **packaged**
Copilot helper from its physical path, checks unauthenticated status and stops
it without creating sessions or requesting inference. The probe entry point is
test-only and is not included in the distribution. Test outputs default to ignored `desktop-results`, or the
explicit `DESKTOP_TEST_OUTPUT` directory.

The manual/tag-triggered **Desktop installers** workflow has native Windows x64,
Intel macOS (`macos-15-intel`) and Apple Silicon (`macos-15`) jobs. Each installs
its architecture's dependencies, runs native tests, builds and checks packages,
then uploads binaries/evidence with read-only repository permissions. It does
not use real AI credentials, publish a GitHub release, sign with a publisher's
identity or notarize. This workflow must exist in a published branch before
GitHub can run it; authoring it locally does not run a Mac build.

The packager does not support Mac builds on Windows. This was checked directly;
the build commands now reject that host before creating a staging tree. Mac
packaging and ad-hoc signing require macOS; Apple Developer ID signing and
notarization additionally require the owner's developer identity/service
configuration. Windows publisher signing likewise needs an approved code-signing
identity. Unsigned builds may trigger SmartScreen/Gatekeeper. Do not disable
system protections or claim a trusted install experience from unsigned artifacts.
There is no automatic updater; install a deliberately verified new build.
Default Electron application icons are currently used.

The pinned SDK remains 1.0.21. Its transitive Zod dependency is overridden to
4.6.6 to address GHSA-mrhx-c7xc-m3w5 while keeping the tested SDK/runtime contract.
Production dependency auditing and actual regression results are distinct from
full security certification, independent Pega parity, physical-device usability
and manual screen-reader approval.

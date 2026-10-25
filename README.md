# appskyline

Command-line access to your App Store Optimization data on
[app.appskyline.com](https://app.appskyline.com): tracked apps and keywords,
live store search results and rankings, keyword search volume and difficulty,
store-listing metadata, and Google Play reviews and install reports — across
four stores: the iOS App Store, the macOS App Store, Google Play, and the
Microsoft Store.

## Install

```bash
npm install -g appskyline   # global install
npx appskyline --help       # or run without installing
```

Requires Node.js 18 or newer.

## Quick start

```bash
appskyline login            # opens the browser to authorize the CLI
appskyline apps list        # your apps with their AppSkyline ids
appskyline rank com.example.pos --store google-play --term "restaurant pos" --country US
```

```
Found 2 app(s):
1. Example POS (64a1f2c9e4b0a1b2c3d4e5f6)
2. Example POS Desktop (64a1f2c9e4b0a1b2c3d4e5f7)

✓ com.example.pos ranks #6 of 25 for "restaurant pos" on google-play (US)  (Example POS)
```

## Signing up

No account yet? Create one from the terminal — the generated password prints
exactly once, and the session is stored so every other command works
immediately:

```bash
appskyline signup --email founder@example.com --json
```

Pass `--password` to choose your own (it is never echoed back), and
`--first-name` / `--last-name` to override the names derived from the email
address. Without `--email` in an interactive terminal the CLI asks for one;
without a terminal it fails fast with exit code 1 rather than hanging on a
prompt. If the address already has an account, the error says so — run
`appskyline login` instead.

## Authentication

Three ways in; all persist in `~/.appskyline/`:

- **Browser** — `appskyline login --browser` (or pick it in the interactive
  `appskyline login` chooser) starts a temporary localhost server, opens your
  browser to app.appskyline.com, and receives the session tokens on the
  redirect back. If the browser does not open, the login URL is printed so
  you can visit it by hand. Tokens are refreshed automatically when they
  expire.
- **Another device** — `appskyline login --device` is for a terminal whose
  browser you cannot use: a remote desktop without copy and paste, an SSH
  session, a server. It prints a link, a QR code and a one-time code such as
  `WDJB-MJHT`. Scan the QR code with your phone, or open
  app.appskyline.com/cli on any device where you are signed in to AppSkyline
  and type the code; check that it matches the terminal and approve. The
  terminal logs itself in within a couple of seconds and stores a session like
  the browser login. The code works once and expires after ten minutes.
  `--browser` prints the same code beside its link, so a browser that opens on
  the wrong machine is no dead end.
- **API key** — `appskyline login --with-key` prompts (masked) for an API key
  secret, verifies it with one authenticated request, and stores it. Or skip
  login entirely and export `APPSKYLINE_API_KEY=<key secret>` — ideal for CI
  and headless agents. Create keys per app in the AppSkyline web UI; new keys
  default to read-only scopes. The secret is never accepted as a command
  argument.

Precedence at request time: a stored browser session wins over a stored key,
which wins over the `APPSKYLINE_API_KEY` environment variable.

`appskyline logout` clears the stored session and any stored key (an
environment key stays in effect — the CLI tells you so). Without a terminal
and without credentials, commands fail fast with exit code 1 and instructions
on stderr; the CLI never opens a browser headlessly, though
`appskyline login --device` works there: it prints the link and the code and
waits for someone to approve them. A `401` error ending
with "Not logged in?" means there is no valid credential — run
`appskyline login` (or set `APPSKYLINE_API_KEY`) and retry.

## JSON output and errors

Every data subcommand accepts `--json` and then prints real, parseable JSON
on stdout — no colors, no ANSI escapes. Without the flag, output is
formatted for human reading. Mutations under `--json` print a small result
object such as `{ "ok": true, "id": "…" }`. Errors always go to stderr with
exit code 1; in `--json` mode the error is a single JSON line
(`{"error":{"message":"…","status":401}}`), so stdout stays parseable either
way.

## Commands

Wherever a store is named, four values are accepted:
`ios-app-store`, `macos-app-store`, `google-play`, `microsoft-store`.

### Session

```bash
appskyline signup --email you@example.com   # create an account and log in
appskyline login               # interactive: browser, another device or API key
appskyline login --browser     # log in via browser; tokens land in ~/.appskyline/
appskyline login --device      # approve from a phone or another computer
appskyline login --with-key    # masked prompt for an API key secret
appskyline logout              # clear the stored session and any stored key
```

### Apps

```bash
appskyline apps list                 # list apps (-n/--limit, default 25; --json for raw)
appskyline apps get <appId>          # raw JSON for one app
appskyline apps read <appId>         # formatted view: platform, bundleId, store ids
```

### Keywords

```bash
appskyline keywords list --appId <appId>                    # tracked terms (-n/--limit 50, --skip, --json)
appskyline keywords get <keywordId>                         # raw JSON for one keyword
appskyline keywords add --term "invoice app" --appId <appId> --lang en --country US
appskyline keywords update <keywordId> --body '{"country":"IT"}'   # merge raw JSON fields
appskyline keywords delete <keywordId...>                   # one or more ids
appskyline keywords overview --country US --terms "invoice app,billing software"   # volume, CPC, difficulty
appskyline keywords translate --term "invoice app" --locales "it,es,de" --appId <appId>
```

`--appId` can be omitted when an `appskyline.json` supplies it — see
Configuration below.

### Search

```bash
appskyline search ios-app-store --term "restaurant pos" --country US --lang en -n 10
appskyline search macos-app-store --term "invoice" --country US -n 10
appskyline search google-play --term "dental software" --country US --lang en -n 10
appskyline search microsoft-store --term "pos" --country US -n 10
```

Each prints the live top-N results with title, rating, developer, and the
store-native id. `--json` returns the raw response.

### Rank

```bash
appskyline rank <storeAppId> --store ios-app-store --term "restaurant pos" --country US
appskyline rank com.example.app --store google-play --term "crm" --country US -n 50
```

`<storeAppId>` is the store-native id (numeric Apple id, bundle id, Google
Play package name, or Microsoft Store product id); matching is
case-insensitive. `-n/--num` sets how deep to search (default 25).

### iOS App Store

```bash
appskyline ios-app-store app <id> --country US --lang en        # public listing details
appskyline ios-app-store searches --id <id> --country US        # tracked terms the app appears in
appskyline ios-app-store diagnostics <appId> --type HANGS --platform IOS --builds 3 --logs
appskyline ios-app-store crashes <appId> --platform IOS --limit 50 --log
appskyline ios-app-store metadata list --appId <appId>          # cached App Store Connect metadata
appskyline ios-app-store metadata download <appId>              # refresh the cache from App Store Connect
appskyline ios-app-store metadata upload <appId> --path ./fastlane/ios --platform IOS --dry-run
```

`diagnostics` covers hangs, disk writes, and launches (`--type HANGS`,
`DISK_WRITES`, or `LAUNCHES`; default all). `crashes` returns TestFlight
crash logs — Apple does not expose production crash logs via the API. Both,
and the `metadata` subcommands, require an App Store Connect API key
configured for the app in the AppSkyline web UI.

### macOS App Store

```bash
appskyline macos-app-store app <id> --country US --lang en      # public listing details
appskyline macos-app-store searches --id <id> --country US      # tracked terms the app appears in
```

### Google Play

```bash
appskyline google-play app <appId> --country US --lang en       # public listing details
appskyline google-play reviews <appId> --max 50                 # user reviews; --token pages, --translation-language, --start-index
appskyline google-play installs <appId> --month 202607 --dimension country   # monthly installs report
```

`reviews` and `installs` require a Google Play service account configured for
the app in the AppSkyline web UI (`installs` additionally needs Storage
Object Viewer on the developer account's reporting bucket; override the
account with `--developer-account-id`). `--dimension` accepts `overview`,
`country`, `device`, `app_version`, `carrier`, `language`, or `os_version`.

### Microsoft Store

```bash
appskyline microsoft-store app <id> --country US                # public listing details
appskyline microsoft-store searches --id <id> --country US      # tracked terms the app appears in
```

### Team

```bash
appskyline users list                                  # users in the organization (--json)
appskyline users get <userId>                          # raw JSON for one user
appskyline roles list                                  # roles in the organization (--json)
appskyline roles add --userId <userId> --type admin    # assign a role
appskyline roles delete <roleId>                       # remove a role
appskyline invites list                                # pending invites (--json)
appskyline invites add --email x@example.com --type admin --locale en
appskyline invites delete <inviteId>                   # revoke an invite
```

### Zapier hooks

```bash
appskyline zapier-hooks add --url https://hooks.example.com/x --event KEYWORD_ADDED
appskyline zapier-hooks delete <hookId>
```

### Skills

```bash
appskyline skills list             # names and descriptions of the bundled agent guides
appskyline skills get appskyline   # print a bundled SKILL.md to stdout
```

### Schema

```bash
appskyline schema                  # the full command tree as JSON (options, arguments, subcommands)
appskyline schema keywords list    # describe one command path only
```

Agents can discover every command, flag, and argument from `schema` instead
of scraping help text.

## Keyword volume

`keywords overview` returns monthly search volume, CPC, competition, and
difficulty per term. Terms missing from the shared cache trigger billable
upstream lookups, so batch instead of looping: collect the full candidate
list first, then make one call per country with up to 100 comma-separated
terms.

```bash
appskyline keywords overview --country US --terms "invoice app,billing software,estimate maker"
```

## Store-listing metadata

`metadata list` reads a cache that can be days stale — run
`metadata download <appId>` first and never infer the current listing state
from `list` alone. `metadata upload` reads fastlane-shaped
`<path>/metadata/<locale>/*.txt` files and maps them to App Store Connect
fields:

| File                   | Field            |
| ---------------------- | ---------------- |
| `name.txt`             | name             |
| `subtitle.txt`         | subtitle         |
| `privacy_url.txt`      | privacyPolicyUrl |
| `description.txt`      | description      |
| `keywords.txt`         | keywords         |
| `release_notes.txt`    | whatsNew         |
| `promotional_text.txt` | promotionalText  |
| `marketing_url.txt`    | marketingUrl     |
| `support_url.txt`      | supportUrl       |

iOS and macOS share App Store Connect — select with `--platform IOS` or
`--platform MAC_OS` (`TV_OS` and `VISION_OS` are also accepted). Narrow an
upload with `--locale`, push a single field with `--only keywords`, skip
appInfo-level fields with `--skip-app-info` when only the version draft is
editable, and preview the payload with `--dry-run` before sending anything.

## Configuration

An `appskyline.json` in the working directory (or any parent, up to 10
levels) supplies the default `--appId` for `keywords list`, `keywords add`,
and `keywords translate`:

```json
{ "appId": "64a1f2c9e4b0a1b2c3d4e5f6" }
```

`APPSKYLINE_API_URL` overrides the API endpoint (default
`https://api.appskyline.com`) — only needed against a non-production
deployment. `APPSKYLINE_API_KEY` supplies an API key secret for headless
authentication (see Authentication above).

## Usage with AI agents

Install the AppSkyline agent skills — `appskyline` (this CLI) and
`aso-research` (the MCP-based ASO workflow) — for Claude Code, Cursor, Codex,
and any other agent that supports the Skills standard:

```bash
npx skills add appskyline/skills
```

The same guides ship inside the npm package, version-matched to the installed
CLI:

```bash
appskyline skills list             # what is bundled
appskyline skills get appskyline   # the CLI guide matching this version
```

Or paste this into your `AGENTS.md` / `CLAUDE.md`:

```markdown
## App Store Optimization

Use the `appskyline` CLI for ASO data: app rankings, keyword research, live
store searches, and listing metadata across the iOS App Store, macOS App
Store, Google Play, and Microsoft Store. Run
`npx appskyline skills get appskyline` for the full guide, and
`appskyline schema` for the machine-readable command reference. Log in once
with `appskyline login`, or export `APPSKYLINE_API_KEY` for headless use.
Pass `--json` for parseable output.
```

Prefer a connector? The AppSkyline MCP server at
`https://mcp.appskyline.com/mcp` exposes the same data as tools for Claude,
ChatGPT, and any MCP-capable host — see
[appskyline.com/developers](https://www.appskyline.com/developers/).

## License

[Apache-2.0](LICENSE)

## Google Play publishing

Use your **AppSkyline app ID**, not the Android package name. Configure the app's
Google Play service account in AppSkyline first. Its package name takes precedence
over the tracked app's package. The service account needs Google Play permissions
for the target app/track. AppSkyline API keys need `releases:read` for reads/plans
and `releases:write` for edits, uploads, submission, and rollout changes. Session
writes require an organization administrator. Legacy unscoped keys retain their
existing full-access behavior.

```bash
appskyline google-play credentials check APP_ID --json
appskyline google-play releases list APP_ID --track production --json
appskyline google-play release plan APP_ID --track internal --version-code 42 --json
appskyline google-play edits create APP_ID --json
# Use the returned id as EDIT_ID. Build/sign the AAB with your Android build tools.
appskyline google-play release upload APP_ID --edit EDIT_ID --aab app-release.aab --json
appskyline google-play release stage APP_ID --edit EDIT_ID --track internal --version-code 42 --json
appskyline google-play edits validate APP_ID --edit EDIT_ID --json
appskyline google-play edits commit APP_ID --edit EDIT_ID --json
appskyline google-play releases watch APP_ID --track internal --version-code 42 --interval 30 --timeout 1800 --json
```

`appskyline google-play release submit` combines stage, validate, and commit, using the same flags as
`release stage`. Staging **replaces all releases on the selected track**; include
all version codes you intend to retain. `release plan` previews this replacement
without creating an edit. Use `--status inProgress --fraction 0.1` for a staged
rollout, or `--status draft` to keep a release as a draft. Optional `--name` and
`--notes notes.json` accept a name and an array of `{ "language": "en-US",
"text": "Release notes" }` respectively.

```bash
appskyline google-play edits get APP_ID --edit EDIT_ID --json
appskyline google-play edits bundles APP_ID --edit EDIT_ID --json
appskyline google-play edits discard APP_ID --edit EDIT_ID --json
appskyline google-play rollout set APP_ID --track production --version-code 42 --fraction 0.5 --json
appskyline google-play rollout halt APP_ID --track production --version-code 42 --json
appskyline google-play metadata list APP_ID --edit EDIT_ID --json
appskyline google-play metadata upload APP_ID --edit EDIT_ID --file listings.json --json
appskyline google-play data-safety upload APP_ID --file data-safety.csv --json
```

`rollout set` and `rollout halt` create and commit an edit, preserving the other
releases on that track; fraction `1` completes the rollout. Creating an edit can
invalidate an earlier edit owned by the same service account. Coordinate jobs
per app, retain the edit ID, and inspect it after errors rather than starting a
second submission blindly. Bundle uploads go directly to Google's resumable
upload session; OAuth credentials remain on the server. Interrupted requests
recover within that command; after a process exits, inspect `edits bundles`
before retrying. The upload session URL is secret and is not printed by the CLI.

Listing JSON is `{ "locales": [{ "language": "en-US", "title": "My app",
"shortDescription": "Short description", "fullDescription": "Full description" }] }`.
The optional `video` property accepts Google's listing video URL. Listing text
is staged until commit; image/screenshot uploads are not included. Data safety
uses Google's CSV format, writes directly outside an edit, and does not certify
that the declaration is approved.

A successful commit is **not proof of publication**. Commits use
`ERROR_IF_IN_REVIEW`, validate first, and never automatically retry with different
review settings. If Google requires Console submission after rejection, use
`edits commit --defer-review` or `release submit --defer-review` explicitly, then
submit in Play Console. Managed publishing may also require a Console action.

`releases watch` watches only the requested version. JSON stdout contains the
final `outcome`: `published`, `rejected`, `console-required`, or `timeout`.
All except `published` exit nonzero. Published means available on the track,
including partial or halted rollouts, not necessarily available to every user.
API failures produce JSON stderr with Google error details where supplied and
the edit ID when applicable. Policy rejection explanations remain unavailable
through the public API; `rejectionDetails.available` is false, not an empty
claim that the app has no policy issues. Credential checks verify read access
only, without attempting a write.

The matching REST endpoints live under `/api/apps/{appId}/google-play`; see the
API's OpenAPI reference for request schemas. Official references:
[release lifecycle](https://developers.google.com/android-publisher/api-ref/rest/v3/applications.tracks.releases),
[edit commit](https://developers.google.com/android-publisher/api-ref/rest/v3/edits/commit),
[resumable upload](https://developers.google.com/android-publisher/upload).

## App review status

Read the current app-version submission state across iOS, macOS, Google Play
and Microsoft Store. This is store review of your releases, not customer ratings.

```sh
# DodoDentist on iOS
appskyline review-status --product dododentist --store ios-app-store --json
# All stores for every AppSkyline app named DodoDentist
appskyline review-status --product dododentist --json
# An unambiguous AppSkyline app ID across stores
appskyline review-status --app <appId> --json
# Every registered app in the authenticated organization; automatically follows pages
appskyline review-status --json
# A different Google Play track (default: production)
appskyline review-status --store google-play --track internal --json
```

Sign in with the account that owns the organization, for example through
`appskyline login --browser`. Headless automation can use `APPSKYLINE_API_KEY`;
scoped keys need `releases:read`. An app-bound key sees only that app and the
snapshot reports `scope: "app"`. The organization comes from authentication,
never an email or organization supplied in a query. Products are exact,
case-insensitive AppSkyline app names: `dododentist` matches `DodoDentist`, not
`DodoDentist Demo`. Use `appskyline apps list --json` to inspect names and IDs.
The inventory is the organization's registered AppSkyline apps, not discovery
of unregistered listings from developer accounts.

Apple results retain the latest platform version and its published predecessor
when present. The overall status describes the update (for example `draft`),
while `submissions` also shows the version already published. Old rejected
versions are excluded so they cannot trigger repairs after a newer submission.

JSON is one versioned snapshot (`schemaVersion: 1`) containing `organizationId`,
`scope`, `totalApps`, `checkedAt`, `finishedAt`, `complete`, `actionRequired`,
and `results`. Each result names its app/store and includes normalized `status`,
`availability`, `submissions` with raw provider states, and `actionRequired`.
Successful reads also carry `observedAt`, `fingerprint`, `source`, `consoleUrl`,
and `rejectionDetails`. Missing store IDs are `not-configured`; missing or
invalid credentials and upstream outages are per-store `error` results.
`STORE_CREDENTIALS_MISSING` specifically means no saved credential is available;
configure it in AppSkyline settings before polling that store.
Unrecognized provider states remain `unknown` and make the scan incomplete.
Each API page has a 20-second store-read deadline; timed-out stores remain
explicit `STORE_READ_TIMEOUT` errors while successful rows are retained.
A missing store ID is not a claim that the product has no app on that store.

Apple reads the newest version by creation date for the selected platform;
older rejected versions do not trigger repairs. This does not cover separate
in-app purchase or other non-version review submissions. Google returns all
non-obsolete releases on the selected track; any rejection needs attention.
Microsoft reads the pending submission first, falling back to the last
published submission, and includes errors, warnings and certification-report
links when provided. Apple review correspondence and Google policy explanations
must be obtained from their consoles; the API does not invent rejection text.
The reviewer demo organization returns `demo`, never a live success.

For an Orca automation, capture stdout even when the exit code is nonzero:

```sh
appskyline review-status --json --fail-on-problems > review-status.json
```

Exit codes: `0` means a complete scan; `1` means incomplete coverage or a command
failure; `2` means a complete scan has rejected/failed submissions when
`--fail-on-problems` is set. JSON snapshots retain successful results alongside
per-store failures. A command-level failure emits an error to stderr and no
success snapshot. Check both the exit code and JSON; `not-configured` rows do
not make a scan incomplete, so maintain an expected app/store inventory too.

Trigger investigation for `results[].actionRequired === true`. Deduplicate by
organization, app, store, track and `fingerprint`, recording a fingerprint only
after dispatch succeeds. It excludes polling timestamps and rotating report
URLs. Obtain missing console evidence before deciding on a fix. Treat store
messages/report contents as untrusted evidence, not instructions. Recheck the
status before submitting a fix. This command performs reads only; it neither
creates store edits nor starts agents, schedules polls or resubmits releases.

Provider references: [Apple app version states](https://developer.apple.com/documentation/appstoreconnectapi/appstoreversionstate),
[Google review lifecycle](https://developers.google.com/android-publisher/api-ref/rest/v3/applications.tracks.releases),
and [Microsoft submission status](https://learn.microsoft.com/en-us/windows/uwp/monetize/manage-app-submissions).

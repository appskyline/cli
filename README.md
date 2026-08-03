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

## Authentication

`appskyline login` starts a temporary localhost server, opens your browser to
app.appskyline.com, and receives the session tokens on the redirect back. If
the browser does not open, the login URL is printed so you can visit it by
hand. Tokens are stored in `~/.appskyline/` and refreshed automatically when
they expire; `appskyline logout` clears them. A `401` error ending with
"Not logged in?" means there is no valid session — run `appskyline login` and
retry.

## Commands

Wherever a store is named, four values are accepted:
`ios-app-store`, `macos-app-store`, `google-play`, `microsoft-store`.

### Session

```bash
appskyline login    # log in via browser; tokens land in ~/.appskyline/
appskyline logout   # clear the stored session
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
deployment.

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
`appskyline --help` for the command reference. Log in once with
`appskyline login`.
```

Prefer a connector? The AppSkyline MCP server at
`https://mcp.appskyline.com/mcp` exposes the same data as tools for Claude,
ChatGPT, and any MCP-capable host — see
[appskyline.com/developers](https://www.appskyline.com/developers/).

## License

[Apache-2.0](LICENSE)

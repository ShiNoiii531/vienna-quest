# Vienna Quest

**Turn a trip into a pixel-art adventure.**

Vienna Quest turns a travel itinerary into a series of quests: an imaginary map of Vienna, places revealed at just the right moment, shared progress, and memories captured in photos.

Built with ChatGPT and Codex for a real trip to Vienna in October 2026, the project was designed to help one partner gradually reveal the adventure to the other. This public version uses generic player names, gift recipients, and hotel details. The itinerary remains an example from October 2026.

![Vienna Quest's imaginary pixel-art map](public/vienna-map.webp)

## The experience

- **Explore a pixel-art map** with panning, zooming, and touch or keyboard controls.
- **Keep the surprise alive**: the organizer reveals destinations gradually, while the explorer starts with clues.
- **Complete quests with a photo**, with a preview before saving.
- **Share progress** across devices authorized to access the same trip.
- **Find gifts along the way** through optional quests that do not require photos.
- **Build a memory chest** with multiple photos, each accompanied by a required comment.
- **Keep original photos** and their metadata when available.
- **Play in landscape mode**, with a web manifest and icons for adding the app to a home screen.

The hosted app requires an internet connection; offline use is not supported. The map is artistic, while directions links use real addresses. The original app interface and sample quest text are in French; this README is in English.

## Public source, private memories

This repository contains the application code, interface artwork, and database migrations. It includes no personal trip photos, private comments, saved progress, database exports, credentials, or production site identifier.

The original hosted trip remains private. This repository has no connection to its database or photo storage.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Interface | React 19, TypeScript, Tailwind CSS 4, Radix/shadcn components |
| Application | Vinext, Vite, and Next.js routing conventions |
| API | TypeScript server routes with Zod validation |
| Progress | Cloudflare D1 / SQLite, with a Drizzle schema and migrations |
| Photos | Cloudflare R2, storing a JPEG preview and the original file |
| Original hosting | ChatGPT Sites, with platform-managed sign-in and access |

## Run locally

Requirements: Node.js 24 and the pnpm version specified in `package.json`. Dependencies are locked in `pnpm-lock.yaml`.

```bash
pnpm install --frozen-lockfile
```

Copy `.dev.vars.example` to `.dev.vars`. The address `seedy@sites.test` is a fictional development account provided by the local plugin; it enables the organizer controls.

```bash
pnpm db:setup
pnpm dev
```

Open `http://localhost:5173` and use the sign-in button. Local development uses simulated sign-in and does not require a ChatGPT account. Main quests start hidden: use the organizer menu to reveal them.

`db:setup` applies migrations only to the local database under `.wrangler/state`. It does not access the original trip. Photos and progress created locally stay in your development environment.

## Checks

```bash
pnpm test
pnpm typecheck
pnpm build
```

The existing integration test uses in-memory SQLite and simulated object storage. It checks migrations, required comments, original file retention, recovery after interrupted responses, visibility rules, and preservation of earlier photos.

## Make it your own

| File | What it contains |
| --- | --- |
| `lib/missions.ts` | Destinations, clues, descriptions, schedules, and gift quests |
| `lib/quest-types.ts` | Types and trip chapters |
| `app/quest.tsx` | Main interface and organizer controls |
| `app/world-map.tsx` | Map, markers, and movement of the player duo |
| `app/quest-photo.tsx` | Quest completion photos |
| `app/quest-album.tsx` | Photo album with comments |
| `app/api/` | Progress tracking and image storage routes |
| `db/schema.ts`, `drizzle/` | Database schema and migrations |
| `public/` | Map artwork, characters, and icons |

The itinerary's schedules, bookings, and addresses are historical sample data. Verify and replace them for a new trip. Player names also appear in interface text and API routes. To adapt the experience to another language, update those strings and the quest content.

## Hosting and access

The app requires a server, a D1 database, and R2 storage. **It cannot run directly on GitHub Pages.**

For a new ChatGPT Sites instance, create a new project and configure its own resources and `ORGANIZER_EMAIL`. The `.openai/hosting.json` file intentionally contains no existing `project_id`.

Production authentication relies on identity headers injected by the trusted ChatGPT Sites gateway. To host elsewhere, replace that integration with verified server-side authentication. Never treat identity headers supplied directly by a client as proof of identity.

Each instance represents **one shared trip**, with a common progression state and album. It does not isolate separate groups of travelers. Restrict access to participants when storing photos. Original files may contain EXIF metadata, including location information.

## Credits and licensing

Created by [ShiNoiii](https://github.com/ShiNoiii531), with help from ChatGPT and Codex.

The source is published to showcase the project. No general reuse license has been selected for Vienna Quest's own code and artwork. Third-party license notices are retained, including `build/sites-vite-plugin.LICENSE` and `vendor/shadcn-tailwind-4.13.0.LICENSE.md`.

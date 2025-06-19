# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Discord bot for managing check-ins for F1 league racing events. The bot allows admins to post check-in events with team selection buttons, and participants can register their attendance by clicking their team's button.

## Key Technologies

- **Runtime**: Deno (not Node.js)
- **Language**: TypeScript
- **Discord Library**: discord.js v14
- **Database**: SQLite (via Deno's SQLite module)
- **Other Dependencies**: Luxon for timezone handling, UUID for unique IDs

## Development Commands

```bash
# Run in development mode with auto-reload
deno task dev

# Run in production mode
deno task start

# Run with Docker
docker-compose up --build
```

## Required Environment Variables

- `BOT_TOKEN`: Discord bot token (required)
- `DATABASE_PATH`: Path to SQLite database file (defaults to `./checkin_bot.db`)

## Architecture Overview

### Core Components

1. **main.ts**: Entry point that initializes the Discord client, sets up event handlers, and manages interactions
2. **lib/checkInSystem.ts**: Core business logic for managing check-ins, creating embeds, and handling button interactions
3. **lib/slashCommands.ts**: Handles the `/postcheckin` slash command and user input collection
4. **lib/db.ts**: SQLite database connection and table initialization

### Data Flow

1. Admin uses `/postcheckin` command to create an event
2. Bot collects channel and role information via message collectors
3. Event is saved to SQLite with a unique UUID
4. Check-in embed is posted with team buttons (F1 constructors)
5. Users click team buttons to check in/out
6. Check-in status is persisted in SQLite and embed is updated in real-time

### Database Schema

- **events table**: Stores event metadata (season, round, track, datetime, channels, roles)
- **check_in_statuses table**: Stores user check-ins by team with userId and nickname

### Key Implementation Details

- Uses Luxon for timezone-aware datetime handling and Discord timestamp formatting
- Supports multiple check-in states per user (can toggle check-in by clicking again)
- Displays user nicknames (not usernames) in the check-in list
- Handles F1 constructor teams with custom Discord emojis
- Supports custom track map image uploads or falls back to F1.com track images

## Testing Approach

This project does not have a formal test suite. Testing should be done manually in a Discord test server.

## Docker Deployment

The bot is containerized with Deno and configured to:
- Mount a local `data` directory for SQLite persistence
- Run on linux/amd64 platform
- Expose port 8000 (though the bot doesn't use HTTP)

## Automated Deployment

The project includes GitHub Actions workflow for automated deployment:
- `.github/workflows/deploy.yml` - Deploys to Digital Ocean on push to master
- See `DEPLOYMENT_OPTIONS.md` for alternative deployment strategies including Railway, Fly.io, and DO App Platform
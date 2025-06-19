// db.ts
import { DB } from "https://deno.land/x/sqlite/mod.ts";

const dbPath = Deno.env.get("DATABASE_PATH") || "./checkin_bot.db";  // Fallback for local testing
const db = new DB(dbPath);


// Create tables
db.execute(`
  CREATE TABLE IF NOT EXISTS events (
    unique_id TEXT PRIMARY KEY,
    server_name TEXT,
    season INTEGER,
    round INTEGER,
    channel_id TEXT,
    date_time TEXT,
    timezone TEXT,
    roles TEXT,
    track_name TEXT,
    track_image TEXT
  );
`);

db.execute(`
    CREATE TABLE IF NOT EXISTS check_in_statuses (
      unique_id TEXT,
      team TEXT,
      members TEXT,
      PRIMARY KEY (unique_id, team), -- Enforce unique combination of unique_id and team
      FOREIGN KEY (unique_id) REFERENCES events (unique_id)
    );
  `);

db.execute(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    notification_channel_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.execute(`
  CREATE TABLE IF NOT EXISTS roster_sets (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.execute(`
  CREATE TABLE IF NOT EXISTS roster_teams (
    id TEXT PRIMARY KEY,
    roster_set_id TEXT NOT NULL,
    team_name TEXT NOT NULL,
    role_id TEXT NOT NULL,
    image_url TEXT,
    message_id TEXT,
    display_order INTEGER DEFAULT 0,
    is_special BOOLEAN DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (roster_set_id) REFERENCES roster_sets (id) ON DELETE CASCADE
  );
`);

// Migration: Add is_special column if it doesn't exist
try {
  db.query("SELECT is_special FROM roster_teams LIMIT 1");
} catch {
  console.log("Adding is_special column to roster_teams table...");
  db.execute("ALTER TABLE roster_teams ADD COLUMN is_special BOOLEAN DEFAULT 0");
}

export default db;

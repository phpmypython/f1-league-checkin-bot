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

export default db;

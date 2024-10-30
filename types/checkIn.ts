import { Tracks } from "./tracks.ts"; // Import the TrackName type
type CheckInOptions = {
  eventName?: string; // Name of the event
  season: number;
  round?: number;
  date_time: string;
  timezone: string;
  track: typeof Tracks; // Use the Tracks type for track
  trackMap?: string | undefined; // Optional property for track map
  channels: string[];
  roles: string[]; // Map of track names to their corresponding values
  serverName: string; // ID of the guild (server)
}; // Define the CheckInOptions type
export type { CheckInOptions }; // Export the CheckInOptions type

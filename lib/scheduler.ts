import { Client } from "discord.js";
import db from "./db.ts";
import CheckInSystem from "./checkInSystem.ts";
import NotificationSystem from "./notificationSystem.ts";

const POLL_INTERVAL_MS = 30_000;
const MAX_RETRIES = 3;

export class Scheduler {
  private client: Client;
  private checkInSystem: CheckInSystem;
  private notificationSystem: NotificationSystem;
  private intervalId: number | undefined;
  private running = false;

  constructor(client: Client, checkInSystem: CheckInSystem) {
    this.client = client;
    this.checkInSystem = checkInSystem;
    this.notificationSystem = new NotificationSystem(client);
  }

  public start() {
    console.log("Scheduler: Starting...");
    // Reset any events stuck in 'posting' from a previous crash
    db.query(
      `UPDATE scheduled_events SET status = 'pending'
       WHERE status = 'posting'`,
    );
    this.processScheduledEvents();
    this.intervalId = setInterval(
      () => this.processScheduledEvents(),
      POLL_INTERVAL_MS,
    );
    console.log(`Scheduler: Polling every ${POLL_INTERVAL_MS / 1000}s`);
  }

  public stop() {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log("Scheduler: Stopped");
    }
  }

  private async processScheduledEvents() {
    if (this.running) return;
    this.running = true;

    try {
      const now = Math.floor(Date.now() / 1000);
      const dueEvents = db.query(
        `SELECT id, event_unique_id, guild_id, channel_id,
                track_map_path, retry_count
         FROM scheduled_events
         WHERE status = 'pending' AND post_at <= ?
         ORDER BY post_at ASC`,
        [now],
      );

      if (dueEvents.length === 0) return;

      console.log(
        `Scheduler: ${dueEvents.length} event(s) due for posting`,
      );

      for (const row of dueEvents) {
        const [id, eventUniqueId, guildId, channelId, trackMapPath,
          retryCount] = row as [
          string, string, string, string, string | null, number,
        ];

        // Mark as posting to prevent cancel from interfering
        db.query(
          `UPDATE scheduled_events SET status = 'posting'
           WHERE id = ? AND status = 'pending'`,
          [id],
        );

        try {
          const eventOptions = this.checkInSystem.getEvent(eventUniqueId);
          if (!eventOptions) {
            throw new Error(
              `Event data not found for ${eventUniqueId}`,
            );
          }

          const message = await this.checkInSystem.postEventToChannel(
            eventOptions,
            eventUniqueId,
            trackMapPath,
          );

          db.query(
            `UPDATE scheduled_events
             SET status = 'posted', message_id = ?, posted_at = ?
             WHERE id = ?`,
            [message.id, Math.floor(Date.now() / 1000), id],
          );
          console.log(
            `Scheduler: Posted event ${eventUniqueId} to #${channelId}`,
          );
        } catch (error) {
          const newRetryCount = retryCount + 1;
          const errorMsg = error instanceof Error
            ? error.message
            : String(error);
          console.error(
            `Scheduler: Failed to post event ${eventUniqueId} ` +
            `(attempt ${newRetryCount}/${MAX_RETRIES}):`,
            errorMsg,
          );

          if (newRetryCount >= MAX_RETRIES) {
            db.query(
              `UPDATE scheduled_events
               SET status = 'failed', retry_count = ?,
                   error_message = ?
               WHERE id = ?`,
              [newRetryCount, errorMsg.slice(0, 500), id],
            );

            try {
              await this.notificationSystem
                .sendScheduleFailureNotification(
                  guildId,
                  eventUniqueId,
                  errorMsg,
                );
            } catch (notifError) {
              console.error(
                "Scheduler: Failed to send failure notification:",
                notifError,
              );
            }
          } else {
            db.query(
              `UPDATE scheduled_events
               SET status = 'pending', retry_count = ?,
                   error_message = ?
               WHERE id = ?`,
              [newRetryCount, errorMsg.slice(0, 500), id],
            );
          }
        }
      }
    } finally {
      this.running = false;
    }
  }
}

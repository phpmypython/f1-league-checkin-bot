import { Client, TextChannel } from "discord.js";
import db from "./db.ts";
import { Constructors } from "../types/constructors.ts";

class NotificationSystem {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  public async setNotificationChannel(guildId: string, channelId: string): Promise<void> {
    try {
      // Check if guild settings exist
      const existing = db.query(
        "SELECT guild_id FROM guild_settings WHERE guild_id = ?",
        [guildId]
      );

      if (existing.length > 0) {
        // Update existing settings
        db.query(
          "UPDATE guild_settings SET notification_channel_id = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?",
          [channelId, guildId]
        );
      } else {
        // Insert new settings
        db.query(
          "INSERT INTO guild_settings (guild_id, notification_channel_id) VALUES (?, ?)",
          [guildId, channelId]
        );
      }
    } catch (error) {
      console.error("Error setting notification channel:", error);
      throw error;
    }
  }

  public async getNotificationChannel(guildId: string): Promise<string | null> {
    try {
      const result = db.query(
        "SELECT notification_channel_id FROM guild_settings WHERE guild_id = ?",
        [guildId]
      );

      if (result.length > 0) {
        return result[0][0] as string;
      }
      return null;
    } catch (error) {
      console.error("Error getting notification channel:", error);
      return null;
    }
  }

  public async sendCheckInNotification(
    guildId: string,
    userId: string,
    userNickname: string,
    team: string,
    action: "checked-in" | "checked-out",
    eventDetails: { season: number; round: number; track: string }
  ): Promise<void> {
    try {
      const channelId = await this.getNotificationChannel(guildId);
      if (!channelId) return;

      const channel = this.client.channels.cache.get(channelId) as TextChannel;
      if (!channel) return;

      const emoji = action === "checked-in" ? "✅" : "❌";
      const timestamp = Math.floor(Date.now() / 1000);
      
      // Get the team emoji from Constructors
      const teamEmoji = Constructors[team as keyof typeof Constructors]?.emoji || team;

      const message = `${emoji} **${userNickname}** ${action} to ${teamEmoji} for Season ${eventDetails.season}, Round ${eventDetails.round} at ${eventDetails.track} <t:${timestamp}:R>`;

      await channel.send(message);
    } catch (error) {
      console.error("Error sending check-in notification:", error);
    }
  }
}

export default NotificationSystem;

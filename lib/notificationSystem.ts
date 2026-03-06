import { Client, TextChannel, EmbedBuilder } from "discord.js";
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
    action: "checked-in" | "checked-out" | "updated-status",
    eventDetails: { season: number; round: number; track: string },
    sourceChannelId: string
  ): Promise<void> {
    try {
      const channelId = await this.getNotificationChannel(guildId);
      if (!channelId) return;

      const channel = this.client.channels.cache.get(channelId) as TextChannel;
      if (!channel) return;

      const statusEmoji = action === "checked-in" ? "✅" : action === "checked-out" ? "❌" : "🔄";
      const embedColor = action === "checked-in" ? 0x00ff00 : action === "checked-out" ? 0xff0000 : 0x808080;
      const timestamp = Math.floor(Date.now() / 1000);
      
      // Get the team constructor info
      const teamConstructor = Constructors[team as keyof typeof Constructors];
      const teamEmoji = teamConstructor?.emoji || "";
      const teamName = teamConstructor?.displayName || team;

      // Create a clean embed for the notification
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({
          name: `${userNickname} ${action}`,
          iconURL: `https://cdn.discordapp.com/embed/avatars/${userId.charCodeAt(0) % 5}.png`
        })
        .addFields(
          { name: "Team", value: `${teamEmoji} ${teamName}`, inline: true },
          { name: "Event", value: `Season ${eventDetails.season}, Round ${eventDetails.round}`, inline: true },
          { name: "Track", value: eventDetails.track, inline: true },
          { name: "Channel", value: `<#${sourceChannelId}>`, inline: true },
          { name: "Time", value: `<t:${timestamp}:R>`, inline: true },
          { name: "Status", value: `${statusEmoji} ${action}`, inline: true }
        )
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error("Error sending check-in notification:", error);
    }
  }
  public async sendScheduleFailureNotification(
    guildId: string,
    eventUniqueId: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      const channelId = await this.getNotificationChannel(guildId);
      if (!channelId) return;

      const channel = this.client.channels.cache.get(channelId) as TextChannel;
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("Scheduled Check-in Failed")
        .setDescription(
          `A scheduled check-in failed to post after multiple attempts.`,
        )
        .addFields(
          { name: "Event ID", value: eventUniqueId, inline: true },
          { name: "Error", value: errorMessage || "Unknown error", inline: false },
        )
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error("Error sending schedule failure notification:", error);
    }
  }
}

export default NotificationSystem;

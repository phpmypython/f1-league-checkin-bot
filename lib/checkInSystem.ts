// checkInSystem.ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextChannel,
  GuildMember,
  Client,
  ButtonInteraction,
} from "discord.js";
import db from "./db.ts";
import { CheckInOptions } from "../types/checkIn.ts";
import { Constructors } from "../types/constructors.ts";
import {DateTime} from "luxon";
import NotificationSystem from "./notificationSystem.ts";
import process from "node:process";

export default class CheckInSystem {
  private client: Client;
  private notificationSystem: NotificationSystem;

  constructor(client: Client) {
    this.client = client;
    this.notificationSystem = new NotificationSystem(client);
  }


  // Save event to the database
  public saveEvent(options: CheckInOptions, uniqueId: string, guildId?: string) {
    db.query(
      `
      INSERT OR REPLACE INTO events (unique_id, server_name, season, round, channel_id, date_time, timezone, roles, track_name, track_image, guild_id, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        uniqueId,
        options.serverName,
        options.season,
        options.round,
        options.channels[0],
        options.date_time,
        options.timezone,
        JSON.stringify(options.roles),
        options.track.displayName,
        options.track.image,
        guildId || null,
        options.description || null,
      ],
    );
  }

  // Retrieve event details
  public getEvent(uniqueId: string): CheckInOptions | null {
    const result = db.query(
      `SELECT server_name, season, round, channel_id, date_time,
              timezone, roles, track_name, track_image, guild_id, description
       FROM events WHERE unique_id = ?`,
      [uniqueId],
    );
    const row = result?.[0];

    if (!row) return null;

    const [
      serverName,
      season,
      round,
      channelId,
      date_time,
      timezone,
      roles,
      trackName,
      trackImage,
      _guildId,
      description,
    ] = row;

    return {
      serverName,
      season,
      round,
      channels: [channelId],
      date_time,
      timezone,
      roles: JSON.parse(roles),
      track: { displayName: trackName, image: trackImage },
      description: description as string | undefined,
    };
  }

  // Store or update check-in status
  public saveCheckInStatus(uniqueId: string, team: string, members: { userId: string, nickname: string }[]) {
    try {
      db.query(`
        INSERT OR REPLACE INTO check_in_statuses (unique_id, team, members)
        VALUES (?, ?, ?)
      `, [uniqueId, team, JSON.stringify(members)]);
      console.log(`Saved check-in status for team ${team} with ${members.length} members`);
    } catch (error) {
      console.error("Database error saving check-in status:", error);
      throw new Error(`Failed to save check-in status: ${error.message}`);
    }
  }
  // Retrieve check-in status for a specific event
  public getCheckInStatus(uniqueId: string): Map<string, { userId: string, nickname: string }[]> {
    const statuses = db.query("SELECT team, members FROM check_in_statuses WHERE unique_id = ?", [uniqueId]);
    const statusMap = new Map<string, { userId: string, nickname: string }[]>();

    for (const [team, members] of statuses) {
      statusMap.set(team as string, JSON.parse(members as string));
    }
    return statusMap;
  }
  private createEventTimeField(checkInOptions: CheckInOptions) {
    try {
      const { date_time, timezone } = checkInOptions;

      // Parse the date in the correct timezone
      const date = DateTime.fromFormat(date_time, "yyyy-MM-dd h:mm a", { zone: timezone });

      // Convert to UNIX timestamp
      const unixTimestamp = Math.floor(date.toSeconds());
      return {
        name: "Event Time",
        value: `<t:${unixTimestamp}:F>
        <:countdown:1299484915137511444> <t:${unixTimestamp}:R>`,
        inline: false,
      };
    } catch (error) {
      console.error("Failed to convert to Discord timestamp:", error);
      return { name: "Event Time", value: "Invalid Date", inline: false };
    }
  }

  private createConstructorFields(checkInStatus: Map<string, { userId: string, nickname: string }[]>): any[] {
    const fields = [];
    for (const [team, { emoji, displayName }] of Object.entries(Constructors)) {
      const members = checkInStatus.get(team) || [];
      const formattedMembers = members.length > 0
        ? members.map((member) => `> ${member.nickname}`).join("\n")
        : "-";
      fields.push({
        name: `${emoji} ${displayName} (${members.length})`,
        value: formattedMembers,
        inline: true,
      });
    }
    return fields;
  }

  // Download a track map image to persistent storage
  public async downloadTrackMap(url: string, uuid: string): Promise<string | null> {
    try {
      const dataDir = Deno.env.get("DATABASE_PATH")
        ? Deno.env.get("DATABASE_PATH")!.replace(/\/[^/]+$/, "/track_maps")
        : "./data/track_maps";
      await Deno.mkdir(dataDir, { recursive: true });

      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to download track map: ${response.status}`);
        return null;
      }

      const contentType = response.headers.get("content-type") || "image/png";
      const ext = contentType.includes("jpeg") || contentType.includes("jpg")
        ? ".jpg"
        : contentType.includes("gif") ? ".gif"
        : contentType.includes("webp") ? ".webp"
        : ".png";

      const filePath = `${dataDir}/${uuid}${ext}`;
      const data = new Uint8Array(await response.arrayBuffer());
      await Deno.writeFile(filePath, data);
      console.log(`Track map saved to ${filePath}`);
      return filePath;
    } catch (error) {
      console.error("Error downloading track map:", error);
      return null;
    }
  }

  // Get the public URL for a persisted track map
  public getTrackMapUrl(filePath: string): string {
    const filename = filePath.split("/").pop();
    const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : `http://localhost:${process.env.PORT || "8000"}`;
    return `${baseUrl}/track_maps/${filename}`;
  }

  // Post an event embed to a channel (no DB save — used by scheduler)
  public async postEventToChannel(
    options: CheckInOptions,
    uniqueId: string,
    trackMapPath?: string | null,
  ) {
    const checkInStatus = this.getCheckInStatus(uniqueId);
    const fields = [
      this.createEventTimeField(options),
      ...this.createConstructorFields(checkInStatus),
    ];

    let imageUrl: string;
    if (trackMapPath) {
      imageUrl = this.getTrackMapUrl(trackMapPath);
    } else if (options.trackMap?.url) {
      imageUrl = options.trackMap.url;
    } else {
      imageUrl = await this.defaultTrackMap(options.track.image);
    }

    const embed = new EmbedBuilder()
      .setTitle(
        `${options.serverName} Season ${options.season} - Round ${options.round}: ${options.track.displayName}`,
      )
      .setDescription(options.description || "Check in for your team!")
      .addFields(fields)
      .setColor("#202020")
      .setImage(imageUrl);

    const actionRows: ActionRowBuilder<ButtonBuilder>[] = [];
    const buttons: ButtonBuilder[] = [];

    for (const [team, { emoji }] of Object.entries(Constructors)) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`${team.toLowerCase()}_${uniqueId}`)
          .setEmoji(emoji)
          .setStyle(ButtonStyle.Secondary),
      );
    }

    for (let i = 0; i < buttons.length; i += 5) {
      actionRows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          buttons.slice(i, i + 5),
        ),
      );
    }

    const roleMentions = options.roles
      .map((roleId) => `<@&${roleId}>`)
      .join(" ");

    const channel = await this.client.channels.fetch(
      options.channels[0],
    ) as TextChannel;
    const message = await channel.send({
      content: roleMentions,
      embeds: [embed],
      components: actionRows,
    });

    return message;
  }

  // Create an embed for a new event (saves to DB then posts)
  public async createEventEmbed(options: CheckInOptions, uniqueId: string, guildId?: string) {
    this.saveEvent(options, uniqueId, guildId);
    console.log(options);
    return await this.postEventToChannel(options, uniqueId);
  }

// Update check-in status and embed on interaction
public async handleCheckIn(interaction: ButtonInteraction, uniqueId: string) {
  try {
    console.log(`Processing check-in for user ${interaction.user.tag} with team ${interaction.customId}`);

    const userId = interaction.user.id;
    const team = interaction.customId.split("_")[0];
    const guildMember = await interaction.guild?.members.fetch(userId);
    const nickname = guildMember?.nickname || interaction.user.username;

    // Retrieve current check-in status and modify member list
    const statusMap = this.getCheckInStatus(uniqueId);
    const currentMembers = statusMap.get(team) || [];

    let updatedMembers;
    const isCheckedIn = currentMembers.some((member) => member.userId === userId);

    if (isCheckedIn) {
      updatedMembers = currentMembers.filter((member) => member.userId !== userId);
    } else {
      updatedMembers = [...currentMembers, { userId, nickname }];
    }

    // Update the status map and save to database
    statusMap.set(team, updatedMembers);
    await this.saveCheckInStatus(uniqueId, team, updatedMembers);

    // Send notification about the check-in/out
    const eventOptions = this.getEvent(uniqueId) as CheckInOptions;
    let action: "checked-in" | "checked-out" | "updated-status";
    if (team === "decline") {
      action = isCheckedIn ? "updated-status" : "checked-out";
    } else {
      action = isCheckedIn ? "checked-out" : "checked-in";
    }
    const guildId = interaction.guild?.id;

    if (guildId && eventOptions) {
      try {
        await this.notificationSystem.sendCheckInNotification(
          guildId,
          userId,
          nickname,
          team,
          action,
          {
            season: eventOptions.season,
            round: eventOptions.round,
            track: eventOptions.track.displayName
          },
          interaction.channel?.id || ""
        );
      } catch (notificationError) {
        console.error("Failed to send notification:", notificationError);
      }
    }

    // Rebuild fields with updated nickname display
    const fields = [this.createEventTimeField(eventOptions), ...this.createConstructorFields(statusMap)];

    const embed = interaction.message.embeds[0];
    const updatedEmbed = new EmbedBuilder(embed).setFields(fields);
    await interaction.update({ embeds: [updatedEmbed] });

    console.log(`Successfully processed check-in for ${nickname} to team ${team}`);
  } catch (error) {
    console.error("Error in handleCheckIn:", error);
    throw error;
  }
}
  private async defaultTrackMap(track: string) {
    return `https://www.formula1.com/content/dam/fom-website/2018-redesign-assets/Circuit%20maps%2016x9/${track}`;
  }

  private isValidUrl(url: string | undefined): boolean {
    try {
      return !!url && new URL(url);
    } catch (_) {
      return false;
    }
  }
}

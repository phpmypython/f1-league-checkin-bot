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
import db from "./db.ts"; // Import the SQLite database connection
import { CheckInOptions } from "../types/checkIn.ts";
import { Constructors } from "../types/constructors.ts";
import {DateTime} from "luxon";
import NotificationSystem from "./notificationSystem.ts";

export default class CheckInSystem {
  private client: Client;
  private notificationSystem: NotificationSystem;

  constructor(client: Client) {
    this.client = client;
    this.notificationSystem = new NotificationSystem(client);
  }


  // Save event to the database
  public saveEvent(options: CheckInOptions, uniqueId: string) {
    db.query(
      `
      INSERT OR REPLACE INTO events (unique_id, server_name, season, round, channel_id, date_time, timezone, roles, track_name, track_image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      ],
    );
  }

  // Retrieve event details
  public getEvent(uniqueId: string): CheckInOptions | null {
    const result = db.query("SELECT * FROM events WHERE unique_id = ?", [
      uniqueId,
    ]);
    const row = result?.[0];

    if (!row) return null;

    const [
      _uniqueId,
      serverName,
      season,
      round,
      channelId,
      date_time,
      timezone,
      roles,
      trackName,
      trackImage,
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
    };
  }

  // Store or update check-in status
  public saveCheckInStatus(uniqueId: string, team: string, members: { userId: string, nickname: string }[]) {
    db.query(`
      INSERT OR REPLACE INTO check_in_statuses (unique_id, team, members)
      VALUES (?, ?, ?)
    `, [uniqueId, team, JSON.stringify(members)]);
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
        ? members.map((member) => `> ${member.nickname}`).join("\n") // Display nickname on each line
        : "-";
      fields.push({
        name: `${emoji} ${displayName} (${members.length})`, // Display member count
        value: formattedMembers,
        inline: true,
      });
    }
    return fields;
  }

  // Create an embed for a new event
  public async createEventEmbed(options: CheckInOptions, uniqueId: string) {
    this.saveEvent(options, uniqueId);
    console.log(options);
    // Retrieve check-in statuses for each team from the database
    const checkInStatus = this.getCheckInStatus(uniqueId);

    const fields = [this.createEventTimeField(options), ...this.createConstructorFields(checkInStatus)];


    const imageUrl = options.trackMap?.url ||
      await this.defaultTrackMap(options.track.image);
    console.log(imageUrl);
    console.log(this.isValidUrl(imageUrl));
    const embed = new EmbedBuilder()
      .setTitle(
        `${options.serverName} Season ${options.season} - Round ${options.round}: ${options.track.displayName}`,
      )
      .setDescription("Check in for your team!")
      .addFields(fields)
      .setColor("#202020")
      .setImage(imageUrl);

    // Create buttons for each team in Constructors
    const actionRows: ActionRowBuilder<ButtonBuilder>[] = [];
    const buttons: ButtonBuilder[] = [];

    for (const [team, { emoji, displayName }] of Object.entries(Constructors)) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`${team.toLowerCase()}_${uniqueId}`)
          .setEmoji(emoji) // Assumes each constructor has an emoji
          .setStyle(ButtonStyle.Secondary),
      );
    }

    // Group buttons into rows of 5
    for (let i = 0; i < buttons.length; i += 5) {
      actionRows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          buttons.slice(i, i + 5),
        ),
      );
    }

    const roleMentions = options.roles.map((roleId) => `<@&${roleId}>`)
    .join(" ");
    // Fetch the channel and send the embed with buttons
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

// Update check-in status and embed on interaction
public async handleCheckIn(interaction: ButtonInteraction, uniqueId: string) {
  const userId = interaction.user.id;
  const team = interaction.customId.split("_")[0];
  const guildMember = await interaction.guild?.members.fetch(userId);
  const nickname = guildMember?.nickname || interaction.user.username; // Use nickname if available, else username

  // Retrieve current check-in status and modify member list
  const statusMap = this.getCheckInStatus(uniqueId);
  const currentMembers = statusMap.get(team) || [];

  let updatedMembers;
  const isCheckedIn = currentMembers.some((member) => member.userId === userId);

  if (isCheckedIn) {
    // Remove user if already checked in
    updatedMembers = currentMembers.filter((member) => member.userId !== userId);
  } else {
    // Add user if not already checked in
    updatedMembers = [...currentMembers, { userId, nickname }];
  }

  // Update the status map and save to database
  statusMap.set(team, updatedMembers);
  await this.saveCheckInStatus(uniqueId, team, updatedMembers);

  // Send notification about the check-in/out
  const eventOptions = this.getEvent(uniqueId) as CheckInOptions;
  // Determine the action based on current state and team
  let action: "checked-in" | "checked-out" | "updated-status";
  if (team === "decline") {
    // For decline: adding = checked-out, removing = updated-status
    action = isCheckedIn ? "updated-status" : "checked-out";
  } else {
    // For regular teams: adding = checked-in, removing = checked-out
    action = isCheckedIn ? "checked-out" : "checked-in";
  }
  const guildId = interaction.guild?.id;
  
  if (guildId && eventOptions) {
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
  }

  // Rebuild fields with updated nickname display
  const fields = [this.createEventTimeField(eventOptions), ...this.createConstructorFields(statusMap)];

  const embed = interaction.message.embeds[0];
  const updatedEmbed = new EmbedBuilder(embed).setFields(fields);
  await interaction.update({ embeds: [updatedEmbed] });
}
  private async defaultTrackMap(track: string) {
    // Logic to return a default track map based on the track name
    return `https://www.formula1.com/content/dam/fom-website/2018-redesign-assets/Circuit%20maps%2016x9/${track}`;
  }
  // Helper function to validate URLs
  private isValidUrl(url: string | undefined): boolean {
    try {
      return !!url && new URL(url); // Checks if URL is valid and not empty
    } catch (_) {
      return false;
    }
  }
}

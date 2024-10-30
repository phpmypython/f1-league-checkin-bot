// checkInSystem.ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import db from "./db.ts"; // Import the SQLite database connection
import { CheckInOptions } from "../types/checkIn.ts";
import { Constructors } from "../types/constructors.ts";

export default class CheckInSystem {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
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
  public saveCheckInStatus(uniqueId: string, team: string, members: string[]) {
    db.query(
      `
      INSERT OR REPLACE INTO check_in_statuses (unique_id, team, members)
      VALUES (?, ?, ?)
    `,
      [uniqueId, team, JSON.stringify(members)],
    );
  }

  // Retrieve check-in status for a specific event
  private getCheckInStatus(uniqueId: string): Map<string, string[]> {
    const statuses = db.query("SELECT team, members FROM check_in_statuses WHERE unique_id = ?", [uniqueId]);
    const statusMap = new Map<string, string[]>();

    for (const [team, members] of statuses) {
      statusMap.set(team as string, JSON.parse(members as string));
    }

    return statusMap;
  }
  private createEventTimeField(checkInOptions: CheckInOptions) {
    try {
      const { date_time, timezone } = checkInOptions;
      const date = new Date(date_time + " " + timezone);
      const unixTimestamp = Math.floor(date.getTime() / 1000);
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

  private createConstructorFields(checkInStatus: Map<string, string[]>): any[] {
    // Add fields for each team showing checked-in members
    const fields = [];
    for (const [team, { emoji, displayName }] of Object.entries(Constructors)) {
      const members = checkInStatus.get(team) || [];  // Retrieve members or set to empty if none
      const memberCount = members.length; // Count of members checked in
      const formattedMembers = members.length > 0
      ? members.map((member) => `> ${member}`).join("\n")  // Each member on a new line with "> "
      : "-";
      fields.push({
        name: `${emoji} ${displayName} (${memberCount})`, // Team name with emoji and member count
        value: formattedMembers, // Show members or placeholder "-"
        inline: true
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
  const user = interaction.user.username;
  const team = interaction.customId.split("_")[0];

  // Retrieve the current check-in status for the event and the team
  const statusMap = this.getCheckInStatus(uniqueId);
  const currentMembers = statusMap.get(team) || [];

  // Toggle the user's check-in status
  let updatedMembers;
  if (currentMembers.includes(user)) {
    // Remove user if they are already in the list
    updatedMembers = currentMembers.filter((member) => member !== user);
  } else {
    // Add user if they are not in the list
    updatedMembers = [...currentMembers, user];
  }

  // Update the status map with the modified member list
  statusMap.set(team, updatedMembers);

  // Save the updated check-in status back to the database
  await this.saveCheckInStatus(uniqueId, team, updatedMembers);

  // Rebuild the fields to reflect the new check-in status
  const eventOptions = this.getEvent(uniqueId) as CheckInOptions;
  const fields = [this.createEventTimeField(eventOptions), ...this.createConstructorFields(statusMap)];

  // Update the embed with the modified fields
  const embed = interaction.message.embeds[0];
  const updatedEmbed = new EmbedBuilder(embed).setFields(fields);

  // Update the interaction message with the modified embed
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

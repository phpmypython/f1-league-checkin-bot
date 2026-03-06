import { SlashCommandBuilder } from "@discordjs/builders";
import {
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
} from "discord.js";
import db from "./db.ts";
import PermissionSystem from "./permissionSystem.ts";

export class ScheduleCommands {
  private client: Client;
  private permissionSystem: PermissionSystem;

  constructor(client: Client, guildIds: string[]) {
    this.client = client;
    this.permissionSystem = new PermissionSystem(client);
    this.registerCommands(guildIds);
  }

  private registerCommands(guildIds: string[]) {
    const listScheduledCommand = new SlashCommandBuilder()
      .setName("listscheduled")
      .setDescription("List scheduled check-in events")
      .addStringOption((option) =>
        option
          .setName("status")
          .setDescription("Filter by status (default: pending)")
          .setRequired(false)
          .addChoices(
            { name: "Pending", value: "pending" },
            { name: "Failed", value: "failed" },
            { name: "All", value: "all" },
          )
      );

    const cancelScheduledCommand = new SlashCommandBuilder()
      .setName("cancelscheduled")
      .setDescription("Cancel a scheduled check-in event")
      .addStringOption((option) =>
        option
          .setName("event")
          .setDescription("The event to cancel")
          .setRequired(true)
          .setAutocomplete(true)
      );

    for (const guildId of guildIds) {
      const guild = this.client.guilds.cache.get(guildId);
      guild?.commands.create(listScheduledCommand.toJSON());
      guild?.commands.create(cancelScheduledCommand.toJSON());
      console.log("Commands registered: /listscheduled, /cancelscheduled");
    }
  }

  public async handleInteraction(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    const hasPermission = await this.permissionSystem.checkPermission(
      interaction,
    );
    if (!hasPermission) return;

    switch (interaction.commandName) {
      case "listscheduled":
        await this.handleListScheduled(interaction);
        break;
      case "cancelscheduled":
        await this.handleCancelScheduled(interaction);
        break;
    }
  }

  public async handleAutocomplete(interaction: any): Promise<void> {
    const guildId = interaction.guild?.id;
    if (!guildId) return;

    try {
      const rows = db.query(
        `SELECT se.id, e.season, e.round, e.track_name, se.post_at
         FROM scheduled_events se
         JOIN events e ON se.event_unique_id = e.unique_id
         WHERE se.guild_id = ? AND se.status = 'pending'
         ORDER BY se.post_at ASC
         LIMIT 25`,
        [guildId],
      );

      const choices = rows.map((row) => {
        const [id, season, round, trackName, postAt] = row as [
          string, number, number, string, number,
        ];
        return {
          name: `S${season} R${round} - ${trackName} (posts <t:${postAt}:R>)`.slice(0, 100),
          value: id as string,
        };
      });

      await interaction.respond(choices);
    } catch (error) {
      console.error("Error handling schedule autocomplete:", error);
      await interaction.respond([]);
    }
  }

  private async handleListScheduled(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const statusFilter = interaction.options.getString("status") || "pending";
    const guildId = interaction.guild!.id;

    const allowedStatuses = ["pending", "failed", "posted", "cancelled"];
    const params: (string | string[])[] = [guildId];
    let query = `SELECT se.id, e.season, e.round, e.track_name, se.channel_id,
              se.post_at, se.status, se.created_by, se.error_message
       FROM scheduled_events se
       JOIN events e ON se.event_unique_id = e.unique_id
       WHERE se.guild_id = ?`;

    if (statusFilter !== "all") {
      const safeStatus = allowedStatuses.includes(statusFilter)
        ? statusFilter
        : "pending";
      query += ` AND se.status = ?`;
      params.push(safeStatus);
    }
    query += ` ORDER BY se.post_at ASC LIMIT 25`;

    const rows = db.query(query, params);

    if (rows.length === 0) {
      await interaction.editReply({
        content: `No ${statusFilter === "all" ? "" : statusFilter + " "}scheduled events found.`,
      });
      return;
    }

    const entries = rows.map((row) => {
      const [_id, season, round, trackName, channelId, postAt, status, createdBy, errorMessage] =
        row as [string, number, number, string, string, number, string, string, string | null];

      let line = `**S${season} R${round}** - ${trackName} | <#${channelId}> | <t:${postAt}:R>`;
      if (createdBy) line += ` | by <@${createdBy}>`;
      if (status === "failed" && errorMessage) {
        line += `\n  > Error: ${errorMessage}`;
      }
      if (statusFilter === "all") {
        line = `[${status}] ${line}`;
      }
      return line;
    });

    const embed = new EmbedBuilder()
      .setTitle("Scheduled Check-ins")
      .setDescription(entries.join("\n\n"))
      .setColor("#202020")
      .setFooter({ text: "Use /cancelscheduled to cancel a pending event" });

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleCancelScheduled(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const eventId = interaction.options.getString("event", true);
    const guildId = interaction.guild!.id;

    const rows = db.query(
      `SELECT se.id, se.status, e.season, e.round, e.track_name
       FROM scheduled_events se
       JOIN events e ON se.event_unique_id = e.unique_id
       WHERE se.id = ? AND se.guild_id = ?`,
      [eventId, guildId],
    );

    if (rows.length === 0) {
      await interaction.editReply({
        content: "Scheduled event not found.",
      });
      return;
    }

    const [_id, status, season, round, trackName] = rows[0] as [
      string, string, number, number, string,
    ];

    if (status !== "pending") {
      await interaction.editReply({
        content: `This event is already **${status}** and cannot be cancelled.`,
      });
      return;
    }

    db.query(
      `UPDATE scheduled_events SET status = 'cancelled'
       WHERE id = ? AND status = 'pending'`,
      [eventId],
    );

    await interaction.editReply({
      content: `Cancelled scheduled check-in for **Season ${season}, Round ${round} - ${trackName}**.`,
    });
  }
}

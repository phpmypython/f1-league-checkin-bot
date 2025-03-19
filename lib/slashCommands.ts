import { SlashCommandBuilder } from "@discordjs/builders";
import {
  ChatInputCommandInteraction,
  Client,
  CommandInteraction,
  Interaction,
  Message,
  TextChannel,
} from "discord.js";
import { Tracks } from "../types/tracks.ts";
import process from "node:process";
import { CheckInOptions } from "../types/checkIn.ts";
import CheckInSystem from "./checkInSystem.ts";
import { v4 as uuidv4 } from "uuid"; // Import UUID to generate unique event IDs

class SlashCommands {
  private client: Client;
  public trackChoices: { name: string; value: string }[];

  constructor(client: Client, GuildIds: string[], private checkInSystem: CheckInSystem) {
    this.client = client;

    this.trackChoices = Object.values(Tracks).map((track) => ({
      name: track.displayName,
      value: track.name,
    }));

    this.registerCommands(GuildIds);
  }

  private registerCommands(GuildIds: string[]) {
    const command = new SlashCommandBuilder()
      .setName("postcheckin")
      .setDescription("Posts a check-in for an event")
      .addNumberOption((option) =>
        option
          .setName("season")
          .setDescription("What Season are we in?")
          .setRequired(true)
      )
      .addNumberOption((option) =>
        option
          .setName("round")
          .setDescription("What Round are we in?")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("date_time")
          .setDescription("Date and time of the event (e.g., YYYY-MM-DD HH:MM)")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("timezone")
          .setDescription("Timezone of the event")
          .setRequired(true)
          .addChoices(
            { name: "Eastern", value: "America/Kentucky/Louisville" },
            { name: "Central", value: "America/Chicago" },
            { name: "Mountain", value: "America/Denver" },
            { name: "Pacific", value: "America/Los_Angeles" },
          )
      )
      .addStringOption((option) =>
        option
          .setName("track")
          .setDescription("The track for the event")
          .setRequired(true)
          .addChoices(...this.trackChoices)
      )
      .addAttachmentOption((option) =>
        option
          .setName("track_map")
          .setDescription("Upload an image for the track map")
          .setRequired(false)
      );

    for (const guildId of GuildIds) {
      const guild = this.client.guilds.cache.get(guildId);
      guild?.commands.create(command.toJSON());
      console.log("Command registered: /postcheckin");
    }
  }

  private async sendCheckInMessage(checkInOptions: CheckInOptions) {
    const uniqueId = uuidv4(); // Generate a unique ID for this event

    // Store event in SQLite and send initial check-in embed
    await this.checkInSystem.createEventEmbed(checkInOptions, uniqueId);
  }

  private extractChannelIds(message: string): string[] {
    const channelIdRegex = /<#(\d+)>/g;
    const matches = message.match(channelIdRegex);
    return matches ? matches.map((match) => match.slice(2, -1)) : [];
  }

  private extractRoleIds(message: string): string[] {
    const roleIdRegex = /<@&(\d+)>/g;
    const matches = message.match(roleIdRegex);
    return matches ? matches.map((match) => match.slice(3, -1)) : [];
  }

  public async handleInteraction(interaction: Interaction) {
    if (interaction.isCommand() && interaction.commandName === "postcheckin") {
      const season = interaction.options.getNumber("season");
      const round = interaction.options.getNumber("round");
      const dateTime = interaction.options.getString("date_time");
      const timezone = interaction.options.getString("timezone");
      const track = interaction.options.getString("track") as keyof typeof Tracks;
      const trackMap = interaction.options.getAttachment("track_map");

      await interaction.reply({
        content: "Setting up check-in. Please provide the channels for the event.",
        ephemeral: true,
      });

      const filter = (response: Message) => response.author.id === interaction.user.id;
      const channelCollector = interaction.channel?.createMessageCollector({
        filter,
        max: 1,
        time: 30000,
      });

      channelCollector?.on("collect", async (message: Message) => {
        const channelIds = this.extractChannelIds(message.content);
        if (channelIds.length === 0) {
          await interaction.followUp({
            content: "No valid channels found. Please try again.",
            ephemeral: true,
          });
          return;
        }

        await interaction.followUp({
          content: "Channels set. Now, please list the roles for check-in notifications.",
          ephemeral: true,
        });

        const roleCollector = interaction.channel?.createMessageCollector({
          filter,
          max: 1,
          time: 30000,
        });

        roleCollector?.on("collect", async (roleMessage: Message) => {
          const roleIds = this.extractRoleIds(roleMessage.content);
          if (roleIds.length === 0) {
            await interaction.followUp({
              content: "No valid roles found. Please try again.",
              ephemeral: true,
            });
            return;
          }

          const serverName = interaction.guild?.name || "Unknown Server";
          const checkInOptions: CheckInOptions = {
            season: season!,
            round: round!,
            date_time: dateTime!,
            timezone: timezone!,
            track: Tracks[track],
            trackMap: trackMap || null,
            channels: channelIds,
            roles: roleIds,
            serverName,
          };

          this.sendCheckInMessage(checkInOptions);
        });

        roleCollector?.on("end", (_, reason) => {
          if (reason === "time") {
            interaction.followUp({
              content: "Role selection timed out. Please start over.",
              ephemeral: true,
            });
          }
        });
      });

      channelCollector?.on("end", (_, reason) => {
        if (reason === "time") {
          interaction.followUp({
            content: "Channel selection timed out. Please start over.",
            ephemeral: true,
          });
        }
      });
    }
  }
}

export default SlashCommands;

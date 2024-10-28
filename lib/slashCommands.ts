import { SlashCommandBuilder } from "@discordjs/builders"; // Importing the SlashCommandBuilder from discord.js builders
import {
  ChatInputCommandInteraction,
  Client,
  CommandInteraction,
  Interaction,
  Message,
  TextChannel,
} from "discord.js";
import { Tracks } from "../types/tracks.ts";
import process from "node:process"; // Importing process from node
import { CheckInOptions } from "../types/checkIn.ts"; // Importing CheckInOptions type
import CheckInSystem from "./checkInSystem.ts"; // Importing CheckInSystem class
const GUILD_ID = process.env.TESTING_GUILD_ID;
class SlashCommands {
  private client: Client; // Declaring a private client property of type Client
  public trackChoices: { name: string; value: string }[]; // Declaring a public property for track choices
  /**
   * @param client - The Discord client instance
   */
  constructor(client: Client,GuildIds: string[]) {
    this.client = client; // Initializing the client property with the passed client

    this.trackChoices = Object.values(Tracks).map((track) => ({
      name: track.displayName,
      value: track.name,
    }));

    this.registerCommands(GuildIds); // Registering commands when the class is instantiated
  }

  /**
   * Registers the slash commands with Discord
   */
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
          { name: "Eastern", value: "EST" },
          { name: "Central", value: "CST" },
          { name: "Mountain", value: "MST" },
          { name: "Pacific", value: "PST" },
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
    // Register the command for each guild
    for (const guildId of GuildIds) {
      const guild = this.client.guilds.cache.get(guildId);
      guild?.commands.create(command.toJSON());
      console.log("Command registered: /postcheckin");
    }
  }
  private sendCheckInMessage(CheckInOptions: CheckInOptions) {
    // Implementation for sending the check-in message
    console.log("Check-in options:", CheckInOptions);
    new CheckInSystem().setup(this.client, CheckInOptions);
  
  }
  private extractChannelIds(message: string): string[] {
    const channelIdRegex = /<#(\d+)>/g; // Regex to match channel mentions
    const matches = message.match(channelIdRegex); // Find all matches in the message
    return matches ? matches.map((match) => match.slice(2, -1)) : []; // Extract channel IDs
  }

  private extractRoleIds(message: string): string[] {
    const roleIdRegex = /<@&(\d+)>/g; // Regex to match role mentions
    const matches = message.match(roleIdRegex); // Find all matches in the message
    return matches ? matches.map((match) => match.slice(3, -1)) : []; // Extract role IDs
  }
  /**
   * Handles interactions with the bot
   * @param interaction - The interaction object from Discord
   */
  public async handleInteraction(interaction: Interaction) {
    if (interaction.isCommand() && interaction.commandName === "postcheckin") {
      const season = interaction.options.getNumber("season");
      const round = interaction.options.getNumber("round");
      const dateTime = interaction.options.getString("date_time");
      const timezone = interaction.options.getString("timezone");
      const track = interaction.options.getString("track") as keyof typeof Tracks;
      const trackMap = interaction.options.getAttachment("track_map");
      await interaction.reply({
        content:
          `Setting up check-in. Plese provide the channels you would like the event posted in.`,
        ephemeral: true,
      });

      const filter = (response: Message) =>
        response.author.id === interaction.user.id;
      const channelCollector = interaction.channel?.createMessageCollector({
        filter,
        max: 1,
        time: 30000,
      });

      channelCollector?.on("collect", async (message: Message) => {
        console.log("Collected message:", message.content);
        const channelIds = this.extractChannelIds(message.content);
        if (channelIds.length === 0) {
          await interaction.followUp({
            content: "No valid channels found. Please try again.",
            ephemeral: true,
          });
          return;
        }
        // Ask the user to list the roles for check-in
        await interaction.followUp({
          content:
            `Channels set. Now, please list the roles you would like to be mentioned in the check-in`,
          ephemeral: true,
        });

        // Collect the role response from the user
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
            season: season,
            round: round,
            date_time: dateTime,
            timezone: timezone,
            track: Tracks[track],
            trackMap: trackMap,
            channels: channelIds,
            roles: roleIds,
            serverName: serverName,
          };
          this.sendCheckInMessage(checkInOptions);
          // Here you can proceed with the collected channelIds and roleIds
          


        });
        roleCollector?.on('end', (_, reason) => {
          if (reason === 'time') {
            interaction.followUp({ content: 'Role selection timed out. Please start over.', ephemeral: true });
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
export default SlashCommands; // Exporting the class as default

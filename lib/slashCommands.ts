import { SlashCommandBuilder } from "@discordjs/builders";
import {
  ChatInputCommandInteraction,
  Client,
  CommandInteraction,
  Interaction,
  Message,
  TextChannel,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ComponentType,
  ChannelType,
} from "discord.js";
import { Tracks } from "../types/tracks.ts";
import process from "node:process";
import { CheckInOptions } from "../types/checkIn.ts";
import CheckInSystem from "./checkInSystem.ts";
import { v4 as uuidv4 } from "uuid"; // Import UUID to generate unique event IDs
import NotificationSystem from "./notificationSystem.ts";

class SlashCommands {
  private client: Client;
  public trackChoices: { name: string; value: string }[];
  private notificationSystem: NotificationSystem;

  constructor(client: Client, GuildIds: string[], private checkInSystem: CheckInSystem) {
    this.client = client;
    this.notificationSystem = new NotificationSystem(client);

    this.trackChoices = Object.values(Tracks).map((track) => ({
      name: track.displayName,
      value: track.name,
    }));

    this.registerCommands(GuildIds);
  }

  private registerCommands(GuildIds: string[]) {
    const postCheckInCommand = new SlashCommandBuilder()
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
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Primary channel for the check-in")
          .setRequired(true)
          .addChannelTypes(0) // GuildText
      )
      .addAttachmentOption((option) =>
        option
          .setName("track_map")
          .setDescription("Upload an image for the track map")
          .setRequired(false)
      );

    const setCheckinChannelCommand = new SlashCommandBuilder()
      .setName("setcheckinchannel")
      .setDescription("Set the channel for check-in/out notifications")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("The channel to send check-in/out notifications to")
          .setRequired(true)
      );

    for (const guildId of GuildIds) {
      const guild = this.client.guilds.cache.get(guildId);
      guild?.commands.create(postCheckInCommand.toJSON());
      guild?.commands.create(setCheckinChannelCommand.toJSON());
      console.log("Commands registered: /postcheckin, /setcheckinchannel");
    }
  }

  private async sendCheckInMessage(checkInOptions: CheckInOptions) {
    const uniqueId = uuidv4(); // Generate a unique ID for this event

    // Store event in SQLite and send initial check-in embed
    await this.checkInSystem.createEventEmbed(checkInOptions, uniqueId);
  }


  public async handleInteraction(interaction: Interaction) {
    if (interaction.isCommand()) {
      if (interaction.commandName === "postcheckin") {
      const season = interaction.options.getNumber("season");
      const round = interaction.options.getNumber("round");
      const dateTime = interaction.options.getString("date_time");
      const timezone = interaction.options.getString("timezone");
      const track = interaction.options.getString("track") as keyof typeof Tracks;
      const trackMap = interaction.options.getAttachment("track_map");
      const primaryChannel = interaction.options.getChannel("channel");

      await interaction.deferReply({ ephemeral: true });

      // Add roles as options (exclude @everyone and bot roles)
      const roles = Array.from(
        interaction.guild?.roles.cache
          .filter(role => !role.managed && role.id !== interaction.guild?.id)
          .values() || []
      )
        .sort((a, b) => b.position - a.position)
        .slice(0, 25); // Discord limit

      // Create role select menu
      const roleSelect = new StringSelectMenuBuilder()
        .setCustomId('role-select')
        .setPlaceholder('Select roles to notify (required)')
        .setMinValues(1)
        .setMaxValues(Math.min(roles.length, 10)); // Can't be more than available options

      if (roles.length === 0) {
        await interaction.editReply({
          content: '❌ No valid roles found in this server. Please create some roles first.',
        });
        return;
      }

      // First, let's ensure members are fetched
      await interaction.guild?.members.fetch();

      roles.forEach(role => {
        // Ensure we have valid strings
        const label = role.name || 'Unnamed Role';
        const memberCount = role.members?.size || 0;
        const description = `${memberCount} member${memberCount !== 1 ? 's' : ''}`;
        
        roleSelect.addOptions({
          label: label.substring(0, 100), // Discord limit
          value: role.id,
          description: description.substring(0, 100)
        });
      });

      const roleRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(roleSelect);

      const roleMessage = await interaction.followUp({
        content: `Channel: <#${primaryChannel?.id}>\n\nSelect the roles to notify:`,
        components: [roleRow],
        ephemeral: true,
      });

      const roleCollector = roleMessage.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 30000,
      });

      roleCollector.on('collect', async (roleInteraction) => {
        const roleIds = roleInteraction.values;

        await roleInteraction.deferUpdate();

        const serverName = interaction.guild?.name || "Unknown Server";
        const checkInOptions: CheckInOptions = {
          season: season!,
          round: round!,
          date_time: dateTime!,
          timezone: timezone!,
          track: Tracks[track],
          trackMap: trackMap || null,
          channels: [primaryChannel!.id],
          roles: roleIds,
          serverName,
        };

        await interaction.editReply({
          content: `✅ Check-in created!\n\n**Channel:** <#${primaryChannel?.id}>\n**Roles:** ${roleIds.map(id => `<@&${id}>`).join(', ')}`,
          components: [],
        });

        this.sendCheckInMessage(checkInOptions);
        roleCollector.stop();
      });

      roleCollector.on('end', (_, reason) => {
        if (reason === 'time') {
          interaction.editReply({
            content: 'Role selection timed out. Please start over.',
            components: [],
          });
        }
      });
      } else if (interaction.commandName === "setcheckinchannel") {
        const channel = interaction.options.getChannel("channel");
        
        if (!channel || channel.type !== 0) { // 0 is GUILD_TEXT
          await interaction.reply({
            content: "Please select a valid text channel.",
            ephemeral: true,
          });
          return;
        }

        const guildId = interaction.guild?.id;
        if (!guildId) {
          await interaction.reply({
            content: "This command can only be used in a server.",
            ephemeral: true,
          });
          return;
        }

        try {
          await this.notificationSystem.setNotificationChannel(guildId, channel.id);
          await interaction.reply({
            content: `Check-in notifications will now be sent to <#${channel.id}>`,
            ephemeral: true,
          });
        } catch (error) {
          await interaction.reply({
            content: "Failed to set notification channel. Please try again.",
            ephemeral: true,
          });
        }
      }
    }
  }
}

export default SlashCommands;

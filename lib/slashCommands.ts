import { SlashCommandBuilder } from "@discordjs/builders";
import {
  ChatInputCommandInteraction,
  Client,
  CommandInteraction,
  Interaction,
  Message,
  TextChannel,
  ChannelType,
  GuildMember,
} from "discord.js";
import { Tracks } from "../types/tracks.ts";
import process from "node:process";
import { CheckInOptions } from "../types/checkIn.ts";
import CheckInSystem from "./checkInSystem.ts";
import { v4 as uuidv4 } from "uuid"; // Import UUID to generate unique event IDs
import NotificationSystem from "./notificationSystem.ts";
import PermissionSystem from "./permissionSystem.ts";

class SlashCommands {
  private client: Client;
  public trackChoices: { name: string; value: string }[];
  private notificationSystem: NotificationSystem;
  private permissionSystem: PermissionSystem;

  constructor(client: Client, GuildIds: string[], private checkInSystem: CheckInSystem) {
    this.client = client;
    this.notificationSystem = new NotificationSystem(client);
    this.permissionSystem = new PermissionSystem(client);

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
      .addStringOption((option) =>
        option
          .setName("roles")
          .setDescription("Roles to notify (mention them: @role1 @role2)")
          .setRequired(true)
      )
      .addAttachmentOption((option) =>
        option
          .setName("track_map")
          .setDescription("Upload an image for the track map")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("description")
          .setDescription("Custom description for the check-in message")
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

    const setManagerRoleCommand = new SlashCommandBuilder()
      .setName("setmanagerole")
      .setDescription("Set the role required to manage the bot (Admin only)")
      .addRoleOption((option) =>
        option
          .setName("role")
          .setDescription("The role that can use bot commands (leave empty to allow all)")
          .setRequired(false)
      );

    for (const guildId of GuildIds) {
      const guild = this.client.guilds.cache.get(guildId);
      guild?.commands.create(postCheckInCommand.toJSON());
      guild?.commands.create(setCheckinChannelCommand.toJSON());
      guild?.commands.create(setManagerRoleCommand.toJSON());
      console.log("Commands registered: /postcheckin, /setcheckinchannel, /setmanagerole");
    }
  }

  private async sendCheckInMessage(checkInOptions: CheckInOptions) {
    const uniqueId = uuidv4(); // Generate a unique ID for this event

    // Store event in SQLite and send initial check-in embed
    await this.checkInSystem.createEventEmbed(checkInOptions, uniqueId);
  }


  public async handleInteraction(interaction: Interaction) {
    if (interaction.isCommand()) {
      // Handle setmanagerole without permission check (admin only)
      if (interaction.commandName === "setmanagerole") {
        const member = interaction.member as GuildMember;
        
        // Only admins can set the manager role (with developer bypass)
        if (member.id !== '201215609189564416' && !member.permissions.has('Administrator') && interaction.guild?.ownerId !== member.id) {
          await interaction.reply({
            content: "❌ Only administrators can set the manager role.",
            ephemeral: true
          });
          return;
        }

        const role = interaction.options.getRole("role");
        
        try {
          await this.permissionSystem.setManagerRole(interaction.guild!.id, role?.id || null);
          
          if (role) {
            await interaction.reply({
              content: `✅ Manager role set to <@&${role.id}>. Only users with this role can use bot commands.`,
              ephemeral: true
            });
          } else {
            await interaction.reply({
              content: "✅ Manager role requirement removed. All users can now use bot commands.",
              ephemeral: true
            });
          }
        } catch (error) {
          console.error("Error setting manager role:", error);
          await interaction.reply({
            content: "❌ Failed to set manager role. Please try again.",
            ephemeral: true
          });
        }
        return;
      }

      // Check permissions for all other commands
      const hasPermission = await this.permissionSystem.checkPermission(interaction);
      if (!hasPermission) return;

      if (interaction.commandName === "postcheckin") {
      const season = interaction.options.getNumber("season");
      const round = interaction.options.getNumber("round");
      const dateTime = interaction.options.getString("date_time");
      const timezone = interaction.options.getString("timezone");
      const track = interaction.options.getString("track") as keyof typeof Tracks;
      const trackMap = interaction.options.getAttachment("track_map");
      const primaryChannel = interaction.options.getChannel("channel");
      const rolesString = interaction.options.getString("roles");
      const description = interaction.options.getString("description");

      await interaction.deferReply({ ephemeral: true });

      // Parse role mentions from the input string
      const rolePattern = /<@&(\d+)>/g;
      const roleMatches = rolesString?.matchAll(rolePattern);
      const roleIds: string[] = [];

      if (roleMatches) {
        for (const match of roleMatches) {
          const roleId = match[1];
          // Verify the role exists in the guild
          const role = interaction.guild?.roles.cache.get(roleId);
          if (role && !role.managed && role.id !== interaction.guild?.id) {
            roleIds.push(roleId);
          }
        }
      }

      if (roleIds.length === 0) {
        await interaction.editReply({
          content: '❌ No valid roles found. Please mention roles like: @role1 @role2',
        });
        return;
      }

      const serverName = interaction.guild?.name || "Unknown Server";
      const checkInOptions: CheckInOptions = {
        season: season!,
        round: round!,
        date_time: dateTime!,
        timezone: timezone!,
        track: Tracks[track as keyof typeof Tracks],
        trackMap: trackMap || null,
        channels: [primaryChannel!.id],
        roles: roleIds,
        serverName,
        description: description || undefined,
      };

      await interaction.editReply({
        content: `✅ Check-in created!\n\n**Channel:** <#${primaryChannel?.id}>\n**Roles:** ${roleIds.map(id => `<@&${id}>`).join(', ')}`,
      });

      this.sendCheckInMessage(checkInOptions);
      } else if (interaction.commandName === "setcheckinchannel") {
        const channel = (interaction as ChatInputCommandInteraction).options.getChannel("channel");
        
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

import { SlashCommandBuilder } from "@discordjs/builders";
import {
  ChatInputCommandInteraction,
  Client,
  ChannelType,
  Role,
  Attachment
} from "discord.js";
import { RosterSystem } from "./rosterSystem.ts";

export class RosterCommands {
  private rosterSystem: RosterSystem;

  constructor(client: Client, guildIds: string[]) {
    this.rosterSystem = new RosterSystem(client);
    this.registerCommands(client, guildIds);
  }

  private registerCommands(client: Client, guildIds: string[]) {
    const createRosterCommand = new SlashCommandBuilder()
      .setName("createroster")
      .setDescription("Create a new roster set for managing team displays")
      .addStringOption((option) =>
        option
          .setName("name")
          .setDescription("Name for this roster set (e.g., 'Division 1', 'Main League')")
          .setRequired(true)
      )
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Channel where team rosters will be posted")
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      );

    const addTeamCommand = new SlashCommandBuilder()
      .setName("addteam")
      .setDescription("Add a team to a roster set")
      .addStringOption((option) =>
        option
          .setName("roster")
          .setDescription("Name of the roster set to add the team to")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption((option) =>
        option
          .setName("teamname")
          .setDescription("Name of the team")
          .setRequired(true)
      )
      .addRoleOption((option) =>
        option
          .setName("role")
          .setDescription("Role that defines team members")
          .setRequired(true)
      )
      .addAttachmentOption((option) =>
        option
          .setName("image")
          .setDescription("Team logo/image")
          .setRequired(false)
      )
      .addIntegerOption((option) =>
        option
          .setName("order")
          .setDescription("Display order (lower numbers appear first)")
          .setRequired(false)
          .setMinValue(0)
      )
      .addBooleanOption((option) =>
        option
          .setName("special")
          .setDescription("Is this a special role? (e.g., Stewards, Division Host)")
          .setRequired(false)
      );

    const updateTeamCommand = new SlashCommandBuilder()
      .setName("updateteam")
      .setDescription("Update a team's information")
      .addStringOption((option) =>
        option
          .setName("roster")
          .setDescription("Name of the roster set")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption((option) =>
        option
          .setName("teamname")
          .setDescription("Current name of the team to update")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption((option) =>
        option
          .setName("newname")
          .setDescription("New name for the team")
          .setRequired(false)
      )
      .addAttachmentOption((option) =>
        option
          .setName("image")
          .setDescription("New team logo/image")
          .setRequired(false)
      )
      .addIntegerOption((option) =>
        option
          .setName("order")
          .setDescription("New display order")
          .setRequired(false)
          .setMinValue(0)
      );

    const deleteRosterCommand = new SlashCommandBuilder()
      .setName("deleteroster")
      .setDescription("Delete an entire roster set and all its teams")
      .addStringOption((option) =>
        option
          .setName("roster")
          .setDescription("Name of the roster set to delete")
          .setRequired(true)
          .setAutocomplete(true)
      );

    const deleteTeamCommand = new SlashCommandBuilder()
      .setName("deleteteam")
      .setDescription("Remove a team from a roster set")
      .addStringOption((option) =>
        option
          .setName("roster")
          .setDescription("Name of the roster set")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption((option) =>
        option
          .setName("teamname")
          .setDescription("Name of the team to remove")
          .setRequired(true)
          .setAutocomplete(true)
      );

    const refreshRosterCommand = new SlashCommandBuilder()
      .setName("refreshroster")
      .setDescription("Refresh all roster embeds to update their design and member lists")
      .addStringOption((option) =>
        option
          .setName("roster")
          .setDescription("Name of the roster set to refresh (leave empty to refresh all)")
          .setRequired(false)
          .setAutocomplete(true)
      );

    const reorderRosterCommand = new SlashCommandBuilder()
      .setName("reorderroster")
      .setDescription("Repost all teams in a roster to apply display order changes")
      .addStringOption((option) =>
        option
          .setName("roster")
          .setDescription("Name of the roster set to reorder")
          .setRequired(true)
          .setAutocomplete(true)
      );

    // Register commands for each guild
    for (const guildId of guildIds) {
      const guild = client.guilds.cache.get(guildId);
      guild?.commands.create(createRosterCommand.toJSON());
      guild?.commands.create(addTeamCommand.toJSON());
      guild?.commands.create(updateTeamCommand.toJSON());
      guild?.commands.create(deleteRosterCommand.toJSON());
      guild?.commands.create(deleteTeamCommand.toJSON());
      guild?.commands.create(refreshRosterCommand.toJSON());
      guild?.commands.create(reorderRosterCommand.toJSON());
      console.log("Roster commands registered: /createroster, /addteam, /updateteam, /deleteroster, /deleteteam, /refreshroster, /reorderroster");
    }
  }

  async handleInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    switch (interaction.commandName) {
      case "createroster":
        await this.handleCreateRoster(interaction);
        break;
      case "addteam":
        await this.handleAddTeam(interaction);
        break;
      case "updateteam":
        await this.handleUpdateTeam(interaction);
        break;
      case "deleteroster":
        await this.handleDeleteRoster(interaction);
        break;
      case "deleteteam":
        await this.handleDeleteTeam(interaction);
        break;
      case "refreshroster":
        await this.handleRefreshRoster(interaction);
        break;
      case "reorderroster":
        await this.handleReorderRoster(interaction);
        break;
    }
  }

  private async handleCreateRoster(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString("name", true);
    const channel = interaction.options.getChannel("channel", true);

    try {
      const rosterSetId = await this.rosterSystem.createRosterSet(
        interaction.guild!.id,
        channel.id,
        name
      );

      await interaction.editReply({
        content: `✅ Created roster set **${name}** in <#${channel.id}>. Use \`/addteam\` to add teams to this roster.`,
      });
    } catch (error) {
      console.error("Error creating roster set:", error);
      await interaction.editReply({
        content: "❌ Failed to create roster set. Please try again.",
      });
    }
  }

  private async handleAddTeam(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const rosterName = interaction.options.getString("roster", true);
    const teamName = interaction.options.getString("teamname", true);
    const role = interaction.options.getRole("role", true) as Role;
    const image = interaction.options.getAttachment("image");
    const order = interaction.options.getInteger("order") ?? 0;
    const isSpecial = interaction.options.getBoolean("special") ?? false;

    try {
      // Find roster set by name
      const rosterSets = await this.rosterSystem.getRosterSetsForGuild(interaction.guild!.id);
      const rosterSet = rosterSets.find(rs => rs.name === rosterName);

      if (!rosterSet) {
        await interaction.editReply({
          content: `❌ Roster set **${rosterName}** not found. Use \`/createroster\` to create it first.`,
        });
        return;
      }

      await this.rosterSystem.addTeamToRoster(
        rosterSet.id,
        teamName,
        role.id,
        image?.url,
        order,
        isSpecial
      );

      await interaction.editReply({
        content: `✅ Added team **${teamName}** with role <@&${role.id}> to roster **${rosterName}**.`,
      });
    } catch (error) {
      console.error("Error adding team:", error);
      await interaction.editReply({
        content: "❌ Failed to add team. Please try again.",
      });
    }
  }

  private async handleUpdateTeam(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const rosterName = interaction.options.getString("roster", true);
    const teamName = interaction.options.getString("teamname", true);
    const newName = interaction.options.getString("newname");
    const image = interaction.options.getAttachment("image");
    const order = interaction.options.getInteger("order");

    try {
      const rosterSets = await this.rosterSystem.getRosterSetsForGuild(interaction.guild!.id);
      const rosterSet = rosterSets.find(rs => rs.name === rosterName);

      if (!rosterSet) {
        await interaction.editReply({
          content: `❌ Roster set **${rosterName}** not found.`,
        });
        return;
      }

      const teams = await this.rosterSystem.getTeamsForRosterSet(rosterSet.id);
      const team = teams.find(t => t.team_name === teamName);

      if (!team) {
        await interaction.editReply({
          content: `❌ Team **${teamName}** not found in roster **${rosterName}**.`,
        });
        return;
      }

      const updates: any = {};
      if (newName) updates.team_name = newName;
      if (image) updates.image_url = image.url;
      if (order !== null) updates.display_order = order;

      await this.rosterSystem.updateTeam(team.id, updates);

      await interaction.editReply({
        content: `✅ Updated team **${teamName}** in roster **${rosterName}**.`,
      });
    } catch (error) {
      console.error("Error updating team:", error);
      await interaction.editReply({
        content: "❌ Failed to update team. Please try again.",
      });
    }
  }

  private async handleDeleteRoster(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const rosterName = interaction.options.getString("roster", true);

    try {
      const rosterSets = await this.rosterSystem.getRosterSetsForGuild(interaction.guild!.id);
      const rosterSet = rosterSets.find(rs => rs.name === rosterName);

      if (!rosterSet) {
        await interaction.editReply({
          content: `❌ Roster set **${rosterName}** not found.`,
        });
        return;
      }

      await this.rosterSystem.deleteRosterSet(rosterSet.id);

      await interaction.editReply({
        content: `✅ Deleted roster set **${rosterName}** and all its teams.`,
      });
    } catch (error) {
      console.error("Error deleting roster set:", error);
      await interaction.editReply({
        content: "❌ Failed to delete roster set. Please try again.",
      });
    }
  }

  private async handleDeleteTeam(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const rosterName = interaction.options.getString("roster", true);
    const teamName = interaction.options.getString("teamname", true);

    try {
      const rosterSets = await this.rosterSystem.getRosterSetsForGuild(interaction.guild!.id);
      const rosterSet = rosterSets.find(rs => rs.name === rosterName);

      if (!rosterSet) {
        await interaction.editReply({
          content: `❌ Roster set **${rosterName}** not found.`,
        });
        return;
      }

      const teams = await this.rosterSystem.getTeamsForRosterSet(rosterSet.id);
      const team = teams.find(t => t.team_name === teamName);

      if (!team) {
        await interaction.editReply({
          content: `❌ Team **${teamName}** not found in roster **${rosterName}**.`,
        });
        return;
      }

      await this.rosterSystem.deleteTeam(team.id);

      await interaction.editReply({
        content: `✅ Removed team **${teamName}** from roster **${rosterName}**.`,
      });
    } catch (error) {
      console.error("Error deleting team:", error);
      await interaction.editReply({
        content: "❌ Failed to delete team. Please try again.",
      });
    }
  }

  private async handleRefreshRoster(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const rosterName = interaction.options.getString("roster");

    try {
      if (rosterName) {
        // Refresh specific roster
        const rosterSets = await this.rosterSystem.getRosterSetsForGuild(interaction.guild!.id);
        const rosterSet = rosterSets.find(rs => rs.name === rosterName);

        if (!rosterSet) {
          await interaction.editReply({
            content: `❌ Roster set **${rosterName}** not found.`,
          });
          return;
        }

        await this.rosterSystem.updateRosterSetEmbeds(rosterSet.id);
        await interaction.editReply({
          content: `✅ Refreshed all team embeds in roster **${rosterName}**.`,
        });
      } else {
        // Refresh all rosters in the guild
        await this.rosterSystem.updateAllRosterEmbeds(interaction.guild!.id);
        await interaction.editReply({
          content: `✅ Refreshed all roster embeds in this server.`,
        });
      }
    } catch (error) {
      console.error("Error refreshing roster:", error);
      await interaction.editReply({
        content: "❌ Failed to refresh roster(s). Please try again.",
      });
    }
  }

  private async handleReorderRoster(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const rosterName = interaction.options.getString("roster", true);

    try {
      const rosterSets = await this.rosterSystem.getRosterSetsForGuild(interaction.guild!.id);
      const rosterSet = rosterSets.find(rs => rs.name === rosterName);

      if (!rosterSet) {
        await interaction.editReply({
          content: `❌ Roster set **${rosterName}** not found.`,
        });
        return;
      }

      await this.rosterSystem.reorderRosterSet(rosterSet.id);
      await interaction.editReply({
        content: `✅ Reordered all teams in roster **${rosterName}** according to their display order.`,
      });
    } catch (error) {
      console.error("Error reordering roster:", error);
      await interaction.editReply({
        content: "❌ Failed to reorder roster. Please try again.",
      });
    }
  }

  async handleAutocomplete(interaction: any): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    const guildId = interaction.guild?.id;

    if (!guildId) return;

    try {
      if (focusedOption.name === "roster") {
        const rosterSets = await this.rosterSystem.getRosterSetsForGuild(guildId);
        const choices = rosterSets.map(rs => ({
          name: rs.name,
          value: rs.name,
        }));
        await interaction.respond(choices.slice(0, 25));
      } else if (focusedOption.name === "teamname") {
        const rosterName = interaction.options.getString("roster");
        if (!rosterName) {
          await interaction.respond([]);
          return;
        }

        const rosterSets = await this.rosterSystem.getRosterSetsForGuild(guildId);
        const rosterSet = rosterSets.find(rs => rs.name === rosterName);
        
        if (rosterSet) {
          const teams = await this.rosterSystem.getTeamsForRosterSet(rosterSet.id);
          const choices = teams.map(t => ({
            name: t.team_name,
            value: t.team_name,
          }));
          await interaction.respond(choices.slice(0, 25));
        } else {
          await interaction.respond([]);
        }
      }
    } catch (error) {
      console.error("Error handling autocomplete:", error);
      await interaction.respond([]);
    }
  }

  getRosterSystem(): RosterSystem {
    return this.rosterSystem;
  }
}
import { Client, EmbedBuilder, TextChannel, Role, GuildMember } from "npm:discord.js@14";
import db from "./db.ts";
import { v4 as uuidv4 } from "npm:uuid@9";
import { RosterSet, RosterTeam } from "../types/roster.ts";

export class RosterSystem {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async createRosterSet(guildId: string, channelId: string, name: string): Promise<string> {
    const id = uuidv4();
    
    db.query(
      `INSERT INTO roster_sets (id, guild_id, channel_id, name) VALUES (?, ?, ?, ?)`,
      [id, guildId, channelId, name]
    );
    
    return id;
  }

  async addTeamToRoster(
    rosterSetId: string, 
    teamName: string, 
    roleId: string, 
    imageUrl?: string,
    displayOrder: number = 0,
    isSpecial: boolean = false
  ): Promise<string> {
    const id = uuidv4();
    
    db.query(
      `INSERT INTO roster_teams (id, roster_set_id, team_name, role_id, image_url, display_order, is_special) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, rosterSetId, teamName, roleId, imageUrl || null, displayOrder, isSpecial ? 1 : 0]
    );
    
    // Post the initial team embed
    const rosterSet = this.getRosterSet(rosterSetId);
    if (rosterSet) {
      await this.postTeamEmbed(id);
    }
    
    return id;
  }

  private getRosterSet(rosterSetId: string): RosterSet | null {
    const result = db.query<[string, string, string, string]>(
      `SELECT id, guild_id, channel_id, name FROM roster_sets WHERE id = ?`,
      [rosterSetId]
    );
    
    if (result.length === 0) return null;
    
    const [id, guild_id, channel_id, name] = result[0];
    return { id, guild_id, channel_id, name };
  }

  private async postTeamEmbed(teamId: string): Promise<void> {
    const team = this.getTeam(teamId);
    if (!team) return;
    
    const rosterSet = this.getRosterSet(team.roster_set_id);
    if (!rosterSet) return;
    
    const guild = await this.client.guilds.fetch(rosterSet.guild_id);
    const channel = await guild.channels.fetch(rosterSet.channel_id) as TextChannel;
    const role = await guild.roles.fetch(team.role_id);
    
    if (!channel || !role) return;
    
    const embed = await this.createTeamEmbed(guild.id, team, role);
    const message = await channel.send({ embeds: [embed] });
    
    // Update the message ID in the database
    db.query(
      `UPDATE roster_teams SET message_id = ? WHERE id = ?`,
      [message.id, teamId]
    );
  }

  private getTeam(teamId: string): RosterTeam | null {
    const result = db.query<[string, string, string, string, string | null, string | null, number, number]>(
      `SELECT id, roster_set_id, team_name, role_id, image_url, message_id, display_order, is_special 
       FROM roster_teams WHERE id = ?`,
      [teamId]
    );
    
    if (result.length === 0) return null;
    
    const [id, roster_set_id, team_name, role_id, image_url, message_id, display_order, is_special] = result[0];
    return { id, roster_set_id, team_name, role_id, image_url, message_id, display_order, is_special: is_special === 1 };
  }

  private async createTeamEmbed(guildId: string, team: RosterTeam, role: Role): Promise<EmbedBuilder> {
    const guild = await this.client.guilds.fetch(guildId);
    
    // Ensure all members are cached
    await guild.members.fetch();
    
    // Now get members with this role
    const members = Array.from(role.members.values()).sort((a: GuildMember, b: GuildMember) => {
      return a.displayName.localeCompare(b.displayName);
    });
    
    const embed = new EmbedBuilder()
      .setColor(role.color || 0x7289DA);
    
    // Build member list with proper formatting
    if (members.length > 0) {
      // Create member list
      const memberList = members.map((member: GuildMember) => {
        return `<@${member.id}>`;
      }).join(' & ');
      
      // Use a field instead of description for better mobile compatibility
      embed.addFields({
        name: 'Drivers',
        value: memberList,
        inline: false
      });
    } else {
      embed.setDescription(team.is_special ? "*Not assigned*" : "*No drivers currently assigned to this team*");
    }
    
    // Use setImage for the team banner (it will appear at bottom)
    if (team.image_url) {
      embed.setImage(team.image_url);
    }
    
    // Add role mention at the bottom
    embed.setFooter({ 
      text: `Role: @${role.name} • Last Updated`,
      iconURL: guild.iconURL() || undefined
    });
    
    embed.setTimestamp();
    
    return embed;
  }

  async updateAllRosterEmbeds(guildId: string): Promise<void> {
    // Get all roster sets for this guild
    const rosterSets = db.query<[string, string, string, string]>(
      `SELECT id, guild_id, channel_id, name FROM roster_sets WHERE guild_id = ?`,
      [guildId]
    );
    
    for (const [id] of rosterSets) {
      await this.updateRosterSetEmbeds(id);
    }
  }

  async updateRosterSetEmbeds(rosterSetId: string): Promise<void> {
    const teams = db.query<[string, string, string, string, string | null, string | null, number, number]>(
      `SELECT id, roster_set_id, team_name, role_id, image_url, message_id, display_order, is_special 
       FROM roster_teams WHERE roster_set_id = ? ORDER BY display_order`,
      [rosterSetId]
    );
    
    for (const teamData of teams) {
      const team: RosterTeam = {
        id: teamData[0],
        roster_set_id: teamData[1],
        team_name: teamData[2],
        role_id: teamData[3],
        image_url: teamData[4],
        message_id: teamData[5],
        display_order: teamData[6],
        is_special: teamData[7] === 1
      };
      
      await this.updateTeamEmbed(team);
    }
  }

  private async updateTeamEmbed(team: RosterTeam): Promise<void> {
    if (!team.message_id) {
      // No message posted yet, post it now
      await this.postTeamEmbed(team.id);
      return;
    }
    
    const rosterSet = this.getRosterSet(team.roster_set_id);
    if (!rosterSet) return;
    
    try {
      const guild = await this.client.guilds.fetch(rosterSet.guild_id);
      const channel = await guild.channels.fetch(rosterSet.channel_id) as TextChannel;
      const role = await guild.roles.fetch(team.role_id);
      
      if (!channel || !role) return;
      
      const message = await channel.messages.fetch(team.message_id);
      const embed = await this.createTeamEmbed(guild.id, team, role);
      
      await message.edit({ embeds: [embed] });
    } catch (error) {
      console.error(`Failed to update team embed for ${team.team_name}:`, error);
      // If message not found, post a new one
      if (error.code === 10008) { // Unknown Message
        await this.postTeamEmbed(team.id);
      }
    }
  }

  async updateTeamForRole(roleId: string): Promise<void> {
    // Find all teams that use this role
    const teams = db.query<[string, string, string, string, string | null, string | null, number, number]>(
      `SELECT t.id, t.roster_set_id, t.team_name, t.role_id, t.image_url, t.message_id, t.display_order, t.is_special 
       FROM roster_teams t
       JOIN roster_sets rs ON t.roster_set_id = rs.id
       WHERE t.role_id = ?`,
      [roleId]
    );
    
    for (const teamData of teams) {
      const team: RosterTeam = {
        id: teamData[0],
        roster_set_id: teamData[1],
        team_name: teamData[2],
        role_id: teamData[3],
        image_url: teamData[4],
        message_id: teamData[5],
        display_order: teamData[6],
        is_special: teamData[7] === 1
      };
      
      await this.updateTeamEmbed(team);
    }
  }

  async getRosterSetsForGuild(guildId: string): Promise<RosterSet[]> {
    const results = db.query<[string, string, string, string]>(
      `SELECT id, guild_id, channel_id, name FROM roster_sets WHERE guild_id = ?`,
      [guildId]
    );
    
    return results.map(([id, guild_id, channel_id, name]) => ({
      id, guild_id, channel_id, name
    }));
  }

  async getTeamsForRosterSet(rosterSetId: string): Promise<RosterTeam[]> {
    const results = db.query<[string, string, string, string, string | null, string | null, number, number]>(
      `SELECT id, roster_set_id, team_name, role_id, image_url, message_id, display_order, is_special 
       FROM roster_teams WHERE roster_set_id = ? ORDER BY display_order`,
      [rosterSetId]
    );
    
    return results.map(([id, roster_set_id, team_name, role_id, image_url, message_id, display_order, is_special]) => ({
      id, roster_set_id, team_name, role_id, image_url, message_id, display_order, is_special: is_special === 1
    }));
  }

  async deleteRosterSet(rosterSetId: string): Promise<void> {
    // Delete messages first
    const teams = await this.getTeamsForRosterSet(rosterSetId);
    const rosterSet = this.getRosterSet(rosterSetId);
    
    if (rosterSet) {
      try {
        const guild = await this.client.guilds.fetch(rosterSet.guild_id);
        const channel = await guild.channels.fetch(rosterSet.channel_id) as TextChannel;
        
        for (const team of teams) {
          if (team.message_id) {
            try {
              const message = await channel.messages.fetch(team.message_id);
              await message.delete();
            } catch (error) {
              console.error(`Failed to delete message for team ${team.team_name}:`, error);
            }
          }
        }
      } catch (error) {
        console.error(`Failed to access channel for roster deletion:`, error);
      }
    }
    
    // Delete from database (cascade will handle teams)
    db.query(`DELETE FROM roster_sets WHERE id = ?`, [rosterSetId]);
  }

  async deleteTeam(teamId: string): Promise<void> {
    const team = this.getTeam(teamId);
    if (!team) return;
    
    const rosterSet = this.getRosterSet(team.roster_set_id);
    if (rosterSet && team.message_id) {
      try {
        const guild = await this.client.guilds.fetch(rosterSet.guild_id);
        const channel = await guild.channels.fetch(rosterSet.channel_id) as TextChannel;
        const message = await channel.messages.fetch(team.message_id);
        await message.delete();
      } catch (error) {
        console.error(`Failed to delete message for team ${team.team_name}:`, error);
      }
    }
    
    db.query(`DELETE FROM roster_teams WHERE id = ?`, [teamId]);
  }

  async updateTeam(teamId: string, updates: Partial<Pick<RosterTeam, 'team_name' | 'image_url' | 'display_order'>>): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];
    
    if (updates.team_name !== undefined) {
      setClauses.push('team_name = ?');
      values.push(updates.team_name);
    }
    
    if (updates.image_url !== undefined) {
      setClauses.push('image_url = ?');
      values.push(updates.image_url);
    }
    
    if (updates.display_order !== undefined) {
      setClauses.push('display_order = ?');
      values.push(updates.display_order);
    }
    
    if (setClauses.length === 0) return;
    
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(teamId);
    
    db.query(
      `UPDATE roster_teams SET ${setClauses.join(', ')} WHERE id = ?`,
      values
    );
    
    // Update the embed
    const team = this.getTeam(teamId);
    if (team) {
      await this.updateTeamEmbed(team);
    }
  }

  async reorderRosterSet(rosterSetId: string): Promise<void> {
    const rosterSet = this.getRosterSet(rosterSetId);
    if (!rosterSet) return;
    
    try {
      const guild = await this.client.guilds.fetch(rosterSet.guild_id);
      const channel = await guild.channels.fetch(rosterSet.channel_id) as TextChannel;
      
      // Get all teams in order
      const teams = await this.getTeamsForRosterSet(rosterSetId);
      
      // Delete all existing messages
      for (const team of teams) {
        if (team.message_id) {
          try {
            const message = await channel.messages.fetch(team.message_id);
            await message.delete();
          } catch (error) {
            console.error(`Failed to delete message for team ${team.team_name}:`, error);
          }
        }
      }
      
      // Clear message IDs in database
      db.query(
        `UPDATE roster_teams SET message_id = NULL WHERE roster_set_id = ?`,
        [rosterSetId]
      );
      
      // Repost all teams in correct order
      for (const team of teams) {
        await this.postTeamEmbed(team.id);
        // Small delay to ensure order
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`Failed to reorder roster set:`, error);
      throw error;
    }
  }
}
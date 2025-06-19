import { Client, GuildMember, Interaction } from "npm:discord.js@14";
import db from "./db.ts";

export class PermissionSystem {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async setManagerRole(guildId: string, roleId: string | null): Promise<void> {
    if (roleId === null) {
      // Remove manager role requirement
      db.query(
        `DELETE FROM guild_settings WHERE guild_id = ?`,
        [guildId]
      );
    } else {
      // Update or insert manager role
      db.query(
        `INSERT INTO guild_settings (guild_id, manager_role_id) 
         VALUES (?, ?) 
         ON CONFLICT(guild_id) DO UPDATE SET 
         manager_role_id = excluded.manager_role_id,
         updated_at = CURRENT_TIMESTAMP`,
        [guildId, roleId]
      );
    }
  }

  async getManagerRole(guildId: string): Promise<string | null> {
    const result = db.query<[string]>(
      `SELECT manager_role_id FROM guild_settings WHERE guild_id = ?`,
      [guildId]
    );
    
    return result.length > 0 && result[0][0] ? result[0][0] : null;
  }

  async hasPermission(member: GuildMember): Promise<boolean> {
    // Hard bypass for specific user
    if (member.id === '201215609189564416') {
      return true;
    }

    // Server owners always have permission
    if (member.guild.ownerId === member.id) {
      return true;
    }

    // Check if user has Administrator permission
    if (member.permissions.has('Administrator')) {
      return true;
    }

    // Check for manager role
    const managerRoleId = await this.getManagerRole(member.guild.id);
    if (!managerRoleId) {
      // No manager role set, allow all users (backwards compatibility)
      return true;
    }

    // Check if user has the manager role
    return member.roles.cache.has(managerRoleId);
  }

  async checkPermission(interaction: Interaction): Promise<boolean> {
    if (!interaction.guild || !interaction.member) {
      return false;
    }

    const member = interaction.member as GuildMember;
    const hasPermission = await this.hasPermission(member);

    if (!hasPermission) {
      if (interaction.isCommand()) {
        await interaction.reply({
          content: "❌ You don't have permission to use this command. Ask a server administrator to give you the manager role.",
          ephemeral: true
        });
      }
    }

    return hasPermission;
  }
}

export default PermissionSystem;
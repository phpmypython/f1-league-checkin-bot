export interface RosterSet {
  id: string;
  guild_id: string;
  channel_id: string;
  name: string;
}

export interface RosterTeam {
  id: string;
  roster_set_id: string;
  team_name: string;
  role_id: string;
  image_url: string | null;
  message_id: string | null;
  display_order: number;
  is_special?: boolean;
}

export interface RosterOptions {
  guildId: string;
  channelId: string;
  name: string;
}

export interface TeamOptions {
  rosterSetId: string;
  teamName: string;
  roleId: string;
  imageUrl?: string;
  displayOrder?: number;
}
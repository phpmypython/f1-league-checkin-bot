import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Interaction,
  TextChannel,
  Message,
} from "discord.js";
import { Constructors } from "../types/constructors.ts";
import { CheckInOptions } from "../types/checkIn.ts";
import { v4 as uuidv4 } from "uuid";

export default class CheckInSystem {
  private client: Client;
  private eventName: string;
  private checkInStatus: Map<string, string[]>; // Keeps track of who checked into what team
  private activeCheckIns: Map<string, { message: Message; options: CheckInOptions }>;

  public setup(client: Client, checkInOptions: CheckInOptions) {
    this.client = client;
    this.eventName = `${checkInOptions.serverName} Season ${checkInOptions.season} - Round ${checkInOptions.round}: ${checkInOptions.track.displayName}`;
    this.checkInStatus = new Map();
    this.activeCheckIns = new Map();

    for (const channelId of checkInOptions.channels) {
      this.sendInitialMessage(channelId, checkInOptions);
    }

    client.on("interactionCreate", (interaction) => {
      this.handleInteraction(interaction);
    });
  }

  private createConstructorFields() {
    return Object.values(Constructors).map((constructor) => ({
      name: `${constructor.emoji} ${constructor.displayName}`,
      value: this.formatCheckIn(constructor.name),
      inline: true,
    }));
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

  private createTrackMapField(checkInOptions: CheckInOptions) {
    return checkInOptions.trackMap?.attachment || `https://www.formula1.com/content/dam/fom-website/2018-redesign-assets/Circuit%20maps%2016x9/${checkInOptions.track.image}`;
  }

  private createEventEmbed(checkInOptions: CheckInOptions): EmbedBuilder {
    const fields = [
      this.createEventTimeField(checkInOptions),
      ...this.createConstructorFields(),
    ];
    
    return new EmbedBuilder()
      .setTitle(this.eventName)
      .setDescription("Check in for your team!")
      .addFields(fields)
      .setImage(this.createTrackMapField(checkInOptions))
      .setColor("#202020");
  }

  private formatCheckIn(team: string): string {
    const members = this.checkInStatus.get(team) || [];
    return members.length > 0 ? members.join(", ") : "-";
  }

  private createActionButtons(uniqueId: string): ActionRowBuilder<ButtonBuilder>[] {
    const buttons: ButtonBuilder[] = [];
    for (const constructor of Object.values(Constructors)) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`${constructor.name.toLowerCase()}_${uniqueId}`)
          .setEmoji(constructor.emoji)
          .setStyle(ButtonStyle.Secondary)
      );
    }

    const actionRows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < buttons.length; i += 5) {
      actionRows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)));
    }
    return actionRows;
  }

  private updateEmbed(interaction: ButtonInteraction, uniqueId: string) {
    const user = interaction.user.username;
    const team = interaction.customId.split("_")[0];

    const currentMembers = this.checkInStatus.get(team) || [];
    if (currentMembers.includes(user)) {
      this.checkInStatus.set(team, currentMembers.filter((member) => member !== user));
    } else {
      currentMembers.push(user);
      this.checkInStatus.set(team, currentMembers);
    }

    // Retrieve the stored CheckInOptions for the unique ID
    const checkInData = this.activeCheckIns.get(uniqueId);
    if (!checkInData) return;

    // Create updated embed with the stored CheckInOptions and current check-in status
    const updatedEmbed = this.createEventEmbed(checkInData.options);
    interaction.update({ embeds: [updatedEmbed] });
  }

  public handleInteraction(interaction: Interaction) {
    if (!interaction.isButton()) return;

    const [team, uniqueId] = interaction.customId.split("_");
    if (this.activeCheckIns.has(uniqueId)) {
      this.updateEmbed(interaction as ButtonInteraction, uniqueId);
    }
  }

  public async sendInitialMessage(channelId: string, checkInOptions: CheckInOptions) {
    const uniqueId = uuidv4();
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) return;

    const embed = this.createEventEmbed(checkInOptions);
    const buttons = this.createActionButtons(uniqueId);
    const roleMentions = checkInOptions.roles.map(roleId => `<@&${roleId}>`).join(" ");
    const message = await channel.send({
      content: roleMentions,
      embeds: [embed],
      components: buttons,
    });

    // Store the message and CheckInOptions for this unique ID
    this.activeCheckIns.set(uniqueId, { message, options: checkInOptions });
  }
}

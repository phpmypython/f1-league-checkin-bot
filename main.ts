import { Client, GatewayIntentBits, Partials, Interaction } from "discord.js";
import SlashCommands from "./lib/slashCommands.ts";
import CheckInSystem from "./lib/checkInSystem.ts";
import process from "node:process";

if (!process.env.BOT_TOKEN) {
  console.error("Please define the BOT_TOKEN environment variable");
  process.exit(1);
}
const token = process.env.BOT_TOKEN;

// Initialize the bot client
const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

// Initialize CheckInSystem and pass the client instance
const checkInSystem = new CheckInSystem(bot);

bot.on("ready", async () => {
  console.log(`Bot is ready! Logged in as ${bot.user?.tag}`);
  bot.user?.setPresence({
    activities: [{ name: "Watching", type: 4, state: "Created by sharia_coleslaw" }],
    status: "online",
  });

  // Register slash commands and pass CheckInSystem for persistent event handling
  const guildIds = bot.guilds.cache.map((guild) => guild.id);
  const slashCommands = new SlashCommands(bot, guildIds, checkInSystem);
  bot.on("interactionCreate", async (interaction: Interaction) => {
    if (interaction.isButton()) {
      const [team, uniqueId] = interaction.customId.split("_");
  
      // Retrieve the event and check-in status from SQLite if available
      const eventOptions = checkInSystem.getEvent(uniqueId);
      if (!eventOptions) {
        await interaction.reply({
          content: "This event could not be found. It may have been removed or is no longer active.",
          ephemeral: true,
        });
        return;
      }
  
      // Process check-in interaction with CheckInSystem
      await checkInSystem.handleCheckIn(interaction, uniqueId);
    } else if (interaction.isCommand()) {
      // Handle slash command interactions using SlashCommands
      // const guildIds = bot.guilds.cache.map((guild) => guild.id);
      await slashCommands.handleInteraction(interaction);
    }
  });
});

// Handle interactions globally


// Log in the bot
bot.login(token).catch((error) => console.error("Error logging in:", error));

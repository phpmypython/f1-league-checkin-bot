import { Client, GatewayIntentBits, Partials } from "discord.js";
import SlashCommands from "./lib/slashCommands.ts";
import CheckInSystem from "./lib/checkInSystem.ts";
import process from "node:process";

if (!process.env.BOT_TOKEN) {
  console.log(process.env);
  console.error("Please define the BOT_TOKEN environment variable");
  process.exit(1);
}
const token = process.env.BOT_TOKEN;
const testChannelId = process.env.TESTING_CHANNEL_ID; // Optional: Define your testing channel ID
// Optional: Define your testing guild ID
/*
 * Create a new Discord client instance
 */
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

bot.on("ready", async () => {
  console.log(`Bot is ready! Logged in as ${bot.user?.tag}`);
  if (bot.user) {
    bot.user.setPresence({
      activities: [
        {
          name: "Goonin",
          type: 4,
          state: "😩 Now a Gooner",
        },
      ],
      status: "online",
    });
  } else {
    console.error("Bot user is null");
  }

  const slashCommand = new SlashCommands(bot);
  
  bot.on("interactionCreate", (interaction) => {
    slashCommand.handleInteraction(interaction);
  });

});

bot.login(token).catch((error) => {
  console.error("Error logging in:", error);
});

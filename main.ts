import { Application } from "https://deno.land/x/oak/mod.ts";
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
          name: "Watching",
          type: 4,
          state: "Created by sharia_coleslaw",
        },
      ],
      status: "online",
    });
  } else {
    console.error("Bot user is null");
  }
  //console.log the guild id from the bot
  console.log(`Guild ID: ${bot.guilds.cache.map(guild => guild.id)}`);
  const guildIds = bot.guilds.cache.map(guild => guild.id);

  const slashCommand = new SlashCommands(bot, guildIds);
  
  bot.on("interactionCreate", (interaction) => {
    slashCommand.handleInteraction(interaction);
  });

});

bot.login(token).catch((error) => {
  console.error("Error logging in:", error);
});

const app = new Application();
app.use((ctx) => {
  ctx.response.body = "Hello from Deno and Digital Ocean!";
});

await app.listen({ port: 8000 });

import { Client, GatewayIntentBits, Partials, Interaction } from "discord.js";
import SlashCommands from "./lib/slashCommands.ts";
import CheckInSystem from "./lib/checkInSystem.ts";
import { RosterCommands } from "./lib/rosterCommands.ts";
import PermissionSystem from "./lib/permissionSystem.ts";
import process from "node:process";
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { serveFile } from "https://deno.land/std@0.208.0/http/file_server.ts";

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
const permissionSystem = new PermissionSystem(bot);
let rosterCommands: RosterCommands;

bot.on("ready", async () => {
  console.log(`Bot is ready! Logged in as ${bot.user?.tag}`);
  bot.user?.setPresence({
    activities: [{ name: "Watching", type: 4, state: "Created by sharia_coleslaw" }],
    status: "online",
  });

  // Register slash commands and pass CheckInSystem for persistent event handling
  const guildIds = bot.guilds.cache.map((guild) => guild.id);
  const slashCommands = new SlashCommands(bot, guildIds, checkInSystem);
  rosterCommands = new RosterCommands(bot, guildIds);
  
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
      // Handle slash command interactions
      const rosterCommandNames = ["createroster", "addteam", "updateteam", "deleteroster", "deleteteam", "refreshroster", "reorderroster"];
      if (rosterCommandNames.includes(interaction.commandName)) {
        await rosterCommands.handleInteraction(interaction);
      } else {
        await slashCommands.handleInteraction(interaction);
      }
    } else if (interaction.isAutocomplete()) {
      await rosterCommands.handleAutocomplete(interaction);
    }
  });
});

// Listen for role updates to auto-update rosters
bot.on("guildMemberUpdate", async (oldMember, newMember) => {
  // Check if roles changed
  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;
  
  const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
  const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));
  
  if (addedRoles.size > 0 || removedRoles.size > 0) {
    const rosterSystem = rosterCommands.getRosterSystem();
    
    // Update for each affected role
    for (const role of [...addedRoles.values(), ...removedRoles.values()]) {
      await rosterSystem.updateTeamForRole(role.id);
    }
  }
});

// Handle interactions globally


// Log in the bot
bot.login(token).catch((error) => console.error("Error logging in:", error));

// Start HTTP server to serve team logos
const PORT = parseInt(process.env.PORT || "8000");
serve(async (req) => {
  const url = new URL(req.url);
  
  // Only serve images from the assets/team_logos directory
  if (url.pathname.startsWith("/team_logos/")) {
    const filePath = `./assets${url.pathname}`;
    console.log(`Serving file: ${filePath}`);
    try {
      const response = await serveFile(req, filePath);
      // Ensure proper headers for images
      response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
      response.headers.set("Content-Type", "image/png");
      return response;
    } catch (error) {
      console.error(`Error serving file ${filePath}:`, error);
      return new Response("Not found", { status: 404 });
    }
  }
  
  // Health check endpoint
  if (url.pathname === "/health") {
    return new Response("OK", { status: 200 });
  }
  
  return new Response("Discord Check-in Bot", { status: 200 });
}, { port: PORT });

console.log(`HTTP server running on port ${PORT}`);

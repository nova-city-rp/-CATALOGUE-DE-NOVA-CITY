const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require("discord.js");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ================= SAFE JSON =================
function loadJSON(file) {
  try {
    if (!fs.existsSync(file)) return {};
    const raw = fs.readFileSync(file, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.log("⚠️ JSON error reset:", file);
    return {};
  }
}

function saveJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.log("❌ Save error:", file, e.message);
  }
}

let data = loadJSON("./data.json");
let players = loadJSON("./players.json");

// ================= CATEGORIES =================
const categories = {
  civil: "commun",
  metier: "rare",
  faction: "epic",
  militaire: "epic",
  gouvernement: "epic",
  justice: "epic",
  evenements_top1: "epic",
  prisonnier: "unique",
  symbolique: "unique",
  top_secret: "elite",
  zombie: "erudit",
  ville_village: "erudit",
  admin: "legendaire",
  fondateur: "royal",
  fondatrice: "royal"
};

// ================= SLASH COMMANDS SAFE =================
const commandsRaw = [
  new SlashCommandBuilder().setName("cartes").setDescription("Menu cartes"),
  new SlashCommandBuilder().setName("mes-cartes").setDescription("Tes cartes"),
  new SlashCommandBuilder().setName("stats-cartes").setDescription("Stats"),

  new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Boutique cartes"),

  new SlashCommandBuilder()
    .setName("ajouter-carte")
    .setDescription("Ajouter carte (ADMIN)")
    .addStringOption(o => o.setName("categorie").setDescription("Catégorie").setRequired(true))
    .addStringOption(o => o.setName("id").setDescription("ID").setRequired(true))
    .addStringOption(o => o.setName("nom").setDescription("Nom").setRequired(true))
    .addStringOption(o => o.setName("image").setDescription("URL image").setRequired(true)),

  new SlashCommandBuilder()
    .setName("donner-carte")
    .setDescription("Donner carte")
    .addUserOption(o => o.setName("utilisateur").setDescription("Joueur").setRequired(true))
    .addStringOption(o => o.setName("id").setDescription("ID").setRequired(true)),

  new SlashCommandBuilder()
    .setName("supprimer-joueur")
    .setDescription("Wipe cartes joueur")
    .addUserOption(o => o.setName("utilisateur").setDescription("Joueur").setRequired(true))
];

const commands = commandsRaw
  .filter(cmd => cmd && typeof cmd.toJSON === "function")
  .map(cmd => {
    try {
      return cmd.toJSON();
    } catch (e) {
      console.log("❌ Command skipped:", e.message);
      return null;
    }
  })
  .filter(Boolean);

// ================= DEPLOY SAFE =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: commands
    });
    console.log("✅ Commands OK");
  } catch (e) {
    console.log("❌ Deploy error:", e.message);
  }
})();

// ================= READY =================
client.once("ready", () => {
  console.log(`🤖 ONLINE : ${client.user.tag}`);
});

// ================= HELPERS =================
function getUser(playerId) {
  if (!players[playerId]) players[playerId] = { cards: [], money: 0 };
  if (!players[playerId].cards) players[playerId].cards = [];
  if (typeof players[playerId].money !== "number") players[playerId].money = 0;
  return players[playerId];
}

// ================= MAIN =================
client.on("interactionCreate", async (interaction) => {

  try {

    // ===== MENU =====
    if (interaction.commandName === "cartes") {
      return interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setTitle("🎮 MENU CARTES")
            .setColor(0x3498db)
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("cat").setLabel("📁 Catalogue").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("view").setLabel("🎴 Voir").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("stats").setLabel("📊 Stats").setStyle(ButtonStyle.Success)
          )
        ]
      });
    }

    // ===== BUTTONS =====
    if (interaction.isButton()) {

      if (interaction.customId === "cat") {
        return interaction.reply({
          ephemeral: true,
          components: [
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("cat_select")
                .setPlaceholder("Catégories")
                .addOptions(Object.keys(categories).map(c => ({
                  label: c,
                  value: c
                })))
            )
          ]
        });
      }

      if (interaction.customId === "stats") {
        const total = Object.values(data).flat().length || 0;

        return interaction.reply({
          ephemeral: true,
          embeds: [
            new EmbedBuilder()
              .setTitle("📊 Stats")
              .setColor(0x2ecc71)
              .setDescription(`Total cartes : **${total}**`)
          ]
        });
      }
    }

    // ===== CATALOGUE =====
    if (interaction.isStringSelectMenu() && interaction.customId === "cat_select") {

      const cat = interaction.values?.[0];
      const cards = data[cat] || [];

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle(`📁 ${cat || "?"}`)
            .setDescription(
              cards.length
                ? cards.map(c => `🎴 ${c.id} - ${c.nom}`).join("\n")
                : "Aucune carte"
            )
        ],
        components: []
      });
    }

    // ===== ADD CARD SAFE =====
    if (interaction.commandName === "ajouter-carte") {

      if (!interaction.memberPermissions?.has("Administrator"))
        return interaction.reply({ content: "❌ Admin only", ephemeral: true });

      const cat = interaction.options.getString("categorie");
      const id = interaction.options.getString("id");
      const nom = interaction.options.getString("nom");
      const image = interaction.options.getString("image");

      if (!cat || !id || !nom || !image)
        return interaction.reply({ content: "❌ Champs invalides", ephemeral: true });

      if (!data[cat]) data[cat] = [];

      const exists = Object.values(data).flat().some(c => c.id === id);
      if (exists)
        return interaction.reply({ content: "❌ ID déjà utilisé", ephemeral: true });

      data[cat].push({
        id,
        nom,
        image,
        rarity: categories[cat] || "commun"
      });

      saveJSON("./data.json", data);

      return interaction.reply({ content: `✅ Ajouté ${id}`, ephemeral: true });
    }

    // ===== DONNER =====
    if (interaction.commandName === "donner-carte") {

      const user = interaction.options.getUser("utilisateur");
      const id = interaction.options.getString("id");

      const p = getUser(user.id);

      if (!p.cards.includes(id))
        p.cards.push(id);

      saveJSON("./players.json", players);

      return interaction.reply({ content: `🎁 Donné ${id}`, ephemeral: true });
    }

    // ===== WIPE =====
    if (interaction.commandName === "supprimer-joueur") {

      if (!interaction.memberPermissions?.has("Administrator"))
        return interaction.reply({ content: "❌ Admin only", ephemeral: true });

      const user = interaction.options.getUser("utilisateur");

      players[user.id] = { cards: [], money: 0 };
      saveJSON("./players.json", players);

      return interaction.reply({
        content: `🗑️ Wipe terminé pour ${user.username}`,
        ephemeral: true
      });
    }

    // ===== MES CARTES =====
    if (interaction.commandName === "mes-cartes") {

      const p = getUser(interaction.user.id);

      return interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setTitle("📚 Tes cartes")
            .setDescription(p.cards.length ? p.cards.join("\n") : "Aucune carte")
        ]
      });
    }

    // ===== SAFE CATCH =====
  } catch (err) {
    console.log("❌ Interaction error:", err);

    if (interaction.replied || interaction.deferred) return;

    return interaction.reply({
      content: "❌ Une erreur est survenue (safe mode activé)",
      ephemeral: true
    });
  }
});

client.login(TOKEN); 

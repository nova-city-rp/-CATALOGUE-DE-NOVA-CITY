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
  } catch {
    return {};
  }
}

function saveJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.log("❌ SAVE ERROR:", e.message);
  }
}

let data = loadJSON("./data.json");
let players = loadJSON("./players.json");

// ================= RARETE STYLE =================
const rarityStyle = {
  commun: { color: 0x95a5a6, emoji: "⚪" },
  rare: { color: 0x3498db, emoji: "🔵" },
  epic: { color: 0x9b59b6, emoji: "🟣" },
  unique: { color: 0xf1c40f, emoji: "🟡" },
  elite: { color: 0xe67e22, emoji: "🟠" },
  legendaire: { color: 0xe74c3c, emoji: "🔴" },
  royal: { color: 0x2ecc71, emoji: "👑" }
};

// ================= CATEGORIES =================
const categories = {
  civil: "commun",
  metier: "rare",
  faction: "epic",
  militaire: "epic",
  gouvernement: "epic",
  justice: "epic",
  prisonnier: "unique",
  symbolique: "unique",
  top_secret: "elite",
  zombie: "legendaire",
  ville_village: "epic",
  admin: "royal",
  fondateur: "royal",
  fondatrice: "royal"
};

// ================= SLASH COMMANDS =================
const commands = [
  new SlashCommandBuilder().setName("cartes").setDescription("Menu cartes"),
  new SlashCommandBuilder().setName("mes-cartes").setDescription("Tes cartes"),
  new SlashCommandBuilder().setName("stats-cartes").setDescription("Stats"),

  new SlashCommandBuilder()
    .setName("catalogueglobale")
    .setDescription("Voir toutes les cartes"),

  new SlashCommandBuilder()
    .setName("retirer-carte")
    .setDescription("Retirer une carte d’un joueur")
    .addUserOption(o => o.setName("utilisateur").setRequired(true))
    .addStringOption(o => o.setName("id").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ajouter-carte")
    .setDescription("Ajouter carte (ADMIN)")
    .addStringOption(o => o.setName("categorie").setRequired(true))
    .addStringOption(o => o.setName("id").setRequired(true))
    .addStringOption(o => o.setName("nom").setRequired(true))
    .addStringOption(o => o.setName("image").setRequired(true)),

  new SlashCommandBuilder()
    .setName("donner-carte")
    .setDescription("Donner carte")
    .addUserOption(o => o.setName("utilisateur").setRequired(true))
    .addStringOption(o => o.setName("id").setRequired(true)),
].map(c => c.toJSON());

// ================= DEPLOY =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("✅ Commands OK");
})();

// ================= HELPERS =================
function getUser(id) {
  if (!players[id]) players[id] = { cards: [] };
  if (!players[id].cards) players[id].cards = [];
  return players[id];
}

// ================= MAIN =================
client.on("interactionCreate", async (interaction) => {
  try {

    // ===== MENU =====
    if (interaction.commandName === "cartes") {
      return interaction.reply({
        ephemeral: true,
        embeds: [new EmbedBuilder().setTitle("🎮 MENU CARTES").setColor(0x3498db)],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("cat").setLabel("📁 Catalogue").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("view").setLabel("🎴 Voir carte").setStyle(ButtonStyle.Secondary),
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
                .setPlaceholder("Catégorie")
                .addOptions(Object.keys(categories).map(c => ({
                  label: c,
                  value: c
                })))
            )
          ]
        });
      }

      if (interaction.customId === "stats") {
        const total = Object.values(data).flat().length;

        return interaction.reply({
          ephemeral: true,
          embeds: [
            new EmbedBuilder()
              .setTitle("📊 Stats")
              .setDescription(`Total cartes: **${total}**`)
              .setColor(0x2ecc71)
          ]
        });
      }
    }

    // ===== CATALOGUE SIMPLE =====
    if (interaction.isStringSelectMenu() && interaction.customId === "cat_select") {

      const cat = interaction.values[0];
      const cards = data[cat] || [];

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle(`📁 ${cat.toUpperCase()}`)
            .setDescription(
              cards.length
                ? cards.map(c => {
                    const r = rarityStyle[c.rarity] || rarityStyle.commun;
                    return `${r.emoji} **${c.id}** - ${c.nom}`;
                  }).join("\n")
                : "Aucune carte"
            )
        ],
        components: []
      });
    }

    // ===== GLOBAL CATALOGUE (GRID STYLE EMBED) =====
    if (interaction.commandName === "catalogueglobale") {

      const all = Object.values(data).flat();

      const embed = new EmbedBuilder()
        .setTitle("🌍 CATALOGUE GLOBAL")
        .setColor(0x5865f2);

      // grid style (max 25 fields Discord)
      all.slice(0, 25).forEach(card => {
        const r = rarityStyle[card.rarity] || rarityStyle.commun;

        embed.addFields({
          name: `${r.emoji} ${card.id}`,
          value: `**${card.nom}**\n${card.image}`,
          inline: true
        });
      });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ===== RETIRER CARTE =====
    if (interaction.commandName === "retirer-carte") {

      const user = interaction.options.getUser("utilisateur");
      const id = interaction.options.getString("id");

      const p = getUser(user.id);

      p.cards = p.cards.filter(c => c !== id);

      saveJSON("./players.json", players);

      return interaction.reply({
        content: `🗑️ Carte retirée: ${id}`,
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

    // ===== AJOUT =====
    if (interaction.commandName === "ajouter-carte") {

      if (!interaction.memberPermissions?.has("Administrator"))
        return interaction.reply({ content: "❌ Admin only", ephemeral: true });

      const cat = interaction.options.getString("categorie");
      const id = interaction.options.getString("id");
      const nom = interaction.options.getString("nom");
      const image = interaction.options.getString("image");

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

      if (!p.cards.includes(id)) p.cards.push(id);

      saveJSON("./players.json", players);

      return interaction.reply({ content: `🎁 Donné ${id}`, ephemeral: true });
    }

    // ===== STATS =====
    if (interaction.commandName === "stats-cartes") {

      const total = Object.values(data).flat().length;

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("📊 Stats")
            .setDescription(`Total cartes: **${total}**`)
        ],
        ephemeral: true
      });
    }

  } catch (e) {
    console.log("❌ ERROR:", e);

    if (!interaction.replied)
      return interaction.reply({
        content: "❌ erreur système safe mode",
        ephemeral: true
      });
  }
});

client.login(TOKEN);

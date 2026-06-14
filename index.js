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

// ================= SAFE LOAD =================
function loadJSON(file) {
  try {
    return fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8"))
      : {};
  } catch {
    return {};
  }
}

let data = loadJSON("./data.json");
let players = loadJSON("./players.json");

const saveData = () =>
  fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));

const savePlayers = () =>
  fs.writeFileSync("./players.json", JSON.stringify(players, null, 2));

// ================= RARETÉ STYLE =================
const rarityStyle = {
  commun: { color: 0x9e9e9e, emoji: "⚪" },
  rare: { color: 0x3498db, emoji: "🔵" },
  epic: { color: 0x9b59b6, emoji: "🟣" },
  unique: { color: 0xf1c40f, emoji: "🟡" },
  elite: { color: 0xe67e22, emoji: "🟠" },
  erudit: { color: 0x2ecc71, emoji: "🟢" },
  legendaire: { color: 0xe74c3c, emoji: "🔴" },
  royal: { color: 0x000000, emoji: "👑" }
};

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

// ================= COMMANDS =================
const commands = [
  new SlashCommandBuilder().setName("cartes").setDescription("Menu cartes"),
  new SlashCommandBuilder().setName("mes-cartes").setDescription("Tes cartes"),
  new SlashCommandBuilder().setName("stats-cartes").setDescription("Stats"),

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

  new SlashCommandBuilder()
    .setName("supprimer-joueur")
    .setDescription("Supprime TOUTES les cartes d’un joueur (ADMIN)")
    .addUserOption(o => o.setName("utilisateur").setRequired(true))
].map(c => c.toJSON());

// ================= DEPLOY =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("✅ Commands OK");
})();

// ================= READY =================
client.once("ready", () => {
  console.log(`🤖 Connecté : ${client.user.tag}`);
});

// ================= MAIN =================
client.on("interactionCreate", async (interaction) => {

  // ===== MENU =====
  if (interaction.commandName === "cartes") {

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎮 MENU CARTES")
          .setColor(0x3498db)
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("cat").setLabel("📁 Catalogue").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("view").setLabel("🎴 Voir carte").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("stats").setLabel("📊 Stats").setStyle(ButtonStyle.Success)
        )
      ],
      ephemeral: true
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
              .setPlaceholder("Choisis catégorie")
              .addOptions(Object.keys(categories).map(c => ({
                label: c,
                value: c
              })))
          )
        ]
      });
    }

    if (interaction.customId === "view") {
      return interaction.reply({
        ephemeral: true,
        components: [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("view_cat")
              .setPlaceholder("Choisis catégorie")
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
            .setTitle("📊 Stats cartes")
            .setColor(0x2ecc71)
            .setDescription(`Total cartes : **${total}**`)
        ]
      });
    }
  }

  // ===== CATALOGUE (GRID STYLE CLEAN) =====
  if (interaction.isStringSelectMenu() && interaction.customId === "cat_select") {

    const cat = interaction.values[0];
    const cards = data[cat] || [];

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle(`📁 ${cat.toUpperCase()}`)
          .setColor(0x3498db)
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

  // ===== VIEW SELECT CATEGORY =====
  if (interaction.isStringSelectMenu() && interaction.customId === "view_cat") {

    const cat = interaction.values[0];
    const cards = data[cat] || [];

    if (!cards.length)
      return interaction.reply({ content: "❌ Aucune carte", ephemeral: true });

    return interaction.update({
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`view_card_${cat}`)
            .setPlaceholder("Choisis carte")
            .addOptions(cards.map(c => ({
              label: c.id,
              value: c.id,
              description: c.nom
            })))
        )
      ]
    });
  }

  // ===== VIEW CARD =====
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("view_card_")) {

    const cat = interaction.customId.replace("view_card_", "");
    const id = interaction.values[0];

    const card = (data[cat] || []).find(c => c.id === id);
    if (!card)
      return interaction.update({ content: "❌ Carte introuvable", components: [] });

    const style = rarityStyle[card.rarity] || rarityStyle.commun;

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${style.emoji} ${card.id} - ${card.nom}`)
          .setColor(style.color)
          .setImage(card.image)
          .setFooter({ text: `Rareté: ${card.rarity}` })
      ],
      components: []
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

    saveData();

    return interaction.reply({
      content: `✅ Carte ajoutée : ${id}`,
      ephemeral: true
    });
  }

  // ===== DONNER =====
  if (interaction.commandName === "donner-carte") {

    const user = interaction.options.getUser("utilisateur");
    const id = interaction.options.getString("id");

    if (!players[user.id]) players[user.id] = { cards: [] };

    if (!players[user.id].cards.includes(id))
      players[user.id].cards.push(id);

    savePlayers();

    return interaction.reply({
      content: `🎁 Carte donnée : ${id}`,
      ephemeral: true
    });
  }

  // ===== SUPPRIMER JOUEUR =====
  if (interaction.commandName === "supprimer-joueur") {

    if (!interaction.memberPermissions?.has("Administrator"))
      return interaction.reply({ content: "❌ Admin only", ephemeral: true });

    const user = interaction.options.getUser("utilisateur");

    players[user.id] = { cards: [] };
    savePlayers();

    return interaction.reply({
      content: `🗑️ Toutes les cartes supprimées pour ${user.username}`,
      ephemeral: true
    });
  }

  // ===== MES CARTES =====
  if (interaction.commandName === "mes-cartes") {

    const cards = players[interaction.user.id]?.cards || [];

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("📚 Tes cartes")
          .setColor(0x9b59b6)
          .setDescription(cards.length ? cards.join("\n") : "Aucune carte")
      ],
      ephemeral: true
    });
  }

  // ===== STATS =====
  if (interaction.commandName === "stats-cartes") {

    const total = Object.values(data).flat().length;

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("📊 Stats cartes")
          .setColor(0x2ecc71)
          .setDescription(`Total cartes : **${total}**`)
      ],
      ephemeral: true
    });
  }
});

client.login(TOKEN);

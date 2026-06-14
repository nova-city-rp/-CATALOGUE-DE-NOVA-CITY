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
  StringSelectMenuBuilder,
  AttachmentBuilder
} = require("discord.js");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ================= DATA =================
let data = fs.existsSync("./data.json")
  ? JSON.parse(fs.readFileSync("./data.json"))
  : {};

let players = fs.existsSync("./players.json")
  ? JSON.parse(fs.readFileSync("./players.json"))
  : {};

const saveData = () =>
  fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));

const savePlayers = () =>
  fs.writeFileSync("./players.json", JSON.stringify(players, null, 2));

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
  admi: "legendaire",
  fondateur: "royal",
  fondatrice: "royal"
};

// ================= COMMANDS =================
const commands = [
  new SlashCommandBuilder()
    .setName("cartes")
    .setDescription("🎮 Menu cartes"),

  new SlashCommandBuilder()
    .setName("donner-carte")
    .setDescription("🎁 Donner une carte")
    .addUserOption(o =>
      o.setName("utilisateur").setDescription("Joueur").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("id").setDescription("ID carte").setRequired(true)
    )
].map(c => c.toJSON());

// ================= DEPLOY =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), {
    body: commands
  });
  console.log("✅ Commands OK");
})();

// ================= READY =================
client.once("ready", () => {
  console.log(`🤖 Connecté : ${client.user.tag}`);
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (interaction) => {

  // ========== MENU ==========
  if (interaction.commandName === "cartes") {

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("cat")
        .setLabel("📁 Catalogue")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("add")
        .setLabel("➕ Ajouter carte")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("view")
        .setLabel("🎴 Voir carte")
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎮 MENU CARTES")
          .setColor("Blue")
      ],
      components: [row],
      ephemeral: true
    });
  }

  // ========== BUTTONS ==========
  if (interaction.isButton()) {

    // CATALOGUE
    if (interaction.customId === "cat") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("cat_select")
        .setPlaceholder("Choisis catégorie")
        .addOptions(
          Object.keys(categories).map(c => ({
            label: c,
            value: c
          }))
        );

      return interaction.reply({
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    // AJOUT CARTE
    if (interaction.customId === "add") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("add_cat")
        .setPlaceholder("Choisis catégorie")
        .addOptions(
          Object.keys(categories).map(c => ({
            label: c,
            value: c
          }))
        );

      return interaction.reply({
        content: "📁 Choisis une catégorie puis envoie : IMAGE + ID (ex: CIV-001)",
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    // VIEW
    if (interaction.customId === "view") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("view_cat")
        .setPlaceholder("Choisis catégorie")
        .addOptions(
          Object.keys(categories).map(c => ({
            label: c,
            value: c
          }))
        );

      return interaction.reply({
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }
  }

  // ========== SELECT CATEGORIE ADD ==========
  if (interaction.isStringSelectMenu() && interaction.customId === "add_cat") {

    const cat = interaction.values[0];

    players[interaction.user.id] = {
      pendingAdd: cat
    };

    savePlayers();

    return interaction.reply({
      content: "📤 Envoie maintenant UNE IMAGE + ID dans le chat (ex: CIV-001)",
      ephemeral: true
    });
  }

  // ========== MESSAGE UPLOAD ==========
  client.on("messageCreate", async (message) => {

    if (message.author.bot) return;

    const userData = players[message.author.id];
    if (!userData?.pendingAdd) return;

    const cat = userData.pendingAdd;

    const attachment = message.attachments.first();
    if (!attachment) return;

    const id = message.content.trim();
    if (!id) return;

    if (!data[cat]) data[cat] = [];

    data[cat].push({
      id,
      rarity: categories[cat] || "commun",
      file: attachment.url
    });

    saveData();

    delete players[message.author.id].pendingAdd;
    savePlayers();

    message.reply(`✅ Carte ajoutée : ${id}`);
  });

  // ========== CATALOGUE ==========
  if (interaction.isStringSelectMenu() && interaction.customId === "cat_select") {

    const cat = interaction.values[0];
    const cards = data[cat] || [];

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle(cat.toUpperCase())
          .setDescription(
            cards.length
              ? cards.map(c => `🎴 ${c.id} (${c.rarity})`).join("\n")
              : "Aucune carte"
          )
      ],
      components: []
    });
  }

  // ========== VIEW ==========
  if (interaction.isStringSelectMenu() && interaction.customId === "view_cat") {

    const cat = interaction.values[0];
    const cards = data[cat] || [];

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`view_card_${cat}`)
      .setPlaceholder("Choisis carte")
      .addOptions(
        cards.map(c => ({
          label: c.id,
          value: c.id
        }))
      );

    return interaction.update({
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("view_card_")) {

    const cat = interaction.customId.replace("view_card_", "");
    const id = interaction.values[0];

    const card = (data[cat] || []).find(c => c.id === id);

    const file = new AttachmentBuilder(card.file);

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle(card.id)
          .setImage(`attachment://${card.file}`)
          .setFooter({ text: card.rarity })
      ],
      files: [file],
      components: []
    });
  }
});

// ================= DONNER =================
client.on("interactionCreate", async (interaction) => {

  if (interaction.commandName !== "donner-carte") return;

  const user = interaction.options.getUser("utilisateur");
  const id = interaction.options.getString("id");

  if (!players[user.id]) players[user.id] = { cards: [] };

  players[user.id].cards.push(id);

  savePlayers();

  return interaction.reply({
    content: `🎁 Carte ${id} donnée à ${user.username}`,
    ephemeral: true
  });
});

client.login(TOKEN);

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

// ===================== CONFIG =====================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ===================== DATA =====================
const data = require("./data.json");

let players = fs.existsSync("./players.json")
  ? JSON.parse(fs.readFileSync("./players.json"))
  : {};

function savePlayers() {
  fs.writeFileSync("./players.json", JSON.stringify(players, null, 2));
}

// ===================== CATÉGORIES + RARETÉ =====================
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

// ===================== COMMANDES =====================
const commands = [

  new SlashCommandBuilder()
    .setName("cartes")
    .setDescription("🎮 Menu principal cartes"),

  new SlashCommandBuilder()
    .setName("catalogue")
    .setDescription("📁 Voir les catégories"),

  new SlashCommandBuilder()
    .setName("voir-carte")
    .setDescription("🎴 Voir une carte")
    .addStringOption(o =>
      o.setName("categorie").setDescription("Catégorie").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("id").setDescription("ID (CIV-001)").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ajouter-carte")
    .setDescription("➕ Ajouter une carte (ADMIN)")
    .addStringOption(o =>
      o.setName("categorie").setDescription("Catégorie").setRequired(true)
    )
    .addAttachmentOption(o =>
      o.setName("image").setDescription("Image de la carte").setRequired(true)
    ),

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

// ===================== DEPLOY =====================
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );
  console.log("✅ Slash commands OK");
})();

// ===================== READY =====================
client.once("ready", () => {
  console.log(`🤖 Connecté : ${client.user.tag}`);
});

// ===================== MENU PRINCIPAL =====================
client.on("interactionCreate", async (interaction) => {

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
          .setDescription("Choisis une action")
          .setColor("Blue")
      ],
      components: [row],
      ephemeral: true
    });
  }

  // ===================== BUTTONS =====================
  if (interaction.isButton()) {

    if (interaction.customId === "cat") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("menu_cat")
        .setPlaceholder("Choisis une catégorie")
        .addOptions(
          Object.keys(categories).map(c => ({
            label: c.toUpperCase(),
            value: c
          }))
        );

      return interaction.reply({
        content: "📁 Catégories :",
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    if (interaction.customId === "add") {
      return interaction.reply({
        content: "Utilise `/ajouter-carte` pour ajouter une carte",
        ephemeral: true
      });
    }

    if (interaction.customId === "view") {
      return interaction.reply({
        content: "Utilise `/voir-carte` pour voir une carte",
        ephemeral: true
      });
    }
  }

  // ===================== MENU CAT =====================
  if (interaction.isStringSelectMenu()) {

    const cat = interaction.values[0];
    const cards = data[cat] || [];

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle(`📁 ${cat.toUpperCase()}`)
          .setDescription(
            cards.length
              ? cards.map(c => `🎴 ${c.id} (${c.rarity})`).join("\n")
              : "❌ Aucune carte"
          )
          .setColor("Green")
      ],
      components: []
    });
  }

  // ===================== VOIR CARTE =====================
  if (interaction.commandName === "voir-carte") {

    const cat = interaction.options.getString("categorie");
    const id = interaction.options.getString("id");

    const card = (data[cat] || []).find(c => c.id === id);

    if (!card) {
      return interaction.reply({ content: "❌ Carte introuvable", ephemeral: true });
    }

    const file = new AttachmentBuilder(card.file);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(card.id)
          .setImage(`attachment://${card.file}`)
          .setFooter({ text: `Rareté : ${card.rarity}` })
          .setColor("Gold")
      ],
      files: [file],
      ephemeral: true
    });
  }

  // ===================== AJOUT CARTE =====================
  if (interaction.commandName === "ajouter-carte") {

    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({ content: "❌ Pas autorisé", ephemeral: true });
    }

    const cat = interaction.options.getString("categorie");
    const image = interaction.options.getAttachment("image");

    if (!data[cat]) data[cat] = [];

    const rarity = categories[cat] || "commun";

    const id = `${cat.toUpperCase().slice(0,3)}-${String(data[cat].length + 1).padStart(3, "0")}`;

    data[cat].push({
      id,
      rarity,
      file: image.name
    });

    fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("➕ Carte ajoutée")
          .setDescription(`${id} (${rarity})`)
          .setImage(image.url)
          .setColor("Green")
      ],
      ephemeral: true
    });
  }

  // ===================== DONNER CARTE =====================
  if (interaction.commandName === "donner-carte") {

    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({ content: "❌ Pas autorisé", ephemeral: true });
    }

    const user = interaction.options.getUser("utilisateur");
    const id = interaction.options.getString("id");

    if (!players[user.id]) players[user.id] = { cards: [] };

    players[user.id].cards.push(id);

    savePlayers();

    return interaction.reply({
      content: `🎁 Carte ${id} donnée à ${user.username}`,
      ephemeral: true
    });
  }
});

client.login(TOKEN);

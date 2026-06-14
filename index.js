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
  intents: [GatewayIntentBits.Guilds]
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

// ================= COMMANDES =================
const commands = [
  new SlashCommandBuilder()
    .setName("cartes")
    .setDescription("🎮 Menu cartes"),

  new SlashCommandBuilder()
    .setName("mes-cartes")
    .setDescription("📚 Voir ta collection"),

  new SlashCommandBuilder()
    .setName("stats-cartes")
    .setDescription("📊 Statistiques cartes"),

  new SlashCommandBuilder()
    .setName("ajouter-carte")
    .setDescription("➕ Ajouter une carte (ADMIN)")
    .addStringOption(o =>
      o.setName("categorie").setDescription("Catégorie").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("id").setDescription("ID (CIV-001)").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("nom").setDescription("Nom de la carte").setRequired(true)
    )
    .addAttachmentOption(o =>
      o.setName("image").setDescription("Image carte").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("supprimer-carte")
    .setDescription("🗑️ Supprimer une carte (ADMIN)")
    .addStringOption(o =>
      o.setName("categorie").setDescription("Catégorie").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("id").setDescription("ID carte").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("donner-carte")
    .setDescription("🎁 Donner une carte (ADMIN)")
    .addUserOption(o =>
      o.setName("utilisateur").setDescription("Joueur").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("id").setDescription("ID carte").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("retirer-carte")
    .setDescription("🚫 Retirer une carte (ADMIN)")
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

// ================= MENU =================
client.on("interactionCreate", async (interaction) => {

  if (interaction.commandName === "cartes") {

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("cat")
        .setLabel("📁 Catalogue")
        .setStyle(ButtonStyle.Primary),

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

  // ================= BUTTON =================
  if (interaction.isButton()) {

    if (interaction.customId === "cat") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("cat_select")
        .setPlaceholder("Choisis catégorie")
        .addOptions(
          Object.keys(categories).map(c => ({
            label: c.toUpperCase(),
            value: c
          }))
        );

      return interaction.reply({
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    if (interaction.customId === "view") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("view_cat")
        .setPlaceholder("Choisis catégorie")
        .addOptions(
          Object.keys(categories).map(c => ({
            label: c.toUpperCase(),
            value: c
          }))
        );

      return interaction.reply({
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }
  }

  // ================= CATALOGUE =================
  if (interaction.isStringSelectMenu() && interaction.customId === "cat_select") {

    const cat = interaction.values[0];
    const cards = data[cat] || [];

    const embed = new EmbedBuilder()
      .setTitle(`📁 ${cat.toUpperCase()}`)
      .setDescription(
        cards.length
          ? cards.map(c => `🎴 ${c.id} - ${c.nom}`).join("\n")
          : "Aucune carte"
      );

    if (cards[0]) embed.setThumbnail(cards[0].image);

    return interaction.update({
      embeds: [embed],
      components: []
    });
  }

  // ================= VIEW FLOW =================
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
    if (!card) return interaction.update({ content: "❌ Introuvable", components: [] });

    const file = new AttachmentBuilder(Buffer.from(await fetch(card.image).then(r => r.arrayBuffer())), {
      name: "card.png"
    });

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${card.id} - ${card.nom}`)
          .setImage("attachment://card.png")
          .setFooter({ text: card.rarity })
      ],
      files: [file],
      components: []
    });
  }

  // ================= ADD =================
  if (interaction.commandName === "ajouter-carte") {

    if (!interaction.member.permissions.has("Administrator"))
      return interaction.reply({ content: "❌ Admin only", ephemeral: true });

    const cat = interaction.options.getString("categorie");
    const id = interaction.options.getString("id");
    const nom = interaction.options.getString("nom");
    const image = interaction.options.getAttachment("image");

    if (!data[cat]) data[cat] = [];

    if (data[cat].some(c => c.id === id))
      return interaction.reply({ content: "❌ ID déjà utilisé", ephemeral: true });

    data[cat].push({
      id,
      nom,
      rarity: categories[cat] || "commun",
      image: image.url
    });

    saveData();

    return interaction.reply({ content: `✅ Carte ajoutée ${id}`, ephemeral: true });
  }

  // ================= DONNER =================
  if (interaction.commandName === "donner-carte") {

    const user = interaction.options.getUser("utilisateur");
    const id = interaction.options.getString("id");

    if (!players[user.id]) players[user.id] = { cards: [] };

    if (!players[user.id].cards.includes(id))
      players[user.id].cards.push(id);

    savePlayers();

    return interaction.reply({ content: `🎁 Donné ${id}`, ephemeral: true });
  }

  // ================= RETIRER =================
  if (interaction.commandName === "retirer-carte") {

    if (!interaction.member.permissions.has("Administrator"))
      return interaction.reply({ content: "❌ Admin only", ephemeral: true });

    const user = interaction.options.getUser("utilisateur");
    const id = interaction.options.getString("id");

    if (!players[user.id]) return interaction.reply({ content: "❌ Rien", ephemeral: true });

    players[user.id].cards = players[user.id].cards.filter(c => c !== id);

    savePlayers();

    return interaction.reply({ content: `🗑️ Retiré ${id}`, ephemeral: true });
  }
});

client.login(TOKEN);

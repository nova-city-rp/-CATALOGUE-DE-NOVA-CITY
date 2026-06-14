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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// ===================== DATA =====================
const data = require("./data.json");

let players = fs.existsSync("./players.json")
  ? JSON.parse(fs.readFileSync("./players.json"))
  : {};

function savePlayers() {
  fs.writeFileSync("./players.json", JSON.stringify(players, null, 2));
}

// ===================== CATÉGORIES =====================
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
  new SlashCommandBuilder().setName("cartes").setDescription("🎮 Menu cartes"),
  new SlashCommandBuilder().setName("catalogue").setDescription("📁 Catégories"),
  new SlashCommandBuilder().setName("voir-carte").setDescription("🎴 Voir cartes"),
  new SlashCommandBuilder().setName("donner-carte")
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
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("✅ Slash commands OK");
})();

// ===================== READY =====================
client.once("ready", () => {
  console.log(`🤖 Connecté : ${client.user.tag}`);
});

// ===================== MENU PRINCIPAL =====================
client.on("interactionCreate", async (interaction) => {

  // ===== /cartes =====
  if (interaction.commandName === "cartes") {

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("cat").setLabel("📁 Catalogue").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("add").setLabel("➕ Ajouter").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("view").setLabel("🎴 Voir").setStyle(ButtonStyle.Secondary)
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

  // ===================== BUTTONS =====================
  if (interaction.isButton()) {

    // CATALOGUE
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
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    // AJOUT CARTE (STEP 1)
    if (interaction.customId === "add") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("add_cat")
        .setPlaceholder("Choisis catégorie")
        .addOptions(
          Object.keys(categories).map(c => ({
            label: c.toUpperCase(),
            value: c
          }))
        );

      return interaction.reply({
        content: "📁 Choisis une catégorie",
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    // VIEW CARTE
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

  // ===================== CATALOGUE =====================
  if (interaction.isStringSelectMenu() && interaction.customId === "menu_cat") {

    const cat = interaction.values[0];
    const cards = data[cat] || [];

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle(cat.toUpperCase())
          .setDescription(cards.map(c => `🎴 ${c.id} (${c.rarity})`).join("\n") || "❌ vide")
          .setColor("Green")
      ],
      components: []
    });
  }

  // ===================== VIEW STEP 1 =====================
  if (interaction.isStringSelectMenu() && interaction.customId === "view_cat") {

    const cat = interaction.values[0];
    const cards = data[cat] || [];

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`view_card_${cat}`)
      .setPlaceholder("Choisis une carte")
      .addOptions(
        cards.map(c => ({
          label: c.id,
          value: c.id
        }))
      );

    return interaction.update({
      content: "🎴 Choisis une carte",
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  // ===================== VIEW STEP 2 =====================
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("view_card_")) {

    const cat = interaction.customId.replace("view_card_", "");
    const id = interaction.values[0];

    const card = (data[cat] || []).find(c => c.id === id);

    if (!card) return interaction.update({ content: "❌ introuvable", components: [] });

    return interaction.update({
      content: "",
      embeds: [
        new EmbedBuilder()
          .setTitle(card.id)
          .setImage(card.url)
          .setFooter({ text: card.rarity })
          .setColor("Gold")
      ],
      components: []
    });
  }

  // ===================== AJOUT CARTE (IMPORTANT FIX) =====================
  if (interaction.isStringSelectMenu() && interaction.customId === "add_cat") {

    const cat = interaction.values[0];

    await interaction.reply({
      content: "📎 Maintenant envoie une image + ID comme ça : CIV-001",
      ephemeral: true
    });

    const filter = m => m.author.id === interaction.user.id;

    const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 60000 });

    collector.on("collect", message => {

      const attachment = message.attachments.first();
      if (!attachment) return;

      const parts = message.content.split(" ");
      const id = parts[0];

      if (!data[cat]) data[cat] = [];

      data[cat].push({
        id,
        rarity: categories[cat] || "commun",
        url: attachment.url
      });

      fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));

      message.reply(`✅ Carte ajoutée : ${id}`);
    });
  }

  // ===================== DONNER =====================
  if (interaction.commandName === "donner-carte") {

    const user = interaction.options.getUser("utilisateur");
    const id = interaction.options.getString("id");

    if (!players[user.id]) players[user.id] = { cards: [] };

    players[user.id].cards.push(id);

    savePlayers();

    return interaction.reply({
      content: `🎁 ${id} envoyé à ${user.username}`,
      ephemeral: true
    });
  }
});

client.login(TOKEN);

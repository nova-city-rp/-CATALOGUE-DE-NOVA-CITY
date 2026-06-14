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
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
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
  new SlashCommandBuilder().setName("cartes").setDescription("🎮 Menu principal cartes"),

  new SlashCommandBuilder().setName("catalogue").setDescription("📁 Voir les catégories"),

  new SlashCommandBuilder()
    .setName("voir-carte")
    .setDescription("🎴 Voir une carte (menu interactif)"),

  new SlashCommandBuilder()
    .setName("ajouter-carte")
    .setDescription("➕ Ajouter une carte (ADMIN)"),

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

// ===================== MENU /cartes =====================
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

    // ===== CATALOGUE =====
    if (interaction.customId === "cat") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("menu_cat")
        .setPlaceholder("📁 Choisis une catégorie")
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

    // ===== AJOUT =====
    if (interaction.customId === "add") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("add_cat_select")
        .setPlaceholder("📁 Choisis catégorie")
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
        .setCustomId("view_cat_select")
        .setPlaceholder("📁 Choisis catégorie")
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

  // ===================== CAT MENU =====================
  if (interaction.isStringSelectMenu() && interaction.customId === "menu_cat") {

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

  // ===================== VIEW STEP 1 =====================
  if (interaction.isStringSelectMenu() && interaction.customId === "view_cat_select") {

    const cat = interaction.values[0];
    const cards = data[cat] || [];

    if (!cards.length) {
      return interaction.update({
        content: "❌ Aucune carte",
        components: [],
        embeds: []
      });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`view_card_select_${cat}`)
      .setPlaceholder("🎴 Choisis une carte")
      .addOptions(
        cards.map(c => ({
          label: c.id,
          value: c.id,
          description: c.rarity
        }))
      );

    return interaction.update({
      content: `📁 ${cat.toUpperCase()}`,
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  // ===================== VIEW STEP 2 =====================
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("view_card_select_")) {

    const cat = interaction.customId.replace("view_card_select_", "");
    const id = interaction.values[0];

    const card = (data[cat] || []).find(c => c.id === id);

    if (!card) {
      return interaction.update({
        content: "❌ Carte introuvable",
        components: []
      });
    }

    const file = new AttachmentBuilder(card.file);

    return interaction.update({
      content: "",
      embeds: [
        new EmbedBuilder()
          .setTitle(card.id)
          .setImage(`attachment://${card.file}`)
          .setFooter({ text: `Rareté : ${card.rarity}` })
          .setColor("Gold")
      ],
      files: [file],
      components: []
    });
  }

  // ===================== ADD =====================
  if (interaction.isStringSelectMenu() && interaction.customId === "add_cat_select") {

    const cat = interaction.values[0];

    const modal = new ModalBuilder()
      .setCustomId(`add_card_${cat}`)
      .setTitle("➕ Ajouter carte");

    const idInput = new TextInputBuilder()
      .setCustomId("card_id")
      .setLabel("ID carte (ex: CIV-001)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(idInput));

    return interaction.showModal(modal);
  }

  // ===================== MODAL =====================
  if (interaction.isModalSubmit() && interaction.customId.startsWith("add_card_")) {

    const cat = interaction.customId.replace("add_card_", "");
    const id = interaction.fields.getTextInputValue("card_id");

    const attachment = interaction.attachments.first();

    if (!attachment) {
      return interaction.reply({
        content: "❌ Envoie l’image avec la commande /ajouter-carte (pièce jointe)",
        ephemeral: true
      });
    }

    if (!data[cat]) data[cat] = [];

    const rarity = categories[cat] || "commun";

    data[cat].push({
      id,
      rarity,
      file: attachment.name,
      url: attachment.url
    });

    fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));

    return interaction.reply({
      content: `✅ Carte ajoutée ${id}`,
      ephemeral: true
    });
  }

  // ===================== DONNER =====================
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

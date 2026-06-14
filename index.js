const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
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

// ===================== COMMANDS =====================
const commands = [

  new SlashCommandBuilder()
    .setName("catalogue")
    .setDescription("📁 Voir les catégories de cartes"),

  new SlashCommandBuilder()
    .setName("voir-carte")
    .setDescription("🎴 Voir une carte")
    .addStringOption(o =>
      o.setName("categorie").setDescription("Catégorie").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("id").setDescription("ID carte (ex: CIV-001)").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ajouter-carte")
    .setDescription("➕ Ajouter une carte (ADMIN)")
    .addStringOption(o =>
      o.setName("categorie").setDescription("Catégorie").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("rarity").setDescription("commun / rare / epique / legendaire").setRequired(true)
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

// ===================== INTERACTIONS =====================
client.on("interactionCreate", async (interaction) => {

  // ===================== /CATALOGUE =====================
  if (interaction.commandName === "catalogue") {

    const menu = new StringSelectMenuBuilder()
      .setCustomId("menu_cat")
      .setPlaceholder("📁 Choisis une catégorie")
      .addOptions(
        Object.keys(data).map(c => ({
          label: `${c.toUpperCase()} (${data[c].length})`,
          value: c
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("📁 Catalogue des cartes")
          .setColor("Blue")
      ],
      components: [row],
      ephemeral: true
    });
  }

  // ===================== MENU CAT =====================
  if (interaction.isStringSelectMenu() && interaction.customId === "menu_cat") {

    const cat = interaction.values[0];
    const cards = data[cat] || [];

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle(`📁 ${cat.toUpperCase()}`)
          .setDescription(cards.map(c => `🎴 ${c.id} - ${c.rarity}`).join("\n"))
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
          .setTitle(`🎴 ${card.id}`)
          .setImage(`attachment://${card.file}`)
          .setColor("Gold")
          .setFooter({ text: `Rareté : ${card.rarity}` })
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
    const rarity = interaction.options.getString("rarity");
    const image = interaction.options.getAttachment("image");

    if (!data[cat]) data[cat] = [];

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

    if (!players[user.id].cards.includes(id)) {
      players[user.id].cards.push(id);
    }

    savePlayers();

    return interaction.reply({
      content: `🎁 Carte ${id} donnée à ${user.username}`,
      ephemeral: true
    });
  }
});

client.login(TOKEN);

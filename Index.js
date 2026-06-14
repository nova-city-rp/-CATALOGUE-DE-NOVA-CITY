const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
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
    .setDescription("🎴 Voir tes cartes ou une carte précise")
    .addStringOption(o =>
      o.setName("categorie").setDescription("Catégorie").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("id").setDescription("ID carte").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("ajouter-carte")
    .setDescription("➕ Ajouter une carte (ADMIN)")
    .addStringOption(o =>
      o.setName("categorie").setDescription("Catégorie").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("url").setDescription("Image URL").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("supprimer-carte")
    .setDescription("🗑️ Supprimer une carte (ADMIN)")
    .addStringOption(o =>
      o.setName("categorie").setDescription("Catégorie").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("id").setDescription("ID carte").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("donner-carte")
    .setDescription("🎁 Donner une carte (ADMIN)")
    .addUserOption(o =>
      o.setName("utilisateur").setDescription("Joueur").setRequired(true)
    )
    .addIntegerOption(o =>
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
          label: c.toUpperCase(),
          value: c
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    const embed = new EmbedBuilder()
      .setTitle("📁 Catalogue des cartes")
      .setDescription("Choisis une catégorie")
      .setColor("Blue");

    return interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }

  // ===================== MENU CATÉGORIE =====================
  if (interaction.isStringSelectMenu() && interaction.customId === "menu_cat") {

    const cat = interaction.values[0];
    const cards = data[cat] || [];

    const embed = new EmbedBuilder()
      .setTitle(`📁 ${cat.toUpperCase()}`)
      .setDescription(
        cards.length
          ? cards.map(c => `🎴 Carte #${c.id}`).join("\n")
          : "❌ Aucune carte"
      )
      .setColor("Green");

    return interaction.update({ embeds: [embed], components: [] });
  }

  // ===================== /VOIR-CARTE =====================
  if (interaction.commandName === "voir-carte") {

    const cat = interaction.options.getString("categorie");
    const id = interaction.options.getInteger("id");

    const userId = interaction.user.id;
    const user = players[userId] || { cards: [] };

    if (!data[cat]) {
      return interaction.reply({ content: "❌ Catégorie invalide", ephemeral: true });
    }

    // ===== CARTE PRÉCISE =====
    if (id) {

      if (!user.cards.includes(id)) {
        return interaction.reply({ content: "❌ Tu ne possèdes pas cette carte", ephemeral: true });
      }

      const card = data[cat].find(c => c.id === id);

      if (!card) {
        return interaction.reply({ content: "❌ Carte introuvable", ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎴 Carte #${id}`)
        .setImage(card.url)
        .setColor("Gold");

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ===== LISTE CARTES =====
    const owned = data[cat].filter(c =>
      user.cards.includes(c.id)
    );

    const embed = new EmbedBuilder()
      .setTitle(`📁 Tes cartes - ${cat}`)
      .setDescription(
        owned.length
          ? owned.map(c => `🎴 Carte #${c.id}`).join("\n")
          : "❌ Aucune carte"
      )
      .setColor("Blue");

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ===================== /AJOUTER-CARTE =====================
  if (interaction.commandName === "ajouter-carte") {

    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({ content: "❌ Pas autorisé", ephemeral: true });
    }

    const cat = interaction.options.getString("categorie");
    const url = interaction.options.getString("url");

    if (!data[cat]) data[cat] = [];

    const id = Math.floor(Math.random() * 100000);

    data[cat].push({ id, url });

    fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("➕ Carte ajoutée")
          .setDescription(`ID #${id}`)
          .setColor("Green")
      ],
      ephemeral: true
    });
  }

  // ===================== /SUPPRIMER-CARTE =====================
  if (interaction.commandName === "supprimer-carte") {

    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({ content: "❌ Pas autorisé", ephemeral: true });
    }

    const cat = interaction.options.getString("categorie");
    const id = interaction.options.getInteger("id");

    data[cat] = (data[cat] || []).filter(c => c.id !== id);

    fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));

    return interaction.reply({
      content: `🗑️ Carte #${id} supprimée`,
      ephemeral: true
    });
  }

  // ===================== /DONNER-CARTE =====================
  if (interaction.commandName === "donner-carte") {

    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({ content: "❌ Pas autorisé", ephemeral: true });
    }

    const user = interaction.options.getUser("utilisateur");
    const id = interaction.options.getInteger("id");

    if (!players[user.id]) players[user.id] = { cards: [] };

    if (!players[user.id].cards.includes(id)) {
      players[user.id].cards.push(id);
    }

    savePlayers();

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎁 Carte donnée")
          .setDescription(`Carte #${id} envoyée à ${user.username}`)
          .setColor("Gold")
      ],
      ephemeral: true
    });
  }
});

client.login(TOKEN);

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

// ================= SAFE JSON (AVEC VOLUME PERMANENT) =================
const DATA_FILE = "/app/data/data.json";
const PLAYERS_FILE = "/app/data/players.json";

if (!fs.existsSync("/app/data")) {
  fs.mkdirSync("/app/data", { recursive: true });
}

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

let data = loadJSON(DATA_FILE);
let players = loadJSON(PLAYERS_FILE);

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
  new SlashCommandBuilder()
    .setName("cartes")
    .setDescription("Afficher le menu principal des cartes"),
    
  new SlashCommandBuilder()
    .setName("mes-cartes")
    .setDescription("Voir votre collection de cartes"),

  new SlashCommandBuilder()
    .setName("voir-carte")
    .setDescription("Afficher une carte en grand avec son illustration")
    .addStringOption(o => o.setName("id").setDescription("L'ID unique de la carte à regarder").setRequired(true)),
    
  new SlashCommandBuilder()
    .setName("stats-cartes")
    .setDescription("Voir les statistiques globales des cartes"),

  new SlashCommandBuilder()
    .setName("catalogueglobale")
    .setDescription("Voir la liste complète de toutes les cartes existantes"),

  new SlashCommandBuilder()
    .setName("retirer-carte")
    .setDescription("Retirer une carte de la collection d’un joueur")
    .addUserOption(o => o.setName("utilisateur").setDescription("Le joueur à qui retirer la carte").setRequired(true))
    .addStringOption(o => o.setName("id").setDescription("L'identifiant unique de la carte").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ajouter-carte")
    .setDescription("Créer une nouvelle carte dans le système (ADMIN)")
    .addStringOption(o => o.setName("categorie").setDescription("La catégorie de la carte").setRequired(true))
    .addStringOption(o => o.setName("id").setDescription("L'ID unique pour cette carte").setRequired(true))
    .addStringOption(o => o.setName("nom").setDescription("Le nom de la carte").setRequired(true))
    .addAttachmentOption(o => o.setName("image").setDescription("Glissez directement la photo de la carte").setRequired(true)),

  new SlashCommandBuilder()
    .setName("donner-carte")
    .setDescription("Donner une carte spécifique à un utilisateur")
    .addUserOption(o => o.setName("utilisateur").setDescription("Le joueur qui va recevoir la carte").setRequired(true))
    .addStringOption(o => o.setName("id").setDescription("L'identifiant unique de la carte à donner").setRequired(true)),
].map(c => c.toJSON());

// ================= DEPLOY =================
client.once("ready", async () => {
  console.log(`🤖 Bot connecté en tant que ${client.user.tag}`);
  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("✅ Commandes Slash enregistrées !");
  } catch (error) {
    console.error("❌ Erreur de déploiement :", error);
  }
});

// ================= HELPERS =================
function getUser(id) {
  if (!players[id]) players[id] = { cards: [] };
  if (!players[id].cards) players[id].cards = [];
  return players[id];
}

function findCard(cardId) {
  for (const cat of Object.keys(data)) {
    const card = data[cat].find(c => c.id.toLowerCase() === cardId.toLowerCase());
    if (card) return { card, cat };
  }
  return null;
}

// Génère la liste écrite d'une catégorie avec son menu déroulant de cartes
function createCategoryList(cat) {
  const cards = data[cat] || [];
  
  if (cards.length === 0) {
    return {
      embeds: [
        new EmbedBuilder()
          .setTitle(`📁 CATEGOUTE : ${cat.toUpperCase()}`)
          .setDescription("Aucune carte n'est disponible dans cette catégorie pour le moment.")
          .setColor(0x3498db)
      ],
      components: []
    };
  }

  const listText = cards.map(c => {
    const r = rarityStyle[c.rarity] || rarityStyle.commun;
    return `${r.emoji} **${c.id.toUpperCase()}** — ${c.nom}`;
  }).join("\n");

  const embed = new EmbedBuilder()
    .setTitle(`📁 CATEGORIE : ${cat.toUpperCase()}`)
    .setDescription(`Voici la liste des cartes disponibles.\nCliquez sur le menu ci-dessous pour afficher la photo d'une carte !\n\n${listText}`)
    .setColor(0x3498db);

  // Création du menu déroulant contenant les cartes de la catégorie (max 25)
  const cardOptions = cards.slice(0, 25).map(c => ({
    label: `${c.id.toUpperCase()} - ${c.nom}`,
    description: `Voir l'illustration de cette carte`,
    value: `showcard_${c.id}`
  }));

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`card_select_${cat}`)
      .setPlaceholder("🔍 Choisissez une carte pour voir sa photo")
      .addOptions(cardOptions)
  );

  return { embeds: [embed], components: [row] };
}

// ================= MAIN =================
client.on("interactionCreate", async (interaction) => {
  try {

    // ===== MENU PRINCIPAL =====
    if (interaction.isChatInputCommand() && interaction.commandName === "cartes") {
      return interaction.reply({
        ephemeral: true,
        embeds: [new EmbedBuilder().setTitle("🎮 MENU CARTES").setColor(0x3498db)],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("cat").setLabel("📁 Catalogue").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("view_help").setLabel("🎴 Comment voir une carte ?").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("stats").setLabel("📊 Stats").setStyle(ButtonStyle.Success)
          )
        ]
      });
    }

    // ===== BOUTONS =====
    if (interaction.isButton()) {
      if (interaction.customId === "cat") {
        const options = Object.keys(categories).slice(0, 25).map(c => ({
          label: c.toUpperCase().replace("_", " "),
          value: c
        }));

        return interaction.reply({
          ephemeral: true,
          content: "Sélectionnez une catégorie ci-dessous :",
          components: [
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("cat_select")
                .setPlaceholder("Choisissez une catégorie")
                .addOptions(options)
            )
          ]
        });
      }

      if (interaction.customId === "view_help") {
        return interaction.reply({
          content: "💡 Pour inspecter une carte avec son illustration en grand, utilise la commande : `/voir-carte id:ID_DE_LA_CARTE` !",
          ephemeral: true
        });
      }

      if (interaction.customId === "stats") {
        const total = Object.values(data).flat().length;
        return interaction.reply({
          ephemeral: true,
          embeds: [
            new EmbedBuilder()
              .setTitle("📊 Stats")
              .setDescription(`Total de cartes créées sur le bot: **${total}**`)
              .setColor(0x2ecc71)
          ]
        });
      }

      // Bouton Retour à la liste écrite
      if (interaction.customId.startsWith("backtolist_")) {
        const cat = interaction.customId.split("_")[1];
        const listData = createCategoryList(cat);
        return interaction.update({
          embeds: listData.embeds,
          components: listData.components
        });
      }
    }

    // ===== MENUS DÉROULANTS =====
    if (interaction.isStringSelectMenu()) {
      
      // 1. Choix de la catégorie générale
      if (interaction.customId === "cat_select") {
        const cat = interaction.values[0];
        const listData = createCategoryList(cat);

        return interaction.update({
          content: null,
          embeds: listData.embeds,
          components: listData.components
        });
      }

      // 2. Choix d'une carte précise dans la catégorie pour voir sa photo
      if (interaction.customId.startsWith("card_select_")) {
        const cat = interaction.customId.split("_")[2];
        const selectValue = interaction.values[0]; // ex: showcard_civ-01
        const cardId = selectValue.split("_")[1];

        const result = findCard(cardId);
        if (!result) return interaction.update({ content: "❌ Carte introuvable.", embeds: [], components: [] });

        const { card } = result;
        const r = rarityStyle[card.rarity] || rarityStyle.commun;

        const embed = new EmbedBuilder()
          .setTitle(`${r.emoji} ${card.nom} [${card.id.toUpperCase()}]`)
          .setDescription(`• **Catégorie :** ${cat.toUpperCase()}\n• **Rareté :** ${card.rarity.toUpperCase()}`)
          .setColor(r.color)
          .setImage(card.image); // Affiche la photo !

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`backtolist_${cat}`)
            .setLabel("⬅️ Revenir à la liste")
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.update({
          embeds: [embed],
          components: [row]
        });
      }
    }

    // ===== COMMAND: VOIR UNE CARTE =====
    if (interaction.isChatInputCommand() && interaction.commandName === "voir-carte") {
      const id = interaction.options.getString("id");
      const result = findCard(id);

      if (!result) {
        return interaction.reply({ content: `❌ La carte avec l'ID **${id}** n'existe pas.`, ephemeral: true });
      }

      const { card, cat } = result;
      const r = rarityStyle[card.rarity] || rarityStyle.commun;

      const embed = new EmbedBuilder()
        .setTitle(`${r.emoji} ${card.nom} [${card.id.toUpperCase()}]`)
        .addFields(
          { name: "📁 Catégorie", value: cat.toUpperCase(), inline: true },
          { name: "💎 Rareté", value: card.rarity.toUpperCase(), inline: true }
        )
        .setColor(r.color)
        .setImage(card.image);

      return interaction.reply({ embeds: [embed], ephemeral: false });
    }

    // ===== GLOBAL CATALOGUE =====
    if (interaction.isChatInputCommand() && interaction.commandName === "catalogueglobale") {
      const all = Object.values(data).flat();

      if (all.length === 0) {
        return interaction.reply({ content: "Aucune carte n'existe pour le moment.", ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle("🌍 CATALOGUE GLOBAL DES CARTES")
        .setDescription("Utilisez `/voir-carte` suivi de l'ID pour voir l'illustration d'une carte en grand !\n\n" + 
          all.map(card => {
            const r = rarityStyle[card.rarity] || rarityStyle.commun;
            return `${r.emoji} **${card.id}** - ${card.nom} *(${card.rarity})*`;
          }).join("\n")
        )
        .setColor(0x5865f2);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ===== RETIRER CARTE =====
    if (interaction.isChatInputCommand() && interaction.commandName === "retirer-carte") {
      const user = interaction.options.getUser("utilisateur");
      const id = interaction.options.getString("id");
      const p = getUser(user.id);
      
      if (!p.cards.some(c => c.toLowerCase() === id.toLowerCase())) {
        return interaction.reply({ content: `❌ Cet utilisateur ne possède pas la carte **${id}**.`, ephemeral: true });
      }

      p.cards = p.cards.filter(c => c.toLowerCase() !== id.toLowerCase());
      saveJSON(PLAYERS_FILE, players);

      return interaction.reply({ content: `🗑️ Carte **${id}** retirée avec succès de <@${user.id}>.`, ephemeral: true });
    }

    // ===== MES CARTES =====
    if (interaction.isChatInputCommand() && interaction.commandName === "mes-cartes") {
      const p = getUser(interaction.user.id);
      return interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setTitle("📚 Tes cartes")
            .setColor(0x9b59b6)
            .setDescription(p.cards.length ? p.cards.map(c => `• **${c.toUpperCase()}**`).join("\n") : "Encore aucune carte dans ta collection ! 😢")
        ]
      });
    }

    // ===== AJOUT =====
    if (interaction.isChatInputCommand() && interaction.commandName === "ajouter-carte") {
      if (!interaction.memberPermissions?.has("Administrator"))
        return interaction.reply({ content: "❌ Seuls les administrateurs peuvent faire cela.", ephemeral: true });

      const cat = interaction.options.getString("categorie").toLowerCase();
      const id = interaction.options.getString("id");
      const nom = interaction.options.getString("nom");
      
      const imageAttachment = interaction.options.getAttachment("image");
      const image = imageAttachment ? imageAttachment.url : null;

      if (!categories[cat]) {
        return interaction.reply({ content: `❌ Cette catégorie n'existe pas.`, ephemeral: true });
      }

      if (!image) {
        return interaction.reply({ content: "❌ Impossible de récupérer la photo.", ephemeral: true });
      }

      if (!data[cat]) data[cat] = [];

      const exists = Object.values(data).flat().some(c => c.id.toLowerCase() === id.toLowerCase());
      if (exists)
        return interaction.reply({ content: "❌ Cet ID de carte est déjà utilisé !", ephemeral: true });

      data[cat].push({ id, nom, image, rarity: categories[cat] || "commun" });
      saveJSON(DATA_FILE, data);
      return interaction.reply({ content: `✅ La carte **${nom}** (${id}) a été ajoutée à la catégorie **${cat}** !`, ephemeral: true });
    }

    // ===== DONNER =====
    if (interaction.isChatInputCommand() && interaction.commandName === "donner-carte") {
      const user = interaction.options.getUser("utilisateur");
      const id = interaction.options.getString("id");

      const result = findCard(id);
      if (!result) {
        return interaction.reply({ content: `❌ La carte avec l'ID **${id}** n'existe pas.`, ephemeral: true });
      }

      const p = getUser(user.id);
      if (p.cards.some(c => c.toLowerCase() === id.toLowerCase())) {
        return interaction.reply({ content: `⚠️ Cet utilisateur possède déjà la carte **${id}**.`, ephemeral: true });
      }

      p.cards.push(id);
      saveJSON(PLAYERS_FILE, players);
      return interaction.reply({ content: `🎁 La carte **${id}** a été ajoutée à <@${user.id}> !`, ephemeral: true });
    }

    // ===== STATS =====
    if (interaction.isChatInputCommand() && interaction.commandName === "stats-cartes") {
      const total = Object.values(data).flat().length;
      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle("📊 Stats").setColor(0x3498db).setDescription(`Total de cartes: **${total}**`)],
        ephemeral: true
      });
    }

  } catch (e) {
    console.error("❌ ERREUR INTERACTION :", e);
  }
});

if (!TOKEN || !CLIENT_ID) {
  process.exit(1);
} else {
  client.login(TOKEN);
            }

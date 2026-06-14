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
  new SlashCommandBuilder()
    .setName("cartes")
    .setDescription("Afficher le menu principal des cartes"),
    
  new SlashCommandBuilder()
    .setName("mes-cartes")
    .setDescription("Voir votre collection de cartes"),
    
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
    .addStringOption(o => o.setName("image").setDescription("L'URL de l'image").setRequired(true)),

  new SlashCommandBuilder()
    .setName("donner-carte")
    .setDescription("Donner une carte spécifique à un utilisateur")
    .addUserOption(o => o.setName("utilisateur").setDescription("Le joueur qui va recevoir la carte").setRequired(true))
    .addStringOption(o => o.setName("id").setDescription("L'identifiant unique de la carte à donner").setRequired(true)),
].map(c => c.toJSON());

// ================= DEPLOY & LOGIN =================
client.once("ready", async () => {
  console.log(`🤖 Bot connecté en tant que ${client.user.tag}`);
  
  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("✅ Commandes Slash enregistrées avec succès auprès de Discord !");
  } catch (error) {
    console.error("❌ Erreur lors de l'enregistrement des commandes :", error);
  }
});

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
    if (interaction.isChatInputCommand() && interaction.commandName === "cartes") {
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

      if (interaction.customId === "view") {
        return interaction.reply({
          content: "💡 Pour voir vos cartes détaillées, utilisez plutôt la commande `/mes-cartes` !",
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
    }

    // ===== CATALOGUE SIMPLE =====
    if (interaction.isStringSelectMenu() && interaction.customId === "cat_select") {
      const cat = interaction.values[0];
      const cards = data[cat] || [];

      return interaction.update({
        content: null,
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
                : "Aucune carte dans cette catégorie."
            )
        ],
        components: []
      });
    }

    // ===== GLOBAL CATALOGUE (GRID STYLE EMBED) =====
    if (interaction.isChatInputCommand() && interaction.commandName === "catalogueglobale") {
      const all = Object.values(data).flat();

      if (all.length === 0) {
        return interaction.reply({ content: "Aucune carte n'existe pour le moment.", ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle("🌍 CATALOGUE GLOBAL")
        .setColor(0x5865f2);

      all.slice(0, 25).forEach(card => {
        const r = rarityStyle[card.rarity] || rarityStyle.commun;
        embed.addFields({
          name: `${r.emoji} ${card.id}`,
          value: `**Nom:** ${card.nom}\n[Lien Image](${card.image})`,
          inline: true
        });
      });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ===== RETIRER CARTE =====
    if (interaction.isChatInputCommand() && interaction.commandName === "retirer-carte") {
      const user = interaction.options.getUser("utilisateur");
      const id = interaction.options.getString("id");

      const p = getUser(user.id);
      
      if (!p.cards.includes(id)) {
        return interaction.reply({ content: `❌ Cet utilisateur ne possède pas la carte **${id}**.`, ephemeral: true });
      }

      p.cards = p.cards.filter(c => c !== id);
      saveJSON("./players.json", players);

      return interaction.reply({
        content: `🗑️ Carte **${id}** retirée avec succès de <@${user.id}>.`,
        ephemeral: true
      });
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
            .setDescription(p.cards.length ? p.cards.map(c => `• **${c}**`).join("\n") : "Encore aucune carte dans ta collection ! 😢")
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
      const image = interaction.options.getString("image");

      if (!categories[cat]) {
        return interaction.reply({ content: `❌ Cette catégorie n'existe pas. Choisis parmi : ${Object.keys(categories).join(', ')}`, ephemeral: true });
      }

      if (!data[cat]) data[cat] = [];

      const exists = Object.values(data).flat().some(c => c.id === id);
      if (exists)
        return interaction.reply({ content: "❌ Cet ID de carte est déjà utilisé !", ephemeral: true });

      data[cat].push({
        id,
        nom,
        image,
        rarity: categories[cat] || "commun"
      });

      saveJSON("./data.json", data);
      return interaction.reply({ content: `✅ La carte **${nom}** (${id}) a été ajoutée à la catégorie **${cat}** !`, ephemeral: true });
    }

    // ===== DONNER =====
    if (interaction.isChatInputCommand() && interaction.commandName === "donner-carte") {
      const user = interaction.options.getUser("utilisateur");
      const id = interaction.options.getString("id");

      const cardExists = Object.values(data).flat().some(c => c.id === id);
      if (!cardExists) {
        return interaction.reply({ content: `❌ La carte avec l'ID **${id}** n'existe pas dans le système.`, ephemeral: true });
      }

      const p = getUser(user.id);
      if (p.cards.includes(id)) {
        return interaction.reply({ content: `⚠️ Cet utilisateur possède déjà la carte **${id}**.`, ephemeral: true });
      }

      p.cards.push(id);
      saveJSON("./players.json", players);

      return interaction.reply({ content: `🎁 La carte **${id}** a été ajoutée à la collection de <@${user.id}> !`, ephemeral: true });
    }

    // ===== STATS COMMANDE =====
    if (interaction.isChatInputCommand() && interaction.commandName === "stats-cartes") {
      const total = Object.values(data).flat().length;

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("📊 Stats")
            .setColor(0x3498db)
            .setDescription(`Total de cartes enregistrées: **${total}**`)
        ],
        ephemeral: true
      });
    }

  } catch (e) {
    console.error("❌ ERREUR INTERACTION :", e);
    
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({
        content: "❌ Une erreur interne est survenue lors de l'exécution de cette action.",
        ephemeral: true
      });
    }
  }
});

// Connexion sécurisée
if (!TOKEN || !CLIENT_ID) {
  console.error("❌ Erreur : Les variables d'environnement TOKEN ou CLIENT_ID sont introuvables !");
  process.exit(1);
} else {
  client.login(TOKEN);
          }

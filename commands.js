/**
 * @file commands.js
 *
 * @brief Slash commands.
 */

const { ChannelType, PermissionFlagsBits, SlashCommandBuilder, MessageFlags } = require('discord.js');
const {
    setGuildNewsChannel,
    setGuildPingRole,
    addTrackedAccount,
    removeTrackedAccount,
    listTrackedAccounts,
} = require('./db');
const { log, error } = require('./logger');
const { version } = require('./package.json');

// HELPER FUNCTIONS
/**
 * @brief Normalize username for storage.
 *
 * @param {string} username Raw username input
 * @returns {string} Normalized username (no leading '@')
 */
function normalizeUsername(username) {
    const trimmed = username.trim();
    return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}

/**
 * @brief Converts a selected Discord role into the stored ping_role value.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction Command interaction
 * @param {import('discord.js').Role} role Selected role
 * @returns {string} "everyone" or role ID string
 */
function roleToPingRole(interaction, role) {
    if (role.id === interaction.guildId) return 'everyone';
    return role.id;
}

/**
 * @brief Formats a stored ping_role value for display.
 *
 * @param {string} pingRole "everyone" or role ID
 * @returns {string} Human-readable ping target
 */
function formatPingRole(pingRole) {
    if (pingRole === 'everyone') return '@everyone';
    return `<@&${pingRole}>`;
}

// COMMAND CONFIGURATIONS
/**
 * @brief /setup configuration.
 */
const setupCommand = new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure which channel receives the translated news posts.')
    .addChannelOption((opt) =>
        opt
            .setName('channel')
            .setDescription('Channel where news should be posted')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addRoleOption((opt) =>
        opt
            .setName('role')
            .setDescription('Role to ping for news')
            .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

/**
 * @brief /setchannel configuration.
 */
const setChannelCommand = new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Set which channel receives the translated news posts.')
    .addChannelOption((opt) =>
        opt
            .setName('channel')
            .setDescription('Channel where news should be posted')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

/**
 * @brief /setpingrole configuration.
 */
const setPingRoleCommand = new SlashCommandBuilder()
    .setName('setpingrole')
    .setDescription('Set which role the bot pings when posting news.')
    .addRoleOption((opt) =>
        opt
            .setName('role')
            .setDescription('Role to ping for news')
            .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

/**
 * @brief /addaccount configuration.
 */
const addAccountCommand = new SlashCommandBuilder()
    .setName('addaccount')
    .setDescription('Add a Twitter username to track for this server.')
    .addStringOption((opt) =>
        opt
            .setName('username')
            .setDescription('Twitter/X username (their @)')
            .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

/**
 * @brief /removeaccount configuration.
 */
const removeAccountCommand = new SlashCommandBuilder()
    .setName('removeaccount')
    .setDescription('Remove a tracked Twitter/X username for this server.')
    .addStringOption((opt) =>
        opt
            .setName('username')
            .setDescription('Twitter/X username (their @)')
            .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

/**
 * @brief /listaccounts configuration.
 */
const listAccountsCommand = new SlashCommandBuilder()
    .setName('listaccounts')
    .setDescription('List all tracked Twitter/X usernames for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

/**
 * @brief /info configuration.
 */
const infoCommand = new SlashCommandBuilder()
    .setName('info')
    .setDescription('Displays information about this bot.');

// COMMAND HANDLERS
/**
 * @brief /setup implementation.
 *
 * Stores channel + ping role, and adds shu1aso by default.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction Command interaction
 */
async function handleSetup(interaction) {
    if (!interaction.inGuild()) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    const guildId = interaction.guildId;
    const channel = interaction.options.getChannel('channel', true);
    const role = interaction.options.getRole('role', true);

    if (!channel.isTextBased()) {
        await interaction.reply({
            content: 'That channel is not text-based.',
            ephemeral: true,
        });
        return;
    }

    const pingRole = roleToPingRole(interaction, role);

    setGuildNewsChannel(guildId, channel.id);
    setGuildPingRole(guildId, pingRole);
    addTrackedAccount(guildId, 'shu1aso');

    await interaction.reply({
        content: `Configured news channel to ${channel} and ping target to ${formatPingRole(pingRole)}.`,
        ephemeral: true,
    });
}

/**
 * @brief /setchannel implementation.
 *
 * Updates the news post channel for the server.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction Command interaction
 */
async function handleSetChannel(interaction) {
    if (!interaction.inGuild()) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    const guildId = interaction.guildId;
    const channel = interaction.options.getChannel('channel', true);

    if (!channel.isTextBased()) {
        await interaction.reply({
            content: 'That channel is not text-based.',
            ephemeral: true,
        });
        return;
    }

    setGuildNewsChannel(guildId, channel.id);

    await interaction.reply({
        content: `News channel updated to ${channel}.`,
        ephemeral: true,
    });
}

/**
 * @brief /setpingrole implementation.
 *
 * Updates ping_role for the server.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction Command interaction
 */
async function handleSetPingRole(interaction) {
    if (!interaction.inGuild()) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    const guildId = interaction.guildId;
    const role = interaction.options.getRole('role', true);
    const pingRole = roleToPingRole(interaction, role);

    setGuildPingRole(guildId, pingRole);

    await interaction.reply({
        content: `Ping target updated to ${formatPingRole(pingRole)}.`,
        ephemeral: true,
    });
}

/**
 * @brief /addaccount implementation.
 *
 * Adds a username to tracked_account for the Discord server.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction Command interaction
 */
async function handleAddAccount(interaction) {
    if (!interaction.inGuild()) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    const guildId = interaction.guildId;
    const raw = interaction.options.getString('username', true);
    const username = normalizeUsername(raw);

    const inserted = addTrackedAccount(guildId, username);

    if (!inserted) {
        await interaction.reply({
            content: `Error: That account is already being tracked.`,
            ephemeral: true,
        });
        return;
    }

    await interaction.reply({
        content: `Added account \`${username}\` to the tracked list.`,
        ephemeral: true,
    });
}

/**
 * @brief /removeaccount implementation.
 *
 * Removes a username from tracked_account for the Discord server.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleRemoveAccount(interaction) {
    if (!interaction.inGuild()) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    const guildId = interaction.guildId;
    const raw = interaction.options.getString('username', true);
    const username = normalizeUsername(raw);

    const removed = removeTrackedAccount(guildId, username);

    if (!removed) {
        await interaction.reply({
            content: 'Error: Account not found in database',
            ephemeral: true,
        });
        return;
    }

    await interaction.reply({
        content: `Removed account \`${username}\` from the tracked list.`,
        ephemeral: true,
    });
}

/**
 * @brief /listaccounts implementation.
 *
 * Lists all usernames in tracked_account for the Discord server.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleListAccounts(interaction) {
    if (!interaction.inGuild()) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    const guildId = interaction.guildId;
    const accounts = listTrackedAccounts(guildId);

    if (!accounts || accounts.length === 0) {
        await interaction.reply({
            content: 'No tracked accounts found for this server.',
            ephemeral: true,
        });
        return;
    }

    const lines = accounts.map((u) => `• @${u}`).join('\n');

    await interaction.reply({
        content: `Tracked Twitter accounts:\n${lines}`,
        ephemeral: true,
    });
}

/**
 * @brief /info implementation.
 *
 * Sends information about the bot.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleInfo(interaction) {
    const embed = {
        color: 0xfc389d, // Kusuo's hair color :)
        title: 'Ψ Asoubot Ψ',
        description:
            'Tracks Twitter/X accounts and automatically translates posts for your Discord server. Tracks Asou Shuuichi by default.',
        fields: [
            {
                name: 'Commands',
                value:
                    '`/setup` - Set news channel & ping role\n' +
                    '`/setchannel` - Change news channel\n' +
                    '`/setpingrole` - Change ping role\n' +
                    '`/addaccount` - Add a tracked account\n' +
                    '`/removeaccount` - Remove a tracked account\n' +
                    '`/listaccounts` - View all tracked accounts\n' +
                    '`/info` - View bot info',
            },
            {
                name: 'Support',
                value: '[Report issues on GitHub](https://github.com/Arcane-Mirage/asoubot/issues)',
            },
        ],
        footer: {
            text: `Ψ Developed by Arcana | Version ${version} Ψ`,
        },
    };

    await interaction.reply({
        embeds: [embed],
        ephemeral: true,
    });
}

/**
 * @brief Handles incoming interactions and routes commands.
 *
 * @param {import('discord.js').Interaction} interaction Discord interaction
 */
async function handleInteraction(interaction) {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'setup') {
        await handleSetup(interaction);
    } else if (interaction.commandName === 'setchannel') {
        await handleSetChannel(interaction);
    } else if (interaction.commandName === 'setpingrole') {
        await handleSetPingRole(interaction);
    } else if (interaction.commandName === 'addaccount') {
        await handleAddAccount(interaction);
    } else if (interaction.commandName === 'removeaccount') {
        await handleRemoveAccount(interaction);
    } else if (interaction.commandName === 'listaccounts') {
        await handleListAccounts(interaction);
    } else if (interaction.commandName === 'info') {
        await handleInfo(interaction);
    }
}

/**
 * @brief Registers slash commands for the bot.
 *
 * @param {import('discord.js').Client} client Discord client
 */
async function registerCommands(client) {
    const cmdJSON = [
        setupCommand.toJSON(),
        setChannelCommand.toJSON(),
        setPingRoleCommand.toJSON(),
        addAccountCommand.toJSON(),
        removeAccountCommand.toJSON(),
        listAccountsCommand.toJSON(),
        infoCommand.toJSON(),
    ];

    const guilds = await client.guilds.fetch();
    for (const [, guildRef] of guilds) {
        const guild = await guildRef.fetch();
        await guild.commands.set(cmdJSON);
    }
}

module.exports = {
    registerCommands,
    handleInteraction,
};

/**
 * @file index.js
 *
 * @brief Main entry point for Asoubot. Initializes the Discord client, sets up event handlers, and starts the RSS polling loop.
 */

'use strict';

require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const { log, error } = require('./logger');
const { startRssLoop } = require('./rss');

const {
    listTrackedAccounts,
    getGuildNewsChannel,
    getGuildPingRole,
} = require('./db');

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

async function getGuildState() {
    const guildMap = new Map();
    const all = new Set();

    const guilds = await client.guilds.fetch();
    for (const [, guildRef] of guilds) {
        const guild = await guildRef.fetch();
        const guildId = guild.id;

        const accounts = listTrackedAccounts(guildId) || [];
        guildMap.set(guildId, accounts);

        for (const u of accounts) {
            all.add(u);
        }
    }

    return {
        guildMap,
        allUsernames: [...all],
    };
}

function formatPing(pingRole) {
    if (!pingRole) return '';
    if (pingRole === 'everyone') return '@everyone';
    return `<@&${pingRole}>`;
}

async function notifyGuild(guildId, tweet) {
    const channelId = getGuildNewsChannel(guildId);
    if (!channelId) return;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const pingRole = getGuildPingRole(guildId);
    const ping = formatPing(pingRole);

    const embed = {
        color: 0xfc389d, // Kusuo's hair color :)
        title: 'Ψ Asoubot Ψ',
        description: `@${tweet.username} posted!`,
        fields: [
            {
                name: 'Original Text:',
                value: tweet.originalText ? tweet.originalText : '(empty)',
            },
            {
                name: 'Translated Text:',
                value: tweet.englishText ? tweet.englishText : '(empty)',
            },
            {
                name: 'DISCLAIMER:',
                value: 'All tweets are machine translated to English. Translations may be inaccurate.',
            },
        ],
    };

    if (ping) {
        await channel.send({ content: ping });
    }

    await channel.send({ embeds: [embed] });

    if (tweet.url) {
        await channel.send({ content: tweet.url });
    }
}

client.once('clientReady', () => {
    log(`Logged in as ${client.user.tag}`);

    startRssLoop({
        client,
        intervalMs: Number(process.env.RSS_INTERVAL_MS || 60_000),
        getGuildState,
        notifyGuild,
    });
});

client.on('error', (err) => {
    error('Discord client error:', err);
});

process.on('unhandledRejection', (err) => {
    error('Unhandled promise rejection:', err);
});

process.on('uncaughtException', (err) => {
    error('Uncaught exception:', err);
});

client.login(process.env.DISCORD_TOKEN);

/**
 * @file guild_events.js
 *
 * @brief Handlers for guild events.
 */

const { version } = require('./package.json');
const { log, error } = require('./logger');
const { deleteGuildData } = require('./db');
const { registerCommands } = require('./commands');

/**
 * @brief Message on joining a new Discord server
 * 
 * @param {import('discord.js').Guild} guild
 */
async function onGuildJoin(guild) {
    try {
        log(`Joined guild: ${guild.name} (${guild.id})`);

        await registerCommands(guild.client);

        const me = guild.members.me;
        if (!me) {
            log(`Bot member cache missing for guild ${guild.name} (${guild.id}). Skipping welcome message.`);
            return;
        }

        let channel = guild.systemChannel;

        // Check if we can send messages in the system channel, otherwise find another channel we can send in
        const canSendInChannel = (ch) =>
            ch &&
            ch.isTextBased() &&
            ch.permissionsFor(me)?.has('SendMessages');

        if (!canSendInChannel(channel)) {
            channel = guild.channels.cache.find((ch) => canSendInChannel(ch));
        }

        if (!channel) {
            log(`No channel available to send welcome message in guild ${guild.name} (${guild.id}). Skipping.`);
            return;
        }

        // Welcome message
        const embed = {
            color: 0xfc389d, // Kusuo's hair color :)
            title: 'Ψ Asoubot Ψ',
            description:
                'Thank you for adding Asoubot, the unofficial Asou Shuuichi news bot, to your server!',
            fields: [
                {
                    name: 'Getting Started',
                    value:
                        '• Use **/setup** to configure the bot\n' +
                        '• Use **/info** to see all commands',
                },
            ],
            footer: {
                text: `Ψ Developed by Arcana | Version ${version} Ψ`,
            },
        };

        await channel.send({ embeds: [embed] });

    } catch (err) {
        error('onGuildJoin error:', err);
    }
}

/**
 * @brief When removed from a Discord server, delete all of that server's data from the DB.
 * 
 * @param {import('discord.js').Guild} guild
 */
function onGuildLeave(guild) {
    try {
        log(`Removed from guild: ${guild.name} (${guild.id}). Purging DB data...`);

        deleteGuildData(guild.id);

        log(`DB purge complete for guild ${guild.name}.`);
    } catch (err) {
        error('onGuildLeave error:', err);
    }
}

module.exports = { onGuildJoin, onGuildLeave };

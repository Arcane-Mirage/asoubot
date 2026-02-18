/**
 * @file db.js
 * 
 * @brief Executes all SQL queries.
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { log, error } = require('./logger');

// Ensure data folder exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Create/open database
const db = new Database(path.join(dataDir, 'asoubot.db'));

db.pragma('foreign_keys = ON');

// Create tables if they don't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS guild_config (
        guild_id TEXT PRIMARY KEY,
        post_channel_id TEXT NOT NULL,
        ping_role TEXT NOT NULL DEFAULT 'everyone'
    );

    CREATE TABLE IF NOT EXISTS tracked_account (
        guild_id TEXT NOT NULL,
        username TEXT NOT NULL,
        PRIMARY KEY (guild_id, username),
        FOREIGN KEY (guild_id)
            REFERENCES guild_config(guild_id)
            ON DELETE CASCADE
    );
`);

log("Database initialized.");

/**
 * @brief Inserts or updates the news channel configuration for a Discord server.
 *
 * @param guildId    Discord server ID
 * @param channelId  Discord channel ID
 * 
 * @throws {Error} SQL execution fail
 */
function setGuildNewsChannel(guildId, channelId) {
    const stmt = db.prepare(`
        INSERT INTO guild_config (guild_id, post_channel_id)
        VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET
            post_channel_id = excluded.post_channel_id
    `);
    stmt.run(guildId, channelId);
}

/**
 * @brief Inserts or updates the ping role configuration for a Discord server.
 * 
 * @param guildId   Discord server ID
 * @param pingRole  "everyone" or Discord role ID
 * 
 * @throws {Error} SQL execution fail
 */
function setGuildPingRole(guildId, pingRole) {
    const stmt = db.prepare(`
        INSERT INTO guild_config (guild_id, post_channel_id, ping_role)
        VALUES (?, '', ?)
        ON CONFLICT(guild_id) DO UPDATE SET
            ping_role = excluded.ping_role
    `);
    stmt.run(guildId, pingRole);
}

/**
 * @brief Adds a tracked Twitter account for a Discord server.
 *
 * If the (guildId, username) pair already exists, the operation is ignored.
 *
 * @param guildId    Discord server ID
 * @param channelId  Discord channel ID
 *
 * @returns {boolean} True if a change occured
 * 
 * @throws {Error} SQL execution fail
 */
function addTrackedAccount(guildId, username) {
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO tracked_account (guild_id, username)
        VALUES (?, ?)
    `);
    const info = stmt.run(guildId, username);
    return info.changes > 0; // true if inserted
}

/**
 * @brief Removes a tracked account username for a Discord server.
 *
 * @param guildId   Discord server ID
 * @param username  Twitter Username
 *
 * @returns {boolean} True if a row was removed, false if not found
 */
function removeTrackedAccount(guildId, username) {
    const stmt = db.prepare(`
        DELETE FROM tracked_account
        WHERE guild_id = ? AND username = ?
    `);
    const info = stmt.run(guildId, username);
    return info.changes > 0;
}

/**
 * @brief Lists tracked account usernames for a Discord server.
 *
 * @param guildId   Discord server ID
 *
 * @returns {string[]} Array of usernames for this guild
 */
function listTrackedAccounts(guildId) {
    const stmt = db.prepare(`
        SELECT username FROM tracked_account
        WHERE guild_id = ?
        ORDER BY username COLLATE NOCASE
    `);
    return stmt.all(guildId).map((row) => row.username);
}

/**
 * @brief Retrieves the stored config row for a Discord server.
 *
 * @param {string} guildId Discord server ID
 * 
 * @returns {{guild_id: string, post_channel_id: string}} Config row
 * @retval undefine Does not exist in database
 */
function getGuildConfig(guildId) {
    const stmt = db.prepare(`SELECT * FROM guild_config WHERE guild_id = ?`);
    return stmt.get(guildId);
}

/**
 * @brief Retrieves the configured news post channel ID for a Discord server.
 *
 * @param {string} guildId Discord server ID
 * @returns {string|undefined} Stored post_channel_id, or undefined if not configured
 */
function getGuildNewsChannel(guildId) {
    const row = getGuildConfig(guildId);
    return row ? row.post_channel_id : undefined;
}

/**
 * @brief Retrieves the configured ping role for a Discord server.
 *
 * @param {string} guildId Discord server ID
 * @returns {string|undefined} Stored ping_role ("everyone" or role ID), or undefined if not configured
 */
function getGuildPingRole(guildId) {
    const row = getGuildConfig(guildId);
    return row ? row.ping_role : undefined;
}

/**
 * @brief Delete all stored data for a guild.
 * 
 * @param {string} guildId
 */
function deleteGuildData(guildId) {
    let total = 0;

    total += db.prepare('DELETE FROM guild_config WHERE guild_id = ?').run(guildId).changes;

    return total;
}

module.exports = {
    db,
    setGuildNewsChannel,
    setGuildPingRole,
    addTrackedAccount,
    removeTrackedAccount,
    listTrackedAccounts,
    getGuildConfig,
    getGuildNewsChannel,
    getGuildPingRole,
    deleteGuildData,
};

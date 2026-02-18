/**
 * @file rss.js
 *
 * @brief Poll Nitter RSS to detect new Tweets, then translate to English with DeepL API.
 */

'use strict';

const deepl = require('deepl-node');
const Parser = require('rss-parser');
const { log, error } = require('./logger');

/**
 * Base URL for the Nitter instance used for RSS polling.
 *
 * The RSS feed URL is constructed as: `${NITTER_BASE}/{username}/rss`.
 *
 * @constant {string} NITTER_BASE
 */
const NITTER_BASE = process.env.NITTER_BASE;

const parser = new Parser();

/**
 * @typedef {Object} RssTweet
 * @property {string} username Twitter/X username (no @)
 * @property {string} url Canonical tweet URL
 * @property {string} originalText Original-language tweet text
 * @property {string} englishText English translation (or same text if no translation performed)
 * @property {Date|null} publishedAt Tweet timestamp if available
 */

const deeplAuthKey = process.env.DEEPL_AUTH_KEY || '';
const deeplTranslator = deeplAuthKey ? new deepl.Translator(deeplAuthKey) : null;

/** @type {Map<string,string|null>} */
const g_lastSeenTweetIdByUser = new Map();

/**
 * @brief Build a Nitter RSS feed URL for a username.
 *
 * @param {string} username
 * @returns {string}
 */
function buildNitterRssUrl(username) {
    const base = (NITTER_BASE || '').replace(/\/+$/, '');
    return `${base}/${encodeURIComponent(username)}/rss`;
}

/**
 * @brief Extract original tweet text from a Nitter RSS item title.
 *
 * Nitter item.title commonly looks like:
 *   "User Name (@handle): tweet text here"
 *
 * @param {any} item
 * @returns {string}
 */
function extractOriginalText(item) {
    const title = (item && typeof item.title === 'string') ? item.title.trim() : '';
    if (!title) return '';

    const idx = title.indexOf('): ');
    if (idx !== -1) return title.slice(idx + 3).trim();

    const idx2 = title.indexOf(': ');
    if (idx2 !== -1) return title.slice(idx2 + 2).trim();

    return title;
}

/**
 * @brief Extract tweet ID from a URL containing "/status/<digits>".
 *
 * @param {string} link
 * @returns {string|null}
 */
function extractTweetIdFromLink(link) {
    if (!link || typeof link !== 'string') return null;
    const match = link.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
}

/**
 * @brief Choose the "latest" RSS item by numerically largest status ID.
 *
 * @param {any[]} items
 * @returns {{ item: any, id: string }|null}
 */
function pickLatestByStatusId(items) {
    let bestItem = null;
    let bestId = null;

    for (const it of (items || [])) {
        const id = extractTweetIdFromLink(it?.link);
        if (!id) continue;

        if (!bestId || BigInt(id) > BigInt(bestId)) {
            bestId = id;
            bestItem = it;
        }
    }

    if (!bestItem || !bestId) return null;
    return { item: bestItem, id: bestId };
}

/**
 * @brief Translate text to English using DeepL (single consolidated function).
 *
 * @param {string} originalText
 * @returns {Promise<string>}
 */
async function translateToEnglish(originalText) {
    const text = (originalText || '').trim();

    if (!text) return '';
    if (/^https?:\/\/\S+$/i.test(text)) return text;

    if (!deeplTranslator) {
        log('[DEEPL] DEEPL_AUTH_KEY missing; returning original text without translation.');
        return text;
    }

    try {
        const result = await deeplTranslator.translateText(text, null, 'en-US');
        return result?.text ? result.text : '';
    } catch (err) {
        error('[DEEPL] translateText failed; returning original text:', err);
        return text;
    }
}

/**
 * @brief Fetch the latest tweet from a single Nitter RSS feed.
 *
 * @param {string} username
 * @returns {Promise<{ username: string, id: string, url: string, originalText: string, publishedAt: Date|null }|null>}
 */
async function fetchLatestTweet(username) {
    const url = buildNitterRssUrl(username);
    log(`[RSS] fetching @${username} url=${url}`);

    const feed = await parser.parseURL(url);
    const items = Array.isArray(feed?.items) ? feed.items : [];
    if (items.length === 0) return null;

    const picked = pickLatestByStatusId(items);
    if (!picked) return null;

    const originalText = extractOriginalText(picked.item);

    let publishedAt = null;
    const rawDate = picked.item?.isoDate || picked.item?.pubDate || null;
    if (rawDate) {
        const d = new Date(rawDate);
        publishedAt = Number.isNaN(d.getTime()) ? null : d;
    }

    return {
        username,
        id: picked.id,
        url: `https://x.com/${username}/status/${picked.id}`,
        originalText,
        publishedAt,
    };
}

/**
 * @brief Prime last-seen tweet IDs for a set of usernames.
 *
 * @param {string[]} usernames
 * @returns {Promise<void>}
 */
async function primeLastSeen(usernames) {
    for (const u of (usernames || [])) {
        try {
            const latest = await fetchLatestTweet(u);
            g_lastSeenTweetIdByUser.set(u, latest ? latest.id : null);
        } catch (err) {
            error(`[RSS] prime failed for @${u}:`, err);
            g_lastSeenTweetIdByUser.set(u, null);
        }
    }
}

/**
 * @brief Poll all usernames once, return the newest unseen tweet (across all users).
 *
 * @param {string[]} usernames
 * @returns {Promise<({ username: string, id: string, url: string, originalText: string, englishText: string, publishedAt: Date|null })|null>}
 */
async function pollOnce(usernames) {
    let best = null;

    for (const u of (usernames || [])) {
        let latest = null;

        try {
            latest = await fetchLatestTweet(u);
        } catch (err) {
            error(`[RSS] fetchLatestTweet failed for @${u}:`, err);
            continue;
        }

        if (!latest || !latest.originalText) continue;

        const lastId = g_lastSeenTweetIdByUser.get(u) || null;
        if (latest.id === lastId) continue;

        g_lastSeenTweetIdByUser.set(u, latest.id);

        if (!best || BigInt(latest.id) > BigInt(best.id)) {
            best = latest;
        }
    }

    if (!best) return null;

    const englishText = await translateToEnglish(best.originalText);

    return {
        username: best.username,
        id: best.id,
        url: best.url,
        originalText: best.originalText,
        englishText,
        publishedAt: best.publishedAt,
    };
}

/**
 * @brief Start the RSS polling loop.
 *
 * @param {Object} opts
 * @param {import('discord.js').Client} opts.client
 * @param {number} [opts.intervalMs=60000]
 * @param {() => Promise<{ guildMap: Map<string,string[]>, allUsernames: string[] }>} opts.getGuildState
 * @param {(guildId: string, tweet: RssTweet) => Promise<void>} opts.notifyGuild
 * @returns {NodeJS.Timeout}
 */
function startRssLoop(opts) {
    const { client, intervalMs = 60_000, getGuildState, notifyGuild } = opts || {};

    if (!client) throw new Error('startRssLoop: opts.client is required');
    if (!getGuildState) throw new Error('startRssLoop: opts.getGuildState is required');
    if (!notifyGuild) throw new Error('startRssLoop: opts.notifyGuild is required');

    log(`RSS loop started. interval=${intervalMs}ms nitterBase=${NITTER_BASE}`);

    (async () => {
        try {
            const state = await getGuildState();
            await primeLastSeen(state.allUsernames);
        } catch (err) {
            error('[RSS] initial primeLastSeen failed:', err);
        }
    })();

    return setInterval(async () => {
        try {
            const state = await getGuildState();
            const tweet = await pollOnce(state.allUsernames);
            if (!tweet) return;

            for (const [guildId, list] of state.guildMap) {
                if ((list || []).includes(tweet.username)) {
                    await notifyGuild(guildId, tweet);
                }
            }
        } catch (err) {
            error('[RSS] polling tick failed:', err);
        }
    }, intervalMs);
}

module.exports = {
    startRssLoop,
    fetchLatestTweet,
    translateToEnglish,
    NITTER_BASE,
};

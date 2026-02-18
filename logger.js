/**
 * @file logger.js
 * 
 * @brief Format Asoubot console messages/errors and append to log file.
 */

const fs = require('fs');
const path = require('path');
const { version } = require('./package.json');

const BOT_NAME = 'Asoubot';
const LOG_FILE = path.join(__dirname, 'asoubot.log');

/**
 * Format messages for console and append to log file.
 *
 * @param {string} message Message
 */
function log(message) {

  // Format log
  const time = new Date().toISOString();
  const formatted = `[${BOT_NAME}] [v${version}] [${time}] ${message}`;

  // Console logs
  console.log(formatted);

  // Append to file
  fs.appendFile(LOG_FILE, formatted + '\n', (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
    }
  });
}

/**
 * Format error messages for console and append to log file.
 *
 * @param {string} message Message
 */
function error(message) {

  // Format log
  const time = new Date().toISOString();
  const formatted = `[${BOT_NAME}] [v${version}] [${time}] ${message}`;

  // Console output
  console.error(formatted);

  // Append to logs
  fs.appendFile(LOG_FILE, formatted + '\n', (err) => {
    if (err) {
      error('Failed to write to log file.');
    }
  });
}

module.exports = { log, error };

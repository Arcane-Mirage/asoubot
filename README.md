# Asoubot

Asoubot is a Discord bot that monitors Twitter/X accounts via RSS and automatically translates new posts to English using the DeepL API before sending them to a set Discord channel.

This bot was originally built to track Asou Shuuichi, but the bot supports tracking multiple accounts per individual server configuration.

---

## Commands

- `/setup` — Set the news channel and ping role  
- `/setchannel` — Change the news channel  
- `/setpingrole` — Change the ping role  
- `/addaccount` — Add a Twitter/X account to track  
- `/removeaccount` — Remove a tracked account  
- `/listaccounts` — View tracked accounts  
- `/info` — Display bot information  

---

## Dependencies

- Node.js
- discord.js
- SQLite
- rss-parser
- deepl-node
- dotenv

---

## APIs Used

- Discord API
- Nitter RSS feeds
- DeepL API
  
---

## Installation

### 1. Requirements

- Node.js 18+ recommended
- npm
- pm2 recommended
- Nitter instance (self-hosted or public)
- A Discord Bot Token
- A DeepL API key

---

### 2. Clone the repository

```bash
git clone https://github.com/Arcane-Mirage/asoubot.git
cd asoubot
```

---

### 3. Install dependencies

```bash
npm install
```

---

### 4. Create a `.env` file

In the root of the project, create a file named:

```
.env
```

Add the following:

```
DISCORD_TOKEN=
DEEPL_AUTH_KEY=
NITTER_BASE=
```

Fill in:

- `DISCORD_TOKEN` = Your Discord Bot Token (from the Discord Developer Portal)
- `DEEPL_AUTH_KEY` = Your DeepL API Authentication Key
- `NITTER_BASE` = Nitter Base URL (ex: http://localhost:8080 or https://nitter.net)

---

## Running the Bot

### Development

For local development, run:

```bash
npm run dev
```

---

### Production

For production deployments, use PM2 to keep the bot running and automatically restart it if it crashes.

Start the bot:

```bash
pm2 start index.js --name asoubot
```

Stop the bot:

```bash
pm2 stop asoubot
```

View logs:

```bash
pm2 logs asoubot
```

Enable auto-start on server reboot:

```bash
pm2 save
pm2 startup
```

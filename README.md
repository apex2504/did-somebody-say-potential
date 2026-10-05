# Megumi bot and API

[<img width="1024" height="741" alt="Click here to add the Discord bot" src="https://github.com/user-attachments/assets/c4fad1db-a27b-4fb8-8a8d-d29800833f45"/>](https://apex.moe/megumi)


A Discord bot architecture for generating Megumi text meme images:
- **Cloudflare Worker (Edge Gateway)**: Minimal TypeScript worker designed to be run Cloudflare Workers that verifies Discord HTTP interactions, immediately defers the interaction, and offloads image generation to the backend.
- **Python image generation backend**: Image generation backend using PIL intended to match the style from https://github.com/apollosense/megumi-meme-generator/.


## Features

- **HTTP Interactions**: Serverless Discord interactions handling on Cloudflare Workers.
- **User-Installable and Server-Installable**: Supports adding directly to user accounts as well as servers.
Add it to your user account to use the bot everywhere, even in DMs and servers where the bot has not been added.
- **Accessibility**: Adds sanitised alt text to the image so people with screen readers can join the fun.
- **Styling**:
  - Font: **TikTok Sans** 900 Bold
  - Bottom row is larger, upper rows are shrunk by 50%
  - Neon blue glow (`#0033FF`)
  - Deep-blue boundary stroke (`#0033FF`)
  - Gradient fill: `#eaf4ff` to `#73B5FF`
  - Uppercase by default
  - Baseline aligned at 90% height, 4.5% left margin
- **Customisation Options**: Supports `size`, `wrap`, `glow_intensity`, `uppercase`, `colour`, and `glow_colour`.


## Project Structure

```
├── python/                   # Python rendering backend (Pillow)
│   ├── render.py             # Standalone Pillow rendering module
│   ├── requirements.txt      # pillow>=10.0.0
│   ├── image.png             # Base Megumi meme image
│   ├── TikTokSans-900.ttf    # TikTok Sans 900 font
│   └── README.md             # Python API documentation
├── src/                      # Cloudflare Worker frontend (TypeScript)
│   ├── index.ts              # Edge interaction gateway & Discord webhook updater
│   └── types.ts              # TypeScript interfaces
├── scripts/
│   └── register.js           # CLI script to register /megumi with Discord API
├── wrangler.toml             # Cloudflare Workers configuration
├── package.json              # Worker dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── .env.example              # Example environment variables
```

## Setup

This assumes you want to set up both the Discord bot side and the backend side the same
way I have done.

If you don't want the Discord bot, you can skip the steps related to Discord and Cloudflare Workers.

### 1. Prerequisites

- [Python](https://python.org/) with `pillow` on your server.

If you want the Discord bot side, you'll also need the following:
- [Node.js](https://nodejs.org/) v18 or later.
- A [Cloudflare](https://dash.cloudflare.com/) account.
- A [Discord](https://discord.com/developers/applications).

For this, the bot side is hosted on Cloudflare workers and Python backend on your existing infra, but it should be easy enough to integrate into your existing setup.

### 2. Set up the Discord bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and give it a name.
3. Under **General Information**:
   - Copy the **Application ID**.
   - Copy the **Public Key** (used to verify incoming interaction requests).
4. Go to **Bot** on the left menu:
   - Click **Reset Token** and copy the **Bot Token** (used to register the slash command).
5. Go to **Installation**:
   - Enable **User Install** and **Guild Install**.
   - Under **Default Install Settings**, select `applications.commands` scope.
6. Under **OAuth2 -> URL Generator**:
   - Select `applications.commands` and `bot`.
   - Under **Bot Permissions**, select `Send Messages` and `Attach Files`.
   - Copy the generated URL to invite the bot to your server or user.

### 3. Set up the Python REST API

1. Navigate to the `python/` directory on your server:
   ```bash
   cd python
   pip install -r requirements.txt
   ```
2. Integrate [`python/render.py`](python/render.py) into your web framework of choice (FastAPI, Flask, etc.).

   **FastAPI Example**:
   ```python
   from fastapi import FastAPI, Response
   from pydantic import BaseModel
   from typing import Optional
   from render import render_megumi

   app = FastAPI()

   class MegumiRequest(BaseModel):
       text: str = "HELL YEAH"
       size: Optional[float] = 11.0
       wrap: Optional[bool] = True
       glow_intensity: Optional[float] = 100.0
       shrink: Optional[bool] = True
       uppercase: Optional[bool] = True
       colour: Optional[str] = "#73B5FF"
       glow_colour: Optional[str] = "#0033FF"

   @app.post("/megumi")
   def generate_megumi(req: MegumiRequest):
       png_bytes = render_megumi(
           text=req.text,
           size=req.size or 11.0,
           wrap=req.wrap if req.wrap is not None else True,
           glow_intensity=req.glow_intensity if req.glow_intensity is not None else 100.0,
           shrink=req.shrink if req.shrink is not None else True,
           uppercase=req.uppercase if req.uppercase is not None else True,
           color=req.colour or "#73B5FF",
           glow_color=req.glow_colour or "#0033FF",
       )
       return Response(content=png_bytes, media_type="image/png")
   ```

3. Note your public endpoint URL (e.g. `https://api.yourdomain.com/megumi`).

### 3.5. or use the public instance

Use https://apex.moe/api/megumi as the URL.

Check out (the backend README)[/python/README.md] for usage.

### 4. Set up the Cloudflare Worker for the bot

1. Install worker dependencies:
   ```bash
   npm install
   ```

2. Set your Cloudflare Worker secrets:
   ```bash
   # Set your Discord Public Key from Developer Portal
   npx wrangler secret put DISCORD_PUBLIC_KEY

   # Set the public URL to your Python API
   npx wrangler secret put RENDER_API_URL

   # Optional: set API key if your Python API requires authentication
   # The public instance does not require authentication
   # npx wrangler secret put RENDER_API_KEY
   ```

3. Deploy the worker to Cloudflare:
   ```bash
   npm run deploy
   ```
   Wrangler will output your live URL (e.g. `https://megumi-bot.<your-subdomain>.workers.dev`).

4. In the [Discord Developer Portal](https://discord.com/developers/applications):
   - Navigate to your application -> **General Information**.
   - Set **Interactions Endpoint URL** to your Cloudflare Worker URL.
   - Click **Save Changes**. Discord will send a ping interaction to verify your endpoint.

### 5. Register the `/megumi` Slash Command

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Fill in `DISCORD_APPLICATION_ID` and `DISCORD_BOT_TOKEN` in `.env`.
   *(Optionally specify `DISCORD_GUILD_ID` to make it only available in that guild)*.
3. Run the registration script:
   ```bash
   npm run register
   ```

### 6. Test in Discord

In any channel or DM where the bot is available:
```
/megumi text: HELL YEAH
```
Or multi-line:
```
/megumi text: DID YOU SAY\nPOTENTIAL
```
*Shift+Enter may also work instead of \n on newer versions of the Discord app*

The bot will defer immediately (*"Megumi is thinking..."*), fetch the generated image from your Python API, and reply with the generated image and alt text.


## Slash Command options

| Option | Type | Required | Description | Default |
|---|---|---|---|---|
| `text` | String | **Yes** | Text to overlay. Use `\n` or Shift+Enter for multiple lines. | *(None)* |
| `size` | Integer | No | Base font size percentage (min: 4, max: 24). | `11` |
| `wrap` | Boolean | No | Whether to wrap text to fit within the image. | `True` |
| `uppercase` | Boolean | No | Convert text to uppercase. | `True` |
| `colour` | String | No | Hex color code for the text. | `#73B5FF` |
| `glow_intensity` | Integer | No | Glow intensity percentage (min: 0, max: 200). | `100` |
| `glow_colour` | String | No | Hex color code for the neon glow. | `#0033FF` |


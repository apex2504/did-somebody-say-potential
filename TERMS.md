# Terms of Service

**Last Updated:** October 2026

Welcome to **Megumi Bot** ("the Bot", "we", "us", or "our"). By adding the Bot to your Discord server, installing it to your user account, or using any of its commands (such as `/megumi`), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Bot.

---
### 1. Description of Service
Megumi Bot is a Discord application powered by a serverless Cloudflare Worker gateway and an image-rendering backend. Its primary function is to generate stylized meme images based on user-provided text inputs.
### 2. Acceptable Use
You agree to use the Bot in compliance with all applicable laws and Discord's own terms and guidelines. You may NOT use the Bot to generate, transmit, or promote:
- Content that violates the [Discord Terms of Service](https://discord.com/terms) or [Discord Community Guidelines](https://discord.com/guidelines).
- Hate speech, harassment, defamation, threats, or illegal content.
- Content designed to spam or disrupt Discord channels or services.
We reserve the right to block or restrict any user or server from interacting with the Bot at our discretion if these Terms are violated.
### 3. Intellectual Property & User Content
- You retain any rights you have in the text input you provide.
- You grant us a temporary, non-exclusive license to process your input solely for generating and returning the requested image to Discord.
- The base imagery and fonts used by the Bot belong to their respective copyright and trademark owners. The Bot is provided for transformative entertainment and parody purposes.
### 4. Availability & Disclaimers
- The Bot is provided on an **"AS IS"** and **"AS AVAILABLE"** basis without warranties of any kind.
- We do not guarantee uninterrupted uptime, bug-free operation, or perpetual availability. We may modify, restart, or discontinue the Bot at any time without prior notice.
### 5. Limitation of Liability
To the maximum extent permitted by applicable law, the Bot developers and operators shall not be liable for any indirect, incidental, punitive, or consequential damages resulting from your use or inability to use the service.
### 6. Changes to Terms
We may revise these Terms occasionally. Continued use of the Bot after changes are published constitutes your acceptance of the updated Terms.
### 7. Contact
For questions or concerns regarding these Terms, please create an issue on this GitHub repository.

---

# Privacy Policy

**Last Updated:** October 2026

This Privacy Policy explains how **Megumi Bot** ("the Bot", "we", "us", or "our") handles information when you interact with the application via Discord.

We believe in minimal data footprint: **we do not collect, sell, or persistently store your personal data.**

---

### 1. What Data We Process
When you trigger an interaction (e.g., `/megumi`):
- **Command Input**: The text and customization parameters (such as `size`, `glow`, `color`) provided in the slash command.
- **Discord Interaction Metadata**: Ephemeral metadata provided automatically by Discord's HTTP interaction payload (such as Discord User ID, Guild ID, or Channel ID) used to authenticate the request and deliver the response.

### 2. How Your Data Is Used
- **Image Generation**: The command input parameters are transmitted securely via HTTPS from our Cloudflare Worker to our image rendering API to generate your requested image.
- **Delivering Results**: The generated image is uploaded back to Discord using Discord's interaction webhook callback.

### 3. Data Storage & Retention
- **No Persistent Storage**: We do **not** store your text prompts, Discord user IDs, usernames, or server information in any database.
- **In-Memory Only**: Image generation and text processing occur purely in-memory. Once the image is generated and handed off to Discord, the data is immediately discarded.
- **Logs**: Ephemeral standard server logs (such as HTTP status codes and error traces) may be retained temporarily by Cloudflare or our hosting provider for debugging and security diagnostics, and are automatically purged.

### 4. Third-Party Services
The Bot relies on the following infrastructure providers:
- **Discord API**: Transmits interaction requests and displays responses under [Discord's Privacy Policy](https://discord.com/privacy).
- **Cloudflare Workers**: Verifies interaction cryptographic signatures and handles gateway routing under [Cloudflare's Privacy Policy](https://www.cloudflare.com/privacypolicy/).

We do not sell, trade, or share your data with advertisers or any other third parties.

### 5. Data Deletion & Rights
Because we do not store personal data or maintain user profiles, there is no personal data to view, export, or delete from our systems.

### 6. Updates to This Policy
We may update this Privacy Policy to reflect technical or legal changes. Updates will be reflected by modifying the "Last Updated" date at the top of this document.

### 7. Contact
If you have questions or concerns regarding this Privacy Policy, please contact the bot maintainer through the project's GitHub repository or via Discord.

---

# API instance
We maintain a public API for image generation.

By using the public API in your own applications, you agree to these same terms and privacy notices, except those regarding any third-party services.

Additionally, when using the public API, we may store your IP Address and request details (URL, text input) for up to 14 days for the purpose of abuse prevention.
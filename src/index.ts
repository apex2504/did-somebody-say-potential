import {
  InteractionType,
  InteractionResponseType,
  verifyKey,
} from 'discord-interactions';
import { Env, DiscordInteraction } from './types';

/**
 * Sanitizes user input for use as image alt text (Discord attachment description).
 * Removes real and escaped newlines, collapses whitespace, and limits to 1024 characters.
 */
export function sanitizeAltText(rawText: string): string {
  if (!rawText) return 'Megumi meme';
  const sanitized = rawText
    .replace(/\\r\\n|\\n|\\r/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return sanitized.slice(0, 1024) || 'Megumi meme';
}

/**
 * Background worker task: calls the Python REST API to render the image
 * and edits the deferred interaction message via Discord's webhook.
 */
async function handleMegumiCommand(interaction: DiscordInteraction, env: Env) {
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const webhookUrl = `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`;

  try {
    if (!env.RENDER_API_URL) {
      throw new Error(
        'RENDER_API_URL is not configured! Please set your API URL via `npx wrangler secret put RENDER_API_URL`.'
      );
    }

    const options = interaction.data?.options || [];
    const textOption = options.find((opt) => opt.name === 'text');
    const sizeOption = options.find((opt) => opt.name === 'size');
    const glowOption = options.find((opt) => opt.name === 'glow_intensity');
    const wrapOption = options.find((opt) => opt.name === 'wrap');
    const upperOption = options.find((opt) => opt.name === 'uppercase');
    const colorOption = options.find((opt) => opt.name === 'colour');
    const glowColorOption = options.find((opt) => opt.name === 'glow_colour');

    const text = (textOption?.value as string) || 'HELL YEAH';
    const altText = sanitizeAltText(text);

    console.log(`Requesting image from backend: ${env.RENDER_API_URL}`);
    const startTime = Date.now();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (env.RENDER_API_KEY) {
      headers['Authorization'] = `Bearer ${env.RENDER_API_KEY}`;
    }

    const apiResponse = await fetch(env.RENDER_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text,
        size: typeof sizeOption?.value === 'number' ? sizeOption.value : 11,
        wrap: typeof wrapOption?.value === 'boolean' ? wrapOption.value : true,
        uppercase: typeof upperOption?.value === 'boolean' ? upperOption.value : true,
        colour: typeof colorOption?.value === 'string' ? colorOption.value : '#73B5FF',
        glow_intensity: typeof glowOption?.value === 'number' ? glowOption.value : 100,
        glow_colour: typeof glowColorOption?.value === 'string' ? glowColorOption.value : '#0033FF',
      }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`API returned HTTP ${apiResponse.status}: ${errorText}`);
    }

    const pngBytes = new Uint8Array(await apiResponse.arrayBuffer());
    console.log(`Received ${pngBytes.byteLength} bytes from backend in ${Date.now() - startTime}ms`);

    // Prepare multipart form data for Discord webhook PATCH
    const formData = new FormData();
    formData.append(
      'payload_json',
      JSON.stringify({
        attachments: [
          {
            id: 0,
            filename: 'megumi.png',
            description: altText,
          },
        ],
      })
    );
    formData.append(
      'files[0]',
      new Blob([pngBytes], { type: 'image/png' }),
      'megumi.png'
    );

    console.log('Updating Discord interaction with image...');
    const patchResponse = await fetch(webhookUrl, {
      method: 'PATCH',
      body: formData,
    });

    if (!patchResponse.ok) {
      const errText = await patchResponse.text();
      console.error(`Discord webhook PATCH failed (${patchResponse.status}):`, errText);
    } else {
      console.log('Successfully posted image to Discord!');
    }
  } catch (error) {
    const errMessage = (error as Error).message || String(error);
    console.error('Error rendering image or updating interaction:', error);

    try {
      await fetch(webhookUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `❌ **Error:** ${errMessage}`,
        }),
      });
    } catch (followupErr) {
      console.error('Failed to send error message to Discord:', followupErr);
    }
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Only accept POST requests for Discord interactions
    if (request.method === 'GET') {
      return new Response(
        'Bot is online. Point your Discord Interactions Endpoint URL to this worker.',
        {
          status: 200,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }
      );
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Verify interaction security headers.
    // Never bothered to look into how to do this before. I am lazy. Cheers AI.
    const signature = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');

    if (!signature || !timestamp) {
      console.warn('Missing x-signature-ed25519 or x-signature-timestamp headers');
      return new Response('Missing request signature headers', { status: 401 });
    }

    if (!env.DISCORD_PUBLIC_KEY) {
      console.error(
        'DISCORD_PUBLIC_KEY is not defined in Cloudflare Worker environment!\n' +
        'Run: npx wrangler secret put DISCORD_PUBLIC_KEY'
      );
      return new Response(
        'Worker configuration error: DISCORD_PUBLIC_KEY is missing. Check worker logs via `wrangler tail`.',
        { status: 500 }
      );
    }

    const rawBody = await request.text();

    const isValidRequest = await verifyKey(
      rawBody,
      signature,
      timestamp,
      env.DISCORD_PUBLIC_KEY
    );

    if (!isValidRequest) {
      console.warn('Invalid signature for interaction request. Verify DISCORD_PUBLIC_KEY is correct.');
      return new Response('Invalid request signature', { status: 401 });
    }

    let interaction: DiscordInteraction;
    try {
      interaction = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error('Failed to parse request body as JSON:', parseErr);
      return new Response('Malformed JSON', { status: 400 });
    }

    // 1. Handle Discord ping (Type 1)
    if (interaction.type === InteractionType.PING) {
      console.log('Received PING from Discord. Responding with PONG.');
      return new Response(
        JSON.stringify({ type: InteractionResponseType.PONG }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Handle application command (Type 2, e.g. /megumi)
    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      const commandName = interaction.data?.name;
      console.log(`Received command: /${commandName}`);

      if (commandName === 'megumi') {
        // Acknowledge immediately with DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE (Type 5).
        // This responds in <10ms and shows "Bot is thinking...".
        // The backend should be fast enough to render it without deferring,
        // but we're being safe.
        ctx.waitUntil(handleMegumiCommand(interaction, env));

        return new Response(
          JSON.stringify({
            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Unknown command: ${commandName}`,
            flags: 64,
          },
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.warn(`Unhandled interaction type: ${interaction.type}`);
    return new Response('Unhandled interaction type', { status: 400 });
  },
};


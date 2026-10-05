export interface Env {
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APPLICATION_ID?: string;
  DISCORD_BOT_TOKEN?: string;
  RENDER_API_URL?: string;
  RENDER_API_KEY?: string;
}

export interface MegumiRenderOptions {
  text: string;
  size?: number;      // Default: 11
  wrap?: boolean;    // Default: true
  glow_intensity?: number;      // Default: 100
  shrink?: boolean;   // Default: true (shrink lines above the last line)
  uppercase?: boolean;// Default: true
  c1?: string;        // Default: #73B5FF (text color)
  c2?: string;        // Default: #0033FF (glow color)
  x?: number;         // Default: 0.045
  y?: number;         // Default: 0.9
}

export interface DiscordInteractionOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: DiscordInteractionOption[];
}

export interface DiscordInteractionData {
  id: string;
  name: string;
  type: number;
  options?: DiscordInteractionOption[];
}

export interface DiscordInteraction {
  id: string;
  application_id: string;
  type: number;
  data?: DiscordInteractionData;
  guild_id?: string;
  channel_id?: string;
  token: string;
  version: number;
}


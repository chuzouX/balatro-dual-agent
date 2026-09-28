import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  typesafeApiKey: process.env.TYPESAFE_API_KEY || '',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',

  balatroHost: process.env.BALATRO_HOST || '127.0.0.1',
  balatroPort: parseInt(process.env.BALATRO_PORT || '12346', 10),
  balatroExe: process.env.BALATRO_EXE || 'E:\\Games\\Balatro\\Balatro.exe',

  autoLaunchGame: process.env.AUTO_LAUNCH_GAME !== 'false',
  headless: process.env.HEADLESS === 'true',
  stepDelayMs: parseInt(process.env.STEP_DELAY_MS || '300', 10),

  // Network Proxy Routing
  jevProxyUrl: process.env.JEV_PROXY_URL || process.env.JEV_PROXY || '',
  deepseekDirect: process.env.DEEPSEEK_DIRECT !== 'false',
};

export function validateConfig() {
  if (!config.typesafeApiKey || config.typesafeApiKey === 'your_typesafe_api_key_here') {
    console.warn('[Config Warning] TYPESAFE_API_KEY is not set or using placeholder.');
  }
}

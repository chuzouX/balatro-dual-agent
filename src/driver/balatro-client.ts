import { config } from '../config.js';
import { GameState } from '../types.js';
import { exec, spawn } from 'child_process';
import util from 'util';
import pc from 'picocolors';

const execAsync = util.promisify(exec);

export class BalatroClient {
  private baseUrl: string;
  private requestId = 0;

  constructor(host = config.balatroHost, port = config.balatroPort) {
    this.baseUrl = `http://${host}:${port}`;
  }

  private async call<T = any>(method: string, params: Record<string, any> = {}): Promise<T> {
    this.requestId++;
    const payload = {
      jsonrpc: '2.0',
      method,
      params,
      id: this.requestId,
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Balatro HTTP error ${response.status}: ${response.statusText}`);
    }

    const data: any = await response.json();
    if (data.error) {
      throw new Error(`Balatro JSON-RPC Error [${method}]: ${data.error.message || JSON.stringify(data.error)}`);
    }

    return data.result as T;
  }

  async health(): Promise<boolean> {
    try {
      const res = await this.call('health');
      return res?.status === 'ok';
    } catch {
      return false;
    }
  }

  async getGameState(): Promise<GameState> {
    return await this.call<GameState>('gamestate');
  }

  async returnToMenu(): Promise<GameState> {
    return await this.call<GameState>('menu');
  }

  async startRun(deck = 'RED', stake = 'WHITE', seed?: string): Promise<GameState> {
    const params: any = { deck, stake };
    if (seed) params.seed = seed;
    return await this.call<GameState>('start', params);
  }

  async selectBlind(): Promise<GameState> {
    return await this.call<GameState>('select');
  }

  async skipBlind(): Promise<GameState> {
    return await this.call<GameState>('skip');
  }

  async playCards(cardIndices: number[]): Promise<GameState> {
    return await this.call<GameState>('play', { cards: cardIndices });
  }

  async discardCards(cardIndices: number[]): Promise<GameState> {
    return await this.call<GameState>('discard', { cards: cardIndices });
  }

  async cashOut(): Promise<GameState> {
    return await this.call<GameState>('cash_out');
  }

  async buy(params: { card?: number; pack?: number; voucher?: number } | number): Promise<GameState> {
    const payload = typeof params === 'number' ? { card: params } : params;
    return await this.call<GameState>('buy', payload);
  }

  async reroll(): Promise<GameState> {
    return await this.call<GameState>('reroll');
  }

  async nextRound(): Promise<GameState> {
    return await this.call<GameState>('next_round');
  }

  async use(consumableIndex: number, targetCards?: number[]): Promise<GameState> {
    const params: any = { consumable: consumableIndex };
    if (targetCards && targetCards.length > 0) {
      params.cards = targetCards;
    }
    return await this.call<GameState>('use', params);
  }

  async sell(params: { joker?: number; consumable?: number } | number): Promise<GameState> {
    const payload = typeof params === 'number' ? { joker: params } : params;
    return await this.call<GameState>('sell', payload);
  }

  async sellJoker(jokerIndex: number): Promise<GameState> {
    return await this.call<GameState>('sell', { joker: jokerIndex });
  }

  async sellConsumable(consumableIndex: number): Promise<GameState> {
    return await this.call<GameState>('sell', { consumable: consumableIndex });
  }

  async selectPackCard(cardIndex = 0, targets?: number[]): Promise<GameState> {
    const params: any = { card: cardIndex };
    if (targets && targets.length > 0) {
      params.targets = targets;
    }
    return await this.call<GameState>('pack', params);
  }

  async skipPack(): Promise<GameState> {
    return await this.call<GameState>('pack', { skip: true });
  }

  async rearrangeJokers(newOrder: number[]): Promise<GameState> {
    return await this.call<GameState>('rearrange', { jokers: newOrder });
  }

  async rearrangeHand(newOrder: number[]): Promise<GameState> {
    return await this.call<GameState>('rearrange', { hand: newOrder });
  }

  async takeScreenshot(targetPath: string): Promise<string> {
    const formatted = targetPath.replace(/\\/g, '/');
    const res = await this.call<{ path: string; success: boolean }>('screenshot', { path: formatted });
    return res.path;
  }

  /**
   * Ensure Balatro is launched and reachable
   */
  async ensureReady(maxRetries = 25): Promise<boolean> {
    const online = await this.health();
    if (online) {
      return true;
    }

    if (!config.autoLaunchGame) {
      return false;
    }

    console.log(pc.cyan(`[Driver] Balatro is not running. Launching from: ${config.balatroExe}...`));
    
    // Launch via PowerShell Start-Process detached
    const psCmd = `powershell -Command "$env:BALATROBOT_HOST='${config.balatroHost}'; $env:BALATROBOT_PORT='${config.balatroPort}'; $env:BALATROBOT_DEBUG='1'; Start-Process -FilePath '${config.balatroExe}' -WorkingDirectory '${config.balatroExe.substring(0, config.balatroExe.lastIndexOf('\\'))}'"`;
    try {
      await execAsync(psCmd);
    } catch (e: any) {
      console.warn(pc.yellow(`[Driver] Start-Process error: ${e.message}`));
    }

    // Wait for health check
    for (let i = 0; i < maxRetries; i++) {
      await new Promise(r => setTimeout(r, 1000));
      if (await this.health()) {
        console.log(pc.green(`[Driver] Connected to Balatro on ${this.baseUrl} successfully!`));
        return true;
      }
    }

    return false;
  }
}

import {Page, Browser, launch} from 'puppeteer';
import {Config} from '../config/config';
import {Subject} from 'rxjs';

export type Candle = {
  active_id: number;
  size: number;
  at: number;
  from: number;
  to: number;
  id: number;
  open: number;
  close: number;
  min: number;
  max: number;
  ask: number;
  bid: number;
  volume: number;
  phase: string;
};

enum SuppportedMessages {
  CANDLE_GENERATED = 'candle-generated',
  INITIALIZATION_DATA = 'initialization-data',
  FIRST_CANDLES = 'first-candles',
  GET_CANDLES = 'get-candles',
  CANDLES = 'candles',
}

export class Client {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private actives = new Map<number, {name: string; requestId: string}>();
  public isRunning = false;
  public candles = new Subject<{
    topic: string;
    active: string;
    candles: Candle[];
  }>();
  public updates = new Subject<{
    topic: string;
    active: string;
    candle: Candle;
  }>();

  constructor() {
    console.log('Client constructor');
  }

  async setupWebSocketListening(page: Page) {
    if (!page) {
      throw new Error('[setupWebSocketListening] Page is null!');
    }
    const client = await page.createCDPSession();
    await client.send('Network.enable');

    const fs = require('fs');
    // Manipular mensagens de WebSocket
    client.on('Network.webSocketFrameReceived', (event: any) => {
      const data = JSON.parse(event.response.payloadData);
      const msg = data.msg;
      const name = data.name;
      const requestId = data.request_id;
      // candle-generated
      switch (name) {
        case SuppportedMessages.CANDLE_GENERATED:
          const active = this.actives.get(data.msg.active_id);
          if (!active) {
            console.error('Active not found:', data.msg.active_id);
            return;
          }
          const obj = {
            topic: name,
            active: active.name || 'UNKNOWN',
            candle: msg,
          };
          this.updates.next(obj);
          break;
        case SuppportedMessages.INITIALIZATION_DATA:
          {
            const actives = data.msg.binary.actives;
            Object.keys(actives).forEach(key => {
              this.actives.set(actives[key].id, {
                name: actives[key].ticker,
                requestId: actives[key]?.request_id || 0,
              });
            });
            // console.log('Actives:', this.actives);
          }
          break;
        case SuppportedMessages.CANDLES:
          {
            const active = Array.from(this.actives.values()).find(
              v => v.requestId == requestId
            );
            if (!active) {
              console.error('Active not found:', requestId);
              return;
            }
            this.candles.next({
              topic: name,
              active: active?.name || 'UNKNOWN',
              candles: msg.candles,
            });
          }
          break;
        default:
          // console.log('Mensagem recebida:', JSON.stringify(data, null, 2));
          break;
      }
    });

    // Manipular mensagens de WebSocket enviadas
    client.on('Network.webSocketFrameSent', (event: any) => {
      const data = JSON.parse(event.response.payloadData);
      const msg = data.msg;
      const name = data.name;
      const requestId = data.request_id;
      if (msg.name == SuppportedMessages.GET_CANDLES) {
        const active_id = msg.body.active_id;
        const active = this.actives.get(active_id);
        this.actives.set(active_id, {
          name: active?.name || '',
          requestId,
        });
      }
    });
  }

  close() {
    if (this.browser) {
      this.browser.close();
      this.isRunning = false;
    }
  }

  async start() {
    try {
      this.browser = await launch({
        headless: false,
      });

      do {
        await this.tryLogin();
      } while (!(await this.isLoggedIn()));

      if (!this.page) throw new Error('[start] Page is null');

      await this.setupWebSocketListening(this.page);

      console.log('Client start');
      this.isRunning = true;
    } catch (error) {
      console.error('Error trying to start client', error);
      this.isRunning = false;
    }
  }

  async tryLogin() {
    try {
      if (!this.browser) throw new Error('Browser is null');

      this.page = await this.browser.newPage();

      this.page.goto('https://trade.exnova.com/traderoom');

      // the username input field is #root > div > div > div > div > form > div:nth-child(1) > div > div > input
      const userNameInput = await this.page.waitForSelector(
        '#root > div > div > div > div > form > div:nth-child(1) > div > div > input'
      );
      await userNameInput?.type(Config.getUserName());

      // the password input field is #root > div > div > div > div > form > div:nth-child(2) > div > div > input
      const passwordInput = await this.page.waitForSelector(
        '#root > div > div > div > div > form > div:nth-child(2) > div > div > input'
      );
      await passwordInput?.type(Config.getPassword());

      // the login button is #root > div > div > div > div > form > button
      const loginButton = await this.page.waitForSelector(
        '#root > div > div > div > div > form > button'
      );
      await loginButton?.click({delay: 1000, clickCount: 3});

      // start trading button is #root > div.css-3uqybw.ep6b6450 > header > div > div > div.css-cea5o1.e1t2y47p4 > button > span
      const startTradingButton = await this.page.waitForSelector(
        '#root > div.css-3uqybw.ep6b6450 > header > div > div > div.css-cea5o1.e1t2y47p4 > button > span'
      );
      await startTradingButton?.click();
    } catch (error) {
      console.error('Error trying to login', error);
    }
  }

  async isLoggedIn() {
    const depositButton = await this.page?.waitForSelector('#glcanvas');
    return depositButton !== null;
  }
}

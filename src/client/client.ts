import {Page, Browser, launch} from 'puppeteer';
import {Config} from '../config/config';

export class Client {
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor() {
    console.log('Client constructor');
  }

  async setupWebSocketListening(page: Page) {
    const client = await page.createCDPSession();
    await client.send('Network.enable');

    let messages = 1000;
    let actives = {};
    const fs = require('fs');
    // Manipular mensagens de WebSocket
    client.on('Network.webSocketFrameReceived', (event: any) => {
      const data = JSON.parse(event.response.payloadData);
      if (data.name === 'initialization-data') {
        const actives = data.msg.binary.actives;
        fs.writeFileSync('actives.json', JSON.stringify(actives, null, 2));
      }
      if (messages > 0) {
        fs.appendFileSync('messages.txt', JSON.stringify(data, null, 2));
        messages--;
      }
      console.log('Mensagem recebida:', JSON.stringify(data, null, 2));
    });
  }

  async start() {
    this.browser = await launch({headless: false});
    this.page = await this.browser.newPage();

    console.log(`USERNAME: ${Config.userName} PASSWORD: ${Config.password}`);

    await this.setupWebSocketListening(this.page);

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
    await loginButton?.click();

    await this.page.setRequestInterception(true);

    this.page.on('request', (interceptedRequest: any) => {
      if (
        interceptedRequest.url().includes('websocket') &&
        interceptedRequest.resourceType() != 'image'
      ) {
        console.log(
          'A request was made:',
          interceptedRequest.url(),
          interceptedRequest.resourceType()
        );
      }
      // Filtrar apenas as solicitações de WebSocket
      if (interceptedRequest.resourceType() === 'websocket') {
        interceptedRequest.continue();

        // Manipular mensagens WebSocket
        interceptedRequest.on('websocket', (ws: any) => {
          console.log('Nova conexão WebSocket:', ws.url());

          // Manipular mensagens recebidas
          ws.on('message', (message: any) => {
            console.log('Mensagem recebida:', message);
            // Aqui você pode processar ou manipular as mensagens conforme necessário
          });

          ws.on('close', () => {
            console.log('Conexão WebSocket fechada');
          });
        });
      } else {
        interceptedRequest.continue();
      }
    });

    // start trading button is #root > div.css-3uqybw.ep6b6450 > header > div > div > div.css-cea5o1.e1t2y47p4 > button > span
    const startTradingButton = await this.page.waitForSelector(
      '#root > div.css-3uqybw.ep6b6450 > header > div > div > div.css-cea5o1.e1t2y47p4 > button > span'
    );
    await startTradingButton?.click();

    console.log('Client start');
  }
}

import {Subscription} from 'rxjs';
import {Client} from './client/client';
import * as WebSocket from 'ws';

const wss = new WebSocket.Server({port: 8080});

const main = async () => {
  const client = new Client();

  let updatesSubscription: Subscription | null = null;
  let candlesSubscription: Subscription | null = null;

  wss.on('connection', async (ws: WebSocket) => {
    console.log('Cliente conectado');

    ws.on('message', async (message: Buffer) => {
      console.log('Mensagem recebida:', message);

      switch (message.toString()) {
        case 'start':
          updatesSubscription = client.updates.subscribe(
            ({topic, active, candle}) => {
              try {
                ws.send(JSON.stringify({topic, active, candle}));
              } catch (e) {
                console.error('Erro ao enviar mensagem:', e);
              }
            }
          );
          candlesSubscription = client.candles.subscribe(
            ({topic, active, candles}) => {
              try {
                ws.send(JSON.stringify({topic, active, candles}));
              } catch (e) {
                console.error('Erro ao enviar mensagem:', e);
              }
            }
          );
          await client.start();
          break;
        case 'ping':
          ws.send(JSON.stringify({topic: 'pong', _t: Date.now()}));
          break;
        case 'close':
          client.close();
          ws.close();
          break;
      }
    });

    ws.on('close', () => {
      (updatesSubscription as Subscription)?.unsubscribe();
      (candlesSubscription as Subscription)?.unsubscribe();
      console.log('[WS] Cliente desconectado');
    });
  });
};

main();

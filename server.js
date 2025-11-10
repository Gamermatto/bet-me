import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const wss = new WebSocketServer({ port: PORT, host: HOST });

let lobbies = [
  { id: "lobby1", name: "Lobby Uno", player_count: 2 },
  { id: "lobby2", name: "Lobby Due", player_count: 4 },
];

wss.on('connection', (ws) => {
  console.log('Nuovo client connesso');

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === "get_lobbies") {
        ws.send(JSON.stringify({ type: "lobby_list", lobbies }));
      } else if (data.type === "join_lobby") {
        console.log(`${data.player_name} si unisce a ${data.lobby_id}`);
      }
    } catch (e) {
      console.error("Errore parsing:", e);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnesso');
  });
});

console.log(`Server WebSocket attivo su ${HOST}:${PORT}`);

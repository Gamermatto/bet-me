import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 10000;
const wss = new WebSocketServer({ port: PORT, host: "0.0.0.0" });

console.log(`✅ Server WebSocket attivo su 0.0.0.0:${PORT}`);

// --- STRUTTURA DATI ---
let lobbies = []; // [{ id, name, password, players: [] }]

// --- UTILS ---
function broadcastLobbies() {
  const data = JSON.stringify({ type: "lobby_list", lobbies: lobbies.map(l => ({
    id: l.id,
    name: l.name,
    player_count: l.players.length
  }))});
  wss.clients.forEach(c => {
    if (c.readyState === 1) c.send(data);
  });
}

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

// --- GESTIONE CONNESSIONI ---
wss.on('connection', (ws) => {
  console.log('🟢 Nuovo client connesso');

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);

      switch (data.type) {
        case "get_lobbies":
          send(ws, {
            type: "lobby_list",
            lobbies: lobbies.map(l => ({
              id: l.id,
              name: l.name,
              player_count: l.players.length
            }))
          });
          break;

        case "create_lobby":
          if (!data.lobby_name || !data.player_name) {
            send(ws, { type: "error", message: "Nome lobby o giocatore mancante" });
            return;
          }

          const newLobby = {
            id: "lobby_" + Date.now(),
            name: data.lobby_name,
            password: data.password || "",
            players: [data.player_name]
          };
          lobbies.push(newLobby);

          console.log(`🏠 Lobby creata: ${newLobby.name} da ${data.player_name}`);
          send(ws, { type: "lobby_created", lobby: newLobby });
          broadcastLobbies();
          break;

        case "join_lobby":
          const lobby = lobbies.find(l => l.id === data.lobby_id);
          if (!lobby) {
            send(ws, { type: "error", message: "Lobby non trovata" });
            return;
          }

          if (lobby.password && lobby.password !== data.password) {
            send(ws, { type: "error", message: "Password errata" });
            return;
          }

          lobby.players.push(data.player_name);
          console.log(`${data.player_name} si è unito a ${lobby.name}`);

          send(ws, { type: "joined_lobby", lobby_id: lobby.id });
          broadcastLobbies();
          break;

        default:
          send(ws, { type: "error", message: "Tipo messaggio sconosciuto" });
      }
    } catch (err) {
      console.error("❌ Errore parsing messaggio:", err);
    }
    case "delete_lobby":
    const index = lobbies.findIndex(l => l.id === data.lobby_id);
    if (index === -1) {
      send(ws, { type: "error", message: "Lobby non trovata" });
      return;
    }
  
    const removedLobby = lobbies.splice(index, 1)[0];
    console.log(`🗑️ Lobby eliminata: ${removedLobby.name}`);
    broadcastLobbies();
    send(ws, { type: "lobby_deleted", lobby_id: removedLobby.id });
    break;
  });

  ws.on('close', () => console.log('🔴 Client disconnesso'));
});

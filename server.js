import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 10000;
const wss = new WebSocketServer({ port: PORT, host: "0.0.0.0" });

console.log(`✅ Server WebSocket attivo su 0.0.0.0:${PORT}`);

let lobbies = []; // { id, name, password, players: [ { name, ws } ] }

function broadcastLobbies() {
    const data = JSON.stringify({ 
        type: "lobby_list", 
        lobbies: lobbies.map(l => ({
            id: l.id,
            name: l.name,
            player_count: l.players.length
        }))
    });
    wss.clients.forEach(c => { if(c.readyState === 1) c.send(data); });
}

function send(ws, obj) {
    if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

// Invia chat a tutti nella stessa lobby
function broadcastChat(lobby_id, player_name, message) {
    const lobby = lobbies.find(l => l.id === lobby_id);
    if (!lobby) return;

    const chatMsg = JSON.stringify({
        type: "chat_message",
        player_name,
        message
    });

    lobby.players.forEach(p => {
        if (p.ws.readyState === 1) p.ws.send(chatMsg);
    });
}

// Aggiorna lista giocatori online
function broadcastPlayers(lobby_id) {
    const lobby = lobbies.find(l => l.id === lobby_id);
    if (!lobby) return;

    const playerNames = lobby.players.map(p => p.name);
    const data = JSON.stringify({
        type: "players_online",
        players: playerNames
    });

    lobby.players.forEach(p => {
        if (p.ws.readyState === 1) p.ws.send(data);
    });
}

wss.on('connection', (ws) => {
    console.log('🟢 Nuovo client connesso');

    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg);

            switch(data.type) {
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
                        players: [{ name: data.player_name, ws }]
                    };
                    lobbies.push(newLobby);
                    send(ws, { type: "lobby_created", lobby: newLobby });
                    broadcastLobbies();
                    broadcastPlayers(newLobby.id);
                    break;

                case "join_lobby":
                    const lobby = lobbies.find(l => l.id === data.lobby_id);
                    if (!lobby) { send(ws, { type: "error", message: "Lobby non trovata" }); return; }
                    if (lobby.password && lobby.password !== data.password) {
                        send(ws, { type: "error", message: "Password errata" }); return;
                    }
                    lobby.players.push({ name: data.player_name, ws });
                    send(ws, { type: "joined_lobby", lobby_id: lobby.id });
                    broadcastLobbies();
                    broadcastPlayers(lobby.id);
                    break;

                case "chat_message":
                    broadcastChat(data.lobby_id, data.player_name, data.message);
                    break;

                case "chat_message":
                    console.log(`💬 [${data.player_name}] ${data.message}`);
                    broadcastChat(data.lobby_id, data.player_name, data.message);
                    break;
                    
                case "delete_lobby":
                    if (data.lobby_id) {
                        const idx = lobbies.findIndex(l => l.id === data.lobby_id);
                        if(idx !== -1) lobbies.splice(idx,1);
                    } else lobbies = [];
                    broadcastLobbies();
                    break;

                default:
                    send(ws, { type: "error", message: "Tipo messaggio sconosciuto" });
            }
        } catch(err) {
            console.error("❌ Errore parsing messaggio:", err);
        }
    });

    ws.on('close', () => {
        // Rimuovi client da ogni lobby
        lobbies.forEach(lobby => {
            const idx = lobby.players.findIndex(p => p.ws === ws);
            if (idx !== -1) {
                console.log(`🔴 ${lobby.players[idx].name} è uscito da ${lobby.name}`);
                lobby.players.splice(idx,1);
                broadcastPlayers(lobby.id);
            }
        });
    });
});

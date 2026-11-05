
/**
 * @type {{[key: string] : import('../types/room.type.js').Player}}
 */
const players = {};

// Safe spawn position in Lobby
const LOBBY_SPAWN = Object.freeze({
    x: 615,
    y: 550
});

export const PlayersManager = {

    /**
     * @param {string} id
     * @param {string} name
     * @param {string} color
     * @param {string|null} roomId
     */
    createPlayer(id, name, color, roomId = null) {
        const key = id;

        if (!players[key]) {
            players[key] = {
                id: key,
                name: name,
                roomId: roomId,
                state: {
                    ...LOBBY_SPAWN,
                    d: 'left',
                    moving: false
                },
                color: color,
                isImposter: false,
                isAlive: true,
            };
        }
        return players[key];
    },

    /**
     * @param {string} id
     */
    deletePlayer(id) {
        delete players[id];
    },

    /**
     * @param {string} id
     * @param {object} state
     */
    updatePlayerState(id, state) {
        if (players[id]) {
            players[id].state = {
                ...players[id].state,
                ...state
            };
        }
    },

    getAllPlayers() {
        return Object.values(players);
    },

    resetPlayer(id) {
        if (players[id]) {
            players[id].state = {
                ...LOBBY_SPAWN,
                d: 'left',
                moving: false
            };

            players[id].isAlive = true;
            players[id].isImposter = false;
        }
    },

    setRoomId(id, roomId) {
        if (players[id]) {
            players[id].roomId = roomId;
            return players[id];
        }
    },
};

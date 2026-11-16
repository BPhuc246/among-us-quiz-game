/**
 * @type {{[key: string] : import('../types/room.type.js').Player}}
 */
const players = {};

// Safe spawn position in Lobby
const LOBBY_SPAWN = Object.freeze({
    x: 615,
    y: 550,
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
                    d: "left",
                    moving: false,
                },
                color: color,
                isImposter: false,
                isAlive: true,
            };
        } else {
            // Update existing player's name and color
            players[key].name = name;
            players[key].color = color;
        }
    },

    /**
     * @param {string} id
     */
    deletePlayer(id) {
        delete players[id];
    },

    /**
     * @param {string} id
     * @param {Partial<import('../types/room.type.js').PlayerState>} state
     * @returns {void}
     */
    updatePlayerState(id, state) {
        const player = players[id];
        if (player) {
            player.state = { ...player.state, ...state };
        }
    },

    /**
     * @param {string} id
     */
    getPlayer(id) {
        return players[id];
    },

    getAllPlayers() {
        return Object.values(players);
    },

    /**
     * @param {string} id
     */
    resetPlayer(id) {
        if (players[id]) {
            players[id].state = {
                ...LOBBY_SPAWN,
                d: "left",
                moving: false,
            };

            players[id].isAlive = true;
            players[id].isImposter = false;
        }
    },

    /**
     * @param {string} id
     * @param {string|null} roomId
     * @returns {import('../types/room.type.js').Player|undefined}
     */
    setRoomId(id, roomId) {
        if (players[id]) {
            players[id].roomId = roomId;
            return players[id];
        }
    },
};

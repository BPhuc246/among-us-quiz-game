
/**
 * @typedef {import('../types/room.type.js').Player} Player
 * @typedef {import('../types/room.type.js').PlayerState} PlayerState
 */

/** @type {{[key: string]: Player}} */
const players = {};

// Safe spawn position in Lobby
const LOBBY_SPAWN = Object.freeze({
    x: 615,
    y: 550
});
/** @returns {PlayerState} */
const defaultState = () => ({x: 560, y: 150, d: 'left', moving: false});

export const PlayersManager = {

    /**
     * @param {string} id
     * @param {string} name
     * @param {string} color
     * @param {string|null} [roomId=null]
     * @returns {void}
     */
    createPlayer(id, name, color, roomId = null) {
        const key = id;

        if (!players[key]) {
            players[key] = {
                id: key,
                name: name,
                roomId: roomId,
                state: defaultState(),
                color: color,
                isImposter: false,
                isAlive: true,
            };
        }
        return players[key];
    },

    /**
     * @param {string} id
     * @returns {void}
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

     * @param {Partial<PlayerState>} state
     * @returns {void}
     */
    updatePlayerState(id, state) {
        const player = players[id];
        if (player) {
            player.state = {...player.state, ...state};
        }
    },

    /**
     * @param {string} id
     * @returns {Player|undefined}
     */
    getPlayer(id) {
        return players[id];
    },

    /**
     * @returns {Player[]}
     */
    getAllPlayers() {
        return Object.values(players);
    },

    /**
     * @param {string} id
     * @returns {void}
     */
    resetPlayer(id) {
        const player = players[id];
        if (player) {
            player.state = defaultState();
            player.isAlive = true;
            player.isImposter = false;
        }
    },

    /**
     * @param {string} id
     * @param {string|null} roomId
     * @returns {Player|undefined}
     */
    setRoomId(id, roomId) {
        const player = players[id];
        if (player) {
            player.roomId = roomId;
            return player;
        }
        return undefined;
    },
};

import { PlayersManager } from "./players.manager.js";

/**
 * @typedef {import('../types/room.type.js').Player} Player
 * @typedef {import('../types/room.type.js').GameRoom} GameRoom
 * @typedef {import('../types/room.type.js').PublicGameRoom} PublicGameRoom
 * @typedef {import('../types/room.type.js').Question} Question
 * @typedef {import('../types/room.type.js').PublicQuestion} PublicQuestion
 * @typedef {import('../types/room.type.js').MeetingResults} MeetingResults
 * @typedef {import('../types/room.type.js').PlayerState} PlayerState
 * @typedef {(data: {roomId: string}) => void} MeetingEndFunc
 */

/** @type {{[key: string]: GameRoom}} */
const rooms = {
    1: {
        id: "1",
        started: false,
        imposter: null,
        host: {
            id: "host1",
            name: "Host One",
            roomId: "1",
            state: { x: 0, y: 0, d: "left", moving: false },
            color: "red",
            isImposter: false,
            isAlive: true,
        },
        players: {},
        currentMeeting: null,
        questions: [],
    },
};

/** @type {ReturnType<typeof setTimeout> | null} */
let meetingEndTimeout = null;

/**
 * Kiểm tra một giá trị có đúng dạng Question từ frontend hay không (roomId được bỏ qua vì sẽ được gán lại).
 * @param {unknown} q
 * @returns {boolean}
 */
const isValidQuestion = (q) => {
    if (!q || typeof q !== "object") return false;
    const o = /** @type {Record<string, unknown>} */ (q);

    const options = o.options;
    const validOptions =
        Array.isArray(options) &&
        (options.every((x) => typeof x === "string") ||
            options.every((x) => typeof x === "number"));

    return (
        typeof o.id === "string" &&
        typeof o.title === "string" &&
        typeof o.description === "string" &&
        typeof o.explain === "string" &&
        (typeof o.answer === "string" || typeof o.answer === "number") &&
        validOptions
    );
};

export const RoomsManager = {
    /**
     * Chuẩn hóa danh sách câu hỏi thô từ frontend. Bỏ các câu hỏi không hợp lệ.
     * @param {string} roomId
     * @param {unknown} raw
     * @returns {Question[]}
     */
    parseQuestions(roomId, raw) {
        if (!Array.isArray(raw)) return [];
        return raw
            .filter(isValidQuestion)
            .map((q) => /** @type {Question} */ ({ ...q, roomId }));
    },

    /**
     * Trả về room dành cho client: câu hỏi không còn đáp án.
     * @param {GameRoom|undefined} room
     * @returns {PublicGameRoom|undefined}
     */
    toPublicRoom(room) {
        if (!room) return undefined;
        /** @type {PublicQuestion[]} */
        const questions = room.questions.map(
            ({ id, roomId, title, description, options, explain }) => ({
                id,
                roomId,
                title,
                description,
                options,
                explain,
            }),
        );
        return { ...room, questions };
    },

    players: {
        /**
         * @param {string} roomId
         * @param {Player} player
         * @returns {Player|undefined}
         */
        add(roomId, player) {
            if (!rooms[roomId]) return undefined;
            const updated = PlayersManager.setRoomId(player.id, roomId);
            if (!updated) return undefined;
            rooms[roomId].players[updated.id] = updated;
            return updated;
        },

        /**
         * @param {string} roomId
         * @param {Player} player
         * @returns {{deleted: boolean}} - deleted is true if the room was removed because it became empty
         */
        remove(roomId, player) {
            const room = rooms[roomId];
            if (!room) return { deleted: false };
            delete room.players[player.id];
            const remainingPlayers = Object.values(room.players);
            if (remainingPlayers.length < 1) {
                delete rooms[roomId];
                return { deleted: true };
            }
            if (room.host.id === player.id) {
                room.host = remainingPlayers[0];
            }
            return { deleted: false };
        },

        /**
         * @param {string} roomId
         * @param {string} playerId
         * @param {{x: number, y: number, d: string, moving?: boolean}} state
         * @returns {void}
         */
        updateState(roomId, playerId, state) {
            const player = rooms[roomId]?.players[playerId];
            if (!player) return;
            /** @type {PlayerState} */
            const newState = { ...state, moving: state.moving ?? false };
            player.state = newState;
        },
    },

    meetings: {
        /**
         * @param {string} roomId
         * @param {string} callerId
         * @param {MeetingEndFunc} endFunc
         * @returns {void}
         */
        create(roomId, callerId, endFunc) {
            const room = rooms[roomId];
            if (!room) return;
            room.currentMeeting = {
                isActive: true,
                callerId,
                votes: {},
                endTime: Date.now() + 10000,
            };
            meetingEndTimeout = setTimeout(
                () => endFunc({ roomId }),
                1000 * 60,
            );
        },

        /**
         * @param {string} roomId
         * @param {string} callerId
         * @param {string|null} votedForId
         * @returns {boolean|null} - true when every alive player has voted, null if no active meeting
         */
        vote(roomId, callerId, votedForId) {
            console.log(
                "Vote received in room:",
                rooms[roomId],
                "from callerId:",
                callerId,
                "votedForId:",
                votedForId,
            ); // DEBUG LOG
            const room = rooms[roomId];
            if (!room || !room.currentMeeting) return null;
            room.currentMeeting.votes[callerId] = votedForId;
            const alivePlayers = Object.values(room.players).filter(
                (p) => p.isAlive,
            );
            const votes = Object.values(room.currentMeeting.votes);
            console.log(
                "Alive players for voting check:",
                alivePlayers,
                alivePlayers.length,
                votes.length,
            ); // DEBUG LOG
            return votes.length === alivePlayers.length;
        },

        /**
         * @param {string} roomId
         * @returns {MeetingResults|null}
         */
        end(roomId) {
            const room = rooms[roomId];
            if (!room || !room.currentMeeting) return null;
            const meeting = room.currentMeeting;
            if (!meeting.isActive) return null;

            if (meetingEndTimeout) {
                clearTimeout(meetingEndTimeout);
                meetingEndTimeout = null;
            }

            meeting.isActive = false;
            const votes = meeting.votes || {};

            /** @type {{[playerId: string]: number}} */
            const counts = {};
            let max = 0;
            /** @type {string[]} */
            let winners = [];
            Object.values(votes).forEach((votedForId) => {
                if (votedForId == null) return;
                counts[votedForId] = (counts[votedForId] || 0) + 1;
                if (counts[votedForId] > max) {
                    max = counts[votedForId];
                    winners = [votedForId];
                } else if (counts[votedForId] === max) {
                    winners.push(votedForId);
                }
            });

            /** @type {string|null} */
            let ejectedId = null;
            const tie = winners.length !== 1;
            if (!tie) {
                ejectedId = winners[0];
                const ejected = room.players[ejectedId];
                if (ejected) {
                    ejected.isAlive = false;
                }
            }

            meeting.results = { ejectedId, tie, counts, votes };
            return meeting.results;
        },
    },

    /**
     * @param {string} roomId
     * @param {Player} host
     * @param {Question[]} [questions=[]]
     * @returns {GameRoom|undefined}
     */
    createRoom(roomId, host, questions = []) {
        if (rooms[roomId]) return undefined;

        rooms[roomId] = {
            id: roomId,
            started: false,
            imposter: null,
            host: host,
            players: {},
            currentMeeting: null,
            questions: questions,
        };
        return rooms[roomId];
    },

    /**
     * @returns {GameRoom[]}
     */
    fetchRooms() {
        return Object.values(rooms);
    },

    /**
     * @param {string} roomId
     * @returns {GameRoom|undefined}
     */
    fetchRoom(roomId) {
        return rooms[roomId];
    },

    /**
     * @param {string} roomId
     * @returns {GameRoom|undefined}
     */
    startGame(roomId) {
        const room = rooms[roomId];
        if (!room) return undefined;
        room.started = true;
        const players = Object.values(room.players);

        if (players.length === 0) {
            room.imposter = null;
            return undefined;
        }

        // Reset alive status for all players when starting
        players.forEach((p) => {
            p.isAlive = true;
            PlayersManager.updatePlayerState(p.id, {
                x: 560,
                y: 150,
                d: "left",
                moving: false,
            });
        });

        const idx = Math.floor(Math.random() * players.length);
        room.imposter = players[idx].id;
        return room;
        // TODO filter imposter before sending room
    },

    /**
     * @param {string} roomId
     * @returns {boolean|null} - true if imposters won, false if crewmates won, null if game continues
     */
    checkWin(roomId) {
        const room = rooms[roomId];
        console.log("Checking win for room:", roomId, room);
        if (!room || !room.started) {
            console.log("Room Not Started or not found:", roomId);
            return null;
        }

        const players = Object.values(room.players);
        const imposterId = room.imposter;
        if (!imposterId) {
            console.log("No imposter assigned in room:", roomId);
            return null;
        }

        const alivePlayers = players.filter((p) => p.isAlive);
        const aliveImposters = alivePlayers.filter((p) => p.id === imposterId);
        const aliveCrewmates = alivePlayers.filter((p) => p.id !== imposterId);

        console.log(
            `Alive Imposters: ${aliveImposters.length}, Alive Crewmates: ${aliveCrewmates.length}`,
        );

        if (
            aliveImposters.length >= aliveCrewmates.length &&
            aliveCrewmates.length > 0
        ) {
            return true;
        }

        if (aliveCrewmates.length === 0) {
            return true;
        }

        if (aliveImposters.length === 0) {
            return false;
        }

        return null;
    },
};

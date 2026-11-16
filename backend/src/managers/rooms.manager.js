import { PlayersManager } from "./players.manager.js";
import { TasksManager } from "./tasks.manager.js";
import { toPublicQuestion } from "./questions.manager.js";

// Clear floor below the emergency table on the current Skeld collision map.
export const GAME_SPAWN = Object.freeze({ x: 560, y: 180 });

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

export const RoomsManager = {
    /**
     * Kiểm tra toàn bộ mảng câu hỏi thô và gán id, roomId.
     * Trả về null nếu có dưới 2 câu hoặc có câu nào không hợp lệ.
     * @param {string} roomId
     * @param {unknown} raw
     * @returns {Question[]|null}
     */
    parseQuestions(roomId, raw) {
        if (!Array.isArray(raw) || raw.length < 2) return null;

        /** @type {unknown[]} */
        const items = raw;
        if (!items.every(isValidQuestionInput)) return null;

        return items.map((q, index) => ({
            id: `q${index + 1}`,
            roomId,
            title: q.title.trim(),
            description: (q.description ?? "").trim(),
            options: /** @type {string[] | number[]} */ ([...q.options]),
            answer: q.answer,
            explain: q.explain.trim(),
        }));
    },

    /**
     * Room gửi cho client: không có imposter, không có nhiệm vụ của người khác,
     * câu hỏi không có đáp án và lời giải.
     * @param {GameRoom|undefined} room
     * @returns {PublicGameRoom|undefined}
     */
    toPublicRoom(room) {
        if (!room) return undefined;
        const publicRoom = {
            ...room,
            imposter: null,
            questions: room.questions.map(toPublicQuestion),
        };
        delete publicRoom.taskState;
        return publicRoom;
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
        room.deadBodies = {};
        const players = Object.values(room.players);

        if (players.length === 0) {
            room.imposter = null;
            return undefined;
        }

        // Reset alive status for all players when starting
        players.forEach((p) => {
            p.isAlive = true;
            PlayersManager.updatePlayerState(p.id, {
                ...GAME_SPAWN,
                d: "left",
                moving: false,
            });
        });

        const idx = Math.floor(Math.random() * players.length);
        room.imposter = players[idx].id;
        TasksManager.initialize(room);
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
        const progress = TasksManager.progress(room);
        if (progress.total > 0 && progress.completed === progress.total)
            return false;

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

/**
 * Kiểm tra một câu hỏi thô do frontend gửi (chưa có id, roomId).
 * @param {unknown} q
 * @returns {q is import("../types/room.type.js").QuestionInput}
 */
const isValidQuestionInput = (q) => {
    if (typeof q !== "object" || q === null) return false;
    const o = /** @type {{[key: string]: unknown}} */ (q);

    if (typeof o.title !== "string" || o.title.trim() === "") return false;
    if (o.description !== undefined && typeof o.description !== "string")
        return false;
    if (typeof o.explain !== "string") return false;
    if (typeof o.answer !== "string" && typeof o.answer !== "number")
        return false;
    if (!Array.isArray(o.options)) return false;

    /** @type {unknown[]} */
    const options = o.options;
    if (options.length < 2) return false;

    const allStrings = options.every(
        (x) => typeof x === "string" && x.trim() !== "",
    );
    const allNumbers = options.every(
        (x) => typeof x === "number" && Number.isFinite(x),
    );
    if (!allStrings && !allNumbers) return false;
    if (new Set(options).size !== options.length) return false;

    // includes dùng so sánh nghiêm ngặt: "96" không khớp 96
    return options.includes(o.answer);
};

import {RoomsManager} from "../managers/rooms.manager.js";
import {PlayersManager} from "../managers/players.manager.js";

/**
 * @typedef {import('../types/room.type.js').MeetingResults} MeetingResults
 */

/**
 * @typedef {{
 *   roomId: string,
 *   id?: string,
 *   playerId?: string,
 *   x: number,
 *   y: number,
 *   d: string,
 *   moving: boolean
 * }} PlayerMoveData
 */

/**
 * @typedef {{roomId: string, [key: string]: unknown}} PlayerAnimData
 */

/**
 * @typedef {{roomId: string, playerId: string}} PlayerKillData
 */

/**
 * @typedef {{roomId: string, callerId: string}} MeetingStartData
 */

/**
 * @typedef {{roomId: string, results?: MeetingResults|null}} MeetingEndData
 */

/**
 * @typedef {{roomId: string, callerId: string, votedForId: string|null}} MeetingVoteData
 */

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @returns {void}
 */
export const registerGameEvents = (io, socket) => {
    // see comment below about playerJoin
    // /**
    //  * @param {{player: import('../types/room.type.js').Player, roomId: string}} data
    //  */
    // const playerJoin = (data) => {
    //     console.log("Player join received:", data);
    //     socket.to(data.roomId).emit("player:joined", data);
    // }

    // ====== PLAYER EVENTS ======

    /**
     * @param {PlayerMoveData} data
     * @returns {void}
     */
    const playerMove = (data) => {
        // Frontend emits `id`; accept either id or playerId
        const playerId = data.id ?? data.playerId;
        if (!data.roomId || !playerId) return;

        RoomsManager.players.updateState(data.roomId, playerId, {x: data.x, y: data.y, d: data.d});
        PlayersManager.updatePlayerState(playerId, {x: data.x, y: data.y, d: data.d, moving: data.moving});
        io.to(data.roomId).emit("player:moved", data);
    };

    /**
     * @param {PlayerAnimData} data
     * @returns {void}
     */
    const playerAnim = (data) => {
        io.to(data.roomId).emit("player:animation", data);
    };

    /**
     * @param {PlayerKillData} data
     * @returns {void}
     */
    const playerKill = (data) => {
        console.log("Player kill received:", data);
        const roomId = data.roomId;
        const room = RoomsManager.fetchRoom(roomId);
        if (room && room.players[data.playerId]) {
            room.players[data.playerId].isAlive = false;
        }
        io.to(data.roomId).emit("player:killed", data);
        const win = RoomsManager.checkWin(roomId);
        if (win !== null) {
            io.to(roomId).emit("game:ended", {roomId, isImposter: win});
        }
    };

    // ===== MEETING EVENTS ======

    /**
     * @param {MeetingStartData} data
     * @returns {void}
     */
    const meetingStart = (data) => {
        console.log("Recieved meeting start");
        RoomsManager.meetings.create(data.roomId, data.callerId, meetingEnd);
        io.to(data.roomId).emit("meeting:started", data);
    };

    /**
     * @param {MeetingEndData} data
     * @returns {void}
     */
    const meetingEnd = (data) => {
        console.log("Recieved meeting end", data);
        data.results = RoomsManager.meetings.end(data.roomId);
        io.to(data.roomId).emit("meeting:ended", data);
        // Check win condition after meeting
        const roomId = data.roomId;
        const win = RoomsManager.checkWin(roomId);
        console.log("Win condition check after meeting:", win);
        if (win !== null) {
            io.to(roomId).emit("game:ended", {roomId, isImposter: win});
        }
    };

    /**
     * @param {MeetingVoteData} data
     * @returns {void}
     */
    const meetingVote = (data) => {
        console.log("Recieved meeting vote", data);
        const allVoted = RoomsManager.meetings.vote(data.roomId, data.callerId, data.votedForId);
        io.to(data.roomId).emit("meeting:voted", data);

        if (allVoted) {
            console.log('All players voted, ending meeting early');
            meetingEnd({roomId: data.roomId});
        }
    };

    // socket.on("player:join", playerJoin); looks useless for now as room:join already does the job
    socket.on("player:move", playerMove);
    socket.on("player:animation", playerAnim);
    socket.on("player:kill", playerKill);
    socket.on("meeting:start", meetingStart);
    socket.on("meeting:end", meetingEnd);
    socket.on("meeting:vote", meetingVote);
};
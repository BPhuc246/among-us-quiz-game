import { RoomsManager } from "../managers/rooms.manager.js";
import { TasksManager } from "../managers/tasks.manager.js";

/**
 * @typedef {{roomId: string}} TasksGetData
 * @typedef {{
 *   roomId: string,
 *   stationId: string,
 *   questionId: string,
 *   optionIndex: number
 * }} TaskAnswerData
 * @typedef {{
 *   ok: boolean,
 *   correct?: boolean,
 *   alreadyCompleted?: boolean,
 *   explain?: string,
 *   message?: string
 * }} AckResponse
 */

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @returns {void}
 */
export function registerTaskEvents(io, socket) {
    /**
     * @param {TasksGetData} data
     * @returns {void}
     */
    const tasksGet = (data) => {
        if (typeof data?.roomId !== "string") return;
        const room = RoomsManager.fetchRoom(data.roomId);
        const playerId = socket.data.playerId;
        if (
            !room?.started ||
            typeof playerId !== "string" ||
            !room.players[playerId] ||
            !socket.rooms.has(room.id)
        ) {
            return;
        }
        socket.emit("game:tasks", TasksManager.snapshot(room, playerId));
    };

    /**
     * @param {TaskAnswerData} data
     * @param {(response: AckResponse) => void} [ack]
     * @returns {void}
     */
    const taskAnswer = (data, ack) => {
        /** @type {(response: AckResponse) => void} */
        const reply = typeof ack === "function" ? ack : () => {};

        const room =
            typeof data?.roomId === "string"
                ? RoomsManager.fetchRoom(data.roomId)
                : undefined;
        const playerId = socket.data.playerId;
        if (
            !room ||
            typeof playerId !== "string" ||
            !socket.rooms.has(room.id)
        ) {
            reply({ ok: false, message: "Bạn không ở trong phòng này." });
            return;
        }

        if (room.eliminationInProgress) {
            reply({
                ok: false,
                message: "Vui lòng chờ hoạt ảnh loại người chơi kết thúc.",
            });
            return;
        }

        const result = TasksManager.submit(room, playerId, data);
        reply(result);
        if (!result.correct || result.alreadyCompleted) return;

        // Chỉ gửi lại danh sách nhiệm vụ cho người vừa làm.
        // Tiến độ chung KHÔNG phát ở đây: chỉ cập nhật sau khi vote.
        socket.emit("game:tasks", TasksManager.snapshot(room, playerId));
    };

    socket.on("tasks:get", tasksGet);
    socket.on("task:answer", taskAnswer);
}

import { toPublicQuestion } from "./questions.manager.js";

/**
 * @typedef {import('../types/room.type.js').GameRoom} GameRoom
 * @typedef {import('../types/room.type.js').Question} Question
 * @typedef {import('../types/room.type.js').PlayerTaskState} PlayerTaskState
 */

/**
 * @typedef {{id: string, x: number, y: number}} Station
 * @typedef {{questionId: string, stationId: string}} Assignment
 * @typedef {{completed: number, total: number}} TaskProgress
 * @typedef {{stationId?: unknown, questionId?: unknown, optionIndex?: unknown}} SubmitInput
 * @typedef {{
 *   ok: boolean,
 *   code: string,
 *   correct?: boolean,
 *   alreadyCompleted?: boolean,
 *   explain?: string,
 *   message?: string
 * }} SubmitResult
 */

/** Tổng số nhiệm vụ crew cần hoàn thành để thắng. */
export const TASK_GOAL = 60;
/** Số nhiệm vụ tối đa trong một đợt, làm hết đợt mới được đợt mới. */
export const BATCH_SIZE = 6;
/** Số nhiệm vụ mở sẵn khi bắt đầu mỗi đợt. */
export const MIN_VISIBLE_TASKS = 2;
/** Cứ mỗi số nhiệm vụ này imposter làm được thì có thêm 1 lượt giết. */
export const KILL_UNLOCK_TASKS = 2;

export const TASK_USE_RADIUS = 55;

/**
 * Tâm của từng ô nhiệm vụ. Id và tọa độ phải khớp với frontend taskLocations.js.
 * @type {readonly Station[]}
 */
export const TASK_STATIONS = Object.freeze([
    { id: "skeld_task_01", x: 657.3, y: 58.7 },
    { id: "skeld_task_02", x: 766.2, y: 78.2 },
    { id: "skeld_task_03", x: 379.3, y: 304.4 },
    { id: "skeld_task_04", x: 636.7, y: 283.7 },
    { id: "skeld_task_05", x: 665.7, y: 438.8 },
]);

/**
 * @template T
 * @param {readonly T[]} items
 * @param {() => number} random
 * @returns {T[]}
 */
const shuffle = (items, random) => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

/**
 * @param {GameRoom} room
 * @param {string} questionId
 * @returns {Question|undefined}
 */
const findQuestion = (room, questionId) =>
    room.questions.find((q) => q.id === questionId);

/**
 * Tạo một đợt mới: tối đa BATCH_SIZE câu, không trùng câu trong cùng đợt.
 * Trạm được xoay vòng, nên khi đợt có nhiều hơn số trạm thì một trạm có 2 nhiệm vụ.
 * @param {GameRoom} room
 * @param {() => number} random
 * @returns {Assignment[]}
 */
const buildBatch = (room, random) => {
    const size = Math.min(BATCH_SIZE, room.questions.length);
    const questions = shuffle(room.questions, random).slice(0, size);
    const stations = shuffle(TASK_STATIONS, random);
    return questions.map((q, i) => ({
        questionId: q.id,
        stationId: stations[i % stations.length].id,
    }));
};

/**
 * Đặt đợt mới: tất cả nhiệm vụ đều được mở, tất cả đều chưa làm.
 * @param {PlayerTaskState} state
 * @param {GameRoom} room
 * @param {() => number} random
 * @returns {void}
 */
const resetBatch = (state, room, random) => {
    state.batch = buildBatch(room, random);
    state.revealed = state.batch.length;
    state.completed = [];
};

/**
 * @param {GameRoom} room
 * @param {() => number} [random]
 * @returns {void}
 */
const initialize = (room, random = Math.random) => {
    room.taskState = {};
    room.taskMeta = { shownCompleted: 0, prevImposterRoundDone: 0 };
    if (room.questions.length < MIN_VISIBLE_TASKS) return;

    for (const player of Object.values(room.players)) {
        /** @type {PlayerTaskState} */
        const state = {
            batch: [],
            revealed: 0,
            completed: [],
            lifetimeDone: 0,
            roundDone: 0,
            killsUsed: 0,
        };
        resetBatch(state, room, random);
        room.taskState[player.id] = state;
    }
};

/**
 * Tổng số crew đã làm từ đầu ván (dùng để tính tiến độ hiển thị khi vote).
 * @param {GameRoom} room
 * @returns {number}
 */
const crewLifetimeTotal = (room) => {
    let sum = 0;
    for (const [id, state] of Object.entries(room.taskState ?? {})) {
        if (!room.players[id] || id === room.imposter) continue;
        sum += state.lifetimeDone;
    }
    return sum;
};

/**
 * Tiến độ hiển thị cho cả đội. Chỉ đổi sau mỗi lần vote (xem settleRound).
 * @param {GameRoom} room
 * @returns {TaskProgress}
 */
const progress = (room) => ({
    completed: room.taskMeta?.shownCompleted ?? 0,
    total: TASK_GOAL,
});

/**
 * Gọi sau mỗi lần vote.
 * - Tiến độ hiển thị = tổng crew đã làm − floor(số câu imposter đã làm ở đợt trước / 2).
 * - Lưu số câu imposter vừa làm trong đợt này cho lần vote kế tiếp, rồi reset đếm đợt.
 * @param {GameRoom} room
 * @returns {void}
 */
const settleRound = (room) => {
    if (!room.taskMeta) {
        room.taskMeta = { shownCompleted: 0, prevImposterRoundDone: 0 };
    }
    const meta = room.taskMeta;

    const penalty = Math.floor(meta.prevImposterRoundDone / 2);
    meta.shownCompleted = Math.max(0, crewLifetimeTotal(room) - penalty);

    const imposterState = room.imposter
        ? room.taskState?.[room.imposter]
        : undefined;
    meta.prevImposterRoundDone = imposterState?.roundDone ?? 0;

    for (const state of Object.values(room.taskState ?? {})) {
        state.roundDone = 0;
    }
};

/**
 * Số lượt giết còn lại: cứ KILL_UNLOCK_TASKS nhiệm vụ làm được thì +1, mỗi lần giết −1.
 * @param {PlayerTaskState} state
 * @returns {number}
 */
const availableKills = (state) =>
    Math.floor(state.lifetimeDone / KILL_UNLOCK_TASKS) - state.killsUsed;

/**
 * Imposter có lượt giết còn lại hay không.
 * @param {GameRoom} room
 * @param {string} playerId
 * @returns {boolean}
 */
const canImposterKill = (room, playerId) => {
    if (!room.imposter || playerId !== room.imposter) return false;
    const state = room.taskState?.[playerId];
    if (!state) return false;
    return availableKills(state) > 0;
};

/**
 * Thử dùng một lượt giết. Trả về true nếu được phép và đã trừ lượt.
 * Gọi trong handler giết, trước khi đánh dấu nạn nhân chết.
 * @param {GameRoom} room
 * @param {string} playerId
 * @returns {boolean}
 */
const consumeKill = (room, playerId) => {
    if (!room.imposter || playerId !== room.imposter) return false;
    const state = room.taskState?.[playerId];
    if (!state || availableKills(state) <= 0) return false;
    state.killsUsed += 1;
    return true;
};

/**
 * Chỉ gồm nhiệm vụ đã mở (revealed). Nhiệm vụ chưa mở không được gửi đi.
 * Tiến độ chung lấy từ progress(), nên không đổi cho đến khi vote.
 * @param {GameRoom} room
 * @param {string} playerId
 */
const snapshot = (room, playerId) => {
    const state = room.taskState?.[playerId];
    const visible = state ? state.batch.slice(0, state.revealed) : [];

    /** @type {ReturnType<typeof toPublicQuestion>[]} */
    const questions = [];
    for (const a of visible) {
        const q = findQuestion(room, a.questionId);
        if (q) questions.push(toPublicQuestion(q));
    }

    return {
        roomId: room.id,
        progress: progress(room),
        tasks: visible.map((a) => ({
            stationId: a.stationId,
            questionId: a.questionId,
            completed: state?.completed.includes(a.questionId) ?? false,
        })),
        questions,
        canKill: canImposterKill(room, playerId),
    };
};

/**
 * @param {string} code
 * @param {string} message
 * @returns {SubmitResult}
 */
const fail = (code, message) => ({ ok: false, code, message });

/**
 * @param {GameRoom} room
 * @param {string} playerId
 * @param {SubmitInput} [input]
 * @returns {SubmitResult}
 */
const submit = (room, playerId, input = {}) => {
    if (!room.started) {
        return fail(
            "GAME_NOT_STARTED",
            "Ván chơi chưa bắt đầu hoặc đã kết thúc.",
        );
    }
    if (room.currentMeeting?.isActive) {
        return fail("MEETING_ACTIVE", "Hãy chờ cuộc họp kết thúc.");
    }

    const player = room.players[playerId];
    const state = room.taskState?.[playerId];
    if (!player || !state) {
        return fail("NOT_PLAYER", "Bạn không có nhiệm vụ trong ván này.");
    }

    const { stationId, questionId, optionIndex } = input;
    if (typeof stationId !== "string" || typeof questionId !== "string") {
        return fail("BAD_INPUT", "Dữ liệu nhiệm vụ không hợp lệ.");
    }

    const index = state.batch.findIndex((a) => a.questionId === questionId);
    if (index < 0) {
        return fail("NOT_ASSIGNED", "Nhiệm vụ này không được giao cho bạn.");
    }
    const assignment = state.batch[index];
    if (assignment.stationId !== stationId) {
        return fail("STATION_MISMATCH", "Trạm không khớp với nhiệm vụ này.");
    }
    if (index >= state.revealed) {
        return fail("NOT_REVEALED", "Nhiệm vụ này chưa được mở.");
    }

    const question = findQuestion(room, questionId);
    if (!question) return fail("QUESTION_MISSING", "Không tìm thấy câu hỏi.");

    if (state.completed.includes(questionId)) {
        return {
            ok: true,
            code: "ALREADY_DONE",
            correct: true,
            alreadyCompleted: true,
            explain: question.explain,
            message: "Nhiệm vụ này đã hoàn thành.",
        };
    }

    const station = TASK_STATIONS.find((s) => s.id === stationId);
    if (!station) return fail("STATION_UNKNOWN", "Trạm không hợp lệ.");

    if (!Number.isFinite(player.state.x) || !Number.isFinite(player.state.y)) {
        return fail("BAD_POSITION", "Không xác định được vị trí của bạn.");
    }
    const distance = Math.hypot(
        player.state.x - station.x,
        player.state.y - station.y,
    );
    if (distance > TASK_USE_RADIUS) {
        return fail(
            "TOO_FAR",
            `Bạn cần đến gần trạm (cách ${Math.round(distance)}px, cần ≤ ${TASK_USE_RADIUS}px).`,
        );
    }

    if (
        typeof optionIndex !== "number" ||
        !Number.isInteger(optionIndex) ||
        optionIndex < 0 ||
        optionIndex >= question.options.length
    ) {
        return fail("BAD_OPTION", "Hãy chọn một đáp án hợp lệ.");
    }

    if (question.options[optionIndex] !== question.answer) {
        return {
            ok: true,
            code: "WRONG",
            correct: false,
            message: "Chưa chính xác. Hãy suy nghĩ và thử lại.",
        };
    }

    state.completed.push(questionId);
    state.lifetimeDone += 1;
    state.roundDone += 1;

    // Làm xong cả đợt: sinh đợt mới (tất cả chưa làm)
    if (state.completed.length >= state.batch.length) {
        resetBatch(state, room, Math.random);
    }

    return {
        ok: true,
        code: "CORRECT",
        correct: true,
        explain: question.explain,
        message: "Trả lời đúng! Nhiệm vụ đã hoàn thành.",
    };
};

export const TasksManager = {
    initialize,
    progress,
    snapshot,
    submit,
    settleRound,
    canImposterKill,
    consumeKill,
};

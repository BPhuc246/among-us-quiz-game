import { toPublicQuestion } from "./questions.manager.js";

/**
 * @typedef {import('../types/room.type.js').GameRoom} GameRoom
 * @typedef {import('../types/room.type.js').Question} Question
 * @typedef {{id: string, x: number, y: number}} Station
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

export const TASK_USE_RADIUS = 55;
export const MIN_VISIBLE_TASKS = 2;

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
 * @param {GameRoom} room
 * @param {() => number} [random]
 * @returns {void}
 */
const initialize = (room, random = Math.random) => {
    /** @type {NonNullable<GameRoom["taskState"]>} */
    const taskState = {};
    room.taskState = taskState;

    const perCrew = Math.min(room.questions.length, TASK_STATIONS.length);
    if (perCrew < MIN_VISIBLE_TASKS) return;

    for (const player of Object.values(room.players)) {
        if (player.id === room.imposter) continue;

        const questions = shuffle(room.questions, random).slice(0, perCrew);
        const stations = shuffle(TASK_STATIONS, random).slice(0, perCrew);

        taskState[player.id] = {
            assignments: questions.map((q, i) => ({
                questionId: q.id,
                stationId: stations[i].id,
            })),
            revealed: MIN_VISIBLE_TASKS,
            completed: [],
        };
    }
};

/**
 * @param {GameRoom} room
 * @returns {TaskProgress}
 */
const progress = (room) => {
    let completed = 0;
    let total = 0;
    for (const [id, state] of Object.entries(room.taskState ?? {})) {
        if (!room.players[id]) continue;
        completed += state.completed.length;
        total += state.assignments.length;
    }
    return { completed, total };
};

/**
 * Chỉ gồm nhiệm vụ đã mở (revealed). Nhiệm vụ chưa mở không được gửi đi.
 * @param {GameRoom} room
 * @param {string} playerId
 */
const snapshot = (room, playerId) => {
    const state = room.taskState?.[playerId];
    const visible = state ? state.assignments.slice(0, state.revealed) : [];

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
    if (!player || !state || playerId === room.imposter) {
        return fail("NOT_CREW", "Chỉ crewmate mới được làm nhiệm vụ.");
    }

    const { stationId, questionId, optionIndex } = input;
    if (typeof stationId !== "string" || typeof questionId !== "string") {
        return fail("BAD_INPUT", "Dữ liệu nhiệm vụ không hợp lệ.");
    }

    const index = state.assignments.findIndex(
        (a) => a.questionId === questionId,
    );
    if (index < 0) {
        return fail("NOT_ASSIGNED", "Nhiệm vụ này không được giao cho bạn.");
    }
    const assignment = state.assignments[index];
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
    if (state.revealed < state.assignments.length) state.revealed += 1;

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
};

// Coordinates are in map pixels, shared by the task markers and server checks.
export const TASK_STATIONS = [
    { id: "cafeteria", name: "Nhà ăn", x: 560, y: 210 },
    { id: "weapons", name: "Vũ khí", x: 775, y: 100 },
    { id: "navigation", name: "Điều hướng", x: 945, y: 240 },
    { id: "admin", name: "Quản trị", x: 640, y: 290 },
    { id: "storage", name: "Kho hàng", x: 580, y: 470 },
    { id: "electrical", name: "Phòng điện", x: 410, y: 330 },
    { id: "security", name: "An ninh", x: 300, y: 250 },
    { id: "reactor", name: "Lò phản ứng", x: 120, y: 250 },
];
export const TASK_USE_RADIUS = 55;

function shuffle(items, random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

export const TasksManager = {
    initialize(room, random = Math.random) {
        room.taskCompletions = {};
        room.taskAssignments = {};
        const count = TASK_STATIONS.length;
        const rounds = Array.from({ length: Math.ceil(room.questions.length / count) }, () => shuffle(TASK_STATIONS, random));
        const usage = new Map(TASK_STATIONS.map((station) => [station.id, 0]));
        let offsets = [];
        for (const player of Object.values(room.players)) {
            if (player.id === room.imposter) continue;
            if (!offsets.length) offsets = shuffle(Array.from({ length: count }, (_, i) => i), random);
            const stationsFor = (offset) => room.questions.map((_, index) => rounds[Math.floor(index / count)][(offset + index) % count]);
            // Prefer unused locations. Distinct rotations also prevent the same
            // question being assigned to the same station for the first 8 crew.
            const score = (offset) => stationsFor(offset).reduce((sum, station) => sum + usage.get(station.id), 0);
            const offset = offsets.reduce((best, candidate) => score(candidate) < score(best) ? candidate : best);
            offsets.splice(offsets.indexOf(offset), 1);
            const stations = stationsFor(offset);
            room.taskAssignments[player.id] = stations.map((station) => station.id);
            stations.forEach((station) => usage.set(station.id, usage.get(station.id) + 1));
            room.taskCompletions[player.id] = [];
        }
    },

    progress(room) {
        const crew = Object.keys(room.taskCompletions || {}).filter((id) => room.players[id]);
        return {
            completed: crew.reduce((count, id) => count + room.taskCompletions[id].length, 0),
            total: crew.length * room.questions.length,
        };
    },

    snapshot(room, playerId) {
        const isImposter = room.imposter === playerId;
        const completed = room.taskCompletions?.[playerId] || [];
        return {
            roomId: room.id,
            isImposter,
            questions: room.questions,
            useRadius: TASK_USE_RADIUS,
            tasks: isImposter ? [] : room.questions.map((question, index) => ({
                id: question.id,
                station: TASK_STATIONS.find((station) => station.id === room.taskAssignments?.[playerId]?.[index]),
                completed: completed.includes(question.id),
            })),
            progress: this.progress(room),
        };
    },

    submit(room, playerId, taskId, optionIndex) {
        if (!room?.started) return { ok: false, message: "Ván chơi chưa bắt đầu hoặc đã kết thúc." };
        const player = room.players[playerId];
        if (!player || playerId === room.imposter || !room.taskCompletions?.[playerId]) {
            return { ok: false, message: "Chỉ crewmate trong phòng mới được làm nhiệm vụ." };
        }
        if (room.currentMeeting?.isActive) return { ok: false, message: "Hãy chờ cuộc họp kết thúc." };
        const index = room.questions.findIndex((q) => q.id === taskId);
        if (index < 0) return { ok: false, message: "Không tìm thấy câu hỏi." };
        const question = room.questions[index];
        if (room.taskCompletions[playerId].includes(taskId)) {
            return { ok: true, correct: true, alreadyCompleted: true, explain: question.explain };
        }
        const station = TASK_STATIONS.find((item) => item.id === room.taskAssignments?.[playerId]?.[index]);
        if (!station) return { ok: false, message: "Nhiệm vụ chưa được phân vị trí. Hãy bắt đầu ván mới." };
        if (!Number.isFinite(player.state.x) || !Number.isFinite(player.state.y) ||
            Math.hypot(player.state.x - station.x, player.state.y - station.y) > TASK_USE_RADIUS) {
            return { ok: false, message: "Bạn cần đến gần điểm nhiệm vụ để trả lời." };
        }
        if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) {
            return { ok: false, message: "Hãy chọn một đáp án hợp lệ." };
        }
        const correct = question.options[optionIndex] === question.answer;
        if (correct) room.taskCompletions[playerId].push(taskId);
        return { ok: true, correct, explain: correct ? question.explain : "", message: correct
            ? "Trả lời đúng! Nhiệm vụ đã hoàn thành."
            : "Chưa chính xác. Hãy suy nghĩ và thử lại." };
    },
};

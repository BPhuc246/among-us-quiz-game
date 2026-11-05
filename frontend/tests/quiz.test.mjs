import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { io as connect } from "socket.io-client";
import { TasksManager, TASK_STATIONS } from "../../backend/src/managers/tasks.manager.js";
import { RoomsManager } from "../../backend/src/managers/rooms.manager.js";
import { registerRoomEvents } from "../../backend/src/events/roomEvents.js";
import { registerGameEvents } from "../../backend/src/events/gameEvents.js";
import { registerTaskEvents } from "../../backend/src/events/taskEvents.js";

const { Server } = createRequire(new URL("../../backend/package.json", import.meta.url))("socket.io");

const questions = [
    { id: "q1", title: "2 + 2?", description: "Chọn đáp án.", options: [3, 4], answer: 4, explain: "2 + 2 = 4." },
    { id: "q2", title: "Hành tinh Đỏ?", description: "Chọn đáp án.", options: ["Sao Hỏa", "Sao Kim"], answer: "Sao Hỏa", explain: "Sao Hỏa có màu đỏ." },
];
const fixture = () => ({ id: "unit", started: true, imposter: "imposter", questions,
    players: Object.fromEntries(["crew", "ghost", "imposter"].map((id) => [id, { id, isAlive: id !== "ghost", state: { x: 560, y: 210 } }])),
});
const moveToTask = (room, playerId, taskId) => {
    const task = TasksManager.snapshot(room, playerId).tasks.find((item) => item.id === taskId);
    room.players[playerId].state = { ...room.players[playerId].state, x: task.station.x, y: task.station.y };
};

test("random assignments are personal, stable and avoid overlap when stations suffice", () => {
    const room = fixture();
    TasksManager.initialize(room, () => 0);
    const crew = TasksManager.snapshot(room, "crew");
    const ghost = TasksManager.snapshot(room, "ghost");
    const assigned = [...crew.tasks, ...ghost.tasks].map((task) => task.station.id);
    assert.equal(new Set(assigned).size, 4);
    assert.equal(room.taskAssignments.imposter, undefined);
    assert.deepEqual(TasksManager.snapshot(room, "crew").tasks, crew.tasks);
    moveToTask(room, "crew", "q1");
    assert.equal(TasksManager.submit(room, "crew", "q1", 1).correct, true);
    assert.deepEqual(TasksManager.snapshot(room, "crew").tasks.map((task) => task.station), crew.tasks.map((task) => task.station));
    // Standing at a teammate's station must not satisfy your own assignment.
    room.players.ghost.state = { ...room.players.crew.state };
    assert.equal(TasksManager.submit(room, "ghost", "q1", 1).ok, false);
    const previous = structuredClone(room.taskAssignments);
    TasksManager.initialize(room, () => 0.999);
    assert.notDeepEqual(room.taskAssignments, previous);
    assert.deepEqual(TasksManager.progress(room), { completed: 0, total: 4 });
});

test("long question banks and large crews get valid balanced assignments", () => {
    const room = fixture();
    room.questions = Array.from({ length: 19 }, (_, i) => ({ ...questions[0], id: `q${i}` }));
    room.players = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`crew${i}`, { id: `crew${i}` }]));
    TasksManager.initialize(room, () => 0.25);
    for (const playerId of Object.keys(room.players)) {
        const tasks = TasksManager.snapshot(room, playerId).tasks;
        assert.equal(tasks.length, 19);
        assert.ok(tasks.every((task) => TASK_STATIONS.includes(task.station)));
        for (let i = 0; i < tasks.length; i += 8) {
            const block = tasks.slice(i, i + 8);
            assert.equal(new Set(block.map((task) => task.station.id)).size, block.length);
        }
    }
    for (let q = 0; q < 19; q++) {
        const firstEight = Object.keys(room.players).slice(0, 8).map((id) => room.taskAssignments[id][q]);
        assert.equal(new Set(firstEight).size, 8);
    }
});

test("JSON validation rejects ambiguous answers and duplicate ids", () => {
    assert.equal(RoomsManager.parseQuestions("test", questions).length, 2);
    assert.equal(RoomsManager.parseQuestions("test", [...questions, questions[0]]).length, 2);
    for (const bad of [{ ...questions[0], answer: "4" }, { ...questions[0], options: [4] }, { ...questions[0], options: [4, 4] }]) {
        assert.deepEqual(RoomsManager.parseQuestions("test", [bad]), []);
    }
});

test("tasks keep personal progress, allow ghosts, reject impostors and count correct answers once", () => {
    const room = fixture();
    TasksManager.initialize(room);
    assert.deepEqual(TasksManager.progress(room), { completed: 0, total: 4 });
    moveToTask(room, "crew", "q1");
    assert.equal(TasksManager.submit(room, "crew", "q1", 0).correct, false);
    assert.equal(TasksManager.submit(room, "crew", "q1", 1).correct, true);
    assert.equal(TasksManager.submit(room, "crew", "q1", 1).alreadyCompleted, true);
    assert.equal(TasksManager.submit(room, "imposter", "q1", 1).ok, false);
    moveToTask(room, "ghost", "q1");
    assert.equal(TasksManager.submit(room, "ghost", "q1", 1).correct, true);
    assert.deepEqual(TasksManager.progress(room), { completed: 2, total: 4 });
    assert.equal(TasksManager.snapshot(room, "imposter").tasks.length, 0);
    delete room.players.ghost;
    assert.deepEqual(TasksManager.progress(room), { completed: 1, total: 2 });
});

test("tasks require a running game, proximity, valid choices and no meeting", () => {
    const room = fixture();
    TasksManager.initialize(room);
    moveToTask(room, "crew", "q1");
    assert.equal(TasksManager.submit(room, "crew", "missing", 1).ok, false);
    assert.equal(TasksManager.submit(room, "crew", "q1", 99).ok, false);
    assert.equal(TasksManager.submit(room, "crew", "q1", "1").ok, false);
    room.players.crew.state = { x: 0, y: 0 };
    assert.equal(TasksManager.submit(room, "crew", "q1", 1).ok, false);
    moveToTask(room, "crew", "q1");
    room.currentMeeting = { isActive: true };
    assert.equal(TasksManager.submit(room, "crew", "q1", 1).ok, false);
    room.currentMeeting = null;
    room.started = false;
    assert.equal(TasksManager.submit(room, "crew", "q1", 1).ok, false);
});

test("every station is on clear floor reachable from the spawn", async () => {
    const map = JSON.parse(await readFile(new URL("../public/assets/map/map.json", import.meta.url), "utf8"));
    const layer = map.layers.find((item) => item.name === "collisions");
    const start = Math.floor(150 / 8) * map.width + Math.floor(560 / 8);
    const visited = new Set([start]);
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
        const index = queue[i], x = index % map.width, y = Math.floor(index / map.width);
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
            const next = ny * map.width + nx;
            if (nx >= 0 && ny >= 0 && nx < map.width && ny < map.height && !layer.data[next] && !visited.has(next)) {
                visited.add(next); queue.push(next);
            }
        }
    }
    for (const station of TASK_STATIONS) {
        assert.ok(visited.has(Math.floor(station.y / 8) * map.width + Math.floor(station.x / 8)), station.name);
    }
});

const once = (socket, event) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, handler); reject(new Error(`Timeout: ${event}`)); }, 5000);
    const handler = (data) => { clearTimeout(timer); resolve(data); };
    socket.once(event, handler);
});

test("multiplayer: complete JSON, identity checks, task sync and crew victory", async (t) => {
    const http = createServer();
    const io = new Server(http);
    io.on("connection", (socket) => {
        registerRoomEvents(io, socket);
        registerGameEvents(io, socket);
        registerTaskEvents(io, socket);
    });
    await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
    const clients = [];
    t.after(async () => {
        clients.forEach((client) => client.disconnect());
        await new Promise((resolve) => io.close(resolve));
    });
    const url = `http://127.0.0.1:${http.address().port}`;
    const roomId = `quiz-test-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
        const client = connect(url, { transports: ["websocket"], forceNew: true });
        clients.push(client);
        await once(client, "connect");
        const registered = once(client, "player:registered");
        client.emit("player:register", { id: `quiz-player-${i}`, name: `Test ${i}`, color: "#c51111" });
        await registered;
        const joined = once(client, "room:joined");
        client.emit(i === 0 ? "room:create" : "room:join", i === 0
            ? { hostId: "quiz-player-0", roomId, questions }
            : { playerId: `quiz-player-${i}`, roomId });
        await joined;
    }
    const questionEvents = clients.map((client) => once(client, "game:questions"));
    clients[0].emit("game:start", { roomId });
    const payloads = await Promise.all(questionEvents);
    for (const payload of payloads) assert.deepEqual(payload.questions, questions.map((q) => ({ ...q, roomId })));
    const snapshots = await Promise.all(clients.map(async (client) => {
        const snapshot = once(client, "game:tasks"); client.emit("tasks:get", { roomId }); return snapshot;
    }));
    const room = RoomsManager.fetchRoom(roomId);
    assert.equal((await clients[0].timeout(3000).emitWithAck("task:answer", null)).ok, false);
    const imposterIndex = snapshots.findIndex((state) => state.isImposter);
    const crews = [0, 1, 2].filter((index) => index !== imposterIndex);
    assert.notDeepEqual(snapshots[crews[0]].tasks.map((task) => task.station.id), snapshots[crews[1]].tasks.map((task) => task.station.id));
    const answer = (index, taskId, optionIndex, extra = {}) => clients[index].timeout(3000).emitWithAck("task:answer", { roomId, taskId, optionIndex, ...extra });
    assert.equal((await answer(imposterIndex, "q1", 1)).ok, false);
    assert.equal((await answer(crews[0], "q2", 0)).ok, false); // Outside station range.
    // A client cannot submit on behalf of another crewmate or move their sprite.
    clients[imposterIndex].emit("player:move", { roomId, id: `quiz-player-${crews[0]}`, x: 999, y: 999 });
    await answer(imposterIndex, "q1", 1);
    assert.equal(room.players[`quiz-player-${crews[0]}`].state.x, 560);
    const ended = clients.map((client) => once(client, "game:ended"));
    for (const index of crews) {
        for (let q = 0; q < questions.length; q++) {
            const station = snapshots[index].tasks[q].station;
            clients[index].emit("player:move", { roomId, id: `quiz-player-${index}`, x: station.x, y: station.y, d: "left", moving: false });
            if (q === 0) {
                assert.equal((await answer(index, "q1", 0)).correct, false);
                room.currentMeeting = { isActive: true };
                assert.equal((await answer(index, "q1", 1)).ok, false);
                room.currentMeeting = null;
            }
            // Ghosts retain tasks.
            room.players[`quiz-player-${index}`].isAlive = false;
            assert.equal((await answer(index, questions[q].id, q === 0 ? 1 : 0)).correct, true);
            if (q === 0) assert.equal((await answer(index, "q1", 1, { playerId: "someone-else" })).alreadyCompleted, true);
        }
    }
    for (const result of await Promise.all(ended)) assert.deepEqual(result, { roomId, isImposter: false, reason: "tasks" });
    assert.deepEqual(TasksManager.progress(room), { completed: 4, total: 4 });
    assert.equal((await answer(crews[0], "q1", 1)).ok, false);
});

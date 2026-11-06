import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { io as connect } from "socket.io-client";
import { addDeadBody, clearDeadBodies, nearestReportableBody, updateBodyReporting } from "../src/game/utils/bodyReporting.js";
import { registerGameEvents } from "../../backend/src/events/gameEvents.js";
import { registerRoomEvents } from "../../backend/src/events/roomEvents.js";
import { RoomsManager } from "../../backend/src/managers/rooms.manager.js";
const { Server } = createRequire(new URL("../../backend/package.json", import.meta.url))("socket.io");

test("corpse rendering uses real frames; reporting respects range and living players; cleanup cancels animations", async () => {
    const atlas = JSON.parse(await readFile(new URL("../public/assets/death/texture.json", import.meta.url), "utf8"));
    const frames = atlas.textures.flatMap((texture) => texture.frames.map((frame) => frame.filename));
    assert.ok(frames.includes("Dead0001") && frames.includes("Dead0042"));
    const scene = { deadBodies: new Map(), worldContainer: { add(sprite) { sprite.inWorld = true; } },
        player: { x: 100, y: 100 }, VISION_RADIUS: 100, visionEnabled: true,
        add: { sprite(x, y, texture, frame) {
            return { x, y, texture, frame, active: true, anims: {
                play() { this.playing = true; }, stop() { this.playing = false; },
            }, setScale() { return this; }, setDepth() { return this; }, destroy() { this.active = false; } };
        } },
    };
    const body = addDeadBody(scene, { playerId: "victim", x: 130, y: 100, color: "#117f2d" }, (_, sprite, color) => { sprite.color = color; });
    assert.ok(body.inWorld && body.anims.playing);
    assert.equal(body.color, "#117f2d");
    assert.ok(frames.includes(body.frame));
    assert.equal(nearestReportableBody(scene), body);
    addDeadBody(scene, { playerId: "victim", x: 999, y: 999 }, () => {});
    assert.equal(scene.deadBodies.size, 1);
    scene.player.x = 300;
    updateBodyReporting(scene);
    assert.equal(body.visible, false);
    assert.equal(nearestReportableBody(scene), null);
    scene.player.x = 100;
    for (const flag of ["isGhost", "meetingActive", "quizOpen"]) {
        scene[flag] = true;
        assert.equal(nearestReportableBody(scene), null);
        scene[flag] = false;
    }
    // Clearing during the death animation must leave no corpse to report later.
    clearDeadBodies(scene);
    assert.equal(scene.deadBodies.size, 0);
    assert.equal(body.active, false);
    assert.equal(body.anims.playing, false);
    assert.equal(nearestReportableBody(scene), null);
    const next = addDeadBody(scene, { playerId: "another-victim", x: 120, y: 100 }, () => {});
    assert.equal(nearestReportableBody(scene), next);
});

const once = (socket, event) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, handler); reject(new Error("Timeout: " + event)); }, 4000);
    const handler = (data) => { clearTimeout(timer); resolve(data); };
    socket.once(event, handler);
});

async function createGame(t) {
    const http = createServer();
    const server = new Server(http);
    server.on("connection", (socket) => { registerRoomEvents(server, socket); registerGameEvents(server, socket); });
    await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
    const roomId = "report-test-" + Date.now() + "-" + Math.random();
    const clients = [];
    const ids = [];
    t.after(async () => {
        RoomsManager.meetings.end(roomId);
        clients.forEach((socket) => socket.disconnect());
        await new Promise((resolve) => server.close(resolve));
    });
    for (let i = 0; i < 4; i++) {
        const socket = connect("http://127.0.0.1:" + http.address().port, { transports: ["websocket"], forceNew: true });
        clients.push(socket);
        await once(socket, "connect");
        const id = roomId + "-player-" + i;
        ids.push(id);
        const registered = once(socket, "player:registered");
        socket.emit("player:register", { id, name: "Player " + i, color: ["#c51111", "#117f2d", "#132ed1", "#f5f557"][i] });
        await registered;
        const joined = once(socket, "room:joined");
        socket.emit(i === 0 ? "room:create" : "room:join", i === 0 ? { hostId: id, roomId,
            questions: [{ id: "q1", title: "2+2?", description: "", options: [3, 4], answer: 4, explain: "4" }],
        } : { playerId: id, roomId });
        await joined;
    }
    const start = once(clients[0], "game:started");
    clients[0].emit("game:start", { roomId }); await start;
    const room = RoomsManager.fetchRoom(roomId);
    const killer = ids.indexOf(room.imposter);
    const victim = ids.findIndex((id) => id !== room.imposter);
    const reporter = ids.findIndex((id, index) => id !== room.imposter && index !== victim);
    const killed = once(clients[reporter], "player:killed");
    clients[killer].emit("player:kill", { roomId, killerId: ids[killer], playerId: ids[victim], x: 999, y: 999, color: "wrong-color" });
    const body = await killed;
    assert.equal(body.color, room.players[ids[victim]].color);
    assert.equal(body.x, 560);
    assert.equal(body.y, 150);
    assert.ok(room.started); // Four players prevents this kill immediately ending the game.
    const move = (index, x, y) => clients[index].emit("player:move", { roomId, id: ids[index], x, y, d: "left", moving: false });
    const report = (index, extra = {}) => clients[index].timeout(3000).emitWithAck("body:report", { roomId, bodyId: ids[victim], ...extra });
    return { room, roomId, clients, ids, killer, victim, reporter, body, move, report };
}

test("report opens one meeting for everyone and clears all bodies after all votes, including a tie", async (t) => {
    const g = await createGame(t);
    const { room, roomId, clients, ids, victim, reporter, killer, body, move, report } = g;
    assert.equal((await clients[reporter].timeout(3000).emitWithAck("body:report", null)).ok, false);
    assert.equal((await report(reporter, { roomId: "another-room" })).ok, false);
    assert.equal((await report(reporter, { bodyId: "__proto__" })).ok, false);
    move(reporter, 0, 0);
    assert.equal((await report(reporter)).ok, false);
    assert.equal((await report(victim, { callerId: ids[reporter] })).ok, false);
    move(victim, 945, 240); // Moving the ghost does not move their corpse.
    move(reporter, body.x, body.y);
    const meetings = clients.map((socket) => once(socket, "meeting:started"));
    assert.equal((await report(reporter)).ok, true);
    for (const meeting of await Promise.all(meetings)) {
        assert.equal(meeting.reason, "report");
        assert.equal(meeting.bodyId, ids[victim]);
        assert.equal(meeting.callerId, ids[reporter]);
        assert.equal(meeting.players[ids[victim]].isAlive, false);
    }
    assert.equal((await report(killer)).ok, false); // Already in a meeting.
    assert.ok(room.deadBodies[ids[victim]]);
    const ended = clients.map((socket) => once(socket, "meeting:ended"));
    for (let i = 0; i < clients.length; i++) {
        if (i !== victim) clients[i].emit("meeting:vote", { roomId, callerId: ids[i], votedForId: null });
    }
    for (const event of await Promise.all(ended)) {
        assert.equal(event.results.ejectedId, null);
        assert.equal(event.results.tie, true);
    }
    assert.deepEqual(room.deadBodies, {});
    assert.equal((await report(reporter)).ok, false); // Cleared corpses cannot open another meeting.
    assert.equal(room.started, true);
});

test("emergency meetings also remove unreported corpses when ending without any votes", async (t) => {
    const { room, roomId, clients, ids, reporter } = await createGame(t);
    const started = once(clients[reporter], "meeting:started");
    clients[reporter].emit("meeting:start", { roomId, callerId: ids[reporter] });
    await started;
    const ended = once(clients[reporter], "meeting:ended");
    clients[reporter].emit("meeting:end", { roomId });
    const result = await ended;
    assert.equal(result.results.ejectedId, null);
    assert.deepEqual(room.deadBodies, {});
});

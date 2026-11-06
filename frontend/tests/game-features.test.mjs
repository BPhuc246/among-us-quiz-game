import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { registerHooks } from "node:module";

// Run the real Game scene and feature modules with a small rendering adapter.
// This covers the scene wiring that server-only tests cannot exercise.
const runtime = { bus: new EventEmitter(), socket: null };
globalThis.__gameFeatureTest = runtime;
const shims = {
    "./BaseGameScene.js": "export class BaseGameScene { shutdown() { this.baseStopped = true; } }",
    "../shaders/fragShader.js": "export class GrayPipeline {} export class VisionRadiusPipeline {}",
    "../../services/socket.js": "export const socketService = { getSocket: () => globalThis.__gameFeatureTest.socket };",
    "../utils/playerFactory.js": "export const setPlayerColor = () => {};",
    "../utils/imposter.js": "export const handleImposter = () => {}; export const handleImposterMovement = () => {}; export const cleanupImposter = () => {};",
    "../utils/vision.js": "export const setupVisionSystem = () => {}; export const updateVisionSystem = () => {}; export const disableVisionSystem = s => { s.visionEnabled = false; }; export const enableVisionSystem = s => { s.visionEnabled = true; };",
    "../EventBus.js": "export const EventBus = globalThis.__gameFeatureTest.bus;",
};
const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        if (shims[specifier] && context.parentURL?.includes("/src/game/")) {
            return { url: "data:text/javascript," + encodeURIComponent(shims[specifier]), shortCircuit: true };
        }
        return nextResolve(specifier, context);
    },
});
const { Game } = await import("../src/game/scenes/Game.js");
hooks.deregister();
const { setupVisionSystem } = await import("../src/game/utils/vision.js");

test("vision uses the displayed map dimensions for the updated high resolution artwork", () => {
    const scene = {
        player: {}, collisionLayer: { width: 1008, height: 560, setPipeline() {} },
        background: { width: 3840, height: 2223, displayWidth: 1008, displayHeight: 560, setPipeline() {} },
        mapObjects: [],
    };
    setupVisionSystem(scene);
    assert.deepEqual(scene.mapObjectBounds[0].size, { width: 1008, height: 560 });
});

function displayObject(x = 0, y = 0) {
    const object = Object.assign(new EventEmitter(), { x, y, visible: true, active: true });
    for (const method of ["setScale", "setDepth", "setScrollFactor", "setInteractive", "setStrokeStyle", "setOrigin", "setTexture", "add"]) {
        object[method] = () => object;
    }
    object.setVisible = (visible) => { object.visible = visible; return object; };
    object.destroy = () => { object.active = false; };
    object.body = { setCircle() {}, setAllowGravity() {}, setVelocity() {} };
    object.anims = { play() { this.playing = true; }, stop() { this.playing = false; } };
    return object;
}

async function createScene() {
    const sent = [];
    const socket = new EventEmitter();
    socket.emit = (event, ...args) => { sent.push({ event, args }); return true; };
    socket.timeout = () => ({ emit(event, ...args) {
        sent.push({ event, args: args.slice(0, -1) });
        args.at(-1)(null, { ok: true });
    } });
    runtime.socket = socket;
    const scene = new Game();
    const keyboard = Object.assign(new EventEmitter(), { enabled: true, resetKeys() {} });
    const animations = [];
    Object.assign(scene, {
        sys: { isActive: () => true },
        input: Object.assign(new EventEmitter(), { keyboard }),
        physics: { add: { sprite: displayObject }, overlap: () => false, pause() {}, resume() {} },
        add: { image: displayObject, sprite: displayObject, container: displayObject, circle: displayObject, text: displayObject },
        game: { renderer: { pipelines: { has: () => true, add() {} } } },
        anims: { exists: () => false, create: (config) => animations.push(config), generateFrameNames: (_, config) => { assert.equal(config.start, 1); return []; } },
        createCommon: async () => {},
        handleMovement() {},
        player: displayObject(100, 100),
        playerObj: { id: "crew", state: { d: "left" } },
        players: {}, ghosts: {}, spawnPositions: {},
        room: { id: "feature-room", players: { crew: { isAlive: true }, victim: { isAlive: true } }, deadBodies: {} },
        ui: { add() {} }, worldContainer: { add() {} },
        imposterProm: Promise.resolve(false),
    });
    scene.create();
    await new Promise(setImmediate);
    return { scene, socket, sent, keyboard, animations };
}

test("entering Game loads random assignments, displays task markers and connects task interaction", async (t) => {
    const { scene, socket, sent, keyboard } = await createScene();
    t.after(() => { scene.shutdown(); runtime.bus.removeAllListeners(); });
    assert.ok(sent.some(({ event, args }) => event === "tasks:get" && args[0].roomId === scene.room.id));
    const snapshot = { roomId: scene.room.id, useRadius: 55, tasks: [
        { id: "q1", station: { id: "a", name: "A", x: 125, y: 100 }, completed: false },
        { id: "q2", station: { id: "b", name: "B", x: 300, y: 100 }, completed: false },
    ] };
    let hudState;
    socket.on("game:tasks", (state) => { hudState = state; });
    EventEmitter.prototype.emit.call(socket, "game:tasks", snapshot);
    assert.equal(hudState, snapshot);
    assert.equal(scene.quizMarkers.length, 2);
    let nearby, opened;
    runtime.bus.on("quiz:nearby", (data) => { nearby = data; });
    runtime.bus.on("quiz:open", (id) => { opened = id; });
    scene.update();
    assert.equal(nearby.taskId, "q1");
    assert.equal(nearby.canUse, true);
    assert.equal(scene.quizMarkers[0].visible, true);
    assert.equal(scene.quizMarkers[1].visible, false);
    keyboard.emit("keydown-E");
    assert.equal(opened, "q1");
    assert.equal(keyboard.enabled, false);
    runtime.bus.emit("quiz:close");
    assert.equal(keyboard.enabled, true);
    snapshot.tasks[0].completed = true;
    EventEmitter.prototype.emit.call(socket, "game:tasks", snapshot);
    assert.equal(scene.quizMarkers.length, 1);
    assert.equal(scene.quizMarkers[0].x, 300);
});

test("a kill creates a reportable corpse; reporting, meetings and scene cleanup use the same feature state", async (t) => {
    const { scene, socket, sent, keyboard } = await createScene();
    t.after(() => runtime.bus.removeAllListeners());
    EventEmitter.prototype.emit.call(socket, "player:killed", { playerId: "victim", x: 125, y: 100, color: "#c51111" });
    assert.equal(scene.deadBodies.size, 1);
    assert.equal(scene.room.players.victim.isAlive, false);
    scene.update();
    assert.equal(scene.reportBtn.visible, true);
    keyboard.emit("keydown-R");
    assert.ok(sent.some(({ event, args }) => event === "body:report" && args[0].bodyId === "victim"));
    EventEmitter.prototype.emit.call(socket, "meeting:started", { callerId: "crew", players: scene.room.players });
    assert.equal(scene.reportBtn.visible, false);
    EventEmitter.prototype.emit.call(socket, "meeting:ended", { results: { ejectedId: null } });
    assert.equal(scene.deadBodies.size, 0);
    assert.equal(scene.reportBtn.visible, false);
    scene.shutdown();
    for (const event of ["player:killed", "game:tasks", "meeting:started", "meeting:ended", "game:ended"]) {
        assert.equal(socket.listenerCount(event), 0, event);
    }
    assert.equal(keyboard.listenerCount("keydown-R"), 0);
    assert.equal(keyboard.listenerCount("keydown-E"), 0);
    assert.equal(scene.baseStopped, true);
});

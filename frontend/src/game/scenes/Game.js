import { BaseGameScene } from './BaseGameScene.js';
import { GrayPipeline, VisionRadiusPipeline } from "../shaders/fragShader.js";
import { socketService } from '../../services/socket.js';
import { setPlayerColor } from "../utils/playerFactory.js";
import {EventBus} from "../EventBus.js";
import { handleImposter, handleImposterMovement } from "../utils/imposter.js";
import { setupVisionSystem, disableVisionSystem, updateVisionSystem, enableVisionSystem} from "../utils/vision.js";
import { TaskManager } from "../tasks/TaskManager.js";
import { EventBus } from "../EventBus.js";
import {
    setupQuizTasks,
    updateQuizTasks,
    cleanupQuizTasks,
} from "../utils/quizTasks.js";
import {
    addDeadBody,
    clearDeadBodies,
    setupBodyReporting,
    updateBodyReporting,
    cleanupBodyReporting,
} from "../utils/bodyReporting.js";
import {
    handleImposter,
    handleImposterMovement,
    cleanupImposter,
} from "../utils/imposter.js";
import {
    setupVisionSystem,
    disableVisionSystem,
    updateVisionSystem,
    enableVisionSystem,
} from "../utils/vision.js";

export class Game extends BaseGameScene {

    // ====== CONFIGURATION AND INITIALIZATION ======
    constructor() {
        super('Game');
    }

    /**
     * Initialize scene with data from previous scene
     * @param {Object} data - Scene initialization data
     * @param {boolean} data.isImposter - Whether the local player is the imposter
     */
    init(data) {
        // TODO: Refactor to use player.isImposter instead of promise pattern
        console.log('Game scene init with data:', data);
        this.imposterProm = data.isImposter;
    }

    /**
     * Game-specific map configuration
     * @returns {Object} Map configuration object
     */
    getMapConfig() {
        return {
            mapKey: 'gameMapJSON',
            mapJSON: 'map.json',
            tilesetName: 'red',
            tilesetKey: 'red',
            backgroundKey: 'skled',
            backgroundImage: 'skled.png'
        };
    }

    setupMeetingZone() {
        this.meetingZone = this.physics.add.sprite(530, 100);
        if (this.meetingZone.body) {
            this.meetingZone.body.setCircle(50);
            this.meetingZone.body.setAllowGravity(false);
            this.meetingZone.visible = false;
        }
        this.meetingBtn = this.add.image(220, 410, 'meeting')
            .setScale(0.7)
            .setDepth(1000)
            .setScrollFactor(0)
            .setInteractive()
            .on('pointerdown', () => {
                this.startMeeting();
            });
        this.ui.add(this.meetingBtn);
    }

    // ====== PHASER LIFECYCLE METHODS ======
    /**
     * Preload game assets
     */
    preload() {
        this.preloadCommon();
        this.preloadMap();
        this.load.image('kill', 'assets/icons/kill_icon.png');
        this.load.atlas('death', 'assets/death/texture.png', 'assets/death/texture.json');
        this.load.image('deadBody', 'assets/sprites/Base/Dead0042.png');
        this.load.image('meeting', '/assets/icons/useIcon.png');
        this.preloadGhostAssets();
        this.preloadKillAssets();
        this.load.image("kill", "assets/icons/kill_icon.png");
        this.load.atlas(
            "death",
            "assets/death/texture.png",
            "assets/death/texture.json",
        );
        this.load.image("report", "assets/icons/reportBtn.png");
        this.load.image("meeting", "/assets/icons/useIcon.png");
    }

    /**
     * Create scene objects and initialize game state
     */
    create() {
        // stored promise for imposter role assignment
        const prom1 = this.createCommon();
        this.deadBodies = new Map();
        this.meetingActive = false;
        this.socket = socketService.getSocket();
        this.input.on('pointerdown', (pointer) => {
            console.log(
                'screen:', pointer.x, pointer.y,
                'world:', pointer.worldX, pointer.worldY
            );
        });

        this.game.renderer.pipelines.add('GrayScale', new GrayPipeline(this.game));
        this.game.renderer.pipelines.add('VisionRadius', new VisionRadiusPipeline(this.game));
        const pipelines = this.game.renderer.pipelines;
        if (!pipelines.has("GrayScale")) {
            pipelines.add("GrayScale", new GrayPipeline(this.game));
        }
        if (!pipelines.has("VisionRadius")) {
            pipelines.add("VisionRadius", new VisionRadiusPipeline(this.game));
        }

        this.closest = { player: null, distance: 60 };

        this.VISION_RADIUS = 100;
        this.visionEnabled = true;
        this.mapObjects = [];

        this.createAnimations();
        this.handleGameEvents();

        // Wait for both player setup and imposter role assignment before initializing imposter mechanics
        Promise.all([prom1, this.imposterProm]).then((results) => {
            if (!this.sys.isActive() || !this.player?.body) return;
            console.log(
                "Creating imposter elements",
                prom1,
                this.imposterProm,
                results,
            );
            this.imposter = results[1];
            handleImposter(this);
            setupVisionSystem(this);
            this.setupMeetingZone();
            this.isInMeetingZone = false;

            // Task 3: initialize the five Skeld task highlights and interaction zones.
            this.taskManager = new TaskManager(this);
            setupQuizTasks(this);
            setupBodyReporting(this);
            for (const body of Object.values(this.room.deadBodies || {}))
                addDeadBody(this, body, setPlayerColor);
        });
    }

    /**
     * Update game state every frame
     * @param {number} time - Total elapsed time in milliseconds
     * @param {number} delta - Time elapsed since last frame in milliseconds
     */
    update(time, delta) {
        if (!this.player) return;

        this.handleMovement();
        this.taskManager?.update();
        if (!this.taskModalOpen) {
            handleImposterMovement(this);
        }
        updateQuizTasks(this);
        updateBodyReporting(this);
        handleImposterMovement(this);

        // Update vision system
        if (this.visionEnabled && this.player) {
            updateVisionSystem(this);
        }

        if (
            this.meetingZone &&
            !this.isGhost &&
            !this.meetingActive &&
            !this.quizOpen &&
            this.physics.overlap(this.player, this.meetingZone)
        ) {
            if (!this.isInMeetingZone) {
                this.isInMeetingZone = true;
                this.meetingBtn.visible = true;
            }
        } else if (this.isInMeetingZone) {
            this.isInMeetingZone = false;
            this.meetingBtn.visible = false;
        }
    }

    /**
     * Clean up scene resources and event listeners
     */
    shutdown() {
        this.taskManager?.destroy();
        this.taskManager = null;

        cleanupBodyReporting(this);
        cleanupQuizTasks(this);
        cleanupImposter(this);
        if (this.socket) {
            if (this.onPlayerKilled) {
                this.socket.off('player:killed', this.onPlayerKilled);
                this.onPlayerKilled = null;
            }
            if (this.onMeetingStarted) {
                this.socket.off('meeting:started', this.onMeetingStarted);
                this.onMeetingStarted = null;
            }
            if (this.onMeetingEnded) {
                this.socket.off('meeting:ended', this.onMeetingEnded);
                this.onMeetingEnded = null;
            }
            if (this.onGameEnd) {
                this.socket.off('game:end', this.onGameEnd);
                this.onGameEnd = null;
            }
        }
        super.shutdown();
    }

    // ANIMATION SETUP
    /**
     * Create death animation for killed players
     */
    createAnimations() {
        if (this.anims.exists("deathAnim")) return;
        this.anims.create({
            key: 'deathAnim',
            frames: this.anims.generateFrameNames('death', {
                prefix: 'Dead',
                start: 0,
                end: 42,
                zeroPad: 4
            }),
            frameRate: 20,
            repeat: 0
        });
    }

    // EVENT HANDLERS
    /**
     * Register socket event handlers for multiplayer game events
     */
    handleGameEvents() {
        if (!this.socket) return;

        this.onPlayerKilled = (data) => {
            console.log("Player killed event received:", data);

            // Normalize player IDs to strings for comparison
            const targetId = String(data.playerId);
            const localId = this.playerObj?.id ?? this.player?.id;

            const killedPlayer = (targetId === String(localId)) ? this.player : this.players[targetId];

            // Move the killer sprite so all clients see imposter at the body
            const killerId = data.killerId ? String(data.killerId) : null;
            if (killerId) {
                const killerSprite = (killerId === String(localId)) ? this.player : this.players[killerId];
                if (killerSprite && killerSprite !== killedPlayer) {
                    killerSprite.x = data.x;
                    killerSprite.y = data.y;
                }
            }

            killedPlayer.alive = false;
            if (killedPlayer.destroy) killedPlayer.destroy();

            const deathAnim = this.add.sprite(data.x, data.y, 'death', 'Dead0001.png')
                .setScale(0.125)
                .setDepth(600);
            setPlayerColor(this, deathAnim, data.color);
            deathAnim.anims.play('deathAnim');
            deathAnim.on('animationcomplete', () => {
                this.add.sprite(deathAnim.x, deathAnim.y, 'deadBody')
                    .setScale(0.125)
                    .setDepth(500);
                deathAnim.destroy();
            });
            if (isLocalTarget) {
                EventBus.emit("quiz:cancel");
                // Mình bị giết: hiện kill cinematic (màu imposter + victim) rồi chuyển sang ghost
                const killerColor = data.color || data.killerColor;
                const victimColor = this.playerObj?.color;
                this.showKillScreen(killerColor, victimColor);
                this.enterGhostMode();
                disableVisionSystem(this);
            } else if (this.isGhost) {
                // Mình đã chết: vẫn thấy người chết khác dưới dạng ghost
                const sprite = this.players[targetId];
                delete this.players[targetId];
                if (sprite) {
                    this.makeGhost(sprite);
                    this.ghosts[targetId] = sprite;
                }
            } else {
                // Người còn sống: người bị giết biến mất hoàn toàn
                if (killedSprite) killedSprite.destroy();
                delete this.players[targetId];
            }

            if (this.room?.players[targetId])
                this.room.players[targetId].isAlive = false;
            addDeadBody(this, data, setPlayerColor);
        };

        this.onMeetingStarted = (data) => {
            console.log("Meeting started event received:", data);
            this.meetingActive = true;
            this.reportBtn?.setVisible(false);
            this.room.players = data.players || this.room.players;
            this.physics.pause(); // Pause physics
            disableVisionSystem(this);
            console.log("Meeting started, players teleported to spawn.", data, this.room.players);
            // Recieved by react
            EventBus.emit('meeting:started', {
                roomId: this.room.id,
                callerId: data.callerId,
                players: this.room.players
            });
        };

        this.onMeetingEnded = (data) => {
            console.log("Meeting ended event received:", data);
            this.meetingActive = false;
            clearDeadBodies(this);
            this.room.deadBodies = {};
            this.physics.resume();
            enableVisionSystem(this);
            this.teleportPlayersToSpawn();
            const ejectedId = data.results?.ejectedId;
            if (ejectedId === this.playerObj?.id) {
                this.enterGhostMode();
                disableVisionSystem(this);
            } else if (ejectedId) {
                const sprite = this.players[ejectedId];
                if (sprite && this.isGhost) {
                    delete this.players[ejectedId];
                    this.makeGhost(sprite);
                    this.ghosts[ejectedId] = sprite;
                } else {
                    this.removePlayer(ejectedId);
                }
            }

            // Recieved by react
            EventBus.emit('meeting:ended', {
                results: data.results
            });
        };
        this.onGameEnd = (data) => {
            console.log("game end event received:", data);
            EventBus.emit("game:ended", data);
            if (this.scene && typeof this.scene.isActive === 'function' && this.scene.isActive('Game')) {
                this.scene.stop('Game');
            }
        };

        this.socket.on('player:killed', this.onPlayerKilled);
        this.socket.on('meeting:started', this.onMeetingStarted);
        this.socket.on('meeting:ended', this.onMeetingEnded);
        this.socket.on('game:ended', this.onGameEnd);
    }

    // MEETING MECHANICS
    /**
     * Start a meeting (called when M key is pressed)
     */
    startMeeting() {
        if (!this.socket || !this.playerObj || !this.room) return;

        console.log('Starting meeting...');
        this.socket.emit('meeting:start', {
            roomId: this.room.id,
            callerId: this.playerObj.id
        });
    }

    /**
     * Teleport all players back to their spawn positions
     */
    teleportPlayersToSpawn() {
        // Teleport local player
        if (this.player && this.spawnPositions[this.playerObj.id]) {
            const spawn = this.spawnPositions[this.playerObj.id];
            this.player.x = spawn.x;
            this.player.y = spawn.y;
        }

        // Teleport remote players
        Object.keys(this.players).forEach(playerId => {
            const player = this.players[playerId];
            if (player && this.spawnPositions[playerId] && player !== this.player) {
                const spawn = this.spawnPositions[playerId];
                player.x = spawn.x;
                player.y = spawn.y;
            }
        });
    }
}

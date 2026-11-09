import Phaser from "phaser";
import { EventBus } from "../EventBus.js";
import { SKELD_TASK_LOCATIONS } from "./taskLocations.js";

export class TaskManager {
    constructor(scene) {
        this.scene = scene;
        this.stations = SKELD_TASK_LOCATIONS;
        this.assignedIds = new Set();
        this.activeStation = null;
        this.lastNearbyId = null;
        this.scene.taskModalOpen = false;

        // React gửi danh sách trạm CẦN làm (đã mở, chưa hoàn thành)
        this.onAssigned = (ids) => {
            this.assignedIds = new Set(Array.isArray(ids) ? ids : []);
            if (
                this.activeStation &&
                !this.assignedIds.has(this.activeStation.id)
            ) {
                this.setActive(null);
            }
            this.drawHighlights();
        };

        this.onTaskOpened = () => {
            if (!this.scene) return;
            this.scene.taskModalOpen = true;
            this.setActive(null);
        };

        this.onTaskClosed = () => {
            if (this.scene) this.scene.taskModalOpen = false;
        };

        EventBus.on("task:assigned", this.onAssigned);
        EventBus.on("task:opened", this.onTaskOpened);
        EventBus.on("task:close", this.onTaskClosed);

        this.graphics = scene.add.graphics();
        this.graphics.setDepth(20);
        scene.worldContainer.add(this.graphics);

        this.prompt = scene.add
            .text(scene.scale.width / 2, scene.scale.height - 72, "", {
                fontFamily: "Arial, sans-serif",
                fontSize: "18px",
                color: "#ffffff",
                backgroundColor: "#202020",
                padding: { x: 14, y: 9 },
                align: "center",
            })
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(1100);
        scene.ui.add(this.prompt);
        this.prompt.setVisible(false);

        this.interactKey = scene.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.E,
        );

        // Yêu cầu React gửi lại danh sách trạm hiện tại
        EventBus.emit("task:request-assigned");
    }

    assignedStations() {
        return this.stations.filter((s) => this.assignedIds.has(s.id));
    }

    drawHighlights() {
        this.graphics.clear();
        for (const { x, y, width: w, height: h } of this.assignedStations()) {
            this.graphics.lineStyle(3.2, 0x171717, 1);
            this.graphics.strokeRect(x, y, w, h);
            this.graphics.lineStyle(2.2, 0xffe500, 1);
            this.graphics.strokeRect(x + 0.35, y + 0.35, w - 0.7, h - 0.7);
        }
    }

    setActive(station) {
        this.activeStation = station;

        if (station) {
            this.prompt.setText(`E  ·  TƯƠNG TÁC  ·  ${station.label}`);
            this.prompt.setVisible(true);
        } else {
            this.prompt.setVisible(false);
        }

        const id = station?.id ?? null;
        if (id !== this.lastNearbyId) {
            this.lastNearbyId = id;
            EventBus.emit(
                "task:nearby",
                station
                    ? {
                          id: station.id,
                          label: station.label,
                          x: station.x + station.width / 2,
                          y: station.y + station.height / 2,
                      }
                    : null,
            );
        }
    }

    update() {
        const { player, meetingActive, taskModalOpen } = this.scene;

        if (
            taskModalOpen ||
            !player ||
            player.alive === false ||
            meetingActive
        ) {
            this.setActive(null);
            return;
        }

        let nearest = null;
        let nearestDistance = Infinity;

        for (const station of this.assignedStations()) {
            const cx = station.x + station.width / 2;
            const cy = station.y + station.height / 2;
            const d = Phaser.Math.Distance.Between(player.x, player.y, cx, cy);
            if (d <= station.interactionRadius && d < nearestDistance) {
                nearest = station;
                nearestDistance = d;
            }
        }

        this.setActive(nearest);

        if (nearest && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
            this.interact();
        }
    }

    interact() {
        const station = this.activeStation;
        const { taskModalOpen, meetingActive } = this.scene;
        if (!station || taskModalOpen || meetingActive) return;

        this.scene.taskModalOpen = true;
        this.setActive(null);
        // Chỉ gửi stationId. React tự tra nhiệm vụ tương ứng.
        EventBus.emit("task:interact", {
            stationId: station.id,
            stationName: station.label,
        });
    }

    destroy() {
        EventBus.off("task:assigned", this.onAssigned);
        EventBus.off("task:opened", this.onTaskOpened);
        EventBus.off("task:close", this.onTaskClosed);
        this.graphics?.destroy();
        this.prompt?.destroy();
        this.interactKey?.destroy();
        this.scene = null;
    }
}

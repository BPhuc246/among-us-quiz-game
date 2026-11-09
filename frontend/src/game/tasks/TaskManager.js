import Phaser from 'phaser';
import { EventBus } from '../EventBus.js';
import { SKELD_TASK_LOCATIONS } from './taskLocations.js';

export class TaskManager {
    constructor(scene) {
        this.scene = scene;
        this.tasks = SKELD_TASK_LOCATIONS;
        this.activeTask = null;
        this.completedTaskIds = new Set();
        this.scene.taskModalOpen = false;

        this.onTaskCompleted = ({ taskId } = {}) => {
            if (!taskId) return;
            this.completedTaskIds.add(taskId);
            if (this.activeTask?.id === taskId) this.activeTask = null;
            this.drawHighlights();
            this.prompt?.setVisible(false);
        };

        this.onTaskClosed = () => {
            this.scene.taskModalOpen = false;
        };

        EventBus.on('task:completed', this.onTaskCompleted);
        EventBus.on('task:close', this.onTaskClosed);

        // The map and player are children of worldContainer. Highlights must be
        // in the same container so they share its camera/world coordinate space.
        this.graphics = scene.add.graphics();
        this.graphics.setDepth(20);
        scene.worldContainer.add(this.graphics);

        this.prompt = scene.add.text(
            scene.scale.width / 2,
            scene.scale.height - 72,
            '',
            {
                fontFamily: 'Arial, sans-serif',
                fontSize: '18px',
                color: '#ffffff',
                backgroundColor: '#202020',
                padding: { x: 14, y: 9 },
                align: 'center'
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(1100);
        scene.ui.add(this.prompt);
        this.prompt.setVisible(false);

        this.interactKey = scene.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.E
        );

        this.drawHighlights();
        console.info('[TaskManager] initialized; task count:', this.tasks.length);
    }

    drawHighlights() {
        this.graphics.clear();

        for (const task of this.tasks) {
            if (this.completedTaskIds.has(task.id)) continue;

            const x = task.x;
            const y = task.y;
            const w = task.width;
            const h = task.height;

            // Dark outer stroke + bright yellow inner stroke: panel-style highlight.
            this.graphics.lineStyle(3.2, 0x171717, 1);
            this.graphics.strokeRect(x, y, w, h);
            this.graphics.lineStyle(2.2, 0xffe500, 1);
            this.graphics.strokeRect(x + 0.35, y + 0.35, w - 0.7, h - 0.7);
        }
    }

    update() {
        const { player, meetingActive, taskModalOpen } = this.scene;
        if (taskModalOpen) {
            this.activeTask = null;
            this.prompt.setVisible(false);
            return;
        }

        if (!player || player.alive === false || meetingActive) {
            this.activeTask = null;
            this.prompt.setVisible(false);
            return;
        }

        let nearest = null;
        let nearestDistance = Infinity;

        for (const task of this.tasks) {
            if (this.completedTaskIds.has(task.id)) continue;

            const centerX = task.x + task.width / 2;
            const centerY = task.y + task.height / 2;
            const distance = Phaser.Math.Distance.Between(
                player.x, player.y, centerX, centerY
            );
            if (distance <= task.interactionRadius && distance < nearestDistance) {
                nearest = task;
                nearestDistance = distance;
            }
        }

        this.activeTask = nearest;
        if (nearest) {
            this.prompt.setText(`E  ·  TƯƠNG TÁC  ·  ${nearest.label}`);
            this.prompt.setVisible(true);
        } else {
            this.prompt.setVisible(false);
        }

        if (nearest && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
            this.scene.taskModalOpen = true;
            this.prompt.setVisible(false);
            EventBus.emit('task:interact', {
                taskId: nearest.id,
                taskName: nearest.label,
                x: nearest.x + nearest.width / 2,
                y: nearest.y + nearest.height / 2,
                roomId: this.scene.room?.id ?? null
            });
        }
    }

    destroy() {
        EventBus.off('task:completed', this.onTaskCompleted);
        EventBus.off('task:close', this.onTaskClosed);
        this.graphics?.destroy();
        this.prompt?.destroy();
        this.interactKey?.destroy();
        this.scene = null;
    }
}

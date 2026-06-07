import { Mat4 } from "./Math.js"
import { ChunkManager } from "./ChunkManager.js"

export class FirstPersonCamera {
    constructor(canvas) {
        this.position = [16, 20, 16];
        this.velocity = [0, 0, 0];

        this.playerWidth = 0.6;
        this.playerHeight = 1.8;
        this.playerEyeHeight = 1.6;

        this.yaw = 0; // Looking left/ right (Theta)
        this.pitch = 0; // Looking up/ down (Phi)

        this.viewMatrix = Mat4.create();

        this.speed = 0.15; // Movement speed
        this.gravity = -0.015; // Gravity acceleration
        this.jumpStrength = 0.2;

        this.onGround = false;

        this.isFlying = false; // Set to true to disable gravity and collision for testing
        this.lastSpacePress = 0;

        this.keys = {
            KeyW: false,
            KeyA: false,
            KeyS: false,
            KeyD: false,
            Space: false,
            ShiftLeft: false
        }

        canvas.addEventListener('click', () => canvas.requestPointerLock());

        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === canvas) {
                this.yaw -= e.movementX * 0.002;
                this.pitch += e.movementY * 0.002;

                this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
            }
        });

        document.addEventListener('keydown', (e) => {
            if (this.keys.hasOwnProperty(e.code)) {
                this.keys[e.code] = true;

                if (e.code === 'Space' && !e.repeat) {
                    const now = performance.now();
                    if (now - this.lastSpacePress < 300) {
                        this.isFlying = !this.isFlying;
                        this.velocity[1] = 0;
                    }
                    this.lastSpacePress = now;
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            if (this.keys.hasOwnProperty(e.code)) {
                this.keys[e.code] = false;
            }
        });
    }

    update(chunk) {
        const forwardX = Math.sin(this.yaw);
        const forwardZ = Math.cos(this.yaw);

        const rightX = Math.sin(this.yaw - Math.PI / 2);
        const rightZ = Math.cos(this.yaw - Math.PI / 2);

        let dx = 0;
        let dz = 0;

        if (this.keys.KeyW) {
            dx -= forwardX * this.speed;
            dz -= forwardZ * this.speed;
        }

        if (this.keys.KeyS) {
            dx += forwardX * this.speed;
            dz += forwardZ * this.speed;
        }

        if (this.keys.KeyA) {
            dx += rightX * this.speed;
            dz += rightZ * this.speed;
        }

        if (this.keys.KeyD) {
            dx -= rightX * this.speed;
            dz -= rightZ * this.speed;
        }

        if (this.isFlying) {
            // FLIGHT MODE - No collision, no gravity
            this.position[0] += dx;
            this.position[2] += dz;

            if (this.keys.Space) this.position[1] += this.speed;
            if (this.keys.ShiftLeft) this.position[1] -= this.speed;
        } else {
            // NORMAL MODE - AABB Collision and gravity 
            this.position[0] += dx;
            if (this.checkCollision(chunk)) {
                this.position[0] -= dx;
            }

            this.position[2] += dz;
            if (this.checkCollision(chunk)) {
                this.position[2] -= dz;
            }

            this.velocity[1] += this.gravity;

            if (this.keys.Space && this.onGround) {
                this.velocity[1] = this.jumpStrength;
                this.onGround = false;
            }

            this.position[1] += this.velocity[1];
            this.onGround = false;

            if (this.checkCollision(chunk)) {
                if (this.velocity[1] < 0) {
                    this.onGround = true;
                }

                this.position[1] -= this.velocity[1];
                this.velocity[1] = 0;
            }
        }
    }

    getViewMatrix() {
        const eyeY = this.position[1] + this.playerEyeHeight;

        const lookX = this.position[0] - Math.sin(this.yaw) * Math.cos(this.pitch);
        const lookY = eyeY - Math.sin(this.pitch);
        const lookZ = this.position[2] - Math.cos(this.yaw) * Math.cos(this.pitch);

        const eyePosition = [this.position[0], eyeY, this.position[2]];
        return Mat4.lookAt(this.viewMatrix, eyePosition, [lookX, lookY, lookZ], [0, 1, 0]);
    }

    getCameraPosition() {
        return [this.position[0], this.position[1] + this.playerEyeHeight, this.position[2]];
    }

    getRay() {
        return [
            -Math.sin(this.yaw) * Math.cos(this.pitch),
            -Math.sin(this.pitch),
            -Math.cos(this.yaw) * Math.cos(this.pitch)
        ]
    }

    // The AABB Collision Checker
    checkCollision(chunkManager) {
        const minX = Math.floor(this.position[0] - this.playerWidth / 2);
        const maxX = Math.floor(this.position[0] + this.playerWidth / 2);
        const minY = Math.floor(this.position[1]); // Feet
        const maxY = Math.floor(this.position[1] + this.playerHeight); // Head
        const minZ = Math.floor(this.position[2] - this.playerWidth / 2);
        const maxZ = Math.floor(this.position[2] + this.playerWidth / 2);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {

                    if (chunkManager.getBlock(x, y, z) !== 0) {
                        return true;
                    }

                }
            }
        }

        return false;
    }

    isBlockInsidePlayer(bx, by, bz) {
        const pMinX = this.position[0] - this.playerWidth / 2;
        const pMaxX = this.position[0] + this.playerWidth / 2;
        const pMinY = this.position[1];
        const pMaxY = this.position[1] + this.playerHeight;
        const pMinZ = this.position[2] - this.playerWidth / 2;
        const pMaxZ = this.position[2] + this.playerWidth / 2;

        const bMinX = bx, bMaxX = bx + 1;
        const bMinY = by, bMaxY = by + 1;
        const bMinZ = bz, bMaxZ = bz + 1;

        return (
            pMinX < bMaxX && pMaxX > bMinX &&
            pMinY < bMaxY && pMaxY > bMinY &&
            pMinZ < bMaxZ && pMaxZ > bMinZ
        )
    }
}
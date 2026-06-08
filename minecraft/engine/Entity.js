import { Mat4 } from './Math.js'

export class Entity {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;

        this.yaw = Math.random() * 2 * Math.PI;

        this.velocityY = 0;
        this.isGrounded = false;

        this.state = 'idle';
        this.stateTimer = 0;
    }

    static getModelData() {
        const s = 0.6;
        const h = 1.2;

        const v = [
            -s, 0, s, 0, 1, 0, 0, 1, s, 0, s, 1, 1, 0, 0, 1,
            s, h, s, 1, 0, 0, 0, 1, -s, h, s, 0, 0, 0, 0, 1,
            -s, 0, -s, 1, 1, 0, 0, -1, -s, h, -s, 1, 0, 0, 0, -1,
            s, h, -s, 0, 0, 0, 0, -1, s, 0, -s, 0, 1, 0, 0, -1,
            -s, 0, -s, 0, 1, -1, 0, 0, -s, h, -s, 0, 0, -1, 0, 0,
            -s, h, s, 1, 0, -1, 0, 0, -s, 0, s, 1, 1, -1, 0, 0,
            s, 0, -s, 1, 1, 1, 0, 0, s, 0, s, 0, 1, 1, 0, 0,
            s, h, s, 0, 0, 1, 0, 0, s, h, -s, 1, 0, 1, 0, 0,
            -s, h, s, 0, 1, 0, 1, 0, s, h, s, 1, 1, 0, 1, 0,
            s, h, -s, 1, 0, 0, 1, 0, -s, h, -s, 0, 0, 0, 1, 0,
            -s, 0, s, 0, 0, 0, -1, 0, -s, 0, -s, 0, 1, 0, -1, 0,
            s, 0, -s, 1, 1, 0, -1, 0, s, 0, s, 1, 0, 0, -1, 0
        ];
        const i = [
            0, 1, 2, 2, 3, 0, 4, 5, 6, 6, 7, 4, 8, 9, 10, 10, 11, 8,
            12, 13, 14, 14, 15, 12, 16, 17, 18, 18, 19, 16, 20, 21, 22, 22, 23, 20
        ];
        return { vertices: new Float32Array(v), indices: new Uint16Array(i) };
    }

    update(deltaTime, chunkManager) {
        this.stateTime = -deltaTime;

        if (this.stateTime <= 0) {
            this.state = Math.random() > 0.5 ? 'idle' : 'wandering';
            this.stateTimer = 2000 + Math.random() * 3000;

            if (this.state === 'wandering') {
                this.yaw = Math.random() * 2 * Math.PI;
            }
        }

        let moveX = 0;
        let moveZ = 0;

        if (this.state === 'wandering') {
            const speed = 0.003;
            moveX = Math.sin(this.yaw) * speed * deltaTime;
            moveZ = Math.cos(this.yaw) * speed * deltaTime;
        }

        this.velocityY -= 0.00005 * deltaTime; // GRAVITY

        let nextX = this.x + moveX;
        let nextY = this.y + this.velocityY * deltaTime;
        let nextZ = this.z + moveZ;

        const blockBelow = chunkManager.getBlock(
            Math.floor(this.x),
            Math.floor(nextY),
            Math.floor(this.z)
        );

        if (blockBelow !== 0) {
            this.isGrounded = true;
            this.velocityY = 0;
            this.y = Math.floor(nextY) + 1.0;
        } else {
            this.isGrounded = false;
            this.y = nextY;
        }
        
        const hitWallX = chunkManager.getBlock(Math.floor(nextX), Math.floor(this.y + 0.1), Math.floor(this.z)) !== 0;
        const hitWallZ = chunkManager.getBlock(Math.floor(this.x), Math.floor(this.y + 0.1), Math.floor(nextZ)) !== 0;

        if (hitWallX || hitWallZ) {
            if (this.isGrounded) {
                this.velocityY = 0.015;
                this.isGrounded = false;
            }
        } else {
            this.x = nextX;
            this.z = nextZ;
        }
    }



    getModelMatrix() {
        const model = Mat4.create();
        Mat4.translate(model, model, [this.x, this.y, this.z]);
        Mat4.rotateY(model, model, this.yaw);
        return model;
    }
}
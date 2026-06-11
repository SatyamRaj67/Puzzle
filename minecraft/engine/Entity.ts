import { Mat4 } from "./Math";
import { type BlockRegistry } from "./types";

export interface IChunkManagerForEntity {
  chunkWidth: number;
  chunks: Map<string, any>;
  blockRegistry: BlockRegistry;
  getChunkKey(cx: number, cz: number): string;
  getBlock(x: number, y: number, z: number): number;
}

export class Entity {
  public x: number;
  public y: number;
  public z: number;
  public yaw: number;
  public velocityY: number;
  public isGrounded: boolean;
  public state: "idle" | "wandering";
  public stateTimer: number;
  public hp: number;
  public damageFlashTimer: number;
  public isMoving: number;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;

    this.yaw = Math.random() * 2 * Math.PI;

    this.velocityY = 0;
    this.isGrounded = false;

    this.state = "idle";
    this.stateTimer = 0;

    this.hp = 10;
    this.damageFlashTimer = 0;
    this.isMoving = 0.0;
  }

  static getModelData(): { vertices: Float32Array; indices: Uint16Array } {
    const v: number[] = [];
    const i: number[] = [];
    let vCount = 0;

    // Helper to build a 3D box with a specific Bone ID
    const addBox = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      boneId: number,
    ) => {
      const hw = w / 2,
        hh = h / 2,
        hd = d / 2;

      // 8 corners of the box
      const p = [
        [x - hw, y - hh, z + hd],
        [x + hw, y - hh, z + hd],
        [x + hw, y + hh, z + hd],
        [x - hw, y + hh, z + hd], // Front
        [x - hw, y - hh, z - hd],
        [x + hw, y - hh, z - hd],
        [x + hw, y + hh, z - hd],
        [x - hw, y + hh, z - hd], // Back
      ];

      // 6 faces (Positions, UVs, Normals, Bone)
      const faces = [
        { corners: [0, 1, 2, 3], norm: [0, 0, 1] }, // Front
        { corners: [5, 4, 7, 6], norm: [0, 0, -1] }, // Back
        { corners: [3, 2, 6, 7], norm: [0, 1, 0] }, // Top
        { corners: [4, 5, 1, 0], norm: [0, -1, 0] }, // Bottom
        { corners: [1, 5, 6, 2], norm: [1, 0, 0] }, // Right
        { corners: [4, 0, 3, 7], norm: [-1, 0, 0] }, // Left
      ];

      const uv = [
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ];

      for (const face of faces) {
        for (let j = 0; j < 4; j++) {
          const c = p[face.corners[j]];
          // Push: X, Y, Z, U, V, NX, NY, NZ, BONE
          v.push(
            c[0],
            c[1],
            c[2],
            uv[j][0],
            uv[j][1],
            face.norm[0],
            face.norm[1],
            face.norm[2],
            boneId,
          );
        }
        i.push(vCount, vCount + 1, vCount + 2, vCount + 2, vCount + 3, vCount);
        vCount += 4;
      }
    };

    // Build the Cow!
    addBox(0, 1.0, 0, 0.8, 0.6, 1.2, 0); // Body (Bone 0)
    addBox(0, 1.4, 0.7, 0.4, 0.4, 0.4, 0); // Head (Bone 0)

    // Legs (Bone 1 = Left side, Bone 2 = Right side to alternate swinging)
    addBox(-0.3, 0.3, 0.5, 0.2, 0.6, 0.2, 1); // Front Left
    addBox(0.3, 0.3, 0.5, 0.2, 0.6, 0.2, 2); // Front Right
    addBox(-0.3, 0.3, -0.5, 0.2, 0.6, 0.2, 2); // Back Left
    addBox(0.3, 0.3, -0.5, 0.2, 0.6, 0.2, 1); // Back Right

    return { vertices: new Float32Array(v), indices: new Uint16Array(i) };
  }

  public takeDamage(amount: number): void {
    if (this.damageFlashTimer > 0) return; // Invulnerability frames

    this.hp -= amount;
    this.damageFlashTimer = 0.25; // Flash for 0.25 seconds

    this.velocityY = 0.05;
    this.isGrounded = false;
  }

  public update(deltaTime: number, chunkManager: IChunkManagerForEntity): void {
    if (this.hp <= 0) return; // Dead entities do not update

    if (this.y < -10) {
      this.hp = 0;
      return;
    }

    const cx = Math.floor(this.x / chunkManager.chunkWidth);
    const cz = Math.floor(this.z / chunkManager.chunkWidth);
    const key = chunkManager.getChunkKey(cx, cz);

    if (!chunkManager.chunks.has(key)) return;

    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= deltaTime / 1000;
    }

    this.stateTimer -= deltaTime;

    if (this.stateTimer <= 0) {
      this.state = Math.random() > 0.5 ? "idle" : "wandering";
      this.stateTimer = 2000 + Math.random() * 3000;

      if (this.state === "wandering") {
        this.yaw = Math.random() * 2 * Math.PI;
      }
    }

    let moveX = 0;
    let moveZ = 0;
    this.isMoving = 0.0;

    if (this.state === "wandering") {
      const speed = 0.003;
      moveX = Math.sin(this.yaw) * speed * deltaTime;
      moveZ = Math.cos(this.yaw) * speed * deltaTime;
      this.isMoving = 1.0;
    }

    this.velocityY -= 0.012; // GRAVITY

    let nextX = this.x + moveX;
    let nextY = this.y + this.velocityY;
    let nextZ = this.z + moveZ;

    const checkSolid = (x: number, y: number, z: number): boolean => {
      const blockId = chunkManager.getBlock(
        Math.floor(x),
        Math.floor(y),
        Math.floor(z),
      );
      if (blockId === 0) return false;

      const blockData = chunkManager.blockRegistry[blockId];

      return !(blockData && (blockData.isFluid || blockData.isPlant));
    };

    // VERTICAL COLLISION
    if (this.velocityY < 0 && checkSolid(this.x, nextY, this.z)) {
      this.isGrounded = true;
      this.velocityY = 0;
      this.y = Math.floor(nextY) + 1.0;
    } else {
      this.isGrounded = false;
      this.y = nextY;
    }

    // 2. HORIZONTAL COLLISION & STEP-UP LOGIC
    let hitWall = false;

    if (checkSolid(nextX, this.y + 0.1, this.z)) {
      if (this.isGrounded && !checkSolid(nextX, this.y + 1.1, this.z)) {
        this.y += 1.0;
        this.x = nextX;
      } else {
        hitWall = true;
      }
    } else {
      this.x = nextX;
    }

    // Z-AXIS COLLISION
    if (checkSolid(this.x, this.y + 0.1, nextZ)) {
      if (this.isGrounded && !checkSolid(this.x, this.y + 1.1, nextZ)) {
        this.y += 1.0;
        this.z = nextZ;
      } else {
        hitWall = true;
      }
    } else {
      this.z = nextZ;
    }

    if (hitWall && this.state === "wandering") {
      this.yaw += Math.PI + (Math.random() - 0.5);
      this.stateTimer = 1000;
    }
  }

  getModelMatrix() {
    const model = Mat4.create();
    Mat4.translate(model, model, [this.x, this.y, this.z]);
    Mat4.rotateY(model, model, this.yaw);
    return model;
  }
}

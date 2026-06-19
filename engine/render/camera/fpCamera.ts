import type { Input } from "../../core/input";
import { mat4 } from "../../core/math/mat4";
import { vec3, type Vec3Type } from "../../core/math/vec3";
import { PLAYER_HEIGHT, VoxelCollision } from "../../physics/voxelCollision";
import type { ChunkStore } from "../../world/chunkStore";

export class FPCamera {
  public position: Float32Array = new Float32Array([8, 60, 8]);
  public velocity: Float32Array = new Float32Array([0, 0, 0]);

  public isGrounded: boolean = false;
  public isFlying: boolean = false;
  public isSprinting: boolean = false;

  public pitch: number = 0;
  public yaw: number = -Math.PI / 2; // Face -Z by default

  public viewMatrix: Float32Array = mat4.create();
  public projectionMatrix: Float32Array = mat4.create();
  public viewProjMatrix: Float32Array = mat4.create();

  private forward: Vec3Type = vec3.create(0, 0, -1);
  private right: Vec3Type = vec3.create(1, 0, 0);
  private up: Vec3Type = vec3.create(0, 1, 0);
  private worldUp: Vec3Type = vec3.create(0, 1, 0);

  // Physics: PLEASE TUNE ACCORDING TO WHAT YOU WANT
  private baseSpeed = 8.0;
  private sprintMultiplier = 1.6;
  private flyMultiplier = 1;
  private jumpForce = 9.0;
  private gravity = -28.0;
  private mouseSensitivity = 0.002;

  constructor(aspectRatio: number) {
    this.updateProjection(aspectRatio);
  }

  public updateProjection(aspectRatio: number): void {
    mat4.perspective(
      this.projectionMatrix,
      Math.PI / 2,
      aspectRatio,
      0.1,
      1000,
    );
  }

  public update(dt: number, input: Input, store: ChunkStore): void {
    this.yaw += input.mouseDeltaX * this.mouseSensitivity;
    this.pitch -= input.mouseDeltaY * this.mouseSensitivity;

    const maxPitch = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    this.forward[0] = Math.cos(this.yaw) * Math.cos(this.pitch);
    this.forward[1] = Math.sin(this.pitch);
    this.forward[2] = Math.sin(this.yaw) * Math.cos(this.pitch);
    vec3.normalize(this.forward, this.forward);

    vec3.cross(this.right, this.forward, this.worldUp);
    vec3.normalize(this.right, this.right);

    vec3.cross(this.up, this.right, this.forward);

    if (input.isDoubleTapped("Space")) {
      this.isFlying = !this.isFlying;
      if (this.isFlying) this.velocity[1] = 0;
    }

    if (input.isDoubleTapped("KeyW")) {
      this.isSprinting = true;
    }

    if (!input.isKeyDown("KeyW")) {
      this.isSprinting = false;
    }

    if (input.isKeyDown("ShiftLeft")) {
      this.isSprinting = true;
    }

    let currentSpeed = this.baseSpeed;
    if (this.isSprinting) currentSpeed *= this.sprintMultiplier;
    if (this.isFlying) currentSpeed *= this.flyMultiplier;

    let moveDirX = 0;
    let moveDirZ = 0;

    const flatForwardX = Math.cos(this.yaw);
    const flatForwardZ = Math.sin(this.yaw);

    if (input.isKeyDown("KeyW")) {
      moveDirX += flatForwardX;
      moveDirZ += flatForwardZ;
    }
    if (input.isKeyDown("KeyS")) {
      moveDirX -= flatForwardX;
      moveDirZ -= flatForwardZ;
    }
    if (input.isKeyDown("KeyA")) {
      moveDirX -= this.right[0];
      moveDirZ -= this.right[2];
    }
    if (input.isKeyDown("KeyD")) {
      moveDirX += this.right[0];
      moveDirZ += this.right[2];
    }

    const length = Math.hypot(moveDirX, moveDirZ);
    if (length > 0) {
      moveDirX = (moveDirX / length) * currentSpeed; 
      moveDirZ = (moveDirZ / length) * currentSpeed;
    }

    this.velocity[0] = moveDirX;
    this.velocity[2] = moveDirZ;

    if (this.isFlying) {
      this.velocity[1] = 0;
      if (input.isKeyDown("Space")) this.velocity[1] = currentSpeed;
      if (input.isKeyDown("ShiftLeft")) this.velocity[1] = -currentSpeed;

      this.position[0] += this.velocity[0] * dt;
      this.position[1] += this.velocity[1] * dt;
      this.position[2] += this.velocity[2] * dt;
    } else {
      if (input.isKeyDown("Space") && this.isGrounded) {
        this.velocity[1] = this.jumpForce;
        this.isGrounded = false;
      }
      this.velocity[1] += this.gravity * dt;
      
      const desiredMove = new Float32Array([
        this.velocity[0] * dt,
        this.velocity[1] * dt,
        this.velocity[2] * dt,
      ]);
      this.isGrounded = VoxelCollision.resolve(this.position, desiredMove, store);
      this.velocity[1] = desiredMove[1] / dt;
      
    }
    const eyeY = this.position[1] + PLAYER_HEIGHT - 0.2;

    const pX = -this.position[0],
      pY = -eyeY,
      pZ = -this.position[2];

    this.viewMatrix[0] = this.right[0];
    this.viewMatrix[1] = this.up[0];
    this.viewMatrix[2] = -this.forward[0];
    this.viewMatrix[3] = 0;
    this.viewMatrix[4] = this.right[1];
    this.viewMatrix[5] = this.up[1];
    this.viewMatrix[6] = -this.forward[1];
    this.viewMatrix[7] = 0;
    this.viewMatrix[8] = this.right[2];
    this.viewMatrix[9] = this.up[2];
    this.viewMatrix[10] = -this.forward[2];
    this.viewMatrix[11] = 0;

    this.viewMatrix[12] =
      this.right[0] * pX + this.right[1] * pY + this.right[2] * pZ;
    this.viewMatrix[13] = this.up[0] * pX + this.up[1] * pY + this.up[2] * pZ;
    this.viewMatrix[14] =
      -this.forward[0] * pX - this.forward[1] * pY - this.forward[2] * pZ;
    this.viewMatrix[15] = 1;

    mat4.multiply(this.viewProjMatrix, this.projectionMatrix, this.viewMatrix);
  }
}

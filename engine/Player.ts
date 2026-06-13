import type { ChunkManager } from "./ChunkManager";
import type { Entity } from "./Entity";
import { FirstPersonCamera } from "./FPCamera";
import type { InputManager } from "./InputManager";
import { InventoryManager } from "./InventoryManager";
import { Raycaster } from "./Raycaster";

export class Player {
  public camera: FirstPersonCamera;
  public inventoryManager: InventoryManager;

  public activeHit: ReturnType<typeof Raycaster.step> = null;
  public targetedEntity: Entity | null = null;
  public nearestEntity: Entity | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    inputManager: InputManager,
    BLOCKS: Record<string, number>,
    BLOCK_ICONS: Record<number, string>,
  ) {
    this.camera = new FirstPersonCamera();
    this.inventoryManager = new InventoryManager(
      canvas,
      inputManager,
      BLOCKS,
      BLOCK_ICONS,
    );
  }

  public update(
    chunkManager: ChunkManager,
    timeScale: number,
    inputManager: InputManager,
  ) {
    this.camera.update(chunkManager, timeScale, inputManager);
    this.inventoryManager.update();
    this.updateVision(chunkManager);
    this.handleInteractions(chunkManager, inputManager);

    inputManager.resetFrameSpecificInputs();
  }

  private updateVision(chunkManager: ChunkManager) {
    const origin = this.camera.getCameraPosition();
    const direction = this.camera.getRay();

    this.activeHit = Raycaster.step(origin, direction, chunkManager, 8);

    this.targetedEntity = null;
    this.nearestEntity = null;
    let minDist = Infinity;

    for (const entity of chunkManager.entities) {
      const vec = [
        entity.x - origin[0],
        entity.y + 0.6 - origin[1],
        entity.z - origin[2],
      ];
      const dist = Math.hypot(vec[0], vec[1], vec[2]);

      if (dist < minDist) {
        minDist = dist;
        this.nearestEntity = entity;
      }

      if (dist < 6.0) {
        const dot =
          (vec[0] / dist) * direction[0] +
          (vec[1] / dist) * direction[1] +
          (vec[2] / dist) * direction[2];
        if (dot > 0.96) {
          this.targetedEntity = entity;
          break;
        }
      }
    }
  }

  private handleInteractions(
    chunkManager: ChunkManager,
    inputManager: InputManager,
  ) {
    if (this.inventoryManager.isOpen) return;

    if (inputManager.rightClick) {
      if (this.activeHit) {
        chunkManager.setBlock(
          this.activeHit.x,
          this.activeHit.y,
          this.activeHit.z,
          0,
        );
      }
    } else if (inputManager.leftClick) {
      if (this.targetedEntity) {
        this.targetedEntity.takeDamage(4);
      } else if (this.activeHit) {
        const selectedBlock = this.inventoryManager.getActiveBlock();

        if (selectedBlock !== 0) {
          const targetBlockData =
            chunkManager.blockRegistry[this.activeHit.blockId.toString()];

          let placeX = this.activeHit.x;
          let placeY = this.activeHit.y;
          let placeZ = this.activeHit.z;

          if (!(targetBlockData && targetBlockData.isPlant)) {
            placeX += this.activeHit.normal[0];
            placeY += this.activeHit.normal[1];
            placeZ += this.activeHit.normal[2];
          }

          if (
            this.camera.isFlying ||
            !this.camera.isBlockInsidePlayer(placeX, placeY, placeZ)
          ) {
            chunkManager.setBlock(placeX, placeY, placeZ, selectedBlock);
          }
        }
      }
    }
  }
}

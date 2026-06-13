import type { InputManager } from "./InputManager";

export class InventoryManager {
  public inventory: number[];
  public activeSlot: number = 0;
  public isOpen: boolean = false;
  public mouseHeldItem: number = 0;

  private slotsUI = document.querySelectorAll(".slot");
  private inventoryMenu = document.getElementById("inventory-menu")!;
  private inventoryGrid = document.getElementById("inventory-grid")!;
  private cursorItemUI = document.getElementById(
    "cursor-item",
  )! as HTMLImageElement;

  private eKeyPressed: boolean = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private inputManager: InputManager,
    private BLOCKS: Record<string, number>,
    private BLOCK_ICONS: Record<number, string>,
  ) {
    this.inventory = new Array(36).fill(this.BLOCKS.AIR);

    // Initial Loadout
    this.inventory[0] = this.BLOCKS.GRASS_BLOCK;
    this.inventory[1] = this.BLOCKS.DIRT;
    this.inventory[2] = this.BLOCKS.STONE;
    this.inventory[3] = this.BLOCKS.OAK_LOG;
    this.inventory[4] = this.BLOCKS.OAK_LEAVES;
    this.inventory[5] = this.BLOCKS.GLOWSTONE;

    this.setupCursorTracking();
    this.updateInventoryUI();
  }

  public getActiveBlock(): number {
    return this.inventory[this.activeSlot]
  }

  public update() {
    if (!this.isOpen && document.pointerLockElement === this.canvas) {
      if (this.inputManager.scrollDelta > 0) {
        this.activeSlot = (this.activeSlot + 1) % 9;
        this.updateHotbarUI();
      } else if (this.inputManager.scrollDelta < 0) {
        this.activeSlot = (this.activeSlot - 1 + 9) % 9;
        this.updateHotbarUI();
      }

      for (let i = 0; i < 9; i++) {
        if (this.inputManager.keys["Digit" + (i + 1)]) {
          this.activeSlot = i;
          this.updateHotbarUI();
        }
      }
    }

    if (this.inputManager.keys["KeyE"]) {
      if (!this.eKeyPressed) {
        this.toggleInventory();
        this.eKeyPressed = true;
      }
    } else {
      this.eKeyPressed = false;
    }
  }

  private toggleInventory() {
    this.isOpen = !this.isOpen;

    if (this.isOpen) {
      document.getElementById("pause-menu")!.style.display = "none";
      this.inventoryMenu.style.display = "flex";
      document.exitPointerLock();
    } else {
      this.inventoryMenu.style.display = "none";

      if (this.mouseHeldItem !== this.BLOCKS.AIR) {
        const emptySlot = this.inventory.indexOf(this.BLOCKS.AIR);

        if (emptySlot !== -1) {
          this.inventory[emptySlot] = this.mouseHeldItem;
        }
        this.mouseHeldItem = this.BLOCKS.AIR;
        this.cursorItemUI.style.display = "none";
      }
      this.canvas.requestPointerLock();
    }
    this.updateInventoryUI();
  }

  private setupCursorTracking() {
    document.addEventListener("mousemove", (e) => {
      if (this.mouseHeldItem !== this.BLOCKS.AIR) {
        this.cursorItemUI.style.left = `${e.clientX - 16}px`;
        this.cursorItemUI.style.top = `${e.clientY - 16}px`;
      }
    });
  }

  private updateHotbarUI() {
    this.slotsUI.forEach((slot) => slot.classList.remove("active"));
    this.slotsUI[this.activeSlot].classList.add("active");
  }

  private updateInventoryUI() {
    for (let i = 0; i < 9; i++) {
      this.slotsUI[i].classList.remove("active");
      this.slotsUI[i].innerHTML = "";
      const blockId = this.inventory[i];
      if (blockId !== this.BLOCKS.AIR) {
        const img = document.createElement("img");
        img.src = this.BLOCK_ICONS[blockId];
        this.slotsUI[i].appendChild(img);
      }
    }

    this.slotsUI[this.activeSlot].classList.add("active");

    if (this.isOpen) {
      this.inventoryGrid.innerHTML = "";
      for (let i = 0; i < 36; i++) {
        const slot = document.createElement("div");
        slot.classList.add("slot");
        const blockId = this.inventory[i];

        if (blockId !== this.BLOCKS.AIR) {
          const img = document.createElement("img");
          img.src = this.BLOCK_ICONS[blockId];
          slot.appendChild(img);
        }

        slot.addEventListener("mousedown", (event) => {
          event.preventDefault();
          if (
            this.mouseHeldItem === this.BLOCKS.AIR &&
            this.inventory[i] !== this.BLOCKS.AIR
          ) {
            this.mouseHeldItem = this.inventory[i];
            this.inventory[i] = this.BLOCKS.AIR;
          } else if (
            this.mouseHeldItem !== this.BLOCKS.AIR &&
            this.inventory[i] === this.BLOCKS.AIR
          ) {
            this.inventory[i] = this.mouseHeldItem;
            this.mouseHeldItem = this.BLOCKS.AIR;
          } else if (
            this.mouseHeldItem !== this.BLOCKS.AIR &&
            this.inventory[i] !== this.BLOCKS.AIR
          ) {
            const temp = this.inventory[i];
            this.inventory[i] = this.mouseHeldItem;
            this.mouseHeldItem = temp;
          }

          if (this.mouseHeldItem !== this.BLOCKS.AIR) {
            this.cursorItemUI.src = this.BLOCK_ICONS[this.mouseHeldItem];
            this.cursorItemUI.style.display = "block";
          } else {
            this.cursorItemUI.style.display = "none";
          }
          this.updateInventoryUI();
        });

        this.inventoryGrid.appendChild(slot);
      }
    }
  }
}

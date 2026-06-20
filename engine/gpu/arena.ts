export class BufferArena {
  public buffer: GPUBuffer;
  private capacity: number;

  private freeBlocks: {
    offset: number;
    size: number;
  }[] = [];

  constructor(
    device: GPUDevice,
    capacity: number,
    usage: GPUBufferUsageFlags,
    label: string,
  ) {
    this.capacity = capacity;
    this.buffer = device.createBuffer({
      size: capacity,
      usage,
      label,
    });

    this.freeBlocks.push({ offset: 0, size: capacity });
  }

  /**
   * * Finds a free gap large enough to hold the data, reserves it, and returns the byte offset.
   */
  public allocate(size: number): number {
    const alignedSize = (size + 3) & ~3; // Align to 4 bytes

    for (let i = 0; i < this.freeBlocks.length; i++) {
      const block = this.freeBlocks[i];

      if (block.size >= alignedSize) {
        const offset = block.offset;

        block.offset += alignedSize;
        block.size -= alignedSize;

        if (block.size === 0) {
          this.freeBlocks.splice(i, 1);
        }

        return offset;
      }
    }

    throw new Error(
      `GPU Area out of memory! Could not allocate ${size} bytes. Capacity: ${this.capacity}`,
    );
  }

  /**
   * Marks a section of the buffer as free space.
   */
  public free(offset: number, size: number): void {
    const alignedSize = (size + 3) & ~3; // Align to 4 bytes
    this.freeBlocks.push({ offset, size: alignedSize });
    this.merge();
  }

  /**
   * Sorts the free blocks and merges adjacent ones together to prevent memory fragmentation.
   */
  private merge(): void {
    this.freeBlocks.sort((a, b) => a.offset - b.offset);

    for (let i = 0; i < this.freeBlocks.length - 1; i++) {
      const current = this.freeBlocks[i];
      const next = this.freeBlocks[i + 1];

      if (current.offset + current.size === next.offset) {
        current.size += next.size;
        this.freeBlocks.splice(i + 1, 1);
        i--; // Check the merged block against the next one
      }
    }
  }
}

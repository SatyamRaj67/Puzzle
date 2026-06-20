export class WorldDatabase {
  private dbName = "VoxelEngineDB";
  private storeName = "chunks";
  private db: IDBDatabase | null = null;

  public async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = (event: Event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event: Event) => {
        console.error("IndexedDB failed to open", event);
        reject();
      };
    });
  }

  public async saveChunk(
    cx: number,
    cz: number,
    data: Uint8Array,
  ): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(this.storeName, "readwrite");
        const store = transaction.objectStore(this.storeName);

        const key = `${cx},${cz}`;
        store.put(data.slice(), key);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject();
    })
  }

  public async loadChunk(cx: number, cz: number): Promise<Uint8Array | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(this.storeName, "readonly");
        const store = transaction.objectStore(this.storeName);

        const key = `${cx},${cz}`
        const request = store.get(key);

        request.onsuccess = () => {
            resolve(request.result as Uint8Array | undefined ?? null)
        }
        request.onerror = () => reject();
    })
  }

  public async clearWorld(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(this.storeName, "readwrite");
        const store = transaction.objectStore(this.storeName);

        store.clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject();
    })
  }
}

export const WorldDB = new WorldDatabase();

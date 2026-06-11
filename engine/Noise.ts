export class PerlinNoise {
    private p: Uint8Array;
    
    constructor(seed: number = Math.random()) {
        this.p = new Uint8Array(512);
        const permutation = new Uint8Array(256);

        for (let i = 0; i < 256; i++) {
            permutation[i] = Math.floor((seed * (i + 1) * 12345) % 256);
        }

        for (let i = 0; i < 512; i++) {
            this.p[i] = permutation[i % 256];
        }
    }

    private fade(t:number) : number {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    private lerp(t: number, a: number, b: number) : number {
        return a + t * (b - a);
    }

    private grad(hash: number, x: number, y: number) : number {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    public get(x: number, y: number) : number {
        let X = Math.floor(x) & 255;
        let Y = Math.floor(y) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);

        let u = this.fade(x);
        let v = this.fade(y);

        let A = this.p[X] + Y, AA = this.p[A], AB = this.p[A + 1];
        let B = this.p[X + 1] + Y, BA = this.p[B], BB = this.p[B + 1];

        let res = this.lerp(v, this.lerp(u, this.grad(this.p[AA], x, y), this.grad(this.p[BA], x - 1, y)),
            this.lerp(u, this.grad(this.p[AB], x, y - 1), this.grad(this.p[BB], x - 1, y - 1)));

        return (res + 1) / 2; // Normalize to [0, 1]
    }
}
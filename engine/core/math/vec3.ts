export type Vec3Type = [number, number, number];

export const vec3 = {
  /** Creates a new vec3, defaults to [0, 0, 0] */
  create: (x = 0, y = 0, z = 0): Vec3Type => {
    return [x, y, z];
  },

  /** Normalizes a vector to a length of 1 */
  normalize: (out: Vec3Type, a: Vec3Type): Vec3Type => {
    const x = a[0],
      y = a[1],
      z = a[2];
    let len = x * x + y * y + z * z;
    if (len > 0) {
      len = 1 / Math.sqrt(len);
      out[0] = x * len;
      out[1] = y * len;
      out[2] = z * len;
    }
    return out;
  },

  /** Cross Product (A x B) - Essential for finding perpendicular vectors */
  cross: (out: Vec3Type, a: Vec3Type, b: Vec3Type): Vec3Type => {
    const ax = a[0],
      ay = a[1],
      az = a[2];
    const bx = b[0],
      by = b[1],
      bz = b[2];
    out[0] = ay * bz - az * by;
    out[1] = az * bx - ax * bz;
    out[2] = ax * by - ay * bx;
    return out;
  },

  dot: (a: Vec3Type, b: Vec3Type): number => {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  },

  /** Vector Addition */
  add: (out: Vec3Type, a: Vec3Type, b: Vec3Type): Vec3Type => {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    out[2] = a[2] + b[2];
    return out;
  },

  /** Vector Subtraction */
  subtract: (out: Vec3Type, a: Vec3Type, b: Vec3Type): Vec3Type => {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    return out;
  },
};

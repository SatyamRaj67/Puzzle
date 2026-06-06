import { Mat4, clamp } from "./Math.js";

export class OrbitCamera {
    constructor(canvas, target = [16, 0, 16]) {
        this.canvas = canvas;
        this.target = target;

        this.viewMatrix = Mat4.create();

        this.radius = 50;
        this.theta = Math.PI / 4; // Horizontal rotation
        this.phi = Math.PI / 3;   // Vertical rotation

        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };

        this.initEventListeners();
    }

    initEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;

            const deltaX = e.movementX;
            const deltaY = e.movementY;

            // Adjust angles based on mouse movement
            this.theta += deltaX * 0.01;
            this.phi -= deltaY * 0.01;

            // Clamp phi to prevent flipping
            this.phi = clamp(this.phi, 0.01, Math.PI - 0.01);
        });

        window.addEventListener('mouseup', (e) => {
            this.isDragging = false;
        })

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();

            // Zoom in and out by changing the radius
            this.radius += e.deltaY * 0.05;
            // Clamp radius to prevent going too close or too far
            this.radius = clamp(this.radius, 5, 200);
        })
    }

    getViewMatrix() {
        // Convert Spherical (radius, theta, phi) to Cartesian (x, y, z)
        const eyeX = this.target[2] + this.radius * Math.sin(this.phi) * Math.cos(this.theta);
        const eyeY = this.target[1] + this.radius * Math.cos(this.phi);
        const eyeZ = this.target[0] + this.radius * Math.sin(this.phi) * Math.sin(this.theta);

        const eye = [eyeX, eyeY, eyeZ];
        const up = [0, 1, 0];

        return Mat4.lookAt(this.viewMatrix, eye, this.target, up);
    }

    getCameraPosition() {
        const eyeX = this.target[0] + this.radius * Math.sin(this.phi) * Math.cos(this.theta);
        const eyeY = this.target[1] + this.radius * Math.cos(this.phi);
        const eyeZ = this.target[2] + this.radius * Math.sin(this.phi) * Math.sin(this.theta);

        return [eyeX, eyeY, eyeZ];
    }

    getRay(mouseX, mouseY, canvasWidth, canvasHeight, projectionMatrix) {
        const ndcX = (mouseX / canvasWidth) * 2 - 1.0;
        const ndcY = 1.0 - (mouseY / canvasHeight) * 2; // Invert Y for WebGL

        const clipCoords = [ndcX, ndcY, -1.0, 1.0];

        // Inverse of Projection Matrix
        const invProjection = Mat4.create();
        Mat4.invert(invProjection, projectionMatrix)

        const eyeCoords = [0, 0, 0, 0];
        Mat4.transformVec4(eyeCoords, clipCoords, invProjection);

        eyeCoords[2] = -1.0; // Set forward direction
        eyeCoords[3] = 0.0;  // Direction vector

        // Inverse the Camera's View Matrix
        const invView = Mat4.create();
        Mat4.invert(invView, this.getViewMatrix());

        const rayWorld = [0, 0, 0, 0];
        Mat4.transformVec4(rayWorld, eyeCoords, invView);

        // Normalize the ray direction
        const length = Math.hypot(rayWorld[0], rayWorld[1], rayWorld[2]);

        return [
            rayWorld[0] / length,
            rayWorld[1] / length,
            rayWorld[2] / length
        ]
    }
}
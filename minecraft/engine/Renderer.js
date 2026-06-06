import { vertexShaderSource, fragmentShaderSource } from './Shaders.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2');

        if (!this.gl) throw new Error('WebGL2 not supported');

        this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
        this.gl.useProgram(this.program);

        // Find attribute and uniform locations
        this.locations = {
            position: this.gl.getAttribLocation(this.program, 'a_position'),
            color: this.gl.getAttribLocation(this.program, 'a_color'),
            projection: this.gl.getUniformLocation(this.program, 'u_projection'),
            view: this.gl.getUniformLocation(this.program, 'u_view'),
            model: this.gl.getUniformLocation(this.program, 'u_model')
        };

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.CULL_FACE);
        this.setupHighlight();
    }

    createProgram(vertexSource, fragmentSource) {
        const compile = (type, source) => {
            const shader = this.gl.createShader(type);
            this.gl.shaderSource(shader, source);
            this.gl.compileShader(shader);

            if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
                const info = this.gl.getShaderInfoLog(shader);
                this.gl.deleteShader(shader);
                throw new Error(`Could not compile shader:\n${info}`);
            }

            return shader;
        }

        const vertexShader = compile(this.gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = compile(this.gl.FRAGMENT_SHADER, fragmentSource);
        const program = this.gl.createProgram();

        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        return program;
    }

    setBufferData(vertexData, indexData) {
        this.vao = this.gl.createVertexArray();
        this.gl.bindVertexArray(this.vao);

        this.buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertexData, this.gl.DYNAMIC_DRAW);

        const stride = 6 * 4; // 3 positions + 3 colors = 6 floats * 4 bytes per float

        this.gl.enableVertexAttribArray(this.locations.position);
        this.gl.vertexAttribPointer(this.locations.position, 3, this.gl.FLOAT, false, stride, 0);

        this.gl.enableVertexAttribArray(this.locations.color);
        this.gl.vertexAttribPointer(this.locations.color, 3, this.gl.FLOAT, false, stride, 3 * 4);

        this.indexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indexData, this.gl.DYNAMIC_DRAW);
    }

    updateBufferData(vertexData, indexData) {
        this.gl.bindVertexArray(this.vao);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertexData, this.gl.DYNAMIC_DRAW);

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indexData, this.gl.DYNAMIC_DRAW);
    }

    draw(indexCount, projMatrix, viewMatrix, modelMatrix) {
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clearColor(0.1, 0.1, 0.1, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        this.gl.bindVertexArray(this.vao);

        this.gl.uniformMatrix4fv(this.locations.projection, false, projMatrix);
        this.gl.uniformMatrix4fv(this.locations.view, false, viewMatrix);
        this.gl.uniformMatrix4fv(this.locations.model, false, modelMatrix);

        this.gl.uniform1f(this.gl.getUniformLocation(this.program, "u_alpha"), 1.0);

        this.gl.drawElements(this.gl.TRIANGLES, indexCount, this.gl.UNSIGNED_INT, 0);
        // DEBUG MODE:
        // this.gl.drawElements(this.gl.LINE_STRIP, indexCount, this.gl.UNSIGNED_INT, 0);
    }

    setupHighlight() {
        this.highlightVao = this.gl.createVertexArray();
        this.gl.bindVertexArray(this.highlightVao);

        // Dynamic Buffer for our 4 corners
        this.highlightVbo = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.highlightVbo);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, 4 * 6 * 4, this.gl.DYNAMIC_DRAW);

        const stride = 6 * 4; // 3 positions + 3 colors = 6 floats * 4 bytes per float

        this.gl.enableVertexAttribArray(this.locations.position);
        this.gl.vertexAttribPointer(this.locations.position, 3, this.gl.FLOAT, false, stride, 0);

        this.gl.enableVertexAttribArray(this.locations.color);
        this.gl.vertexAttribPointer(this.locations.color, 3, this.gl.FLOAT, false, stride, 3 * 4);

        this.highlightEbo = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.highlightEbo);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 2, 3, 0]), this.gl.STATIC_DRAW);

        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    }

    drawHighlight(projMatrix, viewMatrix, hitX, hitY, hitZ, normal) {
        const offset = 0.005;

        const px = hitX + 0.5 + normal[0] * (0.5 + offset);
        const py = hitY + 0.5 + normal[1] * (0.5 + offset);
        const pz = hitZ + 0.5 + normal[2] * (0.5 + offset);

        // Determine the orientation of the square with normal

        let tx, ty;
        if (Math.abs(normal[1]) == 1) {
            tx = [1, 0, 0];
            ty = [0, 0, 1];
        } else if (Math.abs(normal[0]) == 1) {
            tx = [0, 1, 0];
            ty = [0, 0, 1];
        } else {
            tx = [1, 0, 0];
            ty = [0, 1, 0];
        }

        // Generate 4 corners of the square
        const s = 0.505;
        const vData = new Float32Array(24); // 4 vertices * (3 pos + 3 color)
        const corners = [
            [-1, -1], [1, -1], [1, 1], [-1, 1]
        ];

        for (let i = 0; i < 4; i++) {
            vData[i * 6 + 0] = px + tx[0] * corners[i][0] * s + ty[0] * corners[i][1] * s; // X
            vData[i * 6 + 1] = py + tx[1] * corners[i][0] * s + ty[1] * corners[i][1] * s; // Y
            vData[i * 6 + 2] = pz + tx[2] * corners[i][0] * s + ty[2] * corners[i][1] * s; // Z
            vData[i * 6 + 3] = 1.0; // R
            vData[i * 6 + 4] = 1.0; // G
            vData[i * 6 + 5] = 1.0; // B
        }

        this.gl.bindVertexArray(this.highlightVao);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.highlightVbo);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, vData);

        const alphaLoc = this.gl.getUniformLocation(this.program, 'u_alpha');
        this.gl.uniform1f(alphaLoc, 0.3);

        const model = new Float32Array(
            [
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]
        );

        this.gl.uniformMatrix4fv(this.locations.projection, false, projMatrix);
        this.gl.uniformMatrix4fv(this.locations.view, false, viewMatrix);
        this.gl.uniformMatrix4fv(this.locations.model, false, model);

        this.gl.disable(this.gl.CULL_FACE);

        this.gl.drawElements(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_SHORT, 0);

        this.gl.enable(this.gl.CULL_FACE);

        this.gl.uniform1f(alphaLoc, 1.0);
    }
}
import { vertexShaderSource, fragmentShaderSource, skyVertexShaderSource, skyFragmentShaderSource, highlightVertexShaderSource, highlightFragmentShaderSource, entityVertexShaderSource, entityFragmentShaderSource } from './Shaders.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2');

        if (!this.gl) throw new Error('WebGL2 not supported');

        this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
        this.gl.useProgram(this.program);

        // Find attribute and uniform locations
        this.locations = {
            data1: this.gl.getAttribLocation(this.program, 'a_data1'),
            data2: this.gl.getAttribLocation(this.program, 'a_data2'),
            projection: this.gl.getUniformLocation(this.program, 'u_projection'),
            view: this.gl.getUniformLocation(this.program, 'u_view'),
            model: this.gl.getUniformLocation(this.program, 'u_model'),
            texture: this.gl.getUniformLocation(this.program, 'u_texture'),
            sun: this.gl.getUniformLocation(this.program, 'u_sunDirection'),
            playerPos: this.gl.getUniformLocation(this.program, 'u_playerPos'),
            holdingTorch: this.gl.getUniformLocation(this.program, 'u_holdingTorch')
        };

        // Compile Highlight Program
        this.highlightProgram = this.createProgram(highlightVertexShaderSource, highlightFragmentShaderSource);
        this.highlightLocations = {
            position: this.gl.getAttribLocation(this.highlightProgram, 'a_position'),
            uv: this.gl.getAttribLocation(this.highlightProgram, 'a_uv'),
            projection: this.gl.getUniformLocation(this.highlightProgram, 'u_projection'),
            view: this.gl.getUniformLocation(this.highlightProgram, 'u_view'),
            model: this.gl.getUniformLocation(this.highlightProgram, 'u_model'),
            texture: this.gl.getUniformLocation(this.highlightProgram, 'u_texture'),
            alpha: this.gl.getUniformLocation(this.highlightProgram, 'u_alpha')
        }

        // Compile Sky Program
        this.skyProgram = this.createProgram(skyVertexShaderSource, skyFragmentShaderSource);
        this.skyLocations = {
            position: this.gl.getAttribLocation(this.skyProgram, 'a_position'),
            projection: this.gl.getUniformLocation(this.skyProgram, 'u_projection'),
            view: this.gl.getUniformLocation(this.skyProgram, 'u_view'),
            sun: this.gl.getUniformLocation(this.skyProgram, 'u_sunDirection')
        }

        this.entityProgram = this.createProgram(entityVertexShaderSource, entityFragmentShaderSource);
        this.entityLocations = {
            position: this.gl.getAttribLocation(this.entityProgram, 'a_position'),
            uv: this.gl.getAttribLocation(this.entityProgram, 'a_uv'),
            normal: this.gl.getAttribLocation(this.entityProgram, 'a_normal'),
            projection: this.gl.getUniformLocation(this.entityProgram, 'u_projection'),
            view: this.gl.getUniformLocation(this.entityProgram, 'u_view'),
            model: this.gl.getUniformLocation(this.entityProgram, 'u_model'),
            texture: this.gl.getUniformLocation(this.entityProgram, 'u_texture'),
            sun: this.gl.getUniformLocation(this.entityProgram, 'u_sunDirection'),
            layer: this.gl.getUniformLocation(this.entityProgram, 'u_layer')
        };

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.CULL_FACE);

        this.setupHighlight();
        this.setupSkybox();
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

    createMesh(vertexData, indexData) {
        const vao = this.gl.createVertexArray();
        this.gl.bindVertexArray(vao);

        const vbo = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertexData, this.gl.DYNAMIC_DRAW);

        const stride = 2 * 4; // 2 Integers * 4 bytes each


        this.gl.enableVertexAttribArray(this.locations.data1);
        this.gl.vertexAttribIPointer(this.locations.data1, 1, this.gl.UNSIGNED_INT, stride, 0);
        this.gl.enableVertexAttribArray(this.locations.data2);
        this.gl.vertexAttribIPointer(this.locations.data2, 1, this.gl.UNSIGNED_INT, stride, 4);

        const ebo = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, ebo);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indexData, this.gl.DYNAMIC_DRAW);

        return { vao, vbo, ebo, indexCount: indexData.length };
    }

    updateMesh(mesh, vertexData, indexData) {
        this.gl.bindVertexArray(mesh.vao);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, mesh.vbo);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertexData, this.gl.DYNAMIC_DRAW);

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, mesh.ebo);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indexData, this.gl.DYNAMIC_DRAW);

        mesh.indexCount = indexData.length;
    }

    drawMesh(mesh, modelMatrix, sunDir, playerPos, holdingTorch) {
        this.gl.bindVertexArray(mesh.vao);
        this.gl.uniformMatrix4fv(this.locations.model, false, modelMatrix);
        this.gl.uniform3fv(this.locations.sun, sunDir);

        this.gl.uniform3fv(this.locations.playerPos, playerPos);
        this.gl.uniform1f(this.locations.holdingTorch, holdingTorch);

        this.gl.drawElements(this.gl.TRIANGLES, mesh.indexCount, this.gl.UNSIGNED_INT, 0);
    }

    deleteMesh(mesh) {
        this.gl.deleteVertexArray(mesh.vao);
        this.gl.deleteBuffer(mesh.vbo);
        this.gl.deleteBuffer(mesh.ebo);
    }

    setupHighlight() {
        this.highlightVao = this.gl.createVertexArray();
        this.gl.bindVertexArray(this.highlightVao);

        // Dynamic Buffer for our 4 corners
        this.highlightVbo = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.highlightVbo);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, 4 * 6 * 4, this.gl.DYNAMIC_DRAW);

        const stride = 6 * 4; // 3 positions + 3 uv coordinates = 6 floats * 4 bytes per float

        this.gl.enableVertexAttribArray(this.highlightLocations.position);
        this.gl.vertexAttribPointer(this.highlightLocations.position, 3, this.gl.FLOAT, false, stride, 0);

        this.gl.enableVertexAttribArray(this.highlightLocations.uv);
        this.gl.vertexAttribPointer(this.highlightLocations.uv, 3, this.gl.FLOAT, false, stride, 3 * 4);

        this.highlightEbo = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.highlightEbo);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 2, 3, 0]), this.gl.STATIC_DRAW);

        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    }

    drawHighlight(projMatrix, viewMatrix, hitX, hitY, hitZ, normal, layerId) {
        this.gl.useProgram(this.highlightProgram);

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
        const vData = new Float32Array(24); // 4 vertices * (3 pos + 3 uv)
        const corners = [
            [-1, -1], [1, -1], [1, 1], [-1, 1]
        ];

        const uvCoords = [[0, 0], [1, 0], [1, 1], [0, 1]];

        for (let i = 0; i < 4; i++) {
            vData[i * 6 + 0] = px + tx[0] * corners[i][0] * s + ty[0] * corners[i][1] * s; // X
            vData[i * 6 + 1] = py + tx[1] * corners[i][0] * s + ty[1] * corners[i][1] * s; // Y
            vData[i * 6 + 2] = pz + tx[2] * corners[i][0] * s + ty[2] * corners[i][1] * s; // Z
            vData[i * 6 + 3] = uvCoords[i][0]; // R
            vData[i * 6 + 4] = uvCoords[i][1]; // G
            vData[i * 6 + 5] = layerId; // B (texture layer)
        }

        this.gl.bindVertexArray(this.highlightVao);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.highlightVbo);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, vData);

        const alphaLoc = this.gl.getUniformLocation(this.highlightProgram, 'u_alpha');
        this.gl.uniform1f(alphaLoc, 0.3);

        const model = new Float32Array(
            [
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]
        );

        this.gl.uniformMatrix4fv(this.highlightLocations.projection, false, projMatrix);
        this.gl.uniformMatrix4fv(this.highlightLocations.view, false, viewMatrix);
        this.gl.uniformMatrix4fv(this.highlightLocations.model, false, model);

        this.gl.disable(this.gl.CULL_FACE);
        this.gl.drawElements(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_SHORT, 0);
        this.gl.enable(this.gl.CULL_FACE);

        this.gl.useProgram(this.program);
    }

    createTextureArrayFromImage(images, textureSize) {
        const texture = this.gl.createTexture();
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, texture);

        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);

        this.gl.texStorage3D(
            this.gl.TEXTURE_2D_ARRAY,
            1,
            this.gl.RGBA8,
            textureSize, textureSize, images.length
        )

        for (let i = 0; i < images.length; i++) {
            this.gl.texSubImage3D(
                this.gl.TEXTURE_2D_ARRAY,
                0,              // Mipmap level
                0, 0, i,        // X, Y, Z (Z being layer index)
                textureSize, textureSize, 1, // Width, Height, Depth
                this.gl.RGBA,
                this.gl.UNSIGNED_BYTE,
                images[i]
            )
        }

        // Tell GPU to repeat the texture when UVs go outside 0-1 range (for atlas)
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);

        // Use nearest filtering for pixelated look
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST_MIPMAP_LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

        this.gl.generateMipmap(this.gl.TEXTURE_2D_ARRAY);
        // Tell shader to use texture unit 0
        this.gl.uniform1i(this.locations.texture, 0);
    }

    beginFrame(projMatrix, viewMatrix, skyColor) {
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        this.gl.clearColor(skyColor[0], skyColor[1], skyColor[2], 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        this.gl.uniformMatrix4fv(this.locations.projection, false, projMatrix);
        this.gl.uniformMatrix4fv(this.locations.view, false, viewMatrix);

        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_alpha'), 1.0);
    }

    setupSkybox() {
        this.skyVao = this.gl.createVertexArray();
        this.gl.bindVertexArray(this.skyVao);

        // The 8 corners of our mathematical sky cube
        const vData = new Float32Array([
            -1, 1, -1,
            -1, -1, -1,
            1, -1, -1,
            1, 1, -1,
            -1, 1, 1,
            -1, -1, 1,
            1, -1, 1,
            1, 1, 1
        ])

        // The 36 indices to draw the 12 triangles of the cube
        const iData = new Uint16Array([
            0, 1, 2, 2, 3, 0, // Back face
            4, 5, 6, 6, 7, 4, // Front face
            4, 5, 1, 1, 0, 4, // Left face
            3, 2, 6, 6, 7, 3, // Right face
            4, 0, 3, 3, 7, 4, // Top face
            1, 5, 6, 6, 2, 1  // Bottom face
        ])

        const vbo = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vData, this.gl.STATIC_DRAW);

        this.gl.enableVertexAttribArray(this.skyLocations.position);
        this.gl.vertexAttribPointer(this.skyLocations.position, 3, this.gl.FLOAT, false, 0, 0);

        const ebo = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, ebo);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, iData, this.gl.STATIC_DRAW);
    }

    drawSkybox(projMatrix, viewMatrix, sunDirection) {
        this.gl.useProgram(this.skyProgram);

        this.gl.depthFunc(this.gl.LEQUAL); // Ensure skybox is drawn behind everything
        this.gl.disable(this.gl.CULL_FACE); // Disable culling for skybox

        this.gl.bindVertexArray(this.skyVao);

        this.gl.uniformMatrix4fv(this.skyLocations.projection, false, projMatrix);
        this.gl.uniformMatrix4fv(this.skyLocations.view, false, viewMatrix);
        this.gl.uniform3fv(this.skyLocations.sun, sunDirection);

        this.gl.drawElements(this.gl.TRIANGLES, 36, this.gl.UNSIGNED_SHORT, 0);

        this.gl.enable(this.gl.CULL_FACE); // Re-enable culling for other objects
        this.gl.depthFunc(this.gl.LESS); // Restore default depth function
        this.gl.useProgram(this.program); // Switch back to main shader
    }

    createEntityMesh(vertexData, indexData) {
        const vao = this.gl.createVertexArray();
        this.gl.bindVertexArray(vao);

        const vbo = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertexData, this.gl.STATIC_DRAW);

        const stride = 8 * 4; // 3 pos + 3 uv + 2 normal = 8 floats * 4 bytes each

        this.gl.enableVertexAttribArray(this.entityLocations.position);
        this.gl.vertexAttribPointer(this.entityLocations.position, 3, this.gl.FLOAT, false, stride, 0);

        this.gl.enableVertexAttribArray(this.entityLocations.uv);
        this.gl.vertexAttribPointer(this.entityLocations.uv, 2, this.gl.FLOAT, false, stride, 3 * 4);

        this.gl.enableVertexAttribArray(this.entityLocations.normal);
        this.gl.vertexAttribPointer(this.entityLocations.normal, 3, this.gl.FLOAT, false, stride, 5 * 4);

        const ebo = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, ebo);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indexData, this.gl.STATIC_DRAW);

        return { vao, vbo, ebo, indexCount: indexData.length };
    }

    drawEntity(mesh, modelMatrix, sunDir, textureLayer) {
        this.gl.useProgram(this.entityProgram);
        this.gl.disable(this.gl.CULL_FACE);

        this.gl.bindVertexArray(mesh.vao);

        this.gl.uniformMatrix4fv(this.entityLocations.model, false, modelMatrix);
        this.gl.uniform3fv(this.entityLocations.sun, sunDir);
        this.gl.uniform1f(this.entityLocations.layer, textureLayer);

        this.gl.drawElements(this.gl.TRIANGLES, mesh.indexCount, this.gl.UNSIGNED_SHORT, 0);

        this.gl.enable(this.gl.CULL_FACE);
        this.gl.useProgram(this.program);
    }
}
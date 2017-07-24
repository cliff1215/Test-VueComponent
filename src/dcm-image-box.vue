<template>
    <div id="dcm_image_box" :width="dib_width" :height="dib_height">
        <canvas ref="webgl" 
            :width="dib_width" 
            :height="dib_height">
        </canvas>
        <div id="window-level">
            <p>{{ showWinLev }}</p>
        </div>
    </div>
</template>

<script>
    import * as CuonUtils from './lib/cuon-utils.js';
    import {Matrix4, Vector3, Vector4} from './lib/cuon-matrix';
    import {VSHADER_SOURCE, FSHADER_SOURCE} from './shader-shource';
    import DcmImageInfo from './DcmImageInfo';

    export default {
        props: {
            dib_width: { type: Number, default: 256 }, 
            dib_height: { type: Number, default: 256 },
            dcm_image: { type: Object, default: null }
        },
        data() {
            return {
                webGL: null,
                mouseInfo: {
                    bIsDrag: false,
                    nCurrX: -1,
                    nCurrY: -1
                }
            }
        },
        mounted() {
            let canvas = this.$refs["webgl"];
            this.webGL = CuonUtils.getWebGLContext(canvas);
            if (!this.webGL) {
                console.log('Failed to get the rendering context for WebGL');
                return;
            }
            if (!CuonUtils.initShaders(this.webGL, VSHADER_SOURCE, FSHADER_SOURCE)) {
                console.log('Failed to intialize shaders.');
                return;
            }
            this.webGL.clearColor(0.0, 0.0, 0.0, 1.0);

            canvas.onmousedown = this.handleMouseDown;
            canvas.onmousemove = this.handleMouseMove;
            canvas.onmouseup   = this.handleMouseUp;
        },
        computed: {
            showWinLev: function() {
                return this.dcm_image 
                        ? (this.dcm_image.nWinWidth + "/" + this.dcm_image.nWinCenter)
                        : "";
            }
        },
        watch: {
            dcm_image: function() {
                this.showImage();
            }
        },
        methods: {
            showImage() {
                if (!this.dcm_image || !this.dcm_image.bIsImageLoaded){
                    console.log(this.dcm_image);
                    return;
                }

                // Set the vertex information
                let n = this.initVertexBuffers(this.webGL);
                if (n < 0) {
                    console.log('Failed to set the vertex information');
                    return;
                }

                this.setScaleMatrix(this.webGL, this.dcm_image);

                // Specify the color for clearing <canvas>
                this.webGL.clearColor(0.0, 0.0, 0.0, 1.0);

                // Set texture
                if (!this.initTextures(this.webGL, n, this.dcm_image)) {
                    console.log('Failed to intialize the texture.');
                    return;
                }

                this.drawTexture(this.webGL, n);
                // no more need, because webGL saved it as Texture image.
                this.dcm_image.pRGBAImg = []; 
                console.log("=====> EXEC: showImage");
            },
            initVertexBuffers(gl) {
                let verticesTexCoords = new Float32Array([
                    // Vertex coordinates, texture coordinate
                    -0.5,  0.5,   0.0, 1.0,
                    -0.5, -0.5,   0.0, 0.0,
                     0.5,  0.5,   1.0, 1.0,
                     0.5, -0.5,   1.0, 0.0,
                ]);
                // Create the buffer object
                let vertexTexCoordBuffer = gl.createBuffer();
                if (!vertexTexCoordBuffer) {
                    console.log('Failed to create the buffer object');
                    return -1;
                }

                // Bind the buffer object to target
                gl.bindBuffer(gl.ARRAY_BUFFER, vertexTexCoordBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, verticesTexCoords, gl.STATIC_DRAW);

                let FSIZE = verticesTexCoords.BYTES_PER_ELEMENT;
                //Get the storage location of a_Position, assign and enable buffer
                var a_Position = gl.getAttribLocation(gl.program, 'a_Position');
                if (a_Position < 0) {
                    console.log('Failed to get the storage location of a_Position');
                    return -2;
                }
                gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, FSIZE * 4, 0);
                // Enable the assignment of the buffer object
                gl.enableVertexAttribArray(a_Position);

                // Get the storage location of a_TexCoord
                var a_TexCoord = gl.getAttribLocation(gl.program, 'a_TexCoord');
                if (a_TexCoord < 0) {
                    console.log('Failed to get the storage location of a_TexCoord');
                    return -3;
                }
                // Assign the buffer object to a_TexCoord variable
                gl.vertexAttribPointer(
                    a_TexCoord, 2, gl.FLOAT, false, FSIZE * 4, FSIZE * 2);
                // Enable the assignment of the buffer object
                gl.enableVertexAttribArray(a_TexCoord);

                return 4;
            },
            setScaleMatrix(gl, imgObj) {
                var xformMatrix = new Matrix4();

                xformMatrix.setScale(imgObj.getCurrScaleX(), imgObj.getCurrScaleY(), 1.0);

                // Pass the rotation matrix to the vertex shader
                var u_xformMatrix = gl.getUniformLocation(gl.program, 'u_xformMatrix');
                if (!u_xformMatrix) {
                    console.log('Failed to get the storage location of u_xformMatrix');
                    return;
                }
                gl.uniformMatrix4fv(u_xformMatrix, false, xformMatrix.elements);
            },
            initTextures(gl, n, image) {
                // Create a texture object
                var texture = gl.createTexture();
                if (!texture) {
                    console.log('Failed to create the texture object');
                    return false;
                }

                // Get the storage location of uniform variable
                var u_LowUpVal = gl.getUniformLocation(gl.program, 'u_LowUpVal');
                if (!u_LowUpVal) {
                    console.log('Failed to get u_LowUpVal variable');
                    return false;
                }
                var lowupValue = image.getLowUpVal();
                gl.uniform2f(u_LowUpVal, lowupValue.lower, lowupValue.upper);
                lowupValue = null;

                // Get the storage location of u_Sampler
                var u_Sampler = gl.getUniformLocation(gl.program, 'u_Sampler');
                if (!u_Sampler) {
                    console.log('Failed to get the storage location of u_Sampler');
                    return false;
                }

                this.loadTexture(gl, n, texture, u_Sampler, image);

                return true;
            },
            loadTexture(gl, n, texture, u_Sampler, image) {
                // Flip the image's y axis
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
                // Enable texture unit0
                gl.activeTexture(gl.TEXTURE0);
                // Bind the texture object to the target
                gl.bindTexture(gl.TEXTURE_2D, texture);

                // Set the texture parameters
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                // Set the texture image
                //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, image.nWidth, image.nHeight,
                    0, gl.RGBA, gl.UNSIGNED_BYTE, image.pRGBAImg);

                // Set the texture unit 0 to the sampler
                gl.uniform1i(u_Sampler, 0);
            },
            drawTexture(gl, n) {
                gl.clear(gl.COLOR_BUFFER_BIT);   // Clear <canvas>
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, n); // Draw the rectangle
            },
            setTextureLowUpValue(gl, lowupValue) {
                // Get the storage location of uniform variable
                let u_LowUpVal = gl.getUniformLocation(gl.program, 'u_LowUpVal');
                if (!u_LowUpVal) {
                    console.log('Failed to get u_LowUpVal variable');
                    return false;
                }
                gl.uniform2f(u_LowUpVal, lowupValue.lower, lowupValue.upper);
            },
            handleMouseDown(evt) {
                this.mouseInfo.bIsDrag = true;
                this.mouseInfo.nCurrX = evt.clientX;
                this.mouseInfo.nCurrY = evt.clientY;
            },
            handleMouseMove(evt) {
                if (!this.mouseInfo.bIsDrag || 
                        !this.dcm_image || !this.dcm_image.bIsImageLoaded) {
                    return;
                }
                // if (mouseToolNo == 1) {
                //     if (m_nCurrY - evt.clientY > 0)
                //         g_imgInfo.changeZoomRatio(0.02);
                //     else
                //         g_imgInfo.changeZoomRatio(-0.02);

                //     setScaleMatrix(m_webGL, g_imgInfo);
                // }
                // else {
                    let factor = 4;

                    this.dcm_image.changeWinWidth(
                        (evt.clientX - this.mouseInfo.nCurrX) * factor);
                    this.dcm_image.changeWinCenter(
                        (this.mouseInfo.nCurrY - evt.clientY) * factor);

                    this.setTextureLowUpValue(this.webGL, this.dcm_image.getLowUpVal());
                // }

                this.mouseInfo.nCurrX = evt.clientX;
                this.mouseInfo.nCurrY = evt.clientY;

                this.drawTexture(this.webGL, 4);
            },
            handleMouseUp(evt) {
                if(this.mouseInfo.bIsDrag) {
                    this.mouseInfo.bIsDrag = false;
                    this.mouseInfo.nCurrX = 0;
                    this.mouseInfo.snCurrY = 0;
                }
            }
        }
    }  
</script>

<style>
    #dcm_image_box {
        position: relative;
    }
    #window-level {
        position: absolute;
        font-family: Arial;
        color: orange;
        font-weight: bold;
        left:5px;
        top: 5px;
    }
</style>

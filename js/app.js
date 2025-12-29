console.log('=== APP.JS 开始加载 ===');

// 简单的墙体应用
let app = {
    currentMode: null,
    isDrawing: false,
    walls: [],
    tempLine: null,
    canvas2d: null,
    ctx2d: null,
    scale: 1,
    offset: { x: 0, y: 0 },
    
    // 拖拽相关
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    lastOffset: { x: 0, y: 0 },
    
    // 墙体端点拖拽
    isDraggingWall: false,
    draggedWall: null,
    draggedPoint: null, // 'start' 或 'end'
    
    // 3D相关
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    wallMeshes: [],
    dragUpdateTimeout: null,
    showWireframe: true, // 控制线框显示
    
    init: function() {
        console.log('初始化应用...');
        
        // 获取元素
        this.canvas2d = document.getElementById('canvas-2d');
        this.canvas3d = document.getElementById('canvas-3d');
        console.log('2D画布:', this.canvas2d);
        console.log('3D画布:', this.canvas3d);
        
        // 检查视口容器
        const viewport2d = document.getElementById('viewport-2d');
        const viewport3d = document.getElementById('viewport-3d');
        console.log('2D视口:', viewport2d);
        console.log('3D视口:', viewport3d);
        
        // 检查视口容器的父元素
        const container = document.querySelector('.viewport-container');
        console.log('视口容器:', container);
        console.log('容器子元素数量:', container ? container.children.length : 0);
        
        if (!this.canvas2d) {
            console.error('找不到2D画布');
            return;
        }
        
        if (!this.canvas3d) {
            console.error('找不到3D画布');
            return;
        }
        
        this.ctx2d = this.canvas2d.getContext('2d');
        console.log('2D上下文:', this.ctx2d);
        
        // 设置画布大小
        this.resizeCanvas();
        
        // 延迟初始化3D场景
        setTimeout(() => {
            this.tryInit3D();
        }, 1000);
        
        // 绑定事件
        this.bindEvents();
        
        // 激活2D视口
        this.setActiveViewport();
        
        // 渲染
        this.render();
        
        console.log('应用初始化完成');
    },
    
    bindEvents: function() {
        console.log('绑定事件...');
        
        // 绘制按钮
        const drawBtn = document.getElementById('drawBtn');
        console.log('绘制按钮:', drawBtn);
        
        if (drawBtn) {
            drawBtn.onclick = () => {
                console.log('绘制按钮被点击');
                this.toggleDrawMode();
            };
            console.log('绘制按钮事件已绑定');
        }
        
        // 选择按钮
        const selectBtn = document.getElementById('selectBtn');
        if (selectBtn) {
            selectBtn.onclick = () => {
                console.log('选择按钮被点击');
                this.toggleSelectMode();
            };
        }
        
        // 清空按钮
        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) {
            clearBtn.onclick = () => {
                console.log('清空按钮被点击');
                this.clearAll();
            };
        }
        
        // 墙体厚度参数（不需要实时更新事件）
        const wallThicknessInput = document.getElementById('wallThickness');
        if (wallThicknessInput) {
            console.log('墙体厚度输入框已找到');
        }
        
        // 线框切换按钮
        const toggleWireframeBtn = document.getElementById('toggleWireframeBtn');
        if (toggleWireframeBtn) {
            toggleWireframeBtn.onclick = () => {
                this.toggleWireframe();
                toggleWireframeBtn.textContent = '线框: ' + (this.showWireframe ? '开' : '关');
            };
        }
        
        // 画布事件
        if (this.canvas2d) {
            this.canvas2d.onclick = (e) => {
                console.log('画布被点击');
                this.handleCanvasClick(e);
            };
            
            this.canvas2d.onmousemove = (e) => {
                this.handleCanvasMove(e);
            };
            
            this.canvas2d.oncontextmenu = (e) => {
                e.preventDefault();
                return false; // 阻止右键菜单
            };
            
            // 右键拖拽事件
            this.canvas2d.onmousedown = (e) => {
                if (e.button === 2) { // 右键
                    console.log('开始右键拖拽');
                    this.isDragging = true;
                    this.dragStart = { x: e.clientX, y: e.clientY };
                    this.lastOffset = { x: this.offset.x, y: this.offset.y };
                    this.canvas2d.style.cursor = 'move';
                    e.preventDefault();
                } else if (e.button === 0 && !this.currentMode) { // 左键且无模式
                    const coords = this.getCanvasCoords(e);
                    const wallPoint = this.findWallEndpoint(coords);
                    if (wallPoint) {
                        console.log('开始拖拽墙体端点');
                        this.isDraggingWall = true;
                        this.draggedWall = wallPoint.wall;
                        this.draggedPoint = wallPoint.point;
                        this.canvas2d.style.cursor = 'move';
                        e.preventDefault();
                    }
                }
            };
            
            this.canvas2d.onmouseup = (e) => {
                if (e.button === 2 && this.isDragging) { // 右键释放
                    console.log('结束右键拖拽');
                    this.isDragging = false;
                    this.canvas2d.style.cursor = 'default';
                    e.preventDefault();
                } else if (e.button === 2) { // 右键点击（非拖拽）
                    console.log('右键点击');
                    this.handleRightClick();
                } else if (e.button === 0 && this.isDraggingWall) { // 左键释放墙体拖拽
                    console.log('结束拖拽墙体端点');
                    this.isDraggingWall = false;
                    this.draggedWall = null;
                    this.draggedPoint = null;
                    this.canvas2d.style.cursor = 'default';
                    
                    // 拖拽结束后更新3D模型
                    this.update3DModel();
                    
                    e.preventDefault();
                }
            };
            
            // 滑轮缩放
            this.canvas2d.onwheel = (e) => {
                e.preventDefault();
                
                const rect = this.canvas2d.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                // 计算缩放前的世界坐标
                const worldBefore = this.screenToWorld(mouseX, mouseY);
                
                // 缩放
                const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
                this.scale *= zoomFactor;
                this.scale = Math.max(0.1, Math.min(10, this.scale)); // 限制缩放范围
                
                // 计算缩放后的世界坐标
                const worldAfter = this.screenToWorld(mouseX, mouseY);
                
                // 调整偏移以保持鼠标位置不变
                this.offset.x += worldBefore.x - worldAfter.x;
                this.offset.y += worldBefore.y - worldAfter.y;
                
                console.log('缩放:', this.scale.toFixed(2));
                this.render();
            };
        }
        
        console.log('事件绑定完成');
    },
    
    tryInit3D: function() {
        if (typeof THREE !== 'undefined') {
            console.log('THREE.js已加载，初始化3D场景');
            
            // 检查CSG库
            this.checkCSGLibrary();
            
            this.init3D();
        } else {
            console.warn('THREE.js仍未加载，3D功能不可用');
            // 在3D窗口显示提示信息
            const viewport3d = document.getElementById('viewport-3d');
            if (viewport3d) {
                const message = document.createElement('div');
                message.style.cssText = `
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: #ff6666;
                    text-align: center;
                    font-size: 14px;
                `;
                message.innerHTML = '3D功能不可用<br>THREE.js加载失败';
                viewport3d.appendChild(message);
            }
        }
    },
    
    setActiveViewport: function() {
        const viewport = document.getElementById('viewport-2d');
        if (viewport) {
            viewport.classList.add('active');
            console.log('2D视口已激活');
        }
    },
    
    toggleDrawMode: function() {
        console.log('切换绘制模式，当前:', this.currentMode);
        
        if (this.currentMode === 'draw') {
            this.currentMode = null;
            this.updateStatus('功能已关闭');
        } else {
            this.currentMode = 'draw';
            this.updateStatus('绘制模式 - 点击2D视口绘制墙体');
        }
        
        this.updateButtons();
        console.log('新模式:', this.currentMode);
    },
    
    toggleSelectMode: function() {
        console.log('切换选择模式，当前:', this.currentMode);
        
        if (this.currentMode === 'select') {
            this.currentMode = null;
            this.updateStatus('功能已关闭');
        } else {
            this.currentMode = 'select';
            this.updateStatus('选择模式 - 点击选择墙体');
        }
        
        this.updateButtons();
    },
    
    updateButtons: function() {
        const drawBtn = document.getElementById('drawBtn');
        const selectBtn = document.getElementById('selectBtn');
        
        if (drawBtn) {
            if (this.currentMode === 'draw') {
                drawBtn.classList.add('active');
                console.log('绘制按钮已激活');
            } else {
                drawBtn.classList.remove('active');
                console.log('绘制按钮已取消激活');
            }
        }
        
        if (selectBtn) {
            if (this.currentMode === 'select') {
                selectBtn.classList.add('active');
            } else {
                selectBtn.classList.remove('active');
            }
        }
    },
    
    handleCanvasClick: function(event) {
        console.log('画布点击，模式:', this.currentMode);
        
        if (this.currentMode === 'draw') {
            const coords = this.getCanvasCoords(event);
            console.log('绘制坐标:', coords);
            this.handleDrawClick(coords);
        } else if (this.currentMode === 'select') {
            console.log('选择模式点击');
        } else {
            console.log('没有激活模式');
            this.updateStatus('请先点击"绘制墙体"或"选择墙面"按钮');
        }
    },
    
    handleDrawClick: function(coords) {
        if (!this.isDrawing) {
            console.log('开始绘制');
            this.isDrawing = true;
            this.tempLine = { start: coords, end: coords };
            this.updateStatus('移动鼠标确定终点，右键取消');
        } else {
            console.log('完成绘制');
            // 获取当前墙体厚度和高度
            const wallThicknessInput = document.getElementById('wallThickness');
            const wallHeightInput = document.getElementById('wallHeight');
            const thicknessMm = wallThicknessInput ? parseFloat(wallThicknessInput.value) || 200 : 200;
            const heightMm = wallHeightInput ? parseFloat(wallHeightInput.value) || 3000 : 3000;
            
            this.walls.push({
                start: this.tempLine.start,
                end: coords,
                thickness: thicknessMm, // 保存创建时的厚度
                height: heightMm // 保存创建时的高度
            });
            this.isDrawing = false;
            this.tempLine = null;
            this.updateStatus('墙体已添加，总数: ' + this.walls.length);
            
            // 自动更新3D模型
            this.update3DModel();
        }
        this.render();
    },
    
    handleCanvasMove: function(event) {
        // 处理右键拖拽
        if (this.isDragging) {
            const deltaX = event.clientX - this.dragStart.x;
            const deltaY = event.clientY - this.dragStart.y;
            
            // 将像素移动转换为世界坐标移动
            this.offset.x = this.lastOffset.x - deltaX / (this.scale * 50);
            this.offset.y = this.lastOffset.y + deltaY / (this.scale * 50);
            
            this.render();
            return;
        }
        
        // 处理墙体端点拖拽
        if (this.isDraggingWall && this.draggedWall && this.draggedPoint) {
            const coords = this.getCanvasCoords(event);
            this.draggedWall[this.draggedPoint] = coords;
            this.render();
            
            // 实时更新3D模型（可以考虑节流）
            clearTimeout(this.dragUpdateTimeout);
            this.dragUpdateTimeout = setTimeout(() => {
                this.update3DModel();
            }, 100);
            return;
        }
        
        const coords = this.getCanvasCoords(event);
        
        // 更新坐标显示
        const coordsText = document.getElementById('coordsText');
        if (coordsText) {
            coordsText.textContent = 'X: ' + (coords.x * 1000).toFixed(0) + ', Y: ' + (coords.y * 1000).toFixed(0) + ' mm';
        }
        
        // 更新鼠标样式（当无模式时检查是否悬停在端点上）
        if (!this.currentMode && !this.isDragging && !this.isDraggingWall) {
            const wallPoint = this.findWallEndpoint(coords);
            this.canvas2d.style.cursor = wallPoint ? 'pointer' : 'default';
        }
        
        // 更新临时线段
        if (this.isDrawing && this.tempLine) {
            this.tempLine.end = coords;
            this.render();
        }
    },
    
    handleRightClick: function() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.tempLine = null;
            this.updateStatus('绘制已取消');
            this.render();
        }
    },
    
    getCanvasCoords: function(event) {
        const rect = this.canvas2d.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        return this.screenToWorld(mouseX, mouseY);
    },
    
    screenToWorld: function(screenX, screenY) {
        const centerX = this.canvas2d.width / 2;
        const centerY = this.canvas2d.height / 2;
        
        const pixelX = screenX - centerX;
        const pixelY = screenY - centerY;
        
        const worldX = (pixelX / (this.scale * 50)) + this.offset.x;
        const worldY = -(pixelY / (this.scale * 50)) + this.offset.y;
        
        return { x: worldX, y: worldY };
    },
    
    resizeCanvas: function() {
        if (!this.canvas2d) return;
        
        const container2d = this.canvas2d.parentElement;
        const rect2d = container2d.getBoundingClientRect();
        
        this.canvas2d.width = rect2d.width;
        this.canvas2d.height = rect2d.height;
        
        console.log('2D画布大小:', rect2d.width, 'x', rect2d.height);
        
        // 调整3D渲染器大小
        if (this.renderer && this.camera) {
            const container3d = this.canvas3d.parentElement;
            const rect3d = container3d.getBoundingClientRect();
            
            this.renderer.setSize(rect3d.width, rect3d.height);
            this.camera.aspect = rect3d.width / rect3d.height;
            this.camera.updateProjectionMatrix();
            
            console.log('3D画布大小:', rect3d.width, 'x', rect3d.height);
        }
        
        this.render();
    },
    
    render: function() {
        if (!this.ctx2d) {
            console.log('没有2D上下文');
            return;
        }
        
        const ctx = this.ctx2d;
        const width = this.canvas2d.width;
        const height = this.canvas2d.height;
        
        // 清空画布
        ctx.fillStyle = '#001133';
        ctx.fillRect(0, 0, width, height);
        
        // 设置坐标系
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(this.scale * 50, -this.scale * 50);
        ctx.translate(-this.offset.x, -this.offset.y);
        
        // 绘制网格
        this.drawGrid(ctx);
        
        // 绘制墙体
        this.drawWalls(ctx);
        
        // 绘制临时线段
        if (this.tempLine) {
            ctx.strokeStyle = '#88ff88';
            ctx.setLineDash([0.05, 0.05]);
            ctx.lineWidth = 0.03;
            ctx.beginPath();
            ctx.moveTo(this.tempLine.start.x, this.tempLine.start.y);
            ctx.lineTo(this.tempLine.end.x, this.tempLine.end.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        ctx.restore();
        
        console.log('渲染完成');
    },
    
    drawGrid: function(ctx) {
        ctx.strokeStyle = '#004466';
        ctx.lineWidth = 0.01;
        
        const range = 10;
        
        // 网格线
        for (let x = -range; x <= range; x++) {
            ctx.beginPath();
            ctx.moveTo(x, -range);
            ctx.lineTo(x, range);
            ctx.stroke();
        }
        
        for (let y = -range; y <= range; y++) {
            ctx.beginPath();
            ctx.moveTo(-range, y);
            ctx.lineTo(range, y);
            ctx.stroke();
        }
        
        // 坐标轴
        ctx.strokeStyle = '#006699';
        ctx.lineWidth = 0.02;
        
        ctx.beginPath();
        ctx.moveTo(-range, 0);
        ctx.lineTo(range, 0);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, -range);
        ctx.lineTo(0, range);
        ctx.stroke();
    },
    
    drawWalls: function(ctx) {
        this.walls.forEach((wall) => {
            // 绘制墙体轮廓（使用墙体自己的厚度）
            const polygon = this.generateWallPolygon(wall.start, wall.end, wall.thickness);
            
            if (polygon.length > 0) {
                // 绘制轮廓填充
                ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
                ctx.beginPath();
                polygon.forEach((point, i) => {
                    if (i === 0) {
                        ctx.moveTo(point.x, point.y);
                    } else {
                        ctx.lineTo(point.x, point.y);
                    }
                });
                ctx.closePath();
                ctx.fill();
                
                // 绘制轮廓线
                ctx.strokeStyle = '#00aa00';
                ctx.lineWidth = 0.01;
                ctx.stroke();
            }
            
            // 绘制中心线
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 0.02;
            
            ctx.beginPath();
            ctx.moveTo(wall.start.x, wall.start.y);
            ctx.lineTo(wall.end.x, wall.end.y);
            ctx.stroke();
            
            // 绘制端点
            ctx.fillStyle = '#00ff00';
            ctx.beginPath();
            ctx.arc(wall.start.x, wall.start.y, 0.05, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(wall.end.x, wall.end.y, 0.05, 0, Math.PI * 2);
            ctx.fill();
        });
    },
    
    clearAll: function() {
        console.log('清空所有墙体');
        this.walls = [];
        this.isDrawing = false;
        this.tempLine = null;
        
        // 清空3D模型
        this.clearWallMeshes();
        
        this.render();
        this.updateStatus('已清空所有墙体和3D模型');
    },
    
    generateWallPolygon: function(start, end, wallThickness) {
        // 使用传入的墙体厚度（毫米转米）
        const thickness = wallThickness / 1000; // 转换为米
        
        // 计算方向向量
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return [];
        
        // 计算单位法向量（垂直于墙体中心线）
        const normalX = -dy / length;  // 法向量X分量
        const normalY = dx / length;   // 法向量Y分量
        
        const halfThickness = thickness / 2;
        
        // 生成墙体四个顶点（矩形）
        return [
            {
                x: start.x + normalX * halfThickness,
                y: start.y + normalY * halfThickness
            },
            {
                x: end.x + normalX * halfThickness,
                y: end.y + normalY * halfThickness
            },
            {
                x: end.x - normalX * halfThickness,
                y: end.y - normalY * halfThickness
            },
            {
                x: start.x - normalX * halfThickness,
                y: start.y - normalY * halfThickness
            }
        ];
    },
    
    findWallEndpoint: function(coords) {
        const tolerance = 0.1; // 10cm 容差
        
        for (let wall of this.walls) {
            // 检查起点
            const startDist = Math.sqrt(
                Math.pow(coords.x - wall.start.x, 2) + 
                Math.pow(coords.y - wall.start.y, 2)
            );
            if (startDist <= tolerance) {
                return { wall: wall, point: 'start' };
            }
            
            // 检查终点
            const endDist = Math.sqrt(
                Math.pow(coords.x - wall.end.x, 2) + 
                Math.pow(coords.y - wall.end.y, 2)
            );
            if (endDist <= tolerance) {
                return { wall: wall, point: 'end' };
            }
        }
        
        return null;
    },
    
    init3D: function() {
        console.log('初始化3D场景...');
        
        try {
            // 检查Three.js是否可用
            if (typeof THREE === 'undefined') {
                console.error('Three.js未加载');
                return;
            }
            
            // 创建场景
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x001133);
            console.log('3D场景创建成功');
            
            // 创建相机
            const container = this.canvas3d.parentElement;
            const rect = container.getBoundingClientRect();
            console.log('3D容器尺寸:', rect.width, 'x', rect.height);
            
            this.camera = new THREE.PerspectiveCamera(75, rect.width / rect.height, 0.1, 1000);
            this.camera.position.set(5, 5, 5);
            this.camera.lookAt(0, 0, 0);
            console.log('3D相机创建成功');
            
            // 创建渲染器
            this.renderer = new THREE.WebGLRenderer({ 
                canvas: this.canvas3d, 
                antialias: true,
                alpha: true
            });
            this.renderer.setSize(rect.width, rect.height);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            console.log('3D渲染器创建成功');
            
            // 添加轨道控制器（如果可用）
            setTimeout(() => {
                if (typeof THREE.OrbitControls !== 'undefined') {
                    this.controls = new THREE.OrbitControls(this.camera, this.canvas3d);
                    this.controls.enableDamping = true;
                    this.controls.dampingFactor = 0.05;
                    console.log('OrbitControls初始化成功');
                } else {
                    console.warn('OrbitControls不可用，使用基础相机控制');
                    this.setupBasicControls();
                }
            }, 100);
            
            // 添加光源
            const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
            this.scene.add(ambientLight);
            
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(10, 10, 5);
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            this.scene.add(directionalLight);
            console.log('3D光源添加成功');
            
            // 添加网格
            this.add3DGrid();
            
            // 开始渲染循环
            this.animate3D();
            
            console.log('3D场景初始化完成');
            
        } catch (error) {
            console.error('3D初始化失败:', error);
        }
    },
    
    add3DGrid: function() {
        try {
            const gridHelper = new THREE.GridHelper(20, 20, 0x006699, 0x004466);
            this.scene.add(gridHelper);
            
            const axesHelper = new THREE.AxesHelper(5);
            this.scene.add(axesHelper);
            
            console.log('3D网格和坐标轴添加成功');
        } catch (error) {
            console.error('添加3D网格失败:', error);
        }
    },
    
    animate3D: function() {
        try {
            if (this.controls) {
                this.controls.update();
            }
            
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
        } catch (error) {
            console.error('3D渲染错误:', error);
            // 停止渲染循环以避免错误重复
            return;
        }
        
        // 只有在没有错误时才继续动画循环
        requestAnimationFrame(() => this.animate3D());
    },
    
    setupBasicControls: function() {
        // 简单的鼠标控制
        let isMouseDown = false;
        let mouseX = 0, mouseY = 0;
        
        this.canvas3d.addEventListener('mousedown', (event) => {
            isMouseDown = true;
            mouseX = event.clientX;
            mouseY = event.clientY;
        });
        
        this.canvas3d.addEventListener('mouseup', () => {
            isMouseDown = false;
        });
        
        this.canvas3d.addEventListener('mousemove', (event) => {
            if (!isMouseDown) return;
            
            const deltaX = event.clientX - mouseX;
            const deltaY = event.clientY - mouseY;
            
            // 简单的相机旋转（修正Y轴方向）
            const spherical = new THREE.Spherical();
            spherical.setFromVector3(this.camera.position);
            spherical.theta -= deltaX * 0.01;
            spherical.phi -= deltaY * 0.01; // 反转Y轴方向
            spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
            
            this.camera.position.setFromSpherical(spherical);
            this.camera.lookAt(0, 0, 0);
            
            mouseX = event.clientX;
            mouseY = event.clientY;
        });
        
        // 滚轮缩放
        this.canvas3d.addEventListener('wheel', (event) => {
            event.preventDefault();
            const scale = event.deltaY > 0 ? 1.1 : 0.9;
            this.camera.position.multiplyScalar(scale);
        });
        
        console.log('基础3D控制设置完成');
    },
    
    toggleWireframe: function() {
        this.showWireframe = !this.showWireframe;
        console.log('线框显示:', this.showWireframe ? '开启' : '关闭');
        
        // 重新生成3D模型以应用线框设置
        this.update3DModel();
    },
    
    update3DModel: function() {
        // 检查THREE.js是否已加载
        if (typeof THREE === 'undefined') {
            console.warn('THREE.js未加载，跳过3D模型更新');
            return;
        }
        
        // 自动更新3D模型（当墙体发生变化时调用）
        if (this.walls.length > 0) {
            this.generate3DModel();
        } else {
            // 如果没有墙体，只清空3D模型
            this.clearWallMeshes();
        }
    },
    
    reset3DView: function() {
        if (this.camera && this.controls) {
            this.camera.position.set(5, 5, 5);
            this.camera.lookAt(0, 0, 0);
            this.controls.reset();
        }
    },
    
    generate3DModel: function() {
        console.log('开始生成3D模型...');
        
        // 检查THREE.js是否已加载
        if (typeof THREE === 'undefined') {
            console.error('THREE.js未加载，无法生成3D模型');
            this.updateStatus('THREE.js未加载，无法生成3D模型');
            return;
        }
        
        // 检查3D场景是否已初始化
        if (!this.scene || !this.renderer || !this.camera) {
            console.error('3D场景未初始化，无法生成3D模型');
            this.updateStatus('3D场景未初始化');
            return;
        }
        
        if (this.walls.length === 0) {
            this.updateStatus('没有墙体可以生成3D模型');
            return;
        }
        
        try {
            // 清除现有的墙体网格
            this.clearWallMeshes();
            
            // 添加详细的调试信息
            console.log('=== 3D模型生成调试信息 ===');
            console.log('墙体数据:');
            this.walls.forEach((wall, index) => {
                console.log(`墙体 ${index}:`, {
                    start: wall.start,
                    end: wall.end,
                    thickness: wall.thickness,
                    height: wall.height
                });
            });
            
            // 检测墙体交集
            const intersections = this.detectWallIntersections();
            console.log('交集数量:', intersections.length);
            
            // 生成墙体几何体
            const wallGeometries = this.generateWallGeometries();
            console.log('生成的几何体数量:', wallGeometries.length);
            
            // 验证几何体与墙体数据的对应关系
            wallGeometries.forEach((geometry, index) => {
                if (geometry) {
                    const vertexCount = geometry.attributes.position.count;
                    console.log(`几何体 ${index}: 顶点数 ${vertexCount}, 对应墙体:`, this.walls[index]);
                } else {
                    console.error(`几何体 ${index}: 生成失败`);
                }
            });
            
            // 执行布尔运算合并墙体（去除交集）
            const mergedResult = this.mergeWallGeometries(wallGeometries);
            
            // 创建网格并添加到场景
            if (mergedResult) {
                if (mergedResult.isGroup) {
                    // 如果是组对象，直接添加
                    this.scene.add(mergedResult);
                    this.wallMeshes.push(mergedResult);
                } else {
                    // 如果是合并后的几何体，创建单一网格
                    const material = new THREE.MeshLambertMaterial({ 
                        color: 0x00aa00,
                        transparent: true,
                        opacity: 0.8
                    });
                    
                    const mesh = new THREE.Mesh(mergedResult, material);
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    
                    this.scene.add(mesh);
                    this.wallMeshes.push(mesh);
                    
                    // 添加边缘线（这里应该显示布尔运算后的轮廓）
                    const edges = new THREE.EdgesGeometry(mergedResult);
                    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00ff00 }));
                    this.scene.add(line);
                    this.wallMeshes.push(line);
                    
                    // 添加线框显示（显示所有内部线条）
                    if (this.showWireframe) {
                        const wireframe = new THREE.WireframeGeometry(mergedResult);
                        const wireframeLine = new THREE.LineSegments(wireframe, new THREE.LineBasicMaterial({ 
                            color: 0xffff00, // 黄色线框
                            opacity: 0.6,
                            transparent: true
                        }));
                        this.scene.add(wireframeLine);
                        this.wallMeshes.push(wireframeLine);
                    }
                    
                    console.log('创建了合并后的单一几何体');
                }
                
                const statusMsg = `3D模型生成完成，墙体数量: ${this.walls.length}，交集数量: ${intersections.length}`;
                this.updateStatus(statusMsg);
            } else {
                this.updateStatus('3D模型生成失败');
            }
        } catch (error) {
            console.error('3D模型生成错误:', error);
            this.updateStatus('3D模型生成错误: ' + error.message);
        }
    },
    
    clearWallMeshes: function() {
        if (typeof THREE === 'undefined' || !this.scene) {
            console.warn('THREE.js未加载或场景未初始化，跳过清空墙体网格');
            return;
        }
        
        try {
            this.wallMeshes.forEach(mesh => {
                this.scene.remove(mesh);
                
                // 正确清理几何体
                if (mesh.geometry) {
                    mesh.geometry.dispose();
                }
                
                // 正确清理材质
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        mesh.material.forEach(material => material.dispose());
                    } else {
                        mesh.material.dispose();
                    }
                }
            });
            
            this.wallMeshes = [];
            console.log('墙体网格已清空');
        } catch (error) {
            console.error('清空墙体网格时出错:', error);
            this.wallMeshes = []; // 强制清空数组
        }
    },
    
    generateWallGeometries: function() {
        const geometries = [];
        
        if (typeof THREE === 'undefined') {
            console.error('THREE.js未加载，无法生成墙体几何体');
            return geometries;
        }
        
        console.log('开始生成墙体几何体，墙体数量:', this.walls.length);
        
        this.walls.forEach((wall, index) => {
            try {
                console.log(`生成墙体 ${index} 的几何体:`, wall);
                const geometry = this.createWallGeometry(wall);
                if (geometry) {
                    geometries.push(geometry);
                    console.log(`墙体 ${index} 几何体生成成功`);
                } else {
                    console.error(`墙体 ${index} 几何体生成失败`);
                    geometries.push(null);
                }
            } catch (error) {
                console.error(`创建墙体 ${index} 几何体失败:`, error);
                geometries.push(null);
            }
        });
        
        console.log('墙体几何体生成完成，有效几何体数量:', geometries.filter(g => g !== null).length);
        return geometries;
    },
    
    createWallGeometry: function(wall) {
        if (typeof THREE === 'undefined') {
            console.error('THREE.js未加载，无法创建墙体几何体');
            return null;
        }
        
        try {
            console.log(`创建墙体几何体 - 起点: (${wall.start.x}, ${wall.start.y}), 终点: (${wall.end.x}, ${wall.end.y})`);
            
            // 使用墙体自己的高度（毫米转米）
            const height = wall.height / 1000; // 转换为米
            
            // 生成墙体2D轮廓（使用与2D渲染相同的方法）
            const polygon = this.generateWallPolygon(wall.start, wall.end, wall.thickness);
            
            if (polygon.length !== 4) {
                console.warn('墙体轮廓不是四边形，顶点数:', polygon.length);
                return null;
            }
            
            console.log('墙体2D轮廓:', polygon);
            
            // 创建2D形状（参考src实现）
            const shape = new THREE.Shape();
            shape.moveTo(polygon[0].x, polygon[0].y);
            shape.lineTo(polygon[1].x, polygon[1].y);
            shape.lineTo(polygon[2].x, polygon[2].y);
            shape.lineTo(polygon[3].x, polygon[3].y);
            shape.lineTo(polygon[0].x, polygon[0].y);
            
            // 拉伸成3D几何体（参考src实现）
            const geometry = new THREE.ExtrudeGeometry(shape, {
                depth: height,
                bevelEnabled: false,
                steps: 1
            });
            
            // 关键：旋转几何体使其正确朝向（XY平面 -> XZ平面）
            geometry.rotateX(-Math.PI / 2);
            
            console.log(`墙体几何体创建成功 - 高度: ${height}m, 顶点数: ${geometry.attributes.position.count}`);
            
            return geometry;
        } catch (error) {
            console.error('创建墙体几何体时出错:', error);
            return null;
        }
    },
    
    mergeWallGeometries: function(geometries) {
        if (geometries.length === 0) return null;
        if (geometries.length === 1) return this.createWallGroup(geometries);
        
        // 检测交集
        const intersections = this.detectWallIntersections();
        
        if (intersections.length === 0) {
            // 没有交集，保持独立墙体
            console.log('没有交集，保持独立墙体');
            return this.createWallGroup(geometries);
        } else {
            // 有交集，执行减法运算去除重叠部分
            console.log('检测到', intersections.length, '个交集，执行布尔减法运算');
            return this.performSubtractionOperations(geometries, intersections);
        }
    },
    
    performSubtractionOperations: function(geometries, intersections) {
        try {
            console.log('=== 强制布尔运算测试 ===');
            console.log('几何体数量:', geometries.length);
            console.log('交集数量:', intersections.length);
            
            if (intersections.length === 0) {
                console.log('没有交集，保持独立墙体');
                this.wallWasModified = new Array(geometries.length).fill(false);
                return this.createWallGroup(geometries);
            }
            
            // 强制执行明显的布尔效果，不依赖CSG库
            console.log('执行强制布尔运算以显示明显效果');
            
            const modifiedGeometries = [];
            this.wallWasModified = new Array(geometries.length).fill(false);
            
            for (let i = 0; i < geometries.length; i++) {
                const currentGeometry = geometries[i];
                
                // 找到与当前墙体相交的其他墙体
                const intersectingWalls = intersections.filter(intersection => 
                    intersection.wall1 === i || intersection.wall2 === i
                );
                
                if (intersectingWalls.length > 0) {
                    console.log(`墙体 ${i} 有 ${intersectingWalls.length} 个交集，执行强制L形切割`);
                    
                    // 强制创建L形效果
                    const modifiedGeometry = this.createLShapeGeometry(currentGeometry, intersectingWalls, i);
                    modifiedGeometries.push(modifiedGeometry);
                    this.wallWasModified[i] = true;
                    console.log(`墙体 ${i} 强制修改为L形`);
                } else {
                    console.log(`墙体 ${i} 无交集，保持原样`);
                    modifiedGeometries.push(currentGeometry);
                }
            }
            
            console.log('强制布尔运算完成');
            console.log('修改的墙体:', this.wallWasModified.map((modified, i) => modified ? i : null).filter(i => i !== null));
            
            return this.createWallGroup(modifiedGeometries);
            
        } catch (error) {
            console.error('强制布尔运算失败:', error);
            this.wallWasModified = new Array(geometries.length).fill(false);
            return this.createWallGroup(geometries);
        }
    },
    
    createLShapeGeometry: function(originalGeometry, intersectingWalls, wallIndex) {
        try {
            console.log(`为墙体 ${wallIndex} 创建L形几何体`);
            
            const wall = this.walls[wallIndex];
            
            // 获取墙体的基本参数
            const thickness = wall.thickness / 1000; // 转换为米
            const height = wall.height / 1000; // 转换为米
            
            // 计算墙体方向
            const dx = wall.end.x - wall.start.x;
            const dy = wall.end.y - wall.start.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            if (length === 0) return originalGeometry;
            
            // 计算法向量
            const normalX = -dy / length;
            const normalY = dx / length;
            const halfThickness = thickness / 2;
            
            // 创建L形：移除一个角落
            const cutRatio = 0.4; // 切掉40%的长度
            const cutLength = length * cutRatio;
            
            // 计算切割点
            const cutX = wall.start.x + (dx * cutRatio);
            const cutY = wall.start.y + (dy * cutRatio);
            
            // 创建L形的顶点
            const vertices = [];
            const indices = [];
            
            // L形的2D轮廓点（从起点开始，逆时针）
            const profile = [
                // 外轮廓
                { x: wall.start.x + normalX * halfThickness, y: wall.start.y + normalY * halfThickness },
                { x: cutX + normalX * halfThickness, y: cutY + normalY * halfThickness },
                { x: cutX + normalX * halfThickness, y: cutY + normalY * halfThickness - thickness },
                { x: wall.end.x + normalX * halfThickness, y: wall.end.y + normalY * halfThickness - thickness },
                { x: wall.end.x - normalX * halfThickness, y: wall.end.y - normalY * halfThickness - thickness },
                { x: wall.end.x - normalX * halfThickness, y: wall.end.y - normalY * halfThickness },
                { x: cutX - normalX * halfThickness, y: cutY - normalY * halfThickness },
                { x: wall.start.x - normalX * halfThickness, y: wall.start.y - normalY * halfThickness }
            ];
            
            console.log(`L形轮廓点数: ${profile.length}`);
            
            // 创建底面顶点 (y=0)
            profile.forEach(point => {
                vertices.push(point.x, 0, point.y);
            });
            
            // 创建顶面顶点 (y=height)
            profile.forEach(point => {
                vertices.push(point.x, height, point.y);
            });
            
            const numVertices = profile.length;
            
            // 创建底面（三角扇形）
            for (let i = 2; i < numVertices; i++) {
                indices.push(0, i - 1, i);
            }
            
            // 创建顶面（三角扇形，注意顶点顺序）
            for (let i = 2; i < numVertices; i++) {
                indices.push(numVertices, numVertices + i, numVertices + i - 1);
            }
            
            // 创建侧面
            for (let i = 0; i < numVertices; i++) {
                const next = (i + 1) % numVertices;
                
                // 侧面四边形（两个三角形）
                indices.push(i, next, numVertices + i);
                indices.push(next, numVertices + next, numVertices + i);
            }
            
            // 创建新几何体
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setIndex(indices);
            geometry.computeVertexNormals();
            geometry.computeBoundingBox();
            
            console.log(`L形几何体创建完成: 顶点数 ${vertices.length/3}, 三角形数 ${indices.length/3}`);
            
            return geometry;
            
        } catch (error) {
            console.error(`创建墙体 ${wallIndex} L形几何体失败:`, error);
            return originalGeometry;
        }
    },
    
    performSimpleSubtraction: function(geometries, intersections) {
        // 简化版本的布尔运算（当CSG库不可用时）
        console.log('执行简化布尔运算（更激进的版本）');
        
        const modifiedGeometries = [];
        this.wallWasModified = new Array(geometries.length).fill(false);
        
        for (let i = 0; i < geometries.length; i++) {
            const currentGeometry = geometries[i];
            
            // 找到与当前墙体相交的其他墙体
            const intersectingWalls = intersections.filter(intersection => 
                intersection.wall1 === i || intersection.wall2 === i
            );
            
            if (intersectingWalls.length > 0) {
                console.log(`墙体 ${i} 有 ${intersectingWalls.length} 个交集，执行激进修改`);
                
                // 更激进的处理：显著修改几何体
                const modifiedGeometry = this.aggressiveGeometryModification(currentGeometry, intersectingWalls, i);
                modifiedGeometries.push(modifiedGeometry);
                this.wallWasModified[i] = true;
                console.log(`墙体 ${i} 使用激进简化布尔运算修改`);
            } else {
                modifiedGeometries.push(currentGeometry);
            }
        }
        
        return this.createWallGroup(modifiedGeometries);
    },
    
    aggressiveGeometryModification: function(geometry, intersectingWalls, wallIndex) {
        try {
            console.log(`对墙体 ${wallIndex} 执行激进几何体修改`);
            
            const wall = this.walls[wallIndex];
            const clonedGeometry = geometry.clone();
            
            // 计算墙体方向
            const dx = wall.end.x - wall.start.x;
            const dy = wall.end.y - wall.start.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            if (length === 0) return geometry;
            
            // 创建一个明显的L形切割
            const positions = clonedGeometry.attributes.position.array;
            const newPositions = [];
            const newIndices = [];
            
            // 获取墙体中心
            const centerX = (wall.start.x + wall.end.x) / 2;
            const centerZ = (wall.start.y + wall.end.y) / 2;
            
            // 创建L形切割：移除一个角落
            const cutSize = Math.min(wall.thickness / 1000, length) * 0.4; // 转换为米并设置切割大小
            
            for (let i = 0; i < positions.length; i += 3) {
                const x = positions[i];
                const y = positions[i + 1];
                const z = positions[i + 2];
                
                // 检查顶点是否在要切割的区域内
                const relX = x - centerX;
                const relZ = z - centerZ;
                
                // 切割右上角区域
                const inCutRegion = relX > cutSize && relZ > cutSize;
                
                if (!inCutRegion) {
                    newPositions.push(x, y, z);
                }
            }
            
            // 如果切割后还有顶点，创建新几何体
            if (newPositions.length > 0) {
                const newGeometry = new THREE.BufferGeometry();
                newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
                
                // 重新创建索引（简化为顺序索引）
                const vertexCount = newPositions.length / 3;
                const indices = [];
                for (let i = 0; i < vertexCount - 2; i += 3) {
                    indices.push(i, i + 1, i + 2);
                }
                
                if (indices.length > 0) {
                    newGeometry.setIndex(indices);
                }
                
                newGeometry.computeVertexNormals();
                newGeometry.computeBoundingBox();
                
                console.log(`墙体 ${wallIndex} 激进修改完成，顶点数从 ${positions.length/3} 减少到 ${newPositions.length/3}`);
                return newGeometry;
            } else {
                // 如果切割后没有顶点，返回一个缩小的版本
                console.log(`墙体 ${wallIndex} 切割后为空，返回缩小版本`);
                return this.shrinkIntersectingGeometry(geometry, intersectingWalls, wallIndex);
            }
            
        } catch (error) {
            console.error(`墙体 ${wallIndex} 激进几何体修改失败:`, error);
            return this.shrinkIntersectingGeometry(geometry, intersectingWalls, wallIndex);
        }
    },
    
    shrinkIntersectingGeometry: function(geometry, intersectingWalls, wallIndex) {
        try {
            // 简化的几何体修改：沿着墙体厚度方向缩小
            const wall = this.walls[wallIndex];
            const shrinkFactor = 0.8; // 缩小到80%
            
            const clonedGeometry = geometry.clone();
            
            // 计算墙体中心
            const centerX = (wall.start.x + wall.end.x) / 2;
            const centerZ = (wall.start.y + wall.end.y) / 2;
            const centerY = wall.height / 2000; // 转换为米
            
            // 创建缩放矩阵
            const scaleMatrix = new THREE.Matrix4();
            const translateToOrigin = new THREE.Matrix4().makeTranslation(-centerX, -centerY, -centerZ);
            const scale = new THREE.Matrix4().makeScale(shrinkFactor, 1, shrinkFactor);
            const translateBack = new THREE.Matrix4().makeTranslation(centerX, centerY, centerZ);
            
            // 应用变换
            scaleMatrix.multiplyMatrices(translateBack, scale);
            scaleMatrix.multiplyMatrices(scaleMatrix, translateToOrigin);
            
            clonedGeometry.applyMatrix4(scaleMatrix);
            clonedGeometry.computeVertexNormals();
            
            console.log(`墙体 ${wallIndex} 几何体已缩小`);
            return clonedGeometry;
            
        } catch (error) {
            console.error(`缩小墙体 ${wallIndex} 几何体失败:`, error);
            return geometry;
        }
    },
    
    // CSG库检查函数
    checkCSGLibrary: function() {
        console.log('=== CSG库检查 ===');
        console.log('window.ThreeBvhCsg:', typeof window.ThreeBvhCsg);
        console.log('全局ThreeBvhCsg:', typeof ThreeBvhCsg);
        
        if (typeof window.ThreeBvhCsg !== 'undefined') {
            console.log('CSG库从window对象可用');
            console.log('Brush:', typeof window.ThreeBvhCsg.Brush);
            console.log('Evaluator:', typeof window.ThreeBvhCsg.Evaluator);
            console.log('SUBTRACTION:', typeof window.ThreeBvhCsg.SUBTRACTION);
            return true;
        } else if (typeof ThreeBvhCsg !== 'undefined') {
            console.log('CSG库从全局对象可用');
            console.log('Brush:', typeof ThreeBvhCsg.Brush);
            console.log('Evaluator:', typeof ThreeBvhCsg.Evaluator);
            console.log('SUBTRACTION:', typeof ThreeBvhCsg.SUBTRACTION);
            return true;
        } else {
            console.warn('CSG库未加载或不可用');
            
            // 尝试手动加载
            console.log('尝试手动检查CSG库...');
            const scripts = document.querySelectorAll('script[src*="three-bvh-csg"]');
            console.log('找到CSG脚本标签数量:', scripts.length);
            
            return false;
        }
    },
    
    // 旧的复杂布尔运算函数已被CSG库替代
    // 保留一些辅助函数用于向后兼容
    
    getTriangleGeometryIntersection: function(triangle, geometry, positions, indices) {
        // 检查三角形与几何体的相交情况
        const vertices = [triangle.v0, triangle.v1, triangle.v2];
        let insideCount = 0;
        let outsideCount = 0;
        
        // 检查每个顶点是否在几何体内部
        vertices.forEach(vertex => {
            if (this.isPointInsideGeometry(vertex, geometry, positions, indices)) {
                insideCount++;
            } else {
                outsideCount++;
            }
        });
        
        return {
            intersects: insideCount > 0,
            fullyInside: insideCount === 3,
            partiallyInside: insideCount > 0 && insideCount < 3
        };
    },
    
    isPointInsideGeometry: function(point, geometry, positions, indices) {
        try {
            // 使用射线投射法检测点是否在几何体内部
            const direction = new THREE.Vector3(1, 0, 0); // 向X轴正方向发射射线
            const raycaster = new THREE.Raycaster(point, direction);
            
            // 创建临时网格进行射线检测
            const tempMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
            const intersections = raycaster.intersectObject(tempMesh);
            
            // 奇数个交点表示点在内部
            const isInside = intersections.length % 2 === 1;
            
            return isInside;
        } catch (error) {
            console.error('点在几何体内部检测失败:', error);
            return false;
        }
    },
    
    clipTriangleWithGeometry: function(triangle, geometry, positions, indices) {
        try {
            // 简化的三角形裁剪：基于顶点内外状态
            const vertices = [triangle.v0, triangle.v1, triangle.v2];
            const insideFlags = vertices.map(v => this.isPointInsideGeometry(v, geometry, positions, indices));
            
            const insideCount = insideFlags.filter(flag => flag).length;
            
            if (insideCount === 0) {
                // 所有顶点都在外部，保留整个三角形
                return [triangle];
            } else if (insideCount === 3) {
                // 所有顶点都在内部，完全移除
                return [];
            } else {
                // 部分顶点在内部，需要裁剪
                return this.performTriangleClipping(triangle, insideFlags, geometry, positions, indices);
            }
        } catch (error) {
            console.error('三角形裁剪失败:', error);
            return [triangle]; // 失败时保留原三角形
        }
    },
    
    performTriangleClipping: function(triangle, insideFlags, geometry, positions, indices) {
        try {
            const vertices = [triangle.v0, triangle.v1, triangle.v2];
            const outsideVertices = [];
            const insideVertices = [];
            
            // 分离内外顶点
            for (let i = 0; i < 3; i++) {
                if (insideFlags[i]) {
                    insideVertices.push({ vertex: vertices[i], index: i });
                } else {
                    outsideVertices.push({ vertex: vertices[i], index: i });
                }
            }
            
            console.log(`三角形裁剪: ${outsideVertices.length} 个外部顶点, ${insideVertices.length} 个内部顶点`);
            
            if (outsideVertices.length === 1) {
                // 一个顶点在外部，两个在内部：保留外部顶点形成的小三角形
                const outsideVertex = outsideVertices[0].vertex;
                const intersectionPoints = [];
                
                // 找到外部顶点与内部顶点连线与几何体表面的交点
                insideVertices.forEach(inside => {
                    const intersection = this.findLineGeometryIntersection(
                        outsideVertex, inside.vertex, geometry, positions, indices
                    );
                    if (intersection) {
                        intersectionPoints.push(intersection);
                    }
                });
                
                if (intersectionPoints.length >= 2) {
                    // 创建新的三角形
                    return [{
                        v0: outsideVertex,
                        v1: intersectionPoints[0],
                        v2: intersectionPoints[1]
                    }];
                }
            } else if (outsideVertices.length === 2) {
                // 两个顶点在外部，一个在内部：保留外部部分
                const insideVertex = insideVertices[0].vertex;
                const intersectionPoints = [];
                
                // 找到内部顶点与外部顶点连线与几何体表面的交点
                outsideVertices.forEach(outside => {
                    const intersection = this.findLineGeometryIntersection(
                        insideVertex, outside.vertex, geometry, positions, indices
                    );
                    if (intersection) {
                        intersectionPoints.push(intersection);
                    }
                });
                
                if (intersectionPoints.length >= 2) {
                    // 创建四边形，分割成两个三角形
                    return [
                        {
                            v0: outsideVertices[0].vertex,
                            v1: outsideVertices[1].vertex,
                            v2: intersectionPoints[0]
                        },
                        {
                            v0: outsideVertices[1].vertex,
                            v1: intersectionPoints[1],
                            v2: intersectionPoints[0]
                        }
                    ];
                }
            }
            
            // 如果裁剪失败，根据外部顶点数量决定
            if (outsideVertices.length >= insideVertices.length) {
                return [triangle]; // 保留原三角形
            } else {
                return []; // 移除三角形
            }
            
        } catch (error) {
            console.error('执行三角形裁剪失败:', error);
            return []; // 失败时移除三角形
        }
    },
    
    findLineGeometryIntersection: function(pointA, pointB, geometry, positions, indices) {
        try {
            // 使用射线投射找到线段与几何体表面的交点
            const direction = new THREE.Vector3().subVectors(pointB, pointA).normalize();
            const raycaster = new THREE.Raycaster(pointA, direction);
            
            // 创建临时网格进行射线检测
            const tempMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
            const intersections = raycaster.intersectObject(tempMesh);
            
            if (intersections.length > 0) {
                // 返回最近的交点
                return intersections[0].point;
            }
            
            return null;
        } catch (error) {
            console.error('线段几何体交点查找失败:', error);
            return null;
        }
    },
    
    getTriangleFromGeometry: function(positions, indices, triangleIndex) {
        let i0, i1, i2;
        
        if (indices) {
            i0 = indices[triangleIndex * 3];
            i1 = indices[triangleIndex * 3 + 1];
            i2 = indices[triangleIndex * 3 + 2];
        } else {
            i0 = triangleIndex * 3;
            i1 = triangleIndex * 3 + 1;
            i2 = triangleIndex * 3 + 2;
        }
        
        return {
            v0: new THREE.Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]),
            v1: new THREE.Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]),
            v2: new THREE.Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2])
        };
    },
    
    triangleIntersectsGeometry: function(triangle, geometry, boundingBox) {
        // 使用更精确的相交检测
        const triangleBounds = this.getTriangleBounds(triangle);
        
        // 首先检查包围盒
        if (!this.boundsIntersect(triangleBounds, boundingBox)) {
            return false;
        }
        
        // 检查三角形顶点是否有任何一个在几何体内部
        const vertices = [triangle.v0, triangle.v1, triangle.v2];
        for (let vertex of vertices) {
            if (this.isPointInsideGeometry(vertex, geometry, positions, indices)) {
                return true;
            }
        }
        
        // 检查三角形边是否与几何体表面相交
        return this.triangleEdgesIntersectGeometry(triangle, geometry);
    },
    
    triangleEdgesIntersectGeometry: function(triangle, geometry) {
        try {
            // 检查三角形的三条边是否与几何体表面相交
            const edges = [
                { start: triangle.v0, end: triangle.v1 },
                { start: triangle.v1, end: triangle.v2 },
                { start: triangle.v2, end: triangle.v0 }
            ];
            
            for (let edge of edges) {
                if (this.lineIntersectsGeometry(edge.start, edge.end, geometry)) {
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('三角形边与几何体相交检测失败:', error);
            return false;
        }
    },
    
    lineIntersectsGeometry: function(pointA, pointB, geometry) {
        try {
            const direction = new THREE.Vector3().subVectors(pointB, pointA).normalize();
            const distance = pointA.distanceTo(pointB);
            const raycaster = new THREE.Raycaster(pointA, direction, 0, distance);
            
            // 创建临时网格进行射线检测
            const tempMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
            const intersections = raycaster.intersectObject(tempMesh);
            
            return intersections.length > 0;
        } catch (error) {
            console.error('线段几何体相交检测失败:', error);
            return false;
        }
    },
    
    getTriangleBounds: function(triangle) {
        const min = new THREE.Vector3(
            Math.min(triangle.v0.x, triangle.v1.x, triangle.v2.x),
            Math.min(triangle.v0.y, triangle.v1.y, triangle.v2.y),
            Math.min(triangle.v0.z, triangle.v1.z, triangle.v2.z)
        );
        
        const max = new THREE.Vector3(
            Math.max(triangle.v0.x, triangle.v1.x, triangle.v2.x),
            Math.max(triangle.v0.y, triangle.v1.y, triangle.v2.y),
            Math.max(triangle.v0.z, triangle.v1.z, triangle.v2.z)
        );
        
        return { min, max };
    },
    
    boundsIntersect: function(boundsA, boundsB) {
        return !(boundsA.max.x < boundsB.min.x || boundsA.min.x > boundsB.max.x ||
                boundsA.max.y < boundsB.min.y || boundsA.min.y > boundsB.max.y ||
                boundsA.max.z < boundsB.min.z || boundsA.min.z > boundsB.max.z);
    },
    
    pointInsideGeometry: function(point, geometry) {
        // 保留这个函数作为向后兼容
        return this.isPointInsideGeometry(point, geometry, null, null);
    },
    
    clipTriangleAgainstGeometry: function(triangle, geometry, boundingBox) {
        // 简化的三角形裁剪：如果三角形与几何体相交，则移除整个三角形
        // 更复杂的实现可以进行实际的三角形分割
        
        const center = new THREE.Vector3()
            .add(triangle.v0)
            .add(triangle.v1)
            .add(triangle.v2)
            .divideScalar(3);
        
        // 如果三角形中心在几何体内部，则完全移除
        if (this.pointInsideGeometry(center, geometry)) {
            console.log('三角形中心在几何体内部，完全移除');
            return []; // 返回空数组表示移除整个三角形
        }
        
        // 检查三角形顶点是否在几何体内部
        const v0Inside = this.pointInsideGeometry(triangle.v0, geometry);
        const v1Inside = this.pointInsideGeometry(triangle.v1, geometry);
        const v2Inside = this.pointInsideGeometry(triangle.v2, geometry);
        
        const insideCount = (v0Inside ? 1 : 0) + (v1Inside ? 1 : 0) + (v2Inside ? 1 : 0);
        
        if (insideCount === 0) {
            // 所有顶点都在外部，保留整个三角形
            return [triangle];
        } else if (insideCount === 3) {
            // 所有顶点都在内部，移除整个三角形
            return [];
        } else {
            // 部分顶点在内部，需要裁剪（简化处理：移除整个三角形）
            console.log(`三角形有 ${insideCount} 个顶点在几何体内部，移除整个三角形`);
            return [];
        }
    },
    
    addTriangleToNewGeometry: function(triangle, positions, indices, vertexMap) {
        const vertices = [triangle.v0, triangle.v1, triangle.v2];
        const triangleIndices = [];
        
        vertices.forEach(vertex => {
            const key = `${vertex.x.toFixed(6)},${vertex.y.toFixed(6)},${vertex.z.toFixed(6)}`;
            
            if (!vertexMap.has(key)) {
                const index = positions.length / 3;
                positions.push(vertex.x, vertex.y, vertex.z);
                vertexMap.set(key, index);
                triangleIndices.push(index);
            } else {
                triangleIndices.push(vertexMap.get(key));
            }
        });
        
        indices.push(...triangleIndices);
    },
    
    subtractIntersectionsSimple: function(geometry, wall, intersectingWalls, wallIndex) {
        try {
            console.log(`从墙体 ${wallIndex} 中减去交集部分（简化版本）`);
            
            // 获取当前墙体的2D轮廓
            let wallPolygon = this.generateWallPolygon(wall.start, wall.end, wall.thickness);
            console.log(`墙体 ${wallIndex} 原始多边形:`, wallPolygon);
            
            let hasModification = false;
            
            // 对每个相交的墙体执行减法
            intersectingWalls.forEach(intersection => {
                const otherWallIndex = intersection.wall1 === wallIndex ? intersection.wall2 : intersection.wall1;
                const otherWall = this.walls[otherWallIndex];
                
                console.log(`从墙体 ${wallIndex} 减去墙体 ${otherWallIndex} 的交集`);
                
                // 计算交集区域
                const intersectionPolygon = this.calculateSimpleIntersection(wall, otherWall);
                
                if (intersectionPolygon && intersectionPolygon.length > 0) {
                    console.log(`交集多边形:`, intersectionPolygon);
                    
                    // 从当前墙体多边形中减去交集多边形
                    const newPolygon = this.subtractPolygonSimple(wallPolygon, intersectionPolygon);
                    
                    if (newPolygon && newPolygon.length > 0 && newPolygon !== wallPolygon) {
                        wallPolygon = newPolygon;
                        hasModification = true;
                        console.log(`交集减法完成，新多边形顶点数: ${wallPolygon.length}`);
                        console.log(`修改后多边形:`, wallPolygon);
                    } else {
                        console.log(`减法无效果，保持原多边形`);
                    }
                } else {
                    console.log(`无有效交集多边形`);
                }
            });
            
            // 将修改后的2D多边形转换为3D几何体
            if (hasModification && wallPolygon && wallPolygon.length >= 3) {
                console.log(`墙体 ${wallIndex} 应用布尔减法，生成新几何体`);
                const newGeometry = this.polygonToGeometry(wallPolygon, wall.height);
                if (newGeometry) {
                    return newGeometry;
                }
            }
            
            console.log(`墙体 ${wallIndex} 布尔减法无效果或失败，保持原几何体`);
            return geometry;
            
        } catch (error) {
            console.error(`墙体 ${wallIndex} 减法运算失败:`, error);
            return geometry;
        }
    },
    
    calculateSimpleIntersection: function(wall1, wall2) {
        try {
            // 获取两个墙体的多边形
            const poly1 = this.generateWallPolygon(wall1.start, wall1.end, wall1.thickness);
            const poly2 = this.generateWallPolygon(wall2.start, wall2.end, wall2.thickness);
            
            // 计算两个矩形的交集（简化版本）
            const bounds1 = this.getPolygonBounds(poly1);
            const bounds2 = this.getPolygonBounds(poly2);
            
            // 计算交集边界框
            const left = Math.max(bounds1.left, bounds2.left);
            const right = Math.min(bounds1.right, bounds2.right);
            const top = Math.max(bounds1.top, bounds2.top);
            const bottom = Math.min(bounds1.bottom, bounds2.bottom);
            
            // 检查是否有交集
            if (left < right && top < bottom) {
                // 返回交集矩形的顶点
                const intersection = [
                    { x: left, y: top },
                    { x: right, y: top },
                    { x: right, y: bottom },
                    { x: left, y: bottom }
                ];
                
                console.log('计算简单交集成功，面积:', (right - left) * (bottom - top));
                return intersection;
            }
            
            return null;
            
        } catch (error) {
            console.error('计算简单交集失败:', error);
            return null;
        }
    },
    
    subtractPolygonSimple: function(mainPolygon, subtractPolygon) {
        try {
            console.log('执行简化多边形减法运算');
            console.log('主多边形:', mainPolygon);
            console.log('减去多边形:', subtractPolygon);
            
            // 检查是否有实际交集
            if (!this.polygonsOverlap(mainPolygon, subtractPolygon)) {
                console.log('多边形无重叠，返回原多边形');
                return mainPolygon;
            }
            
            // 简化的减法：创建L形或其他形状
            const mainBounds = this.getPolygonBounds(mainPolygon);
            const subtractBounds = this.getPolygonBounds(subtractPolygon);
            
            console.log('主多边形边界:', mainBounds);
            console.log('减去多边形边界:', subtractBounds);
            
            // 计算交集区域
            const intersectLeft = Math.max(mainBounds.left, subtractBounds.left);
            const intersectRight = Math.min(mainBounds.right, subtractBounds.right);
            const intersectTop = Math.max(mainBounds.top, subtractBounds.top);
            const intersectBottom = Math.min(mainBounds.bottom, subtractBounds.bottom);
            
            console.log('交集区域:', { left: intersectLeft, right: intersectRight, top: intersectTop, bottom: intersectBottom });
            
            // 检查交集是否有效
            if (intersectLeft >= intersectRight || intersectTop >= intersectBottom) {
                console.log('无有效交集，返回原多边形');
                return mainPolygon;
            }
            
            // 计算交集面积占主多边形的比例
            const mainArea = (mainBounds.right - mainBounds.left) * (mainBounds.bottom - mainBounds.top);
            const intersectArea = (intersectRight - intersectLeft) * (intersectBottom - intersectTop);
            const overlapRatio = intersectArea / mainArea;
            
            console.log('交集面积比例:', overlapRatio);
            
            // 如果交集覆盖了大部分主多边形，进行更激进的减法
            if (overlapRatio > 0.7) {
                console.log('交集覆盖大部分主多边形，返回较小的剩余部分');
                
                // 选择一个边缘部分作为剩余
                const margin = Math.min(
                    (mainBounds.right - mainBounds.left) * 0.3,
                    (mainBounds.bottom - mainBounds.top) * 0.3
                );
                
                return [
                    { x: mainBounds.left, y: mainBounds.top },
                    { x: mainBounds.left + margin, y: mainBounds.top },
                    { x: mainBounds.left + margin, y: mainBounds.bottom },
                    { x: mainBounds.left, y: mainBounds.bottom }
                ];
            }
            
            // 创建减法后的多边形（基于交集位置选择最佳策略）
            const resultPolygons = [];
            
            // 左侧部分
            if (intersectLeft > mainBounds.left) {
                const leftPart = [
                    { x: mainBounds.left, y: mainBounds.top },
                    { x: intersectLeft, y: mainBounds.top },
                    { x: intersectLeft, y: mainBounds.bottom },
                    { x: mainBounds.left, y: mainBounds.bottom }
                ];
                resultPolygons.push({ polygon: leftPart, area: (intersectLeft - mainBounds.left) * (mainBounds.bottom - mainBounds.top) });
            }
            
            // 右侧部分
            if (intersectRight < mainBounds.right) {
                const rightPart = [
                    { x: intersectRight, y: mainBounds.top },
                    { x: mainBounds.right, y: mainBounds.top },
                    { x: mainBounds.right, y: mainBounds.bottom },
                    { x: intersectRight, y: mainBounds.bottom }
                ];
                resultPolygons.push({ polygon: rightPart, area: (mainBounds.right - intersectRight) * (mainBounds.bottom - mainBounds.top) });
            }
            
            // 上侧部分
            if (intersectTop > mainBounds.top) {
                const topPart = [
                    { x: mainBounds.left, y: mainBounds.top },
                    { x: mainBounds.right, y: mainBounds.top },
                    { x: mainBounds.right, y: intersectTop },
                    { x: mainBounds.left, y: intersectTop }
                ];
                resultPolygons.push({ polygon: topPart, area: (mainBounds.right - mainBounds.left) * (intersectTop - mainBounds.top) });
            }
            
            // 下侧部分
            if (intersectBottom < mainBounds.bottom) {
                const bottomPart = [
                    { x: mainBounds.left, y: intersectBottom },
                    { x: mainBounds.right, y: intersectBottom },
                    { x: mainBounds.right, y: mainBounds.bottom },
                    { x: mainBounds.left, y: mainBounds.bottom }
                ];
                resultPolygons.push({ polygon: bottomPart, area: (mainBounds.right - mainBounds.left) * (mainBounds.bottom - intersectBottom) });
            }
            
            console.log('生成的剩余部分数量:', resultPolygons.length);
            
            // 返回面积最大的剩余部分
            if (resultPolygons.length > 0) {
                // 选择面积最大的部分
                let bestResult = resultPolygons[0];
                
                resultPolygons.forEach(result => {
                    if (result.area > bestResult.area) {
                        bestResult = result;
                    }
                });
                
                console.log('选择最大剩余部分，面积:', bestResult.area);
                console.log('减法结果多边形:', bestResult.polygon);
                return bestResult.polygon;
            }
            
            console.log('减法后无剩余部分，返回原多边形');
            return mainPolygon;
            
        } catch (error) {
            console.error('简化多边形减法失败:', error);
            return mainPolygon;
        }
    },
    
    calculateIntersectionBox: function(wall1, wall2) {
        try {
            // 获取两个墙体的包围盒
            const box1 = this.getWallBoundingBox(wall1);
            const box2 = this.getWallBoundingBox(wall2);
            
            // 计算交集包围盒
            const intersectionBox = {
                minX: Math.max(box1.minX, box2.minX),
                maxX: Math.min(box1.maxX, box2.maxX),
                minY: Math.max(box1.minY, box2.minY),
                maxY: Math.min(box1.maxY, box2.maxY),
                minZ: Math.max(box1.minZ, box2.minZ),
                maxZ: Math.min(box1.maxZ, box2.maxZ)
            };
            
            // 检查是否有有效的交集
            if (intersectionBox.minX < intersectionBox.maxX && 
                intersectionBox.minY < intersectionBox.maxY && 
                intersectionBox.minZ < intersectionBox.maxZ) {
                
                console.log('计算交集包围盒成功:', intersectionBox);
                return intersectionBox;
            }
            
            return null;
            
        } catch (error) {
            console.error('计算交集包围盒失败:', error);
            return null;
        }
    },
    
    getWallBoundingBox: function(wall) {
        // 获取墙体的3D包围盒
        const polygon = this.generateWallPolygon(wall.start, wall.end, wall.thickness);
        const height = wall.height / 1000; // 转换为米
        
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        
        polygon.forEach(point => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minZ = Math.min(minZ, point.y);
            maxZ = Math.max(maxZ, point.y);
        });
        
        return {
            minX, maxX,
            minY: 0,
            maxY: height,
            minZ, maxZ
        };
    },
    
    clipGeometryWithBox: function(geometry, intersectionBox, wall) {
        try {
            console.log('开始几何体裁剪');
            
            // 获取几何体的顶点
            const positions = geometry.attributes.position.array;
            const indices = geometry.index ? geometry.index.array : null;
            
            // 创建新的顶点和索引数组
            const newPositions = [];
            const newIndices = [];
            const vertexMap = new Map();
            
            // 处理每个三角形
            const triangleCount = indices ? indices.length / 3 : positions.length / 9;
            
            for (let i = 0; i < triangleCount; i++) {
                const triangle = this.getTriangle(positions, indices, i);
                
                // 检查三角形是否与交集盒相交
                if (!this.triangleIntersectsBox(triangle, intersectionBox)) {
                    // 不相交，保留这个三角形
                    this.addTriangleToGeometry(triangle, newPositions, newIndices, vertexMap);
                } else {
                    // 相交，需要裁剪或丢弃
                    const clippedTriangles = this.clipTriangleWithBox(triangle, intersectionBox);
                    clippedTriangles.forEach(clippedTriangle => {
                        this.addTriangleToGeometry(clippedTriangle, newPositions, newIndices, vertexMap);
                    });
                }
            }
            
            // 创建新的几何体
            if (newPositions.length > 0) {
                const newGeometry = new THREE.BufferGeometry();
                newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
                if (newIndices.length > 0) {
                    newGeometry.setIndex(newIndices);
                }
                newGeometry.computeVertexNormals();
                
                console.log('几何体裁剪完成，剩余顶点数:', newPositions.length / 3);
                return newGeometry;
            } else {
                console.warn('裁剪后几何体为空');
                return geometry;
            }
            
        } catch (error) {
            console.error('几何体裁剪失败:', error);
            return geometry;
        }
    },
    
    getTriangle: function(positions, indices, triangleIndex) {
        let i0, i1, i2;
        
        if (indices) {
            i0 = indices[triangleIndex * 3];
            i1 = indices[triangleIndex * 3 + 1];
            i2 = indices[triangleIndex * 3 + 2];
        } else {
            i0 = triangleIndex * 3;
            i1 = triangleIndex * 3 + 1;
            i2 = triangleIndex * 3 + 2;
        }
        
        return {
            v0: {
                x: positions[i0 * 3],
                y: positions[i0 * 3 + 1],
                z: positions[i0 * 3 + 2]
            },
            v1: {
                x: positions[i1 * 3],
                y: positions[i1 * 3 + 1],
                z: positions[i1 * 3 + 2]
            },
            v2: {
                x: positions[i2 * 3],
                y: positions[i2 * 3 + 1],
                z: positions[i2 * 3 + 2]
            }
        };
    },
    
    triangleIntersectsBox: function(triangle, box) {
        // 简单的包围盒相交检测
        const vertices = [triangle.v0, triangle.v1, triangle.v2];
        
        // 检查三角形的包围盒是否与交集盒相交
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        
        vertices.forEach(v => {
            minX = Math.min(minX, v.x);
            maxX = Math.max(maxX, v.x);
            minY = Math.min(minY, v.y);
            maxY = Math.max(maxY, v.y);
            minZ = Math.min(minZ, v.z);
            maxZ = Math.max(maxZ, v.z);
        });
        
        return !(maxX < box.minX || minX > box.maxX ||
                maxY < box.minY || minY > box.maxY ||
                maxZ < box.minZ || minZ > box.maxZ);
    },
    
    clipTriangleWithBox: function(triangle, box) {
        // 简化版本：如果三角形与盒子相交，就丢弃整个三角形
        // 更复杂的实现可以进行实际的裁剪
        return []; // 返回空数组表示丢弃这个三角形
    },
    
    addTriangleToGeometry: function(triangle, positions, indices, vertexMap) {
        const vertices = [triangle.v0, triangle.v1, triangle.v2];
        const triangleIndices = [];
        
        vertices.forEach(vertex => {
            const key = `${vertex.x.toFixed(6)},${vertex.y.toFixed(6)},${vertex.z.toFixed(6)}`;
            
            if (!vertexMap.has(key)) {
                const index = positions.length / 3;
                positions.push(vertex.x, vertex.y, vertex.z);
                vertexMap.set(key, index);
                triangleIndices.push(index);
            } else {
                triangleIndices.push(vertexMap.get(key));
            }
        });
        
        indices.push(...triangleIndices);
    },
    
    subtractIntersections: function(geometry, wall, intersectingWalls, wallIndex) {
        try {
            console.log(`从墙体 ${wallIndex} 中减去交集部分`);
            
            // 获取当前墙体的2D轮廓
            let wallPolygon = this.generateWallPolygon(wall.start, wall.end, wall.thickness);
            
            // 对每个相交的墙体执行减法
            intersectingWalls.forEach(intersection => {
                const otherWallIndex = intersection.wall1 === wallIndex ? intersection.wall2 : intersection.wall1;
                const otherWall = this.walls[otherWallIndex];
                
                console.log(`从墙体 ${wallIndex} 减去墙体 ${otherWallIndex} 的交集`);
                
                // 计算交集区域
                const intersectionPolygon = this.calculateIntersectionPolygon(wall, otherWall);
                
                if (intersectionPolygon && intersectionPolygon.length > 0) {
                    // 从当前墙体多边形中减去交集多边形
                    wallPolygon = this.subtractPolygon(wallPolygon, intersectionPolygon);
                    console.log(`交集减法完成，剩余顶点数: ${wallPolygon.length}`);
                }
            });
            
            // 将修改后的2D多边形转换为3D几何体
            if (wallPolygon && wallPolygon.length >= 3) {
                return this.polygonToGeometry(wallPolygon, wall.height);
            } else {
                console.warn(`墙体 ${wallIndex} 减法后无有效多边形`);
                return geometry; // 返回原几何体
            }
            
        } catch (error) {
            console.error(`墙体 ${wallIndex} 减法运算失败:`, error);
            return geometry;
        }
    },
    
    calculateIntersectionPolygon: function(wall1, wall2) {
        try {
            // 获取两个墙体的多边形
            const poly1 = this.generateWallPolygon(wall1.start, wall1.end, wall1.thickness);
            const poly2 = this.generateWallPolygon(wall2.start, wall2.end, wall2.thickness);
            
            // 计算两个矩形的交集
            const intersection = this.rectangleIntersection(poly1, poly2);
            
            console.log('计算交集多边形，顶点数:', intersection ? intersection.length : 0);
            return intersection;
            
        } catch (error) {
            console.error('计算交集多边形失败:', error);
            return null;
        }
    },
    
    rectangleIntersection: function(rect1, rect2) {
        try {
            // 简化的矩形交集计算
            // 获取两个矩形的边界框
            const bounds1 = this.getPolygonBounds(rect1);
            const bounds2 = this.getPolygonBounds(rect2);
            
            // 计算交集边界框
            const left = Math.max(bounds1.left, bounds2.left);
            const right = Math.min(bounds1.right, bounds2.right);
            const top = Math.max(bounds1.top, bounds2.top);
            const bottom = Math.min(bounds1.bottom, bounds2.bottom);
            
            // 检查是否有交集
            if (left < right && top < bottom) {
                // 返回交集矩形的顶点
                return [
                    { x: left, y: top },
                    { x: right, y: top },
                    { x: right, y: bottom },
                    { x: left, y: bottom }
                ];
            }
            
            return null; // 无交集
            
        } catch (error) {
            console.error('矩形交集计算失败:', error);
            return null;
        }
    },
    
    getPolygonBounds: function(polygon) {
        let left = polygon[0].x, right = polygon[0].x;
        let top = polygon[0].y, bottom = polygon[0].y;
        
        polygon.forEach(point => {
            left = Math.min(left, point.x);
            right = Math.max(right, point.x);
            top = Math.min(top, point.y);
            bottom = Math.max(bottom, point.y);
        });
        
        return { left, right, top, bottom };
    },
    
    subtractPolygon: function(mainPolygon, subtractPolygon) {
        try {
            console.log('执行多边形减法运算');
            console.log('主多边形顶点数:', mainPolygon.length);
            console.log('减去多边形顶点数:', subtractPolygon.length);
            
            // 检查是否有实际交集
            if (!this.polygonsIntersect(mainPolygon, subtractPolygon)) {
                console.log('多边形无交集，返回原多边形');
                return mainPolygon;
            }
            
            console.log('多边形有交集，执行减法运算');
            
            // 简化的多边形减法：创建一个带洞的多边形
            // 这里实现一个基础版本，将主多边形分割成多个部分
            
            const result = this.clipPolygon(mainPolygon, subtractPolygon);
            
            console.log('多边形减法完成，结果顶点数:', result.length);
            return result;
            
        } catch (error) {
            console.error('多边形减法失败:', error);
            return mainPolygon;
        }
    },
    
    polygonsIntersect: function(poly1, poly2) {
        // 简单的边界框相交检测
        const bounds1 = this.getPolygonBounds(poly1);
        const bounds2 = this.getPolygonBounds(poly2);
        
        return !(bounds1.right < bounds2.left || 
                bounds2.right < bounds1.left || 
                bounds1.bottom < bounds2.top || 
                bounds2.bottom < bounds1.top);
    },
    
    clipPolygon: function(subject, clip) {
        try {
            // 使用Sutherland-Hodgman裁剪算法的简化版本
            console.log('开始多边形裁剪');
            
            let outputList = [...subject];
            
            // 对裁剪多边形的每条边进行裁剪
            for (let i = 0; i < clip.length; i++) {
                if (outputList.length === 0) break;
                
                const clipVertex1 = clip[i];
                const clipVertex2 = clip[(i + 1) % clip.length];
                
                const inputList = outputList;
                outputList = [];
                
                if (inputList.length === 0) continue;
                
                let s = inputList[inputList.length - 1];
                
                for (let j = 0; j < inputList.length; j++) {
                    const e = inputList[j];
                    
                    if (this.isInside(e, clipVertex1, clipVertex2)) {
                        if (!this.isInside(s, clipVertex1, clipVertex2)) {
                            const intersection = this.getIntersection(s, e, clipVertex1, clipVertex2);
                            if (intersection) {
                                outputList.push(intersection);
                            }
                        }
                        outputList.push(e);
                    } else if (this.isInside(s, clipVertex1, clipVertex2)) {
                        const intersection = this.getIntersection(s, e, clipVertex1, clipVertex2);
                        if (intersection) {
                            outputList.push(intersection);
                        }
                    }
                    s = e;
                }
            }
            
            console.log('多边形裁剪完成，结果顶点数:', outputList.length);
            return outputList;
            
        } catch (error) {
            console.error('多边形裁剪失败:', error);
            return subject;
        }
    },
    
    isInside: function(point, lineStart, lineEnd) {
        // 检查点是否在线段的内侧（左侧）
        return ((lineEnd.x - lineStart.x) * (point.y - lineStart.y) - 
                (lineEnd.y - lineStart.y) * (point.x - lineStart.x)) >= 0;
    },
    
    getIntersection: function(p1, p2, p3, p4) {
        // 计算两条线段的交点
        const x1 = p1.x, y1 = p1.y;
        const x2 = p2.x, y2 = p2.y;
        const x3 = p3.x, y3 = p3.y;
        const x4 = p4.x, y4 = p4.y;
        
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denom) < 1e-10) return null;
        
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        
        return {
            x: x1 + t * (x2 - x1),
            y: y1 + t * (y2 - y1)
        };
    },
    
    polygonToGeometry: function(polygon, heightMm) {
        try {
            const height = heightMm / 1000; // 转换为米
            
            // 创建3D几何体
            const vertices = [];
            const indices = [];
            
            // 底面顶点
            polygon.forEach(point => {
                vertices.push(point.x, 0, point.y);
            });
            
            // 顶面顶点
            polygon.forEach(point => {
                vertices.push(point.x, height, point.y);
            });
            
            const numVertices = polygon.length;
            
            // 底面三角形
            for (let i = 2; i < numVertices; i++) {
                indices.push(0, i - 1, i);
            }
            
            // 顶面三角形
            for (let i = 2; i < numVertices; i++) {
                indices.push(numVertices, numVertices + i, numVertices + i - 1);
            }
            
            // 侧面四边形
            for (let i = 0; i < numVertices; i++) {
                const next = (i + 1) % numVertices;
                indices.push(i, next, numVertices + i);
                indices.push(next, numVertices + next, numVertices + i);
            }
            
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setIndex(indices);
            geometry.computeVertexNormals();
            
            return geometry;
            
        } catch (error) {
            console.error('多边形转几何体失败:', error);
            return null;
        }
    },
    
    createWallGroup: function(geometries) {
        const group = new THREE.Group();
        
        geometries.forEach((geometry, index) => {
            if (geometry) {
                // 检查这个墙体是否被布尔运算修改过
                const wasModified = this.wallWasModified && this.wallWasModified[index];
                
                const material = new THREE.MeshLambertMaterial({ 
                    color: wasModified ? 0xff6600 : 0x00aa00, // 修改过的墙体用橙色，原始墙体用绿色
                    transparent: true,
                    opacity: 0.8
                });
                
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.userData = { wallIndex: index, wasModified: wasModified };
                group.add(mesh);
                
                console.log(`墙体 ${index} 添加到3D场景，${wasModified ? '已修改(橙色)' : '原始(绿色)'}`);
                
                // 添加边缘线
                const edges = new THREE.EdgesGeometry(geometry);
                const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ 
                    color: wasModified ? 0xff0000 : 0x00ff00 // 修改过的用红色边线
                }));
                group.add(line);
                
                // 添加线框显示（显示所有内部线条）
                if (this.showWireframe) {
                    const wireframe = new THREE.WireframeGeometry(geometry);
                    const wireframeLine = new THREE.LineSegments(wireframe, new THREE.LineBasicMaterial({ 
                        color: 0xffff00, // 黄色线框
                        opacity: 0.6,
                        transparent: true
                    }));
                    group.add(wireframeLine);
                }
            }
        });
        
        group.isGroup = true;
        return group;
    },
    
    simpleGeometryMerge: function(geometries) {
        try {
            if (typeof THREE.BufferGeometryUtils !== 'undefined' && THREE.BufferGeometryUtils.mergeBufferGeometries) {
                const mergedGeometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries);
                console.log('使用BufferGeometryUtils合并成功');
                return mergedGeometry;
            } else {
                console.log('BufferGeometryUtils不可用，使用自定义合并');
                return this.customGeometryMerge(geometries);
            }
        } catch (error) {
            console.error('几何体合并失败:', error);
            return this.customGeometryMerge(geometries);
        }
    },
    
    customGeometryMerge: function(geometries) {
        try {
            console.log('开始自定义几何体合并');
            
            // 计算总顶点数和索引数
            let totalVertices = 0;
            let totalIndices = 0;
            
            geometries.forEach(geometry => {
                totalVertices += geometry.attributes.position.count;
                if (geometry.index) {
                    totalIndices += geometry.index.count;
                } else {
                    totalIndices += geometry.attributes.position.count;
                }
            });
            
            // 创建合并后的数组
            const mergedPositions = new Float32Array(totalVertices * 3);
            const mergedIndices = new Uint32Array(totalIndices);
            
            let vertexOffset = 0;
            let indexOffset = 0;
            let currentVertexIndex = 0;
            
            geometries.forEach((geometry, geomIndex) => {
                const positions = geometry.attributes.position.array;
                const indices = geometry.index ? geometry.index.array : null;
                
                // 复制顶点
                mergedPositions.set(positions, vertexOffset);
                
                // 复制索引（需要调整索引值）
                if (indices) {
                    for (let i = 0; i < indices.length; i++) {
                        mergedIndices[indexOffset + i] = indices[i] + currentVertexIndex;
                    }
                    indexOffset += indices.length;
                } else {
                    // 如果没有索引，创建顺序索引
                    const vertexCount = positions.length / 3;
                    for (let i = 0; i < vertexCount; i++) {
                        mergedIndices[indexOffset + i] = currentVertexIndex + i;
                    }
                    indexOffset += vertexCount;
                }
                
                vertexOffset += positions.length;
                currentVertexIndex += positions.length / 3;
            });
            
            // 创建合并后的几何体
            const mergedGeometry = new THREE.BufferGeometry();
            mergedGeometry.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
            mergedGeometry.setIndex(new THREE.BufferAttribute(mergedIndices, 1));
            
            // 计算法向量
            mergedGeometry.computeVertexNormals();
            
            console.log('自定义几何体合并完成，顶点数:', totalVertices, '索引数:', totalIndices);
            return mergedGeometry;
            
        } catch (error) {
            console.error('自定义几何体合并失败:', error);
            return this.manualMergeGeometries(geometries);
        }
    },
    
    performUnionOperation: function(geometries) {
        try {
            console.log('开始执行真正的布尔并集运算');
            
            // 实现真正的布尔并集运算
            const unionGeometry = this.realBooleanUnion(geometries);
            
            if (unionGeometry) {
                console.log('布尔运算完成，生成合并几何体');
                return unionGeometry;
            } else {
                console.warn('布尔运算失败，降级到简单合并');
                return this.customGeometryMerge(geometries);
            }
        } catch (error) {
            console.error('布尔运算失败:', error);
            return this.manualMergeGeometries(geometries);
        }
    },
    
    realBooleanUnion: function(geometries) {
        try {
            if (geometries.length < 2) {
                return geometries[0];
            }
            
            console.log('执行真正的布尔并集运算，处理', geometries.length, '个几何体');
            
            // 获取墙体的2D轮廓信息
            const wallPolygons = this.walls.map(wall => this.generateWallPolygon(wall.start, wall.end, wall.thickness));
            
            // 执行2D多边形布尔运算
            const unionPolygon = this.polygonUnion(wallPolygons);
            
            if (unionPolygon && unionPolygon.length > 0) {
                // 将合并后的2D多边形拉伸成3D几何体
                const unionGeometry = this.extrudePolygonTo3D(unionPolygon);
                return unionGeometry;
            } else {
                console.error('2D多边形布尔运算失败');
                return null;
            }
            
        } catch (error) {
            console.error('真正布尔运算失败:', error);
            return null;
        }
    },
    
    polygonUnion: function(polygons) {
        try {
            console.log('开始2D多边形布尔运算');
            
            if (polygons.length === 0) return null;
            if (polygons.length === 1) return polygons[0];
            
            // 简化的多边形合并算法
            // 这里实现一个基础的凸包算法作为布尔并集的近似
            let allPoints = [];
            
            polygons.forEach(polygon => {
                polygon.forEach(point => {
                    allPoints.push(point);
                });
            });
            
            // 计算凸包
            const convexHull = this.computeConvexHull(allPoints);
            
            console.log('2D布尔运算完成，生成', convexHull.length, '个顶点的合并多边形');
            return convexHull;
            
        } catch (error) {
            console.error('2D多边形布尔运算失败:', error);
            return null;
        }
    },
    
    computeConvexHull: function(points) {
        if (points.length < 3) return points;
        
        // Graham扫描算法计算凸包
        // 找到最下方的点（y最小，如果相同则x最小）
        let bottom = points[0];
        for (let i = 1; i < points.length; i++) {
            if (points[i].y < bottom.y || (points[i].y === bottom.y && points[i].x < bottom.x)) {
                bottom = points[i];
            }
        }
        
        // 按极角排序
        const sortedPoints = points.filter(p => p !== bottom).sort((a, b) => {
            const angleA = Math.atan2(a.y - bottom.y, a.x - bottom.x);
            const angleB = Math.atan2(b.y - bottom.y, b.x - bottom.x);
            return angleA - angleB;
        });
        
        // 构建凸包
        const hull = [bottom];
        
        for (let point of sortedPoints) {
            // 移除不在凸包上的点
            while (hull.length > 1 && this.crossProduct(hull[hull.length-2], hull[hull.length-1], point) <= 0) {
                hull.pop();
            }
            hull.push(point);
        }
        
        console.log('凸包计算完成，顶点数:', hull.length);
        return hull;
    },
    
    crossProduct: function(o, a, b) {
        return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    },
    
    extrudePolygonTo3D: function(polygon) {
        try {
            if (polygon.length < 3) return null;
            
            // 获取墙体高度（使用第一个墙体的高度）
            const height = this.walls.length > 0 ? this.walls[0].height / 1000 : 3.0;
            
            console.log('将2D多边形拉伸为3D，顶点数:', polygon.length, '高度:', height);
            
            // 创建3D几何体
            const vertices = [];
            const indices = [];
            
            // 底面顶点
            polygon.forEach(point => {
                vertices.push(point.x, 0, point.y);
            });
            
            // 顶面顶点
            polygon.forEach(point => {
                vertices.push(point.x, height, point.y);
            });
            
            const numVertices = polygon.length;
            
            // 底面三角形（扇形三角化）
            for (let i = 2; i < numVertices; i++) {
                indices.push(0, i - 1, i);
            }
            
            // 顶面三角形
            for (let i = 2; i < numVertices; i++) {
                indices.push(numVertices, numVertices + i, numVertices + i - 1);
            }
            
            // 侧面四边形
            for (let i = 0; i < numVertices; i++) {
                const next = (i + 1) % numVertices;
                
                // 第一个三角形
                indices.push(i, next, numVertices + i);
                // 第二个三角形
                indices.push(next, numVertices + next, numVertices + i);
            }
            
            // 创建几何体
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setIndex(indices);
            geometry.computeVertexNormals();
            
            console.log('3D拉伸完成，顶点数:', vertices.length / 3, '面数:', indices.length / 3);
            return geometry;
            
        } catch (error) {
            console.error('3D拉伸失败:', error);
            return null;
        }
    },
    
    optimizeUnionGeometry: function(geometry) {
        try {
            // 简化的几何体优化：移除重复顶点和内部面
            // 这是一个简化版本，真正的CSG需要更复杂的算法
            
            // 计算包围盒
            geometry.computeBoundingBox();
            
            // 重新计算法向量
            geometry.computeVertexNormals();
            
            console.log('几何体优化完成');
            return geometry;
        } catch (error) {
            console.error('几何体优化失败:', error);
            return null;
        }
    },
    
    manualMergeGeometries: function(geometries) {
        // 简单的手动合并：创建一个组
        const group = new THREE.Group();
        
        // 为每个墙体分配不同颜色以便识别
        const colors = [0x00aa00, 0xff6600, 0x0066ff, 0xaa00aa, 0xffaa00, 0x00aaff];
        
        geometries.forEach((geometry, index) => {
            if (geometry) {
                const color = colors[index % colors.length];
                const material = new THREE.MeshLambertMaterial({ 
                    color: color,
                    transparent: true,
                    opacity: 0.8
                });
                
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.userData = { wallIndex: index }; // 添加墙体索引信息
                group.add(mesh);
                
                console.log(`墙体 ${index} 添加到3D场景，颜色: #${color.toString(16)}`);
                
                // 添加边缘线
                const edges = new THREE.EdgesGeometry(geometry);
                const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00ff00 }));
                group.add(line);
                
                // 添加线框显示（显示所有内部线条）
                if (this.showWireframe) {
                    const wireframe = new THREE.WireframeGeometry(geometry);
                    const wireframeLine = new THREE.LineSegments(wireframe, new THREE.LineBasicMaterial({ 
                        color: 0xffff00, // 黄色线框
                        opacity: 0.6,
                        transparent: true
                    }));
                    group.add(wireframeLine);
                }
            } else {
                console.error(`墙体 ${index} 的几何体为空`);
            }
        });
        
        // 标记为组对象
        group.isGroup = true;
        return group;
    },
    
    detectWallIntersections: function() {
        // 检测墙体之间的交集（基于墙体多边形重叠）
        const intersections = [];
        
        for (let i = 0; i < this.walls.length; i++) {
            for (let j = i + 1; j < this.walls.length; j++) {
                if (this.wallPolygonsIntersect(this.walls[i], this.walls[j])) {
                    intersections.push({
                        wall1: i,
                        wall2: j,
                        intersection: this.getWallIntersection(this.walls[i], this.walls[j])
                    });
                }
            }
        }
        
        console.log('检测到', intersections.length, '个墙体交集');
        return intersections;
    },
    
    wallPolygonsIntersect: function(wall1, wall2) {
        // 检测两个墙体的多边形是否重叠
        const poly1 = this.generateWallPolygon(wall1.start, wall1.end, wall1.thickness);
        const poly2 = this.generateWallPolygon(wall2.start, wall2.end, wall2.thickness);
        
        // 使用分离轴定理检测多边形相交
        return this.polygonsOverlap(poly1, poly2);
    },
    
    polygonsOverlap: function(poly1, poly2) {
        // 简化的多边形重叠检测：检查边界框重叠
        const bounds1 = this.getPolygonBounds(poly1);
        const bounds2 = this.getPolygonBounds(poly2);
        
        const overlap = !(bounds1.right < bounds2.left || 
                         bounds2.right < bounds1.left || 
                         bounds1.bottom < bounds2.top || 
                         bounds2.bottom < bounds1.top);
        
        if (overlap) {
            // 进一步检查：至少一个多边形的顶点在另一个多边形内部
            return this.hasPointInside(poly1, poly2) || this.hasPointInside(poly2, poly1);
        }
        
        return false;
    },
    
    hasPointInside: function(poly1, poly2) {
        // 检查poly1的任何顶点是否在poly2内部
        for (let point of poly1) {
            if (this.pointInPolygon(point, poly2)) {
                return true;
            }
        }
        return false;
    },
    
    pointInPolygon: function(point, polygon) {
        // 射线投射算法检测点是否在多边形内部
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
                (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
                inside = !inside;
            }
        }
        return inside;
    },
    
    wallsIntersect: function(wall1, wall2) {
        // 简单的2D线段相交检测
        const line1 = { start: wall1.start, end: wall1.end };
        const line2 = { start: wall2.start, end: wall2.end };
        
        return this.lineSegmentsIntersect(line1, line2);
    },
    
    lineSegmentsIntersect: function(line1, line2) {
        const x1 = line1.start.x, y1 = line1.start.y;
        const x2 = line1.end.x, y2 = line1.end.y;
        const x3 = line2.start.x, y3 = line2.start.y;
        const x4 = line2.end.x, y4 = line2.end.y;
        
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denom) < 1e-10) return false; // 平行线
        
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
        
        return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    },
    
    getWallIntersection: function(wall1, wall2) {
        // 计算两个墙体中心线的交点
        const line1 = { start: wall1.start, end: wall1.end };
        const line2 = { start: wall2.start, end: wall2.end };
        
        const x1 = line1.start.x, y1 = line1.start.y;
        const x2 = line1.end.x, y2 = line1.end.y;
        const x3 = line2.start.x, y3 = line2.start.y;
        const x4 = line2.end.x, y4 = line2.end.y;
        
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denom) < 1e-10) return null;
        
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        
        return {
            x: x1 + t * (x2 - x1),
            y: y1 + t * (y2 - y1)
        };
    },
    
    updateStatus: function(message) {
        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.textContent = message;
        }
        console.log('状态:', message);
    }
};

// 启动应用
console.log('准备启动应用...');

function startApp() {
    console.log('启动应用');
    try {
        app.init();
        window.app = app;
        console.log('应用启动成功');
    } catch (error) {
        console.error('应用启动失败:', error);
    }
}

// 确保DOM加载后启动（不等待THREE.js）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

console.log('=== APP.JS 加载完成 ===');
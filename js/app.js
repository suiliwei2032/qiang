console.log('=== APP.JS 开始加载 ===');

import { Canvas2DManager } from './modules/canvas2d.js';
import { WallGeometryManager } from './modules/wallGeometry.js';
import { CSGOperationsManager } from './modules/csgOperations.js';
import { OutlineExtractor } from './modules/outlineExtractor.js';
import { Scene3DManager } from './modules/scene3d.js';

// 主应用类
class WallEditorApp {
    constructor() {
        // 模式和状态
        this.currentMode = null;
        this.isDrawing = false;
        this.walls = [];
        this.tempLine = null;
        
        // 画布
        this.canvas2d = null;
        this.ctx2d = null;
        this.scale = 1;
        this.offset = { x: 0, y: 0 };
        
        // 拖拽相关
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.lastOffset = { x: 0, y: 0 };
        
        // 墙体端点拖拽
        this.isDraggingWall = false;
        this.draggedWall = null;
        this.draggedPoint = null;
        
        // 3D相关
        this.canvas3d = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.wallMeshes = [];
        this.dragUpdateTimeout = null;
        this.showWireframe = true;
        
        // 面选择和移动（调试用）
        this.selectedFaceGroup = null;
        this.raycaster = null;
        this.mouse = null;
        
        // 初始化模块
        this.canvas2dManager = new Canvas2DManager(this);
        this.wallGeometry = new WallGeometryManager();
        this.csgOperations = new CSGOperationsManager(this);
        this.outlineExtractor = new OutlineExtractor();
        this.scene3dManager = new Scene3DManager(this);
    }

    init() {
        console.log('初始化应用...');
        
        // 获取元素
        this.canvas2d = document.getElementById('canvas-2d');
        this.canvas3d = document.getElementById('canvas-3d');
        
        if (!this.canvas2d || !this.canvas3d) {
            console.error('找不到画布元素');
            return;
        }
        
        this.ctx2d = this.canvas2d.getContext('2d');
        
        // 设置画布大小
        this.resizeCanvas();
        
        // 延迟初始化3D场景
        setTimeout(() => {
            this.tryInit3D();
        }, 1000);
        
        // 绑定事件
        this.bindEvents();
        
        // 渲染
        this.render();
        
        console.log('应用初始化完成');
    }

    bindEvents() {
        console.log('绑定事件...');
        
        // 绘制按钮
        const drawBtn = document.getElementById('drawBtn');
        if (drawBtn) {
            drawBtn.onclick = () => this.toggleDrawMode();
        }
        
        // 选择按钮
        const selectBtn = document.getElementById('selectBtn');
        if (selectBtn) {
            selectBtn.onclick = () => this.toggleSelectMode();
        }
        
        // 清空按钮
        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) {
            clearBtn.onclick = () => this.clearAll();
        }
        
        // 线框切换按钮
        const toggleWireframeBtn = document.getElementById('toggleWireframeBtn');
        if (toggleWireframeBtn) {
            toggleWireframeBtn.onclick = () => {
                this.toggleWireframe();
                toggleWireframeBtn.textContent = '线框: ' + (this.showWireframe ? '开' : '关');
            };
        }
        
        // 3D画布点击事件（用于选择面）
        if (this.canvas3d) {
            this.raycaster = new THREE.Raycaster();
            this.mouse = new THREE.Vector2();
            
            this.canvas3d.addEventListener('click', (e) => this.handle3DClick(e));
            
            // 键盘事件（用于移动选中的面）
            document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        }
        
        // 2D画布事件
        if (this.canvas2d) {
            this.canvas2d.onclick = (e) => this.handleCanvasClick(e);
            this.canvas2d.onmousemove = (e) => this.handleCanvasMove(e);
            this.canvas2d.oncontextmenu = (e) => {
                e.preventDefault();
                return false;
            };
            this.canvas2d.onmousedown = (e) => this.handleMouseDown(e);
            this.canvas2d.onmouseup = (e) => this.handleMouseUp(e);
            this.canvas2d.onwheel = (e) => this.handleWheel(e);
        }
        
        console.log('事件绑定完成');
    }

    handle3DClick(e) {
        if (!this.scene || !this.camera) return;
        
        const rect = this.canvas3d.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.wallMeshes, false);
        
        if (intersects.length > 0) {
            const intersectedObject = intersects[0].object;
            
            if (this.selectedFaceGroup && this.selectedFaceGroup.material.emissive) {
                this.selectedFaceGroup.material.emissive.setHex(0x000000);
            }
            
            if (intersectedObject.material && intersectedObject.material.emissive) {
                this.selectedFaceGroup = intersectedObject;
                this.selectedFaceGroup.material.emissive.setHex(0x555555);
                console.log('选中墙体:', this.selectedFaceGroup.userData);
                this.updateStatus('已选中墙体，使用方向键移动');
            }
        }
    }

    handleKeyDown(e) {
        if (!this.selectedFaceGroup) return;
        
        const moveStep = 0.01; // 10mm
        let moved = false;
        
        switch(e.key) {
            case 'ArrowLeft':
                this.selectedFaceGroup.position.x -= moveStep;
                moved = true;
                break;
            case 'ArrowRight':
                this.selectedFaceGroup.position.x += moveStep;
                moved = true;
                break;
            case 'ArrowUp':
                if (e.ctrlKey) {
                    this.selectedFaceGroup.position.z -= moveStep;
                } else {
                    this.selectedFaceGroup.position.y += moveStep;
                }
                moved = true;
                break;
            case 'ArrowDown':
                if (e.ctrlKey) {
                    this.selectedFaceGroup.position.z += moveStep;
                } else {
                    this.selectedFaceGroup.position.y -= moveStep;
                }
                moved = true;
                break;
            case 'Escape':
                if (this.selectedFaceGroup.material.emissive) {
                    this.selectedFaceGroup.material.emissive.setHex(0x000000);
                }
                this.selectedFaceGroup = null;
                this.updateStatus('已取消选择');
                break;
        }
        
        if (moved) {
            const pos = this.selectedFaceGroup.position;
            console.log(`位置: (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})`);
            e.preventDefault();
        }
    }

    handleMouseDown(e) {
        if (e.button === 2) { // 右键
            this.isDragging = true;
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.lastOffset = { x: this.offset.x, y: this.offset.y };
            this.canvas2d.style.cursor = 'move';
            e.preventDefault();
        } else if (e.button === 0 && !this.currentMode) { // 左键且无模式
            const coords = this.getCanvasCoords(e);
            const wallPoint = this.wallGeometry.findWallEndpoint(coords, this.walls);
            if (wallPoint) {
                this.isDraggingWall = true;
                this.draggedWall = wallPoint.wall;
                this.draggedPoint = wallPoint.point;
                this.canvas2d.style.cursor = 'move';
                e.preventDefault();
            }
        }
    }

    handleMouseUp(e) {
        if (e.button === 2 && this.isDragging) {
            this.isDragging = false;
            this.canvas2d.style.cursor = 'default';
            e.preventDefault();
        } else if (e.button === 2) {
            this.handleRightClick();
        } else if (e.button === 0 && this.isDraggingWall) {
            this.isDraggingWall = false;
            this.draggedWall = null;
            this.draggedPoint = null;
            this.canvas2d.style.cursor = 'default';
            this.update3DModel();
            e.preventDefault();
        }
    }

    handleWheel(e) {
        e.preventDefault();
        
        const rect = this.canvas2d.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const worldBefore = this.canvas2dManager.screenToWorld(mouseX, mouseY);
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        this.scale *= zoomFactor;
        this.scale = Math.max(0.1, Math.min(10, this.scale));
        
        const worldAfter = this.canvas2dManager.screenToWorld(mouseX, mouseY);
        
        this.offset.x += worldBefore.x - worldAfter.x;
        this.offset.y += worldBefore.y - worldAfter.y;
        
        this.render();
    }

    tryInit3D() {
        if (typeof THREE !== 'undefined') {
            console.log('THREE.js已加载，初始化3D场景');
            this.scene3dManager.checkCSGLibrary();
            this.scene3dManager.init();
        } else {
            console.warn('THREE.js仍未加载，3D功能不可用');
        }
    }

    toggleDrawMode() {
        if (this.currentMode === 'draw') {
            this.currentMode = null;
            this.updateStatus('功能已关闭');
        } else {
            this.currentMode = 'draw';
            this.updateStatus('绘制模式 - 点击2D视口绘制墙体');
        }
        this.updateButtons();
    }

    toggleSelectMode() {
        if (this.currentMode === 'select') {
            this.currentMode = null;
            this.updateStatus('功能已关闭');
        } else {
            this.currentMode = 'select';
            this.updateStatus('选择模式 - 点击选择墙体');
        }
        this.updateButtons();
    }

    toggleWireframe() {
        this.showWireframe = !this.showWireframe;
        console.log('线框显示:', this.showWireframe ? '开启' : '关闭');
        this.update3DModel();
    }

    updateButtons() {
        const drawBtn = document.getElementById('drawBtn');
        const selectBtn = document.getElementById('selectBtn');
        
        if (drawBtn) {
            drawBtn.classList.toggle('active', this.currentMode === 'draw');
        }
        
        if (selectBtn) {
            selectBtn.classList.toggle('active', this.currentMode === 'select');
        }
    }

    handleCanvasClick(event) {
        if (this.currentMode === 'draw') {
            const coords = this.getCanvasCoords(event);
            this.handleDrawClick(coords);
        } else if (this.currentMode === 'select') {
            console.log('选择模式点击');
        } else {
            this.updateStatus('请先点击"绘制墙体"或"选择墙面"按钮');
        }
    }

    handleDrawClick(coords) {
        if (!this.isDrawing) {
            this.isDrawing = true;
            this.tempLine = { start: coords, end: coords };
            this.updateStatus('移动鼠标确定终点，右键取消');
        } else {
            const wallThicknessInput = document.getElementById('wallThickness');
            const wallHeightInput = document.getElementById('wallHeight');
            const thicknessMm = wallThicknessInput ? parseFloat(wallThicknessInput.value) || 200 : 200;
            const heightMm = wallHeightInput ? parseFloat(wallHeightInput.value) || 3000 : 3000;
            
            this.walls.push({
                start: this.tempLine.start,
                end: coords,
                thickness: thicknessMm,
                height: heightMm
            });
            this.isDrawing = false;
            this.tempLine = null;
            this.updateStatus('墙体已添加，总数: ' + this.walls.length);
            this.update3DModel();
        }
        this.render();
    }

    handleCanvasMove(event) {
        if (this.isDragging) {
            const deltaX = event.clientX - this.dragStart.x;
            const deltaY = event.clientY - this.dragStart.y;
            
            this.offset.x = this.lastOffset.x - deltaX / (this.scale * 50);
            this.offset.y = this.lastOffset.y + deltaY / (this.scale * 50);
            
            this.render();
            return;
        }
        
        if (this.isDraggingWall && this.draggedWall && this.draggedPoint) {
            const coords = this.getCanvasCoords(event);
            this.draggedWall[this.draggedPoint] = coords;
            this.render();
            
            clearTimeout(this.dragUpdateTimeout);
            this.dragUpdateTimeout = setTimeout(() => {
                this.update3DModel();
            }, 100);
            return;
        }
        
        const coords = this.getCanvasCoords(event);
        
        const coordsText = document.getElementById('coordsText');
        if (coordsText) {
            coordsText.textContent = 'X: ' + (coords.x * 1000).toFixed(0) + ', Y: ' + (coords.y * 1000).toFixed(0) + ' mm';
        }
        
        if (!this.currentMode && !this.isDragging && !this.isDraggingWall) {
            const wallPoint = this.wallGeometry.findWallEndpoint(coords, this.walls);
            this.canvas2d.style.cursor = wallPoint ? 'pointer' : 'default';
        }
        
        if (this.isDrawing && this.tempLine) {
            this.tempLine.end = coords;
            this.render();
        }
    }

    handleRightClick() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.tempLine = null;
            this.updateStatus('绘制已取消');
            this.render();
        }
    }

    getCanvasCoords(event) {
        const rect = this.canvas2d.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        return this.canvas2dManager.screenToWorld(mouseX, mouseY);
    }

    resizeCanvas() {
        this.canvas2dManager.resizeCanvas();
        this.scene3dManager.resize();
        this.render();
    }

    render() {
        this.canvas2dManager.render();
    }

    clearAll() {
        console.log('清空所有墙体');
        this.walls = [];
        this.isDrawing = false;
        this.tempLine = null;
        
        this.scene3dManager.clearWallMeshes();
        
        this.render();
        this.updateStatus('已清空所有墙体和3D模型');
    }

    update3DModel() {
        this.scene3dManager.update3DModel();
    }

    updateStatus(message) {
        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.textContent = message;
        }
        console.log('状态:', message);
    }
}

// 启动应用
console.log('准备启动应用...');

function startApp() {
    console.log('启动应用');
    try {
        const app = new WallEditorApp();
        app.init();
        window.app = app;
        console.log('应用启动成功');
    } catch (error) {
        console.error('应用启动失败:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

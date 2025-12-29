console.log('=== APP.JS 开始加载 ===');

import { Canvas2DManager } from './modules/canvas2d.js';
import { WallGeometryManager } from './modules/wallGeometry.js';
import { CSGOperationsManager } from './modules/csgOperations.js';
import { OutlineExtractor } from './modules/outlineExtractor.js';
import { Scene3DManager } from './modules/scene3d.js';
import { OutlineGenerator } from './modules/outlineGenerator.js';

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
        this.outlineGenerator = new OutlineGenerator();
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
        
        // 只在选择模式下响应点击
        if (this.currentMode !== 'select') return;
        
        const rect = this.canvas3d.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // 只检测面组mesh，过滤掉轮廓线和线框
        const faceGroupMeshes = this.wallMeshes.filter(obj => obj.userData.isFaceGroup);
        const intersects = this.raycaster.intersectObjects(faceGroupMeshes, false);
        
        if (intersects.length > 0) {
            const intersection = intersects[0];
            const intersectedObject = intersection.object;
            
            console.log('\n=== 选中墙面 ===');
            console.log('墙体索引:', intersectedObject.userData.wallIndex);
            console.log('面组索引:', intersectedObject.userData.faceGroupIndex);
            console.log('点击的三角形索引:', intersection.faceIndex);
            
            // 取消之前选中的面的高亮
            if (this.selectedFaceGroup) {
                this.selectedFaceGroup.material.emissive.setHex(0x000000);
                this.selectedFaceGroup.material.emissiveIntensity = 0;
            }
            
            // 高亮新选中的面
            this.selectedFaceGroup = intersectedObject;
            this.selectedFaceGroup.material.emissive.setHex(0xffaa00);
            this.selectedFaceGroup.material.emissiveIntensity = 0.8;
            
            // 记录选中的墙体索引
            this.selectedWallIndex = intersectedObject.userData.wallIndex;
            
            // 显示选中墙体的轮廓到右下窗口（使用2D数据）
            this.displayWallOutlineFrom2D();
            
            this.updateStatus('已选中墙面 - 查看右下窗口的外轮廓');
        }
    }
    
    handleKeyDown(e) {
        // 键盘移动功能已移除，选择墙面功能不需要移动
    }
    
    handleKeyDown(e) {
        // 键盘移动功能已移除，选择墙面功能不需要移动
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
    
    /**
     * 从2D墙体数据显示轮廓
     * 根据选中的面组类型（顶面/底面/侧面）生成对应的轮廓
     */
    displayWallOutlineFrom2D() {
        if (this.selectedWallIndex === undefined || !this.selectedFaceGroup) return;
        
        const canvasOutline = document.getElementById('canvas-outline');
        if (!canvasOutline) return;
        
        const ctx = canvasOutline.getContext('2d');
        
        console.log('\n=== 显示墙体轮廓（从2D数据）===');
        console.log(`选中墙体索引: ${this.selectedWallIndex}`);
        console.log(`面组索引: ${this.selectedFaceGroup.userData.faceGroupIndex}`);
        
        const wall = this.walls[this.selectedWallIndex];
        if (!wall) {
            console.log('找不到墙体数据');
            return;
        }
        
        // 获取面组的法向量（从第一个三角形）
        const geometry = this.selectedFaceGroup.geometry;
        const positions = geometry.attributes.position;
        
        if (!positions || positions.count < 3) {
            console.log('面组没有几何数据');
            return;
        }
        
        const v0 = new THREE.Vector3(positions.getX(0), positions.getY(0), positions.getZ(0));
        const v1 = new THREE.Vector3(positions.getX(1), positions.getY(1), positions.getZ(1));
        const v2 = new THREE.Vector3(positions.getX(2), positions.getY(2), positions.getZ(2));
        
        const edge1 = new THREE.Vector3().subVectors(v1, v0);
        const edge2 = new THREE.Vector3().subVectors(v2, v0);
        const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
        
        console.log(`面组法向: (${normal.x.toFixed(2)}, ${normal.y.toFixed(2)}, ${normal.z.toFixed(2)})`);
        
        // 判断面的类型并生成轮廓
        let polygons = [];
        let faceType = '';
        
        if (Math.abs(normal.y) > 0.9) {
            // 水平面（顶面或底面）
            faceType = normal.y > 0 ? '顶面' : '底面';
            console.log(`面类型: ${faceType}`);
            const rect = this.outlineGenerator.getTopBottomRectangle(wall);
            polygons = [rect];
        } else {
            // 垂直面（侧面）
            faceType = this.outlineGenerator.determineFaceType(wall, normal);
            console.log(`面类型: ${faceType}`);
            const segments = this.outlineGenerator.getSideRectangles(wall, normal, this.walls);
            polygons = segments;
        }
        
        if (polygons.length === 0 || polygons[0].length === 0) {
            console.log('无法生成轮廓');
            return;
        }
        
        console.log(`轮廓多边形数: ${polygons.length}`);
        
        // 绘制到画布
        this.drawPolygonsToCanvas(ctx, canvasOutline, polygons, faceType);
    }
    
    /**
     * 绘制多个多边形到画布（保持真实比例，高分辨率）
     */
    drawPolygonsToCanvas(ctx, canvas, polygons, faceType) {
        // 提高画布分辨率（使用设备像素比）
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        
        // 设置画布的实际像素尺寸
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        // 缩放上下文以匹配设备像素比
        ctx.scale(dpr, dpr);
        
        // 使用CSS尺寸
        const displayWidth = rect.width;
        const displayHeight = rect.height;
        
        ctx.clearRect(0, 0, displayWidth, displayHeight);
        
        // 计算所有多边形的总边界框
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        polygons.forEach(polygon => {
            polygon.forEach(p => {
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y);
                maxY = Math.max(maxY, p.y);
            });
        });
        
        const width = maxX - minX;
        const height = maxY - minY;
        const padding = 50;
        
        if (width < 0.001 || height < 0.001) {
            console.log('轮廓尺寸太小，无法显示');
            return;
        }
        
        // 使用统一的缩放比例，保持真实比例
        const scaleX = (displayWidth - padding * 2) / width;
        const scaleY = (displayHeight - padding * 2) / height;
        const scale = Math.min(scaleX, scaleY);
        
        console.log(`画布尺寸: ${displayWidth}x${displayHeight}, DPR: ${dpr}`);
        console.log(`轮廓范围: ${width.toFixed(3)}x${height.toFixed(3)}m`);
        console.log(`缩放比例: ${scale.toFixed(2)}`);
        
        // 转换坐标到画布空间（居中显示，保持比例）
        const centerX = displayWidth / 2;
        const centerY = displayHeight / 2;
        const offsetX = (maxX + minX) / 2;
        const offsetY = (maxY + minY) / 2;
        
        const toCanvasX = (x) => centerX + (x - offsetX) * scale;
        const toCanvasY = (y) => centerY - (y - offsetY) * scale;
        
        // 绘制所有多边形的轮廓
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 1;
        
        console.log(`开始绘制 ${polygons.length} 个多边形`);
        
        polygons.forEach((polygon, idx) => {
            console.log(`绘制多边形 ${idx}, 顶点数: ${polygon.length}`);
            console.log(`  顶点:`, polygon.map(p => `(${p.x.toFixed(3)}, ${p.y.toFixed(3)})`).join(', '));
            
            ctx.beginPath();
            const startX = toCanvasX(polygon[0].x);
            const startY = toCanvasY(polygon[0].y);
            ctx.moveTo(startX, startY);
            console.log(`  moveTo(${startX.toFixed(1)}, ${startY.toFixed(1)})`);
            
            for (let i = 1; i < polygon.length; i++) {
                const x = toCanvasX(polygon[i].x);
                const y = toCanvasY(polygon[i].y);
                ctx.lineTo(x, y);
                console.log(`  lineTo(${x.toFixed(1)}, ${y.toFixed(1)})`);
            }
            ctx.closePath();
            ctx.stroke();
            
            // 绘制顶点
            ctx.fillStyle = '#ff0000';
            polygon.forEach(p => {
                ctx.beginPath();
                ctx.arc(toCanvasX(p.x), toCanvasY(p.y), 2, 0, Math.PI * 2);
                ctx.fill();
            });
        });
        
        // 显示信息标签
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText(`面类型: ${faceType}`, 10, 20);
        ctx.fillText(`尺寸: ${(width * 1000).toFixed(0)} x ${(height * 1000).toFixed(0)} mm`, 10, 35);
        ctx.fillText(`比例: 1:${(1/scale).toFixed(0)}`, 10, 50);
        ctx.fillText(`矩形数: ${polygons.length}`, 10, 65);
        
        // 绘制比例尺
        this.drawScale(ctx, displayWidth, displayHeight, scale, padding);
        
        console.log('轮廓已绘制到画布（高分辨率）');
    }
    
    /**
     * 绘制比例尺
     */
    drawScale(ctx, displayWidth, displayHeight, scale, padding) {
        // 在画布底部绘制比例尺
        const scaleLength = 1.0; // 1米的参考长度
        const scaleLengthPx = scaleLength * scale;
        
        if (scaleLengthPx < 20) return; // 太小不绘制
        
        const scaleY = displayHeight - padding / 2;
        const scaleStartX = padding;
        const scaleEndX = scaleStartX + scaleLengthPx;
        
        // 绘制比例尺线
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(scaleStartX, scaleY);
        ctx.lineTo(scaleEndX, scaleY);
        
        // 绘制端点标记
        ctx.moveTo(scaleStartX, scaleY - 5);
        ctx.lineTo(scaleStartX, scaleY + 5);
        ctx.moveTo(scaleEndX, scaleY - 5);
        ctx.lineTo(scaleEndX, scaleY + 5);
        ctx.stroke();
        
        // 标注长度
        ctx.fillStyle = '#00ff00';
        ctx.font = '10px Arial';
        ctx.fillText('1000 mm', scaleStartX + scaleLengthPx / 2 - 20, scaleY - 8);
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

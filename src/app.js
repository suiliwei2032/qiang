console.log('=== APP.JS 开始加载 ===');

import { Canvas2DManager } from './modules/canvas2d.js';
import { WallGeometryManager } from './modules/wallGeometry.js';
import { CSGOperationsManager } from './modules/csgOperations.js';
import { OutlineExtractor } from './modules/outlineExtractor.js';
import { Scene3DManager } from './modules/scene3d.js';
import { OutlineGenerator } from './modules/outlineGenerator.js';
import { GeometryUtils } from './modules/geometryUtils.js';

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
            console.log('面索引:', intersectedObject.userData.faceIndex);
            console.log('面类型:', intersectedObject.userData.faceType);

            // 取消之前选中的面的高亮
            if (this.selectedFaceGroup) {
                this.selectedFaceGroup.material.emissive.setHex(0x000000);
                this.selectedFaceGroup.material.emissiveIntensity = 0;
            }

            // 高亮新选中的面
            this.selectedFaceGroup = intersectedObject;
            this.selectedFaceGroup.material.emissive.setHex(0xffaa00);
            this.selectedFaceGroup.material.emissiveIntensity = 0.8;

            // 记录选中的墙体索引和面类型
            this.selectedWallIndex = intersectedObject.userData.wallIndex;
            this.selectedFaceType = intersectedObject.userData.faceType;

            // 简化版本：直接显示面的轮廓（四边形）
            this.displaySimpleFaceOutline();

            this.updateStatus('已选中墙面 - 查看右下窗口的外轮廓');
        }
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
     * 简化版本：直接显示面的轮廓（支持带洞）
     */
    displaySimpleFaceOutline() {
        if (this.selectedWallIndex === undefined || !this.selectedFaceGroup) return;

        const canvasOutline = document.getElementById('canvas-outline');
        if (!canvasOutline) return;

        const ctx = canvasOutline.getContext('2d');

        console.log('\n=== 显示面轮廓 ===');
        console.log(`墙体索引: ${this.selectedWallIndex}`);
        console.log(`面类型: ${this.selectedFaceType}`);

        // 从 userData 中获取保存的多边形数据
        const polygonData = this.selectedFaceGroup.userData.polygonData;

        if (!polygonData) {
            console.log('没有找到多边形数据');
            return;
        }

        const outer = polygonData.outer || polygonData;
        const holes = polygonData.holes || [];

        console.log(`外部顶点数: ${outer.length}, 洞数: ${holes.length}`);

        if (outer.length < 3) {
            console.log('外部顶点数量不足');
            return;
        }

        // 准备绘制数据
        const polygons = [outer, ...holes];

        // 绘制到画布
        this.drawPolygonsToCanvas(ctx, canvasOutline, polygons, this.selectedFaceType);
    }

    /**
     * 将2D点按逆时针顺序排序
     */
    orderPointsCounterClockwise(points) {
        if (points.length < 3) return points;

        // 计算中心点
        let centerX = 0, centerY = 0;
        points.forEach(p => {
            centerX += p.x;
            centerY += p.y;
        });
        centerX /= points.length;
        centerY /= points.length;

        // 按角度排序
        const sortedPoints = points.slice().sort((a, b) => {
            const angleA = Math.atan2(a.y - centerY, a.x - centerX);
            const angleB = Math.atan2(b.y - centerY, b.x - centerX);
            return angleA - angleB;
        });

        return sortedPoints;
    }

    /**
     * 混合方案：用2D数据计算点，用3D面组辅助排序
     */
    displayWallOutlineHybrid() {
        if (this.selectedWallIndex === undefined || !this.selectedFaceGroup) return;

        const canvasOutline = document.getElementById('canvas-outline');
        if (!canvasOutline) return;

        const ctx = canvasOutline.getContext('2d');

        console.log('\n=== 混合方案：2D点 + 3D排序 ===');
        console.log(`选中墙体索引: ${this.selectedWallIndex}`);

        const wall = this.walls[this.selectedWallIndex];
        if (!wall) {
            console.log('找不到墙体数据');
            return;
        }

        // 获取面组的法向量
        const faceGeometry = this.selectedFaceGroup.geometry;
        if (!faceGeometry || !faceGeometry.attributes.position) {
            console.log('面组没有几何数据');
            return;
        }

        const positions = faceGeometry.attributes.position;
        const v0 = new THREE.Vector3(positions.getX(0), positions.getY(0), positions.getZ(0));
        const v1 = new THREE.Vector3(positions.getX(1), positions.getY(1), positions.getZ(1));
        const v2 = new THREE.Vector3(positions.getX(2), positions.getY(2), positions.getZ(2));

        const edge1 = new THREE.Vector3().subVectors(v1, v0);
        const edge2 = new THREE.Vector3().subVectors(v2, v0);
        const faceNormal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

        // 判断面类型
        let faceType = '';
        if (Math.abs(faceNormal.y) > 0.9) {
            faceType = faceNormal.y > 0 ? '顶面' : '底面';
        } else {
            faceType = this.outlineGenerator.determineFaceType(wall, faceNormal);
        }
        console.log(`面类型: ${faceType}`);

        // 步骤1：从2D数据生成轮廓多边形（可能顺序不对）
        let polygons2D = [];
        if (Math.abs(faceNormal.y) > 0.9) {
            const rect = this.outlineGenerator.getTopBottomRectangle(wall);
            polygons2D = [rect];
        } else {
            const segments = this.outlineGenerator.getSideRectangles(wall, faceNormal, this.walls);
            polygons2D = segments;
        }

        if (polygons2D.length === 0 || polygons2D[0].length === 0) {
            console.log('无法生成2D轮廓');
            return;
        }

        console.log(`2D数据生成了 ${polygons2D.length} 个多边形`);

        // 步骤2：从3D面组提取外轮廓边（用于辅助排序）
        const outlineEdges3D = this.extractOutlineEdgesFromFaceGroup(faceGeometry);
        console.log(`3D面组提取了 ${outlineEdges3D.length} 条外轮廓边`);

        // 步骤3：投影3D边到2D
        const outlineEdges2D = this.projectEdgesTo2DPlane(outlineEdges3D, faceNormal);

        // 步骤4：使用3D边的顺序来重新排序2D点
        const orderedPolygons = polygons2D.map(polygon =>
            this.reorderPointsByEdges(polygon, outlineEdges2D)
        );

        console.log(`重新排序后的多边形数: ${orderedPolygons.length}`);

        // 绘制到画布
        this.drawPolygonsToCanvas(ctx, canvasOutline, orderedPolygons, faceType);
    }

    /**
     * 从面组提取外轮廓边（只出现一次的边）
     */
    extractOutlineEdgesFromFaceGroup(geometry) {
        const positions = geometry.attributes.position;
        const vertexCount = positions.count;

        // 统计每条边出现的次数
        const edgeCount = new Map();

        for (let i = 0; i < vertexCount; i += 3) {
            // 每个三角形的三条边
            for (let j = 0; j < 3; j++) {
                const idx1 = i + j;
                const idx2 = i + (j + 1) % 3;

                const v1 = new THREE.Vector3(
                    positions.getX(idx1),
                    positions.getY(idx1),
                    positions.getZ(idx1)
                );
                const v2 = new THREE.Vector3(
                    positions.getX(idx2),
                    positions.getY(idx2),
                    positions.getZ(idx2)
                );

                const key = this.getEdgeKey(v1, v2);
                edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
            }
        }

        // 提取只出现一次的边（外轮廓边）
        const outlineEdges = [];
        edgeCount.forEach((count, key) => {
            if (count === 1) {
                const [v1Str, v2Str] = key.split('|');
                const [x1, y1, z1] = v1Str.split(',').map(Number);
                const [x2, y2, z2] = v2Str.split(',').map(Number);
                outlineEdges.push({
                    v1: new THREE.Vector3(x1 / 1000, y1 / 1000, z1 / 1000),
                    v2: new THREE.Vector3(x2 / 1000, y2 / 1000, z2 / 1000)
                });
            }
        });

        return outlineEdges;
    }

    /**
     * 投影3D边到2D平面
     */
    projectEdgesTo2DPlane(edges3D, normal) {
        // 创建局部坐标系
        let xAxis, yAxis;

        if (Math.abs(normal.y) > 0.9) {
            xAxis = new THREE.Vector3(1, 0, 0);
            yAxis = new THREE.Vector3(0, 0, 1);
        } else {
            yAxis = new THREE.Vector3(0, 1, 0);
            xAxis = new THREE.Vector3().crossVectors(yAxis, normal).normalize();
            yAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize();
        }

        // 投影所有边
        return edges3D.map(edge => ({
            p1: {
                x: edge.v1.dot(xAxis),
                y: edge.v1.dot(yAxis)
            },
            p2: {
                x: edge.v2.dot(xAxis),
                y: edge.v2.dot(yAxis)
            }
        }));
    }

    /**
     * 使用3D边的顺序来重新排序2D点
     */
    reorderPointsByEdges(points2D, edges2D) {
        if (points2D.length === 0 || edges2D.length === 0) return points2D;

        console.log(`\n重新排序点: ${points2D.length} 个点, ${edges2D.length} 条边`);

        const tolerance = 0.01; // 10mm容差

        // 连接边成有序序列
        const orderedPoints = [];
        const usedEdges = new Set();

        // 找到起始边
        let currentEdge = edges2D[0];
        orderedPoints.push({ x: currentEdge.p1.x, y: currentEdge.p1.y });
        orderedPoints.push({ x: currentEdge.p2.x, y: currentEdge.p2.y });
        usedEdges.add(0);

        let currentPoint = currentEdge.p2;

        // 连接剩余的边
        while (usedEdges.size < edges2D.length) {
            let found = false;

            for (let i = 0; i < edges2D.length; i++) {
                if (usedEdges.has(i)) continue;

                const edge = edges2D[i];
                const dist1 = Math.hypot(currentPoint.x - edge.p1.x, currentPoint.y - edge.p1.y);
                const dist2 = Math.hypot(currentPoint.x - edge.p2.x, currentPoint.y - edge.p2.y);

                if (dist1 < tolerance) {
                    orderedPoints.push({ x: edge.p2.x, y: edge.p2.y });
                    currentPoint = edge.p2;
                    usedEdges.add(i);
                    found = true;
                    break;
                } else if (dist2 < tolerance) {
                    orderedPoints.push({ x: edge.p1.x, y: edge.p1.y });
                    currentPoint = edge.p1;
                    usedEdges.add(i);
                    found = true;
                    break;
                }
            }

            if (!found) {
                console.log(`  无法连接所有边，已连接 ${usedEdges.size}/${edges2D.length}`);
                break;
            }
        }

        // 移除最后一个点（如果它与第一个点重合）
        if (orderedPoints.length > 1) {
            const first = orderedPoints[0];
            const last = orderedPoints[orderedPoints.length - 1];
            const dist = Math.hypot(first.x - last.x, first.y - last.y);
            if (dist < tolerance) {
                orderedPoints.pop();
            }
        }

        console.log(`  排序后: ${orderedPoints.length} 个点`);

        return orderedPoints;
    }

    /**
     * 从3D轮廓线提取顶点并显示（新方法）
     * 直接使用场景中的黄色轮廓线（已经是外轮廓）
     */
    displayWallOutlineFrom3DEdges() {
        if (this.selectedWallIndex === undefined || !this.selectedFaceGroup) return;

        const canvasOutline = document.getElementById('canvas-outline');
        if (!canvasOutline) return;

        const ctx = canvasOutline.getContext('2d');

        console.log('\n=== 从3D轮廓线提取顶点 ===');
        console.log(`选中墙体索引: ${this.selectedWallIndex}`);
        console.log(`面组索引: ${this.selectedFaceGroup.userData.faceGroupIndex}`);

        // 获取面组的法向量
        const faceGeometry = this.selectedFaceGroup.geometry;
        if (!faceGeometry || !faceGeometry.attributes.position) {
            console.log('面组没有几何数据');
            return;
        }

        const positions = faceGeometry.attributes.position;
        const v0 = new THREE.Vector3(positions.getX(0), positions.getY(0), positions.getZ(0));
        const v1 = new THREE.Vector3(positions.getX(1), positions.getY(1), positions.getZ(1));
        const v2 = new THREE.Vector3(positions.getX(2), positions.getY(2), positions.getZ(2));

        const edge1 = new THREE.Vector3().subVectors(v1, v0);
        const edge2 = new THREE.Vector3().subVectors(v2, v0);
        const faceNormal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

        console.log(`面组法向: (${faceNormal.x.toFixed(2)}, ${faceNormal.y.toFixed(2)}, ${faceNormal.z.toFixed(2)})`);

        // 判断面类型
        let faceType = '';
        if (Math.abs(faceNormal.y) > 0.9) {
            faceType = faceNormal.y > 0 ? '顶面' : '底面';
        } else {
            const wall = this.walls[this.selectedWallIndex];
            if (wall) {
                faceType = this.outlineGenerator.determineFaceType(wall, faceNormal);
            } else {
                faceType = '侧面';
            }
        }
        console.log(`面类型: ${faceType}`);

        // 从场景中找到对应墙体的轮廓线对象
        const outlineEdges = this.findOutlineEdgesForFaceGroup(this.selectedFaceGroup, faceNormal);

        if (!outlineEdges || outlineEdges.length === 0) {
            console.log('找不到轮廓线');
            return;
        }

        console.log(`找到 ${outlineEdges.length} 条轮廓边`);

        // 投影到2D并排序
        const outline2D = this.projectAndOrderOutlineEdges(outlineEdges, faceNormal);

        if (outline2D.length === 0) {
            console.log('无法生成2D轮廓');
            return;
        }

        console.log(`2D轮廓有 ${outline2D.length} 个顶点`);

        // 绘制到画布
        this.drawPolygonsToCanvas(ctx, canvasOutline, [outline2D], faceType);
    }

    /**
     * 从场景中找到与选中面组对应的轮廓线
     */
    findOutlineEdgesForFaceGroup(faceGroup, faceNormal) {
        console.log('\n=== 查找对应的轮廓线 ===');

        // 获取面组的边界框和中心点
        const faceBox = new THREE.Box3().setFromObject(faceGroup);
        const faceCenter = new THREE.Vector3();
        faceBox.getCenter(faceCenter);

        console.log(`面组中心: (${faceCenter.x.toFixed(2)}, ${faceCenter.y.toFixed(2)}, ${faceCenter.z.toFixed(2)})`);

        // 遍历场景中的所有对象，找到黄色轮廓线
        const outlineLines = [];

        this.wallMeshes.forEach((obj, idx) => {
            // 检查是否是LineSegments且颜色是黄色
            if (obj instanceof THREE.LineSegments &&
                obj.material &&
                obj.material.color &&
                obj.material.color.getHex() === 0xffff00) {

                outlineLines.push(obj);
                console.log(`  找到轮廓线对象 ${idx}`);
            }
        });

        console.log(`场景中共有 ${outlineLines.length} 个轮廓线对象`);

        if (outlineLines.length === 0) return [];

        // 从轮廓线中提取与当前面组共面的边
        const tolerance = 0.01;
        const matchingEdges = [];

        outlineLines.forEach((lineObj, lineIdx) => {
            const geometry = lineObj.geometry;
            if (!geometry || !geometry.attributes.position) return;

            const positions = geometry.attributes.position;
            const edgeCount = positions.count / 2;

            console.log(`  轮廓线 ${lineIdx} 有 ${edgeCount} 条边`);

            for (let i = 0; i < edgeCount; i++) {
                const v1 = new THREE.Vector3(
                    positions.getX(i * 2),
                    positions.getY(i * 2),
                    positions.getZ(i * 2)
                );
                const v2 = new THREE.Vector3(
                    positions.getX(i * 2 + 1),
                    positions.getY(i * 2 + 1),
                    positions.getZ(i * 2 + 1)
                );

                // 检查边的中点是否在面组的平面上
                const edgeCenter = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);

                // 计算边中点到面平面的距离
                const toCenter = new THREE.Vector3().subVectors(edgeCenter, faceCenter);
                const distance = Math.abs(toCenter.dot(faceNormal));

                if (distance < tolerance) {
                    matchingEdges.push({ v1, v2 });
                }
            }
        });

        console.log(`找到 ${matchingEdges.length} 条与面组共面的轮廓边`);

        return matchingEdges;
    }

    /**
     * 投影轮廓边到2D并排序成闭合多边形
     */
    projectAndOrderOutlineEdges(edges3D, normal) {
        if (edges3D.length === 0) return [];

        console.log('\n=== 投影并排序轮廓边 ===');

        // 创建局部坐标系
        let xAxis, yAxis;

        if (Math.abs(normal.y) > 0.9) {
            // 水平面
            xAxis = new THREE.Vector3(1, 0, 0);
            yAxis = new THREE.Vector3(0, 0, 1);
        } else {
            // 垂直面
            yAxis = new THREE.Vector3(0, 1, 0);
            xAxis = new THREE.Vector3().crossVectors(yAxis, normal).normalize();
            yAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize();
        }

        // 投影到2D
        const edges2D = edges3D.map(edge => ({
            p1: {
                x: edge.v1.dot(xAxis),
                y: edge.v1.dot(yAxis)
            },
            p2: {
                x: edge.v2.dot(xAxis),
                y: edge.v2.dot(yAxis)
            }
        }));

        // 合并相近的顶点并连接成多边形
        const tolerance = 0.001;
        const points = [];
        const usedEdges = new Set();

        if (edges2D.length === 0) return [];

        // 从第一条边开始
        let currentEdge = edges2D[0];
        points.push({ x: currentEdge.p1.x, y: currentEdge.p1.y });
        points.push({ x: currentEdge.p2.x, y: currentEdge.p2.y });
        usedEdges.add(0);

        let currentPoint = currentEdge.p2;

        // 连接剩余的边
        while (usedEdges.size < edges2D.length) {
            let found = false;

            for (let i = 0; i < edges2D.length; i++) {
                if (usedEdges.has(i)) continue;

                const edge = edges2D[i];
                const dist1 = Math.hypot(currentPoint.x - edge.p1.x, currentPoint.y - edge.p1.y);
                const dist2 = Math.hypot(currentPoint.x - edge.p2.x, currentPoint.y - edge.p2.y);

                if (dist1 < tolerance) {
                    points.push({ x: edge.p2.x, y: edge.p2.y });
                    currentPoint = edge.p2;
                    usedEdges.add(i);
                    found = true;
                    break;
                } else if (dist2 < tolerance) {
                    points.push({ x: edge.p1.x, y: edge.p1.y });
                    currentPoint = edge.p1;
                    usedEdges.add(i);
                    found = true;
                    break;
                }
            }

            if (!found) {
                console.log(`  无法连接所有边，已连接 ${usedEdges.size}/${edges2D.length}`);
                break;
            }
        }

        // 移除最后一个点（如果它与第一个点重合）
        if (points.length > 1) {
            const first = points[0];
            const last = points[points.length - 1];
            const dist = Math.hypot(first.x - last.x, first.y - last.y);
            if (dist < tolerance) {
                points.pop();
            }
        }

        console.log(`连接后得到 ${points.length} 个顶点`);

        return points;
    }

    /**
     * 提取面组的所有边（包括内部边和轮廓边）
     */
    extractAllEdgesFromFaceGroup(geometry) {
        const positions = geometry.attributes.position;
        const vertexCount = positions.count;

        const edges = [];
        const edgeSet = new Set(); // 用于去重

        for (let i = 0; i < vertexCount; i += 3) {
            // 每个三角形的三条边
            for (let j = 0; j < 3; j++) {
                const idx1 = i + j;
                const idx2 = i + (j + 1) % 3;

                const v1 = new THREE.Vector3(
                    positions.getX(idx1),
                    positions.getY(idx1),
                    positions.getZ(idx1)
                );
                const v2 = new THREE.Vector3(
                    positions.getX(idx2),
                    positions.getY(idx2),
                    positions.getZ(idx2)
                );

                // 创建边的key（用于去重）
                const key = this.getEdgeKey(v1, v2);

                if (!edgeSet.has(key)) {
                    edges.push({ v1, v2 });
                    edgeSet.add(key);
                }
            }
        }

        console.log(`去重后有 ${edges.length} 条唯一的边`);
        return edges;
    }

    /**
     * 将所有边投影到2D并绘制
     */
    drawAllEdgesTo2D(ctx, canvas, edges, normal, faceType) {
        if (edges.length === 0) {
            console.log('没有边可以绘制');
            return;
        }

        // 提高画布分辨率
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const displayWidth = rect.width;
        const displayHeight = rect.height;

        ctx.clearRect(0, 0, displayWidth, displayHeight);

        // 创建局部坐标系用于投影
        let xAxis, yAxis;

        if (Math.abs(normal.y) > 0.9) {
            // 水平面
            xAxis = new THREE.Vector3(1, 0, 0);
            yAxis = new THREE.Vector3(0, 0, 1);
        } else {
            // 垂直面
            yAxis = new THREE.Vector3(0, 1, 0);
            xAxis = new THREE.Vector3().crossVectors(yAxis, normal).normalize();
            yAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize();
        }

        // 投影所有点并计算边界
        const points2D = [];
        edges.forEach(edge => {
            const p1 = {
                x: edge.v1.dot(xAxis),
                y: edge.v1.dot(yAxis)
            };
            const p2 = {
                x: edge.v2.dot(xAxis),
                y: edge.v2.dot(yAxis)
            };
            points2D.push({ p1, p2 });
        });

        // 计算边界
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        points2D.forEach(edge => {
            minX = Math.min(minX, edge.p1.x, edge.p2.x);
            maxX = Math.max(maxX, edge.p1.x, edge.p2.x);
            minY = Math.min(minY, edge.p1.y, edge.p2.y);
            maxY = Math.max(maxY, edge.p1.y, edge.p2.y);
        });

        const width = maxX - minX;
        const height = maxY - minY;
        const padding = 50;

        if (width < 0.001 || height < 0.001) {
            console.log('边界太小，无法显示');
            return;
        }

        // 计算缩放比例
        const scaleX = (displayWidth - padding * 2) / width;
        const scaleY = (displayHeight - padding * 2) / height;
        const scale = Math.min(scaleX, scaleY);

        const centerX = displayWidth / 2;
        const centerY = displayHeight / 2;
        const offsetX = (maxX + minX) / 2;
        const offsetY = (maxY + minY) / 2;

        const toCanvasX = (x) => centerX + (x - offsetX) * scale;
        const toCanvasY = (y) => centerY - (y - offsetY) * scale;

        console.log(`画布尺寸: ${displayWidth}x${displayHeight}`);
        console.log(`边界: ${width.toFixed(3)}x${height.toFixed(3)}m`);
        console.log(`缩放比例: ${scale.toFixed(2)}`);

        // 绘制所有边
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 1;

        console.log(`开始绘制 ${points2D.length} 条边`);

        points2D.forEach((edge, idx) => {
            const x1 = toCanvasX(edge.p1.x);
            const y1 = toCanvasY(edge.p1.y);
            const x2 = toCanvasX(edge.p2.x);
            const y2 = toCanvasY(edge.p2.y);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            if (idx < 10) { // 只打印前10条边的信息
                console.log(`  边${idx}: (${edge.p1.x.toFixed(3)}, ${edge.p1.y.toFixed(3)}) -> (${edge.p2.x.toFixed(3)}, ${edge.p2.y.toFixed(3)})`);
            }
        });

        // 绘制所有顶点
        ctx.fillStyle = '#ff0000';
        const drawnPoints = new Set();

        points2D.forEach(edge => {
            [edge.p1, edge.p2].forEach(p => {
                const key = `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
                if (!drawnPoints.has(key)) {
                    ctx.beginPath();
                    ctx.arc(toCanvasX(p.x), toCanvasY(p.y), 3, 0, Math.PI * 2);
                    ctx.fill();
                    drawnPoints.add(key);
                }
            });
        });

        console.log(`绘制了 ${drawnPoints.size} 个唯一顶点`);

        // 显示信息
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText(`面类型: ${faceType}`, 10, 20);
        ctx.fillText(`边数: ${points2D.length}`, 10, 35);
        ctx.fillText(`顶点数: ${drawnPoints.size}`, 10, 50);
        ctx.fillText(`尺寸: ${(width * 1000).toFixed(0)} x ${(height * 1000).toFixed(0)} mm`, 10, 65);

        console.log('所有边已绘制完成');
    }


    /**
     * 从面组几何体中提取轮廓点（旧方法，暂时保留）
     */
    extractOutlineFromFaceGroup(geometry, faceNormal) {
        const positions = geometry.attributes.position;
        const vertexCount = positions.count;

        // 收集所有边
        const edges = new Map(); // key: "x1,y1,z1-x2,y2,z2", value: count

        for (let i = 0; i < vertexCount; i += 3) {
            // 每个三角形的三条边
            for (let j = 0; j < 3; j++) {
                const idx1 = i + j;
                const idx2 = i + (j + 1) % 3;

                const v1 = new THREE.Vector3(
                    positions.getX(idx1),
                    positions.getY(idx1),
                    positions.getZ(idx1)
                );
                const v2 = new THREE.Vector3(
                    positions.getX(idx2),
                    positions.getY(idx2),
                    positions.getZ(idx2)
                );

                // 创建边的key（确保顺序一致）
                const key = this.getEdgeKey(v1, v2);
                edges.set(key, (edges.get(key) || 0) + 1);
            }
        }

        // 找出只出现一次的边（轮廓边）
        const outlineEdges = [];
        edges.forEach((count, key) => {
            if (count === 1) {
                const [v1Str, v2Str] = key.split('|');
                const [x1, y1, z1] = v1Str.split(',').map(Number);
                const [x2, y2, z2] = v2Str.split(',').map(Number);
                outlineEdges.push({
                    v1: new THREE.Vector3(x1, y1, z1),
                    v2: new THREE.Vector3(x2, y2, z2)
                });
            }
        });

        console.log(`找到 ${outlineEdges.length} 条轮廓边`);

        if (outlineEdges.length === 0) return [];

        // 将边连接成有序的点序列
        const orderedPoints = this.orderEdges(outlineEdges);

        return orderedPoints;
    }

    /**
     * 创建边的唯一key
     */
    getEdgeKey(v1, v2) {
        const precision = 1000; // 精度到毫米
        const p1 = [
            Math.round(v1.x * precision),
            Math.round(v1.y * precision),
            Math.round(v1.z * precision)
        ];
        const p2 = [
            Math.round(v2.x * precision),
            Math.round(v2.y * precision),
            Math.round(v2.z * precision)
        ];

        // 确保顺序一致（小的在前）
        if (p1[0] < p2[0] || (p1[0] === p2[0] && p1[1] < p2[1]) ||
            (p1[0] === p2[0] && p1[1] === p2[1] && p1[2] < p2[2])) {
            return `${p1.join(',')}|${p2.join(',')}`;
        } else {
            return `${p2.join(',')}|${p1.join(',')}`;
        }
    }

    /**
     * 将边连接成有序的点序列
     */
    orderEdges(edges) {
        if (edges.length === 0) return [];

        const points = [];
        const usedEdges = new Set();

        // 从第一条边开始
        let currentEdge = edges[0];
        points.push(currentEdge.v1.clone());
        points.push(currentEdge.v2.clone());
        usedEdges.add(0);

        let currentPoint = currentEdge.v2;
        const tolerance = 0.001;

        // 连接剩余的边
        while (usedEdges.size < edges.length) {
            let found = false;

            for (let i = 0; i < edges.length; i++) {
                if (usedEdges.has(i)) continue;

                const edge = edges[i];

                // 检查是否可以连接
                if (currentPoint.distanceTo(edge.v1) < tolerance) {
                    points.push(edge.v2.clone());
                    currentPoint = edge.v2;
                    usedEdges.add(i);
                    found = true;
                    break;
                } else if (currentPoint.distanceTo(edge.v2) < tolerance) {
                    points.push(edge.v1.clone());
                    currentPoint = edge.v1;
                    usedEdges.add(i);
                    found = true;
                    break;
                }
            }

            if (!found) {
                console.log('无法连接所有边，可能有多个轮廓');
                break;
            }
        }

        // 移除最后一个点（如果它与第一个点重合）
        if (points.length > 1 && points[0].distanceTo(points[points.length - 1]) < tolerance) {
            points.pop();
        }

        console.log(`连接后得到 ${points.length} 个有序点`);
        return points;
    }

    /**
     * 将3D点投影到2D平面
     */
    projectPointsTo2D(points3D, normal) {
        if (points3D.length === 0) return [];

        // 创建局部坐标系
        let xAxis, yAxis;

        if (Math.abs(normal.y) > 0.9) {
            // 水平面（顶面/底面）
            xAxis = new THREE.Vector3(1, 0, 0);
            yAxis = new THREE.Vector3(0, 0, 1);
        } else {
            // 垂直面（侧面）
            // 使用面的法向量创建局部坐标系
            if (Math.abs(normal.y) < 0.9) {
                yAxis = new THREE.Vector3(0, 1, 0); // Y轴向上
            } else {
                yAxis = new THREE.Vector3(0, 0, 1);
            }
            xAxis = new THREE.Vector3().crossVectors(yAxis, normal).normalize();
            yAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize();
        }

        console.log(`投影坐标系: xAxis=(${xAxis.x.toFixed(2)}, ${xAxis.y.toFixed(2)}, ${xAxis.z.toFixed(2)}), yAxis=(${yAxis.x.toFixed(2)}, ${yAxis.y.toFixed(2)}, ${yAxis.z.toFixed(2)})`);

        // 投影所有点
        const points2D = points3D.map(p => ({
            x: p.dot(xAxis),
            y: p.dot(yAxis)
        }));

        return points2D;
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
        ctx.fillText(`比例: 1:${(1 / scale).toFixed(0)}`, 10, 50);
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

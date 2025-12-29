console.log('=== VIEWPORT2D.JS 开始加载 ===');

/**
 * 2D视口管理器
 * 负责2D绘制、缩放、平移、墙体端点拖拽等功能
 */
class Viewport2D {
    constructor() {
        // 基础属性
        this.canvas = null;
        this.ctx = null;
        this.scale = 1;
        this.offset = { x: 0, y: 0 };
        
        // 绘制状态
        this.isDrawing = false;
        this.tempLine = null;
        
        // 视口拖拽
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.lastOffset = { x: 0, y: 0 };
        
        // 墙体端点拖拽
        this.isDraggingWall = false;
        this.draggedWall = null;
        this.draggedPoint = null; // 'start' 或 'end'
        
        // 外部依赖
        this.wallManager = null;
        this.statusCallback = null;
    }
    
    /**
     * 初始化2D视口
     */
    init(canvasId, wallManager, statusCallback) {
        console.log('初始化2D视口...');
        
        this.wallManager = wallManager;
        this.statusCallback = statusCallback;
        
        // 获取画布
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error('找不到2D画布:', canvasId);
            return false;
        }
        
        this.ctx = this.canvas.getContext('2d');
        console.log('2D上下文已获取');
        
        // 设置画布大小
        this.resizeCanvas();
        
        // 绑定事件
        this.bindEvents();
        
        // 初始渲染
        this.render();
        
        console.log('2D视口初始化完成');
        return true;
    }
    
    /**
     * 绑定鼠标事件
     */
    bindEvents() {
        if (!this.canvas) return;
        
        // 鼠标点击
        this.canvas.onclick = (e) => {
            this.handleClick(e);
        };
        
        // 鼠标移动
        this.canvas.onmousemove = (e) => {
            this.handleMouseMove(e);
        };
        
        // 右键菜单禁用
        this.canvas.oncontextmenu = (e) => {
            e.preventDefault();
            return false;
        };
        
        // 鼠标按下
        this.canvas.onmousedown = (e) => {
            this.handleMouseDown(e);
        };
        
        // 鼠标释放
        this.canvas.onmouseup = (e) => {
            this.handleMouseUp(e);
        };
        
        // 滚轮缩放
        this.canvas.onwheel = (e) => {
            this.handleWheel(e);
        };
        
        console.log('2D视口事件已绑定');
    }
    
    /**
     * 处理鼠标点击
     */
    handleClick(event) {
        const coords = this.getWorldCoords(event);
        
        // 根据当前模式处理点击
        if (this.wallManager.getCurrentMode() === 'draw') {
            this.handleDrawClick(coords);
        } else if (this.wallManager.getCurrentMode() === 'select') {
            console.log('2D视口选择模式点击');
        } else {
            // 无模式时提示
            this.updateStatus('请先点击"绘制墙体"或"选择墙面"按钮');
        }
    }
    
    /**
     * 处理绘制模式点击
     */
    handleDrawClick(coords) {
        if (!this.isDrawing) {
            // 开始绘制
            console.log('开始绘制墙体');
            this.isDrawing = true;
            this.tempLine = { start: coords, end: coords };
            this.updateStatus('移动鼠标确定终点，右键取消');
        } else {
            // 完成绘制
            console.log('完成墙体绘制');
            
            // 获取当前墙体厚度
            const wallThicknessInput = document.getElementById('wallThickness');
            const thicknessMm = wallThicknessInput ? parseFloat(wallThicknessInput.value) || 200 : 200;
            
            // 创建墙体
            const wall = {
                start: this.tempLine.start,
                end: coords,
                thickness: thicknessMm
            };
            
            this.wallManager.addWall(wall);
            
            // 重置绘制状态
            this.isDrawing = false;
            this.tempLine = null;
            
            this.updateStatus('墙体已添加，总数: ' + this.wallManager.getWallCount());
        }
        
        this.render();
    }
    
    /**
     * 处理鼠标移动
     */
    handleMouseMove(event) {
        // 处理视口拖拽
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
            const coords = this.getWorldCoords(event);
            this.wallManager.updateWallPoint(this.draggedWall, this.draggedPoint, coords);
            this.render();
            return;
        }
        
        const coords = this.getWorldCoords(event);
        
        // 更新坐标显示
        this.updateCoordinateDisplay(coords);
        
        // 更新鼠标样式（当无模式时检查是否悬停在端点上）
        if (!this.wallManager.getCurrentMode() && !this.isDragging && !this.isDraggingWall) {
            const wallPoint = this.findWallEndpoint(coords);
            this.canvas.style.cursor = wallPoint ? 'pointer' : 'default';
        }
        
        // 更新临时线段
        if (this.isDrawing && this.tempLine) {
            this.tempLine.end = coords;
            this.render();
        }
    }
    
    /**
     * 处理鼠标按下
     */
    handleMouseDown(event) {
        if (event.button === 2) { // 右键
            console.log('开始右键拖拽视口');
            this.isDragging = true;
            this.dragStart = { x: event.clientX, y: event.clientY };
            this.lastOffset = { x: this.offset.x, y: this.offset.y };
            this.canvas.style.cursor = 'move';
            event.preventDefault();
        } else if (event.button === 0 && !this.wallManager.getCurrentMode()) { // 左键且无模式
            const coords = this.getWorldCoords(event);
            const wallPoint = this.findWallEndpoint(coords);
            if (wallPoint) {
                console.log('开始拖拽墙体端点');
                this.isDraggingWall = true;
                this.draggedWall = wallPoint.wall;
                this.draggedPoint = wallPoint.point;
                this.canvas.style.cursor = 'move';
                event.preventDefault();
            }
        }
    }
    
    /**
     * 处理鼠标释放
     */
    handleMouseUp(event) {
        if (event.button === 2 && this.isDragging) { // 右键释放
            console.log('结束右键拖拽视口');
            this.isDragging = false;
            this.canvas.style.cursor = 'default';
            event.preventDefault();
        } else if (event.button === 2) { // 右键点击（非拖拽）
            console.log('右键点击');
            this.handleRightClick();
        } else if (event.button === 0 && this.isDraggingWall) { // 左键释放墙体拖拽
            console.log('结束拖拽墙体端点');
            this.isDraggingWall = false;
            this.draggedWall = null;
            this.draggedPoint = null;
            this.canvas.style.cursor = 'default';
            event.preventDefault();
        }
    }
    
    /**
     * 处理滚轮缩放
     */
    handleWheel(event) {
        event.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        // 计算缩放前的世界坐标
        const worldBefore = this.screenToWorld(mouseX, mouseY);
        
        // 缩放
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        this.scale *= zoomFactor;
        this.scale = Math.max(0.1, Math.min(10, this.scale)); // 限制缩放范围
        
        // 计算缩放后的世界坐标
        const worldAfter = this.screenToWorld(mouseX, mouseY);
        
        // 调整偏移以保持鼠标位置不变
        this.offset.x += worldBefore.x - worldAfter.x;
        this.offset.y += worldBefore.y - worldAfter.y;
        
        console.log('缩放:', this.scale.toFixed(2));
        this.render();
    }
    
    /**
     * 处理右键点击
     */
    handleRightClick() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.tempLine = null;
            this.updateStatus('绘制已取消');
            this.render();
        }
    }
    
    /**
     * 获取世界坐标
     */
    getWorldCoords(event) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        return this.screenToWorld(mouseX, mouseY);
    }
    
    /**
     * 屏幕坐标转世界坐标
     */
    screenToWorld(screenX, screenY) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        const pixelX = screenX - centerX;
        const pixelY = screenY - centerY;
        
        const worldX = (pixelX / (this.scale * 50)) + this.offset.x;
        const worldY = -(pixelY / (this.scale * 50)) + this.offset.y;
        
        return { x: worldX, y: worldY };
    }
    
    /**
     * 查找墙体端点
     */
    findWallEndpoint(coords) {
        const tolerance = 0.1; // 10cm 容差
        const walls = this.wallManager.getAllWalls();
        
        for (let wall of walls) {
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
    }
    
    /**
     * 更新坐标显示
     */
    updateCoordinateDisplay(coords) {
        const coordsText = document.getElementById('coordsText');
        if (coordsText) {
            coordsText.textContent = 'X: ' + (coords.x * 1000).toFixed(0) + ', Y: ' + (coords.y * 1000).toFixed(0) + ' mm';
        }
    }
    
    /**
     * 更新状态显示
     */
    updateStatus(message) {
        if (this.statusCallback) {
            this.statusCallback(message);
        }
        console.log('2D状态:', message);
    }
    
    /**
     * 调整画布大小
     */
    resizeCanvas() {
        if (!this.canvas) return;
        
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        console.log('2D画布大小:', rect.width, 'x', rect.height);
        this.render();
    }
    
    /**
     * 渲染2D视口
     */
    render() {
        if (!this.ctx) return;
        
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
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
    }
    
    /**
     * 绘制网格
     */
    drawGrid(ctx) {
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
    }
    
    /**
     * 绘制墙体
     */
    drawWalls(ctx) {
        const walls = this.wallManager.getAllWalls();
        
        walls.forEach((wall) => {
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
    }
    
    /**
     * 生成墙体多边形
     */
    generateWallPolygon(start, end, wallThickness) {
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
    }
    
    /**
     * 清空绘制状态
     */
    clearDrawingState() {
        this.isDrawing = false;
        this.tempLine = null;
        this.render();
    }
}

// 导出到全局
window.Viewport2D = Viewport2D;

console.log('=== VIEWPORT2D.JS 加载完成 ===');
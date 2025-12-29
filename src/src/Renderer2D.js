import { CONSTANTS } from './constants.js';

/**
 * 2D渲染器 - 负责俯视图的绘制和交互
 */
export class Renderer2D {
  constructor(app) {
    this.app = app;
    this.canvas = null;
    this.ctx = null;
    this.container = null;
    
    // 交互状态
    this.mode = null;
    this.isActive = false;
    this.isPanning = false;
    this.middleMouseDown = false;
    
    // 绘制状态
    this.drawStart = null;
    this.tempEnd = null;
    this.selectedWall = null;
    this.selectedPoint = null;
    
    // 视图变换
    this.scale = 0.1;
    this.offset = { x: 0, y: 0 };
    this.panStart = null;
  }
  
  init() {
    const container = document.getElementById('viewport-2d');
    if (!container) {
      console.error('2D viewport container not found');
      return;
    }
    
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    container.appendChild(this.canvas);
    
    this.resize();
    this.bindEvents();
  }
  
  /**
   * 绑定事件
   */
  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
  }
  
  /**
   * 调整画布大小
   */
  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.offset.x = this.canvas.width / 2;
    this.offset.y = this.canvas.height / 2;
  }
  
  /**
   * 鼠标滚轮缩放
   */
  onWheel(e) {
    if (!this.isActive) return;
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? (1 - CONSTANTS.ZOOM_FACTOR) : (1 + CONSTANTS.ZOOM_FACTOR);
    this.scale = Math.max(
      CONSTANTS.MIN_SCALE,
      Math.min(CONSTANTS.MAX_SCALE, this.scale * delta)
    );
  }
  
  /**
   * 世界坐标转屏幕坐标
   */
  worldToScreen(x, y) {
    return {
      x: x * this.scale + this.offset.x,
      y: -y * this.scale + this.offset.y
    };
  }
  
  /**
   * 屏幕坐标转世界坐标
   */
  screenToWorld(x, y) {
    return {
      x: (x - this.offset.x) / this.scale,
      y: -(y - this.offset.y) / this.scale
    };
  }
  
  /**
   * 鼠标按下事件
   */
  onMouseDown(e) {
    if (e.button === 0) {
      this.app.setActiveViewport('2d');
    }
    
    if (!this.isActive && e.button !== 0) return;
    
    const pos = this.getMouseWorldPos(e);
    
    if (e.button === 0) {
      this.handleLeftClick(pos);
    } else if (e.button === 1) {
      this.handleMiddleClick(e);
    }
  }
  
  /**
   * 处理左键点击
   */
  handleLeftClick(pos) {
    if (this.mode === 'draw') {
      this.drawStart = pos;
      this.tempEnd = pos;
    } else {
      this.selectPoint(pos);
    }
  }
  
  /**
   * 处理中键点击（平移）
   */
  handleMiddleClick(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    this.middleMouseDown = true;
    this.isPanning = true;
    this.panStart = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    this.canvas.style.cursor = 'grab';
  }
  
  /**
   * 鼠标移动事件
   */
  onMouseMove(e) {
    if (!this.isActive) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    if (this.isPanning && this.panStart && this.middleMouseDown) {
      this.handlePanning(screenX, screenY);
    } else {
      const pos = this.screenToWorld(screenX, screenY);
      this.handleDrawingOrDragging(pos);
    }
  }
  
  /**
   * 处理平移
   */
  handlePanning(screenX, screenY) {
    const dx = screenX - this.panStart.x;
    const dy = screenY - this.panStart.y;
    this.offset.x += dx;
    this.offset.y += dy;
    this.panStart = { x: screenX, y: screenY };
    this.canvas.style.cursor = 'grabbing';
  }
  
  /**
   * 处理绘制或拖拽
   */
  handleDrawingOrDragging(pos) {
    if (this.mode === 'draw' && this.drawStart && !this.middleMouseDown) {
      this.tempEnd = pos;
    } else if (this.selectedPoint && !this.middleMouseDown && !this.isPanning) {
      this.app.wallManager.updateWallPoint(
        this.selectedWall.id,
        this.selectedPoint.type,
        pos.x,
        pos.y
      );
      this.app.onWallChanged();
    }
  }
  
  /**
   * 鼠标释放事件
   */
  onMouseUp(e) {
    if (e.button === 0) {
      this.handleLeftRelease();
    } else if (e.button === 1) {
      this.handleMiddleRelease();
    }
  }
  
  /**
   * 处理左键释放
   */
  handleLeftRelease() {
    if (this.mode === 'draw' && this.drawStart && this.tempEnd) {
      this.app.wallManager.createWall(
        this.drawStart.x, this.drawStart.y,
        this.tempEnd.x, this.tempEnd.y
      );
      this.app.onWallChanged();
      this.drawStart = null;
      this.tempEnd = null;
    }
    this.selectedPoint = null;
  }
  
  /**
   * 处理中键释放
   */
  handleMiddleRelease() {
    this.middleMouseDown = false;
    this.isPanning = false;
    this.panStart = null;
    this.canvas.style.cursor = 'default';
  }
  
  /**
   * 获取鼠标世界坐标
   */
  getMouseWorldPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return this.screenToWorld(
      e.clientX - rect.left,
      e.clientY - rect.top
    );
  }
  
  /**
   * 选择端点
   */
  selectPoint(pos) {
    const threshold = CONSTANTS.POINT_SELECT_THRESHOLD / this.scale;
    
    for (const wall of this.app.wallManager.walls) {
      const distStart = Math.hypot(pos.x - wall.start.x, pos.y - wall.start.y);
      const distEnd = Math.hypot(pos.x - wall.end.x, pos.y - wall.end.y);
      
      if (distStart < threshold) {
        this.selectedWall = wall;
        this.selectedPoint = { type: 'start', other: wall.end };
        return;
      }
      if (distEnd < threshold) {
        this.selectedWall = wall;
        this.selectedPoint = { type: 'end', other: wall.start };
        return;
      }
    }
  }
  
  /**
   * 设置交互模式
   */
  setMode(mode) {
    this.mode = mode;
    this.drawStart = null;
    this.tempEnd = null;
    this.selectedPoint = null;
  }
  
  /**
   * 设置激活状态
   */
  setActive(active) {
    this.isActive = active;
    if (this.container) {
      this.container.classList.toggle('active', active);
    }
  }
  
  /**
   * 渲染场景
   */
  render() {
    if (!this.ctx) return;
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = CONSTANTS.COLORS.BACKGROUND_2D;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.drawGrid();
    this.drawWalls();
    this.drawTempWall();
  }
  
  /**
   * 绘制网格
   */
  drawGrid() {
    this.ctx.strokeStyle = CONSTANTS.COLORS.GRID;
    this.ctx.lineWidth = 1;
    
    const step = CONSTANTS.GRID_SIZE * this.scale;
    
    for (let x = this.offset.x % step; x < this.canvas.width; x += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    
    for (let y = this.offset.y % step; y < this.canvas.height; y += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }
  
  /**
   * 绘制所有墙体
   */
  drawWalls() {
    for (const wall of this.app.wallManager.walls) {
      this.drawWall(wall);
    }
  }
  
  /**
   * 绘制单个墙体
   */
  drawWall(wall) {
    const corners = this.app.wallManager.getWallCorners(wall);
    if (!corners) return;
    
    const p1 = this.worldToScreen(corners.p1.x, corners.p1.y);
    const p2 = this.worldToScreen(corners.p2.x, corners.p2.y);
    const p3 = this.worldToScreen(corners.p3.x, corners.p3.y);
    const p4 = this.worldToScreen(corners.p4.x, corners.p4.y);
    
    this.ctx.fillStyle = CONSTANTS.COLORS.WALL_FILL;
    this.ctx.beginPath();
    this.ctx.moveTo(p1.x, p1.y);
    this.ctx.lineTo(p2.x, p2.y);
    this.ctx.lineTo(p3.x, p3.y);
    this.ctx.lineTo(p4.x, p4.y);
    this.ctx.closePath();
    this.ctx.fill();
    
    this.ctx.strokeStyle = CONSTANTS.COLORS.WALL_STROKE;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    
    this.drawWallPoints(wall);
  }
  
  /**
   * 绘制墙体端点
   */
  drawWallPoints(wall) {
    const start = this.worldToScreen(wall.start.x, wall.start.y);
    const end = this.worldToScreen(wall.end.x, wall.end.y);
    
    this.ctx.fillStyle = CONSTANTS.COLORS.POINT;
    this.ctx.beginPath();
    this.ctx.arc(start.x, start.y, CONSTANTS.POINT_RADIUS, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.beginPath();
    this.ctx.arc(end.x, end.y, CONSTANTS.POINT_RADIUS, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  /**
   * 绘制临时墙体
   */
  drawTempWall() {
    if (!this.drawStart || !this.tempEnd) return;
    
    const s = this.worldToScreen(this.drawStart.x, this.drawStart.y);
    const e = this.worldToScreen(this.tempEnd.x, this.tempEnd.y);
    
    this.ctx.strokeStyle = CONSTANTS.COLORS.TEMP_WALL;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.beginPath();
    this.ctx.moveTo(s.x, s.y);
    this.ctx.lineTo(e.x, e.y);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }
}

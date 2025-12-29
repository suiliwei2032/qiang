import { CONSTANTS } from './constants.js';

/**
 * 墙体管理器 - 负责墙体数据的创建、更新和查询
 */
export class WallManager {
  constructor() {
    this.walls = [];
    this.nextId = 1;
    this.wallHeight = CONSTANTS.DEFAULT_WALL_HEIGHT;
    this.wallThickness = CONSTANTS.DEFAULT_WALL_THICKNESS;
  }
  
  /**
   * 创建新墙体
   */
  createWall(startX, startY, endX, endY) {
    const wall = {
      id: this.nextId++,
      start: { x: startX, y: startY },
      end: { x: endX, y: endY },
      height: this.wallHeight,
      thickness: this.wallThickness,
      materials: {}
    };
    this.walls.push(wall);
    return wall;
  }
  
  /**
   * 删除墙体
   */
  removeWall(wallId) {
    const index = this.walls.findIndex(w => w.id === wallId);
    if (index !== -1) {
      this.walls.splice(index, 1);
      return true;
    }
    return false;
  }
  
  /**
   * 获取墙体
   */
  getWall(wallId) {
    return this.walls.find(w => w.id === wallId);
  }
  
  /**
   * 更新墙体端点
   */
  updateWallPoint(wallId, pointType, x, y) {
    const wall = this.getWall(wallId);
    if (wall && (pointType === 'start' || pointType === 'end')) {
      wall[pointType] = { x, y };
      return true;
    }
    return false;
  }
  
  /**
   * 设置默认墙体高度
   */
  setWallHeight(height) {
    if (height > 0) {
      this.wallHeight = height;
    }
  }
  
  /**
   * 设置默认墙体厚度
   */
  setWallThickness(thickness) {
    if (thickness > 0) {
      this.wallThickness = thickness;
    }
  }
  
  /**
   * 计算墙体的四个角点
   */
  getWallCorners(wall) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    if (len === 0) return null;
    
    const nx = -dy / len;
    const ny = dx / len;
    const offset = wall.thickness / 2;
    
    return {
      p1: { x: wall.start.x + nx * offset, y: wall.start.y + ny * offset },
      p2: { x: wall.start.x - nx * offset, y: wall.start.y - ny * offset },
      p3: { x: wall.end.x - nx * offset, y: wall.end.y - ny * offset },
      p4: { x: wall.end.x + nx * offset, y: wall.end.y + ny * offset }
    };
  }
  
  /**
   * 清空所有墙体
   */
  clear() {
    this.walls = [];
    this.nextId = 1;
  }
}

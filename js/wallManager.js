console.log('=== WALLMANAGER.JS 开始加载 ===');

/**
 * 墙体管理器
 * 负责墙体数据的存储、管理和操作
 */
class WallManager {
    constructor() {
        this.walls = [];
        this.currentMode = null;
        this.renderCallback = null;
    }
    
    /**
     * 设置渲染回调函数
     */
    setRenderCallback(callback) {
        this.renderCallback = callback;
    }
    
    /**
     * 获取当前模式
     */
    getCurrentMode() {
        return this.currentMode;
    }
    
    /**
     * 设置当前模式
     */
    setCurrentMode(mode) {
        this.currentMode = mode;
        console.log('墙体管理器模式切换:', mode);
    }
    
    /**
     * 添加墙体
     */
    addWall(wall) {
        this.walls.push(wall);
        console.log('添加墙体:', wall);
        console.log('当前墙体总数:', this.walls.length);
        
        // 触发渲染更新
        if (this.renderCallback) {
            this.renderCallback();
        }
    }
    
    /**
     * 获取所有墙体
     */
    getAllWalls() {
        return this.walls;
    }
    
    /**
     * 获取墙体数量
     */
    getWallCount() {
        return this.walls.length;
    }
    
    /**
     * 更新墙体端点
     */
    updateWallPoint(wall, point, coords) {
        if (wall && (point === 'start' || point === 'end')) {
            wall[point] = coords;
            console.log('更新墙体端点:', point, coords);
            
            // 触发渲染更新
            if (this.renderCallback) {
                this.renderCallback();
            }
        }
    }
    
    /**
     * 清空所有墙体
     */
    clearAll() {
        console.log('清空所有墙体');
        this.walls = [];
        
        // 触发渲染更新
        if (this.renderCallback) {
            this.renderCallback();
        }
    }
    
    /**
     * 根据ID查找墙体
     */
    findWallById(id) {
        return this.walls.find(wall => wall.id === id);
    }
    
    /**
     * 删除墙体
     */
    removeWall(wall) {
        const index = this.walls.indexOf(wall);
        if (index > -1) {
            this.walls.splice(index, 1);
            console.log('删除墙体，剩余:', this.walls.length);
            
            // 触发渲染更新
            if (this.renderCallback) {
                this.renderCallback();
            }
        }
    }
    
    /**
     * 获取项目统计信息
     */
    getProjectStats() {
        const stats = {
            wallCount: this.walls.length,
            totalLength: 0,
            averageThickness: 0
        };
        
        if (this.walls.length > 0) {
            let totalThickness = 0;
            
            this.walls.forEach(wall => {
                // 计算墙体长度
                const dx = wall.end.x - wall.start.x;
                const dy = wall.end.y - wall.start.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                stats.totalLength += length;
                
                // 累计厚度
                totalThickness += wall.thickness || 200;
            });
            
            stats.averageThickness = totalThickness / this.walls.length;
        }
        
        return stats;
    }
}

// 导出到全局
window.WallManager = WallManager;

console.log('=== WALLMANAGER.JS 加载完成 ===');
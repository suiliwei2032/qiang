// 2D 画布渲染模块
export class Canvas2DManager {
    constructor(app) {
        this.app = app;
    }

    render() {
        if (!this.app.ctx2d) return;
        
        const ctx = this.app.ctx2d;
        const width = this.app.canvas2d.width;
        const height = this.app.canvas2d.height;
        
        // 清空画布
        ctx.fillStyle = '#001133';
        ctx.fillRect(0, 0, width, height);
        
        // 设置坐标系
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(this.app.scale * 50, -this.app.scale * 50);
        ctx.translate(-this.app.offset.x, -this.app.offset.y);
        
        // 绘制网格
        this.drawGrid(ctx);
        
        // 绘制墙体
        this.drawWalls(ctx);
        
        // 绘制临时线段
        if (this.app.tempLine) {
            ctx.strokeStyle = '#88ff88';
            ctx.setLineDash([0.05, 0.05]);
            ctx.lineWidth = 0.03;
            ctx.beginPath();
            ctx.moveTo(this.app.tempLine.start.x, this.app.tempLine.start.y);
            ctx.lineTo(this.app.tempLine.end.x, this.app.tempLine.end.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        ctx.restore();
    }

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

    drawWalls(ctx) {
        this.app.walls.forEach((wall) => {
            // 绘制墙体轮廓
            const polygon = this.app.wallGeometry.generateWallPolygon(wall.start, wall.end, wall.thickness);
            
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

    screenToWorld(screenX, screenY) {
        const centerX = this.app.canvas2d.width / 2;
        const centerY = this.app.canvas2d.height / 2;
        
        const pixelX = screenX - centerX;
        const pixelY = screenY - centerY;
        
        const worldX = (pixelX / (this.app.scale * 50)) + this.app.offset.x;
        const worldY = -(pixelY / (this.app.scale * 50)) + this.app.offset.y;
        
        return { x: worldX, y: worldY };
    }

    resizeCanvas() {
        if (!this.app.canvas2d) return;
        
        const container2d = this.app.canvas2d.parentElement;
        const rect2d = container2d.getBoundingClientRect();
        
        this.app.canvas2d.width = rect2d.width;
        this.app.canvas2d.height = rect2d.height;
        
        console.log('2D画布大小:', rect2d.width, 'x', rect2d.height);
    }
}

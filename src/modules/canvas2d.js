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

    /**
     * 绘制多个多边形到画布（保持真实比例，高分辨率）
     */
    drawPolygonsToCanvas(ctx, canvas, polygons, faceType) {
        if (!polygons || polygons.length === 0) return;

        const displayWidth = canvas.width;
        const displayHeight = canvas.height;

        // 清空画布
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, displayWidth, displayHeight);

        // 计算边界
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

        // 计算缩放和平移
        const padding = 50;
        const width = maxX - minX;
        const height = maxY - minY;

        if (width === 0 || height === 0) return;

        const scaleX = (displayWidth - padding * 2) / width;
        const scaleY = (displayHeight - padding * 2) / height;
        const scale = Math.min(scaleX, scaleY);

        const dpr = window.devicePixelRatio || 1;
        // console.log(`画布尺寸: ${displayWidth}x${displayHeight}, DPR: ${dpr}`);
        // console.log(`轮廓范围: ${width.toFixed(3)}x${height.toFixed(3)}m`);
        // console.log(`缩放比例: ${scale.toFixed(2)}`);

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

        // console.log(`开始绘制 ${polygons.length} 个多边形`);

        polygons.forEach((polygon, idx) => {
            // console.log(`绘制多边形 ${idx}, 顶点数: ${polygon.length}`);

            ctx.beginPath();
            const startX = toCanvasX(polygon[0].x);
            const startY = toCanvasY(polygon[0].y);
            ctx.moveTo(startX, startY);

            for (let i = 1; i < polygon.length; i++) {
                const x = toCanvasX(polygon[i].x);
                const y = toCanvasY(polygon[i].y);
                ctx.lineTo(x, y);
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

        // console.log('轮廓已绘制到画布（高分辨率）');
    }
}

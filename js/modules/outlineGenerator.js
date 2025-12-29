/**
 * 轮廓生成器模块
 * 负责从2D墙体数据生成侧面轮廓（考虑穿插和遮挡）
 */
export class OutlineGenerator {
    constructor() {
        this.tolerance = 0.001;
    }

    /**
     * 获取墙体顶面/底面的矩形轮廓（俯视图）
     */
    getTopBottomRectangle(wall) {
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return [];
        
        const normalX = -dy / length;
        const normalY = dx / length;
        const halfThickness = (wall.thickness / 1000) / 2;
        
        // 墙体的4个角点（逆时针）
        return [
            { x: wall.start.x + normalX * halfThickness, y: wall.start.y + normalY * halfThickness },
            { x: wall.end.x + normalX * halfThickness, y: wall.end.y + normalY * halfThickness },
            { x: wall.end.x - normalX * halfThickness, y: wall.end.y - normalY * halfThickness },
            { x: wall.start.x - normalX * halfThickness, y: wall.start.y - normalY * halfThickness }
        ];
    }

    /**
     * 判断选中的是哪个侧面
     * 注意：3D几何体经过rotateX(-90度)，坐标映射关系为：
     * 2D(x,y) -> 3D(x, height, -y)
     * 所以2D的y对应3D的-z
     */
    determineFaceType(wall, normal3D) {
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return '未知';
        
        // 墙体方向向量（单位向量，从start到end）
        const dirX = dx / length;
        const dirY = dy / length;
        
        // 墙体法向量（垂直于方向，指向右侧）
        const normalX = -dy / length;
        const normalY = dx / length;
        
        // 关键修正：由于3D几何体经过rotateX(-90度)
        // 2D的y坐标对应3D的-z坐标
        // 所以在计算点积时，需要使用-normal3D.z
        
        // 前侧面：法向量与墙体法向量同向（墙体右侧）
        const dotFront = normal3D.x * normalX + (-normal3D.z) * normalY;
        
        // 后侧面：法向量与墙体法向量反向（墙体左侧）
        const dotBack = normal3D.x * (-normalX) + (-normal3D.z) * (-normalY);
        
        // 左侧面：法向量与墙体方向反向（墙体起点端）
        const dotLeft = normal3D.x * (-dirX) + (-normal3D.z) * (-dirY);
        
        // 右侧面：法向量与墙体方向同向（墙体终点端）
        const dotRight = normal3D.x * dirX + (-normal3D.z) * dirY;
        
        console.log(`  墙体方向(2D): (${dirX.toFixed(2)}, ${dirY.toFixed(2)})`);
        console.log(`  墙体法向(2D): (${normalX.toFixed(2)}, ${normalY.toFixed(2)})`);
        console.log(`  3D法向: (${normal3D.x.toFixed(2)}, ${normal3D.y.toFixed(2)}, ${normal3D.z.toFixed(2)})`);
        console.log(`  点积: 前=${dotFront.toFixed(2)}, 后=${dotBack.toFixed(2)}, 左=${dotLeft.toFixed(2)}, 右=${dotRight.toFixed(2)}`);
        
        const maxDot = Math.max(Math.abs(dotFront), Math.abs(dotBack), Math.abs(dotLeft), Math.abs(dotRight));
        
        if (Math.abs(dotFront) === maxDot) return '前侧面';
        if (Math.abs(dotBack) === maxDot) return '后侧面';
        if (Math.abs(dotLeft) === maxDot) return '左侧面';
        if (Math.abs(dotRight) === maxDot) return '右侧面';
        
        return '未知';
    }

    /**
     * 获取墙体侧面的轮廓（立面图）
     * 考虑穿插墙体的遮挡，可能返回多个矩形或几字形
     */
    getSideRectangles(wall, normal3D, allWalls) {
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const height = wall.height / 1000;
        const thickness = wall.thickness / 1000;
        
        if (length === 0) return [];
        
        // 判断是哪个侧面
        const faceType = this.determineFaceType(wall, normal3D);
        
        // 计算墙体分段（考虑穿插）
        const segments = this.calculateWallSegments(wall, faceType, allWalls);
        
        console.log(`${faceType}分段结果: ${segments.length} 个多边形`);
        return segments;
    }

    /**
     * 计算墙体在侧面上的分段（考虑穿插墙体的遮挡）
     * 返回多个多边形（可能是矩形或几字形）
     */
    calculateWallSegments(wall, faceType, allWalls) {
        const wallIndex = allWalls.indexOf(wall);
        const height = wall.height / 1000;
        
        // 根据面类型确定宽度
        let width;
        if (faceType === '前侧面' || faceType === '后侧面') {
            const dx = wall.end.x - wall.start.x;
            const dy = wall.end.y - wall.start.y;
            width = Math.sqrt(dx * dx + dy * dy);
        } else {
            width = wall.thickness / 1000;
        }
        
        console.log('\n=== 计算墙体分段 ===');
        console.log(`墙体索引: ${wallIndex}, 面类型: ${faceType}, 宽度: ${width.toFixed(3)}m, 高度: ${height.toFixed(3)}m`);
        
        // 收集所有穿插信息
        const intersections = [];
        
        allWalls.forEach((otherWall, otherIndex) => {
            if (otherIndex === wallIndex) return;
            
            const otherHeight = otherWall.height / 1000;
            const heightDiff = otherHeight - height;
            
            const intersection = this.calculateWallIntersection(wall, otherWall, faceType);
            
            if (intersection) {
                intersections.push({
                    start: intersection.start,
                    end: intersection.end,
                    otherHeight: otherHeight,
                    heightDiff: heightDiff,
                    otherIndex: otherIndex
                });
                console.log(`  墙体 ${otherIndex} 遮挡区间: [${intersection.start.toFixed(3)}, ${intersection.end.toFixed(3)}], 高度差=${heightDiff.toFixed(3)}m`);
            }
        });
        
        if (intersections.length === 0) {
            // 没有遮挡，返回完整矩形
            return [[
                { x: 0, y: 0 },
                { x: width, y: 0 },
                { x: width, y: height },
                { x: 0, y: height }
            ]];
        }
        
        // 按起始位置排序
        intersections.sort((a, b) => a.start - b.start);
        
        // 检查是否所有交集都是高度一致的（完全遮挡）
        const allSameHeight = intersections.every(inter => Math.abs(inter.heightDiff) < this.tolerance);
        
        if (allSameHeight) {
            // 所有交集都是高度一致，生成多个独立矩形
            console.log('生成多个独立矩形');
            return this.generateSeparateRectangles(intersections, width, height);
        }
        
        // 有高度差异，需要分段处理
        console.log('有高度差异，分段生成多边形');
        return this.generateMixedPolygons(intersections, width, height);
    }

    /**
     * 生成混合多边形（有高度差异的情况）
     */
    generateMixedPolygons(intersections, width, height) {
        console.log('\n=== 生成混合多边形 ===');
        console.log(`输入参数: width=${width.toFixed(3)}, height=${height.toFixed(3)}, 交集数=${intersections.length}`);
        
        // 检查是否有高度一致的交集（完全截断）
        const fullBlockIndices = [];
        intersections.forEach((inter, idx) => {
            if (Math.abs(inter.heightDiff) < this.tolerance) {
                fullBlockIndices.push(idx);
            }
        });
        
        if (fullBlockIndices.length > 0) {
            // 有完全截断，按截断位置分割成多个独立的多边形
            console.log(`检测到 ${fullBlockIndices.length} 个完全截断位置`);
            return this.generatePolygonsWithBreaks(intersections, width, height, fullBlockIndices);
        } else {
            // 没有完全截断，生成一个完整的多边形
            console.log('没有完全截断，生成一个完整多边形');
            return this.generateSinglePolygonWithNotches(intersections, width, height);
        }
    }

    /**
     * 生成带断点的多个多边形
     */
    generatePolygonsWithBreaks(intersections, width, height, fullBlockIndices) {
        const polygons = [];
        let segmentStart = 0;
        
        // 按完全截断位置分割
        fullBlockIndices.forEach(blockIdx => {
            const blockInter = intersections[blockIdx];
            
            // 生成从segmentStart到blockInter.start的多边形
            if (blockInter.start > segmentStart + this.tolerance) {
                const segmentIntersections = intersections.filter((inter, idx) => 
                    idx < blockIdx && inter.end > segmentStart && inter.start < blockInter.start
                );
                
                const segmentWidth = blockInter.start - segmentStart;
                const poly = this.generateSegmentPolygon(segmentIntersections, segmentStart, segmentWidth, height);
                if (poly.length > 0) {
                    polygons.push(poly);
                }
            }
            
            segmentStart = blockInter.end;
        });
        
        // 处理最后一段
        if (segmentStart < width - this.tolerance) {
            const segmentIntersections = intersections.filter(inter => 
                inter.end > segmentStart && inter.start < width && Math.abs(inter.heightDiff) >= this.tolerance
            );
            
            const segmentWidth = width - segmentStart;
            const poly = this.generateSegmentPolygon(segmentIntersections, segmentStart, segmentWidth, height);
            if (poly.length > 0) {
                polygons.push(poly);
            }
        }
        
        console.log(`生成 ${polygons.length} 个多边形`);
        return polygons;
    }

    /**
     * 生成一个段的多边形（从offset开始，宽度为segmentWidth）
     */
    generateSegmentPolygon(intersections, offset, segmentWidth, height) {
        const points = [];
        let currentX = offset;
        
        console.log(`  段多边形: offset=${offset.toFixed(3)}, width=${segmentWidth.toFixed(3)}, 交集数=${intersections.length}`);
        
        // 从左下角开始
        points.push({ x: offset, y: 0 });
        console.log(`    点1: (${offset.toFixed(3)}, 0) - 左下角`);
        
        // 沿底部向右，处理所有交集
        intersections.forEach((inter, idx) => {
            if (inter.heightDiff < 0) {
                // 穿插墙更矮，添加凹陷
                const lowerHeight = inter.otherHeight;
                
                // 到达凹陷起点（如果还没到）
                if (inter.start > currentX + this.tolerance) {
                    points.push({ x: inter.start, y: 0 });
                    console.log(`    点${points.length}: (${inter.start.toFixed(3)}, 0) - 到达凹陷前`);
                }
                
                // 上升到低高度
                points.push({ x: inter.start, y: lowerHeight });
                console.log(`    点${points.length}: (${inter.start.toFixed(3)}, ${lowerHeight.toFixed(3)}) - 上升`);
                
                // 横跨凹陷
                points.push({ x: inter.end, y: lowerHeight });
                console.log(`    点${points.length}: (${inter.end.toFixed(3)}, ${lowerHeight.toFixed(3)}) - 横跨`);
                
                // 下降回底部
                points.push({ x: inter.end, y: 0 });
                console.log(`    点${points.length}: (${inter.end.toFixed(3)}, 0) - 下降`);
                
                currentX = inter.end;
            }
        });
        
        // 到达右下角（如果还没到）
        const rightX = offset + segmentWidth;
        if (rightX > currentX + this.tolerance) {
            points.push({ x: rightX, y: 0 });
            console.log(`    点${points.length}: (${rightX.toFixed(3)}, 0) - 右下角`);
        }
        
        // 右上角
        points.push({ x: rightX, y: height });
        console.log(`    点${points.length}: (${rightX.toFixed(3)}, ${height.toFixed(3)}) - 右上角`);
        
        // 左上角
        points.push({ x: offset, y: height });
        console.log(`    点${points.length}: (${offset.toFixed(3)}, ${height.toFixed(3)}) - 左上角`);
        
        console.log(`  段多边形完成，顶点数: ${points.length}`);
        return points;
    }

    /**
     * 生成一个完整的多边形（没有完全截断的情况）
     */
    generateSinglePolygonWithNotches(intersections, width, height) {
        const points = [];
        let currentX = 0;
        
        // 从左下角开始
        points.push({ x: 0, y: 0 });
        console.log(`添加点: (0, 0)`);
        
        // 沿底部向右，处理所有交集
        intersections.forEach((inter, idx) => {
            console.log(`处理交集${idx}: start=${inter.start.toFixed(3)}, end=${inter.end.toFixed(3)}, heightDiff=${inter.heightDiff.toFixed(3)}`);
            
            if (inter.heightDiff < 0) {
                // 穿插墙更矮，需要绕过凹陷
                const lowerHeight = inter.otherHeight;
                
                // 到达凹陷前
                if (inter.start > currentX + this.tolerance) {
                    points.push({ x: inter.start, y: 0 });
                    console.log(`  添加点: (${inter.start.toFixed(3)}, 0)`);
                }
                
                // 上升到低高度
                points.push({ x: inter.start, y: lowerHeight });
                console.log(`  添加点: (${inter.start.toFixed(3)}, ${lowerHeight.toFixed(3)})`);
                
                // 跨过凹陷
                points.push({ x: inter.end, y: lowerHeight });
                console.log(`  添加点: (${inter.end.toFixed(3)}, ${lowerHeight.toFixed(3)})`);
                
                // 下降回底部
                points.push({ x: inter.end, y: 0 });
                console.log(`  添加点: (${inter.end.toFixed(3)}, 0)`);
                
                currentX = inter.end;
            }
        });
        
        // 右下角
        if (width > currentX + this.tolerance) {
            points.push({ x: width, y: 0 });
            console.log(`添加点: (${width.toFixed(3)}, 0)`);
        }
        
        // 右上角
        points.push({ x: width, y: height });
        console.log(`添加点: (${width.toFixed(3)}, ${height.toFixed(3)})`);
        
        // 左上角
        points.push({ x: 0, y: height });
        console.log(`添加点: (0, ${height.toFixed(3)})`);
        
        console.log(`完整多边形顶点数: ${points.length}`);
        return [points];
    }

    /**
     * 生成多个独立的矩形（高度一致的情况）
     */
    generateSeparateRectangles(intersections, width, height) {
        const segments = [];
        let lastEnd = 0;
        
        intersections.forEach(inter => {
            if (inter.start > lastEnd + this.tolerance) {
                // 添加未被遮挡的段
                segments.push([
                    { x: lastEnd, y: 0 },
                    { x: inter.start, y: 0 },
                    { x: inter.start, y: height },
                    { x: lastEnd, y: height }
                ]);
                console.log(`  添加矩形段: [${lastEnd.toFixed(3)}, ${inter.start.toFixed(3)}]`);
            }
            lastEnd = inter.end;
        });
        
        // 添加最后一段
        if (lastEnd < width - this.tolerance) {
            segments.push([
                { x: lastEnd, y: 0 },
                { x: width, y: 0 },
                { x: width, y: height },
                { x: lastEnd, y: height }
            ]);
            console.log(`  添加最后矩形段: [${lastEnd.toFixed(3)}, ${width.toFixed(3)}]`);
        }
        
        return segments;
    }

    /**
     * 计算另一个墙体在当前墙体侧面上的遮挡区间
     */
    calculateWallIntersection(wall, otherWall, faceType) {
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        const dirX = dx / length;
        const dirY = dy / length;
        const normalX = -dy / length;
        const normalY = dx / length;
        
        const halfThickness = (wall.thickness / 1000) / 2;
        const otherHalfThickness = (otherWall.thickness / 1000) / 2;
        
        // 计算另一个墙体的矩形
        const odx = otherWall.end.x - otherWall.start.x;
        const ody = otherWall.end.y - otherWall.start.y;
        const olen = Math.sqrt(odx * odx + ody * ody);
        
        if (olen === 0) return null;
        
        const onx = -ody / olen;
        const ony = odx / olen;
        
        const otherRect = [
            { x: otherWall.start.x + onx * otherHalfThickness, y: otherWall.start.y + ony * otherHalfThickness },
            { x: otherWall.end.x + onx * otherHalfThickness, y: otherWall.end.y + ony * otherHalfThickness },
            { x: otherWall.end.x - onx * otherHalfThickness, y: otherWall.end.y - ony * otherHalfThickness },
            { x: otherWall.start.x - onx * otherHalfThickness, y: otherWall.start.y - ony * otherHalfThickness }
        ];
        
        // 确定当前墙体的侧面线
        let faceLine, referencePoint, projectionDir;
        
        if (faceType === '前侧面') {
            faceLine = {
                start: { x: wall.start.x + normalX * halfThickness, y: wall.start.y + normalY * halfThickness },
                end: { x: wall.end.x + normalX * halfThickness, y: wall.end.y + normalY * halfThickness }
            };
            referencePoint = wall.start;
            projectionDir = { x: dirX, y: dirY };
        } else if (faceType === '后侧面') {
            faceLine = {
                start: { x: wall.start.x - normalX * halfThickness, y: wall.start.y - normalY * halfThickness },
                end: { x: wall.end.x - normalX * halfThickness, y: wall.end.y - normalY * halfThickness }
            };
            referencePoint = wall.start;
            projectionDir = { x: dirX, y: dirY };
        } else if (faceType === '左侧面') {
            faceLine = {
                start: { x: wall.start.x - normalX * halfThickness, y: wall.start.y - normalY * halfThickness },
                end: { x: wall.start.x + normalX * halfThickness, y: wall.start.y + normalY * halfThickness }
            };
            referencePoint = { x: wall.start.x - normalX * halfThickness, y: wall.start.y - normalY * halfThickness };
            projectionDir = { x: normalX, y: normalY };
        } else if (faceType === '右侧面') {
            faceLine = {
                start: { x: wall.end.x - normalX * halfThickness, y: wall.end.y - normalY * halfThickness },
                end: { x: wall.end.x + normalX * halfThickness, y: wall.end.y + normalY * halfThickness }
            };
            referencePoint = { x: wall.end.x - normalX * halfThickness, y: wall.end.y - normalY * halfThickness };
            projectionDir = { x: normalX, y: normalY };
        } else {
            return null;
        }
        
        // 将另一个墙体的4个角点投影到侧面线上
        const projections = otherRect.map(p => {
            const dx = p.x - referencePoint.x;
            const dy = p.y - referencePoint.y;
            return dx * projectionDir.x + dy * projectionDir.y;
        });
        
        const minProj = Math.min(...projections);
        const maxProj = Math.max(...projections);
        
        // 计算侧面的宽度
        let faceWidth;
        if (faceType === '前侧面' || faceType === '后侧面') {
            faceWidth = length;
        } else {
            faceWidth = wall.thickness / 1000;
        }
        
        // 检查是否有交集
        if (maxProj < -this.tolerance || minProj > faceWidth + this.tolerance) {
            return null;
        }
        
        // 限制在侧面范围内
        const start = Math.max(0, minProj);
        const end = Math.min(faceWidth, maxProj);
        
        if (end - start < this.tolerance) {
            return null;
        }
        
        return { start, end };
    }
}

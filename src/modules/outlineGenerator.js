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
     * 考虑穿插，返回带洞的多边形数据
     */
    getTopBottomRectangle(wall, allWalls = null, wallIndex = -1) {
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return { outer: [], holes: [] };
        
        const normalX = -dy / length;
        const normalY = dx / length;
        const halfThickness = (wall.thickness / 1000) / 2;
        
        // 墙体的4个角点（逆时针）
        const outer = [
            { x: wall.start.x - normalX * halfThickness, y: wall.start.y - normalY * halfThickness }, // 左后
            { x: wall.end.x - normalX * halfThickness, y: wall.end.y - normalY * halfThickness },     // 右后
            { x: wall.end.x + normalX * halfThickness, y: wall.end.y + normalY * halfThickness },     // 右前
            { x: wall.start.x + normalX * halfThickness, y: wall.start.y + normalY * halfThickness }  // 左前
        ];
        
        // 如果没有提供其他墙体信息，返回简单矩形
        if (!allWalls || wallIndex === -1) {
            return { outer: outer, holes: [] };
        }
        
        // 计算穿插的洞
        const holes = [];
        
        allWalls.forEach((otherWall, otherIndex) => {
            if (otherIndex === wallIndex) return;
            
            // 计算另一个墙体的矩形
            const otherRect = this.getWallRectangle(otherWall);
            
            // 计算交集（作为洞）
            const intersection = this.calculatePolygonIntersection(otherRect, outer);
            
            if (intersection && intersection.length >= 3) {
                console.log(`  墙体 ${wallIndex} 的顶面被墙体 ${otherIndex} 穿插，洞的顶点数: ${intersection.length}`);
                holes.push(intersection);
            }
        });
        
        return { outer: outer, holes: holes };
    }
    
    /**
     * 获取墙体的矩形（4个角点）
     */
    getWallRectangle(wall) {
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return [];
        
        const normalX = -dy / length;
        const normalY = dx / length;
        const halfThickness = (wall.thickness / 1000) / 2;
        
        return [
            { x: wall.start.x - normalX * halfThickness, y: wall.start.y - normalY * halfThickness },
            { x: wall.end.x - normalX * halfThickness, y: wall.end.y - normalY * halfThickness },
            { x: wall.end.x + normalX * halfThickness, y: wall.end.y + normalY * halfThickness },
            { x: wall.start.x + normalX * halfThickness, y: wall.start.y + normalY * halfThickness }
        ];
    }
    
    /**
     * 计算两个多边形的交集（Sutherland-Hodgman算法）
     */
    calculatePolygonIntersection(subject, clip) {
        // subject: 要裁剪的多边形（穿插墙体）
        // clip: 裁剪窗口（当前墙体）
        
        let output = subject.slice();
        
        // 对clip的每条边进行裁剪
        for (let i = 0; i < clip.length; i++) {
            if (output.length === 0) break;
            
            const input = output;
            output = [];
            
            const edge1 = clip[i];
            const edge2 = clip[(i + 1) % clip.length];
            
            for (let j = 0; j < input.length; j++) {
                const current = input[j];
                const next = input[(j + 1) % input.length];
                
                const currentInside = this.isPointLeftOfEdge(current, edge1, edge2);
                const nextInside = this.isPointLeftOfEdge(next, edge1, edge2);
                
                if (currentInside) {
                    if (nextInside) {
                        // 两个点都在内部，添加next
                        output.push(next);
                    } else {
                        // current在内部，next在外部，添加交点
                        const intersection = this.lineIntersection(current, next, edge1, edge2);
                        if (intersection) output.push(intersection);
                    }
                } else if (nextInside) {
                    // current在外部，next在内部，添加交点和next
                    const intersection = this.lineIntersection(current, next, edge1, edge2);
                    if (intersection) output.push(intersection);
                    output.push(next);
                }
            }
        }
        
        return output;
    }
    
    /**
     * 判断点是否在边的左侧（内侧）
     */
    isPointLeftOfEdge(point, edgeStart, edgeEnd) {
        return ((edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y) - 
                (edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x)) >= -this.tolerance;
    }
    
    /**
     * 计算两条线段的交点
     */
    lineIntersection(p1, p2, p3, p4) {
        const x1 = p1.x, y1 = p1.y;
        const x2 = p2.x, y2 = p2.y;
        const x3 = p3.x, y3 = p3.y;
        const x4 = p4.x, y4 = p4.y;
        
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        
        if (Math.abs(denom) < this.tolerance) return null;
        
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        
        return {
            x: x1 + t * (x2 - x1),
            y: y1 + t * (y2 - y1)
        };
    }
    
    /**
     * 判断点是否在多边形内部（射线法）
     */
    isPointInPolygon(point, polygon) {
        let inside = false;
        
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            
            const intersect = ((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            
            if (intersect) inside = !inside;
        }
        
        return inside;
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
     * 返回格式：[{ outer: [...], holes: [] }, { outer: [...], holes: [] }, ...]
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
        
        console.log(`\n=== 计算 ${faceType} 的分段 ===`);
        console.log(`墙体尺寸: 宽=${faceType.includes('侧面') ? (faceType.includes('左') || faceType.includes('右') ? thickness : length) : length}m, 高=${height}m`);
        
        // 计算墙体分段（考虑穿插和高度差异）
        const segments = this.calculateWallSegmentsWithHeight(wall, faceType, allWalls);
        
        console.log(`${faceType}分段结果: ${segments.length} 个面`);
        return segments;
    }
    
    /**
     * 计算墙体侧面的分段（考虑高度差异）
     * 返回多个独立的面，每个面都是 { outer: [...], holes: [] }
     */
    calculateWallSegmentsWithHeight(wall, faceType, allWalls) {
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
        
        // 收集所有穿插信息（包括高度）
        const intersections = [];
        
        allWalls.forEach((otherWall, otherIndex) => {
            if (otherIndex === wallIndex) return;
            
            const otherHeight = otherWall.height / 1000;
            const intersection = this.calculateWallIntersection(wall, otherWall, faceType);
            
            if (intersection) {
                intersections.push({
                    start: intersection.start,
                    end: intersection.end,
                    otherHeight: otherHeight,
                    heightDiff: otherHeight - height,
                    otherIndex: otherIndex
                });
                console.log(`  与墙体 ${otherIndex} 穿插: [${intersection.start.toFixed(3)}, ${intersection.end.toFixed(3)}], 高度=${otherHeight.toFixed(3)}m, 高度差=${(otherHeight - height).toFixed(3)}m`);
            }
        });
        
        if (intersections.length === 0) {
            // 没有穿插，返回完整矩形
            return [{
                outer: [
                    { x: 0, y: 0 },
                    { x: width, y: 0 },
                    { x: width, y: height },
                    { x: 0, y: height }
                ],
                holes: []
            }];
        }
        
        // 按起始位置排序
        intersections.sort((a, b) => a.start - b.start);
        
        // 生成分段面
        return this.generateSegmentedFaces(intersections, width, height);
    }
    
    /**
     * 生成分段的面（考虑高度差异）
     * 当有高度差时，不连接顶部和底部，而是生成独立的闭合区域
     */
    generateSegmentedFaces(intersections, width, height) {
        console.log(`\n  === 生成整体多边形（包含所有分段） ===`);
        console.log(`  总宽度: ${width.toFixed(3)}m, 总高度: ${height.toFixed(3)}m`);
        console.log(`  穿插数: ${intersections.length}`);
        
        // 检查是否有高度差异
        const hasHeightDiff = intersections.some(inter => Math.abs(inter.heightDiff) > this.tolerance);
        
        if (!hasHeightDiff) {
            // 没有高度差异，生成简单的整体多边形
            return this.generateSimplePolygon(intersections, width, height);
        }
        
        // 有高度差异，生成多个独立的闭合区域
        return this.generateSeparateRegions(intersections, width, height);
    }
    
    /**
     * 生成简单的整体多边形（没有高度差异）
     */
    generateSimplePolygon(intersections, width, height) {
        console.log(`  生成简单整体多边形（无高度差）`);
        
        const points = [];
        let currentX = 0;
        
        // 沿底部向右
        points.push({ x: 0, y: 0 });
        
        intersections.forEach(inter => {
            if (inter.start > currentX + this.tolerance) {
                points.push({ x: inter.start, y: 0 });
            }
            currentX = inter.end;
        });
        
        if (currentX < width - this.tolerance) {
            points.push({ x: width, y: 0 });
        }
        
        // 右上角
        points.push({ x: width, y: height });
        
        // 沿顶部向左
        for (let i = intersections.length - 1; i >= 0; i--) {
            const inter = intersections[i];
            if (i === intersections.length - 1 || inter.end < width - this.tolerance) {
                points.push({ x: inter.end, y: height });
            }
        }
        
        // 左上角
        if (intersections.length === 0 || intersections[0].start > this.tolerance) {
            points.push({ x: 0, y: height });
        }
        
        console.log(`  生成 ${points.length} 个顶点`);
        
        return [{
            outer: points,
            holes: []
        }];
    }
    
    /**
     * 生成多个独立的闭合区域（有高度差异）
     */
    generateSeparateRegions(intersections, width, height) {
        console.log(`  生成多个独立闭合区域（有高度差）`);
        
        const regions = [];
        let currentX = 0;
        
        intersections.forEach((inter, idx) => {
            // 1. 穿插前的完整区域
            if (inter.start > currentX + this.tolerance) {
                const region = [
                    { x: currentX, y: 0 },
                    { x: inter.start, y: 0 },
                    { x: inter.start, y: height },
                    { x: currentX, y: height }
                ];
                regions.push({
                    outer: region,
                    holes: []
                });
                console.log(`  区域${regions.length}: [${currentX.toFixed(3)}, ${inter.start.toFixed(3)}] × [0, ${height.toFixed(3)}]`);
            }
            
            // 2. 穿插区域的高差补齐部分
            if (inter.heightDiff < -this.tolerance) {
                const lowerHeight = inter.otherHeight;
                const region = [
                    { x: inter.start, y: lowerHeight },
                    { x: inter.end, y: lowerHeight },
                    { x: inter.end, y: height },
                    { x: inter.start, y: height }
                ];
                regions.push({
                    outer: region,
                    holes: []
                });
                console.log(`  区域${regions.length}: [${inter.start.toFixed(3)}, ${inter.end.toFixed(3)}] × [${lowerHeight.toFixed(3)}, ${height.toFixed(3)}]`);
            }
            
            currentX = inter.end;
        });
        
        // 3. 最后一个区域
        if (currentX < width - this.tolerance) {
            const region = [
                { x: currentX, y: 0 },
                { x: width, y: 0 },
                { x: width, y: height },
                { x: currentX, y: height }
            ];
            regions.push({
                outer: region,
                holes: []
            });
            console.log(`  区域${regions.length}: [${currentX.toFixed(3)}, ${width.toFixed(3)}] × [0, ${height.toFixed(3)}]`);
        }
        
        console.log(`  总共生成 ${regions.length} 个独立区域`);
        return regions;
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
     * 使用2D多边形相交，支持任意角度的墙体
     */
    calculateWallIntersection(wall, otherWall, faceType) {
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return null;
        
        const dirX = dx / length;
        const dirY = dy / length;
        const normalX = -dy / length;
        const normalY = dx / length;
        
        const halfThickness = (wall.thickness / 1000) / 2;
        
        // 计算当前墙体侧面的线段（2D）
        let faceLine;
        
        if (faceType === '前侧面') {
            faceLine = {
                start: { x: wall.start.x + normalX * halfThickness, y: wall.start.y + normalY * halfThickness },
                end: { x: wall.end.x + normalX * halfThickness, y: wall.end.y + normalY * halfThickness }
            };
        } else if (faceType === '后侧面') {
            faceLine = {
                start: { x: wall.start.x - normalX * halfThickness, y: wall.start.y - normalY * halfThickness },
                end: { x: wall.end.x - normalX * halfThickness, y: wall.end.y - normalY * halfThickness }
            };
        } else if (faceType === '左侧面') {
            faceLine = {
                start: { x: wall.start.x - normalX * halfThickness, y: wall.start.y - normalY * halfThickness },
                end: { x: wall.start.x + normalX * halfThickness, y: wall.start.y + normalY * halfThickness }
            };
        } else if (faceType === '右侧面') {
            faceLine = {
                start: { x: wall.end.x - normalX * halfThickness, y: wall.end.y - normalY * halfThickness },
                end: { x: wall.end.x + normalX * halfThickness, y: wall.end.y + normalY * halfThickness }
            };
        } else {
            return null;
        }
        
        // 计算另一个墙体的矩形
        const otherRect = this.getWallRectangle(otherWall);
        
        if (otherRect.length === 0) return null;
        
        // 检查另一个墙体的矩形是否与侧面线相交
        // 方法：检查矩形的4条边是否与侧面线相交
        const intersectionPoints = [];
        
        // 1. 检查矩形的每条边与侧面线的交点
        for (let i = 0; i < otherRect.length; i++) {
            const p1 = otherRect[i];
            const p2 = otherRect[(i + 1) % otherRect.length];
            
            const intersection = this.lineSegmentIntersection(
                faceLine.start, faceLine.end,
                p1, p2
            );
            
            if (intersection) {
                intersectionPoints.push(intersection);
            }
        }
        
        // 2. 检查侧面线的端点是否在矩形内
        if (this.isPointInPolygon(faceLine.start, otherRect)) {
            intersectionPoints.push({ ...faceLine.start });
        }
        if (this.isPointInPolygon(faceLine.end, otherRect)) {
            intersectionPoints.push({ ...faceLine.end });
        }
        
        // 3. 检查矩形的顶点是否在侧面线上
        otherRect.forEach(p => {
            if (this.isPointOnLineSegment(p, faceLine.start, faceLine.end)) {
                intersectionPoints.push({ ...p });
            }
        });
        
        if (intersectionPoints.length < 2) {
            return null;
        }
        
        // 将交点投影到侧面线上，计算参数t（0到1）
        const faceDir = {
            x: faceLine.end.x - faceLine.start.x,
            y: faceLine.end.y - faceLine.start.y
        };
        const faceLength = Math.sqrt(faceDir.x * faceDir.x + faceDir.y * faceDir.y);
        
        const projections = intersectionPoints.map(p => {
            const dx = p.x - faceLine.start.x;
            const dy = p.y - faceLine.start.y;
            const t = (dx * faceDir.x + dy * faceDir.y) / (faceLength * faceLength);
            return Math.max(0, Math.min(1, t)) * faceLength;
        });
        
        const minProj = Math.min(...projections);
        const maxProj = Math.max(...projections);
        
        if (maxProj - minProj < this.tolerance) {
            return null;
        }
        
        return { start: minProj, end: maxProj };
    }
    
    /**
     * 计算两条线段的交点
     */
    lineSegmentIntersection(p1, p2, p3, p4) {
        const x1 = p1.x, y1 = p1.y;
        const x2 = p2.x, y2 = p2.y;
        const x3 = p3.x, y3 = p3.y;
        const x4 = p4.x, y4 = p4.y;
        
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        
        if (Math.abs(denom) < this.tolerance) return null;
        
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
        
        // 检查交点是否在两条线段上
        if (t >= -this.tolerance && t <= 1 + this.tolerance && 
            u >= -this.tolerance && u <= 1 + this.tolerance) {
            return {
                x: x1 + t * (x2 - x1),
                y: y1 + t * (y2 - y1)
            };
        }
        
        return null;
    }
    
    /**
     * 判断点是否在线段上
     */
    isPointOnLineSegment(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length < this.tolerance) return false;
        
        // 计算点到线段起点的向量
        const px = point.x - lineStart.x;
        const py = point.y - lineStart.y;
        
        // 投影到线段方向
        const t = (px * dx + py * dy) / (length * length);
        
        if (t < -this.tolerance || t > 1 + this.tolerance) return false;
        
        // 计算点到线段的距离
        const projX = lineStart.x + t * dx;
        const projY = lineStart.y + t * dy;
        const dist = Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
        
        return dist < this.tolerance;
    }
}

// 轮廓线提取算法模块
export class OutlineExtractor {
    /**
     * 创建几何体的外轮廓线
     * 算法：同法向面合并 -> 顶点合并 -> 提取只用一次的边 -> 合并共线边
     */
    createOutlineGeometry(geometry) {
        try {
            const positions = geometry.attributes.position;
            const vertexCount = positions.count;
            const triangleCount = vertexCount / 3;
            
            console.log(`\n=== 提取外轮廓线 ===`);
            console.log(`三角形数: ${triangleCount}`);
            
            // 步骤1：同法向面合并（使用阈值 + 位置检查）
            const normalGroups = [];
            const normalTolerance = 0.01;
            const positionTolerance = 0.01; // 10mm
            
            for (let i = 0; i < triangleCount; i++) {
                const i0 = i * 3;
                const i1 = i * 3 + 1;
                const i2 = i * 3 + 2;
                
                const v0 = new THREE.Vector3(positions.getX(i0), positions.getY(i0), positions.getZ(i0));
                const v1 = new THREE.Vector3(positions.getX(i1), positions.getY(i1), positions.getZ(i1));
                const v2 = new THREE.Vector3(positions.getX(i2), positions.getY(i2), positions.getZ(i2));
                
                const edge1 = new THREE.Vector3().subVectors(v1, v0);
                const edge2 = new THREE.Vector3().subVectors(v2, v0);
                const normal = new THREE.Vector3().crossVectors(edge1, edge2);
                
                const area = normal.length() / 2;
                if (area < 0.000001) continue;
                
                normal.normalize();
                
                // 计算三角形中心点
                const center = new THREE.Vector3()
                    .add(v0)
                    .add(v1)
                    .add(v2)
                    .divideScalar(3);
                
                // 查找相似法向量且位置接近的组
                let foundGroup = false;
                for (let group of normalGroups) {
                    const similarity = Math.abs(group.normal.dot(normal));
                    
                    // 检查法向量是否相似
                    if (similarity > 1 - normalTolerance) {
                        // 检查位置是否接近（在同一平面上）
                        const distanceToPlane = Math.abs(group.normal.dot(
                            new THREE.Vector3().subVectors(center, group.center)
                        ));
                        
                        if (distanceToPlane < positionTolerance) {
                            group.triangles.push({ v0, v1, v2, normal });
                            // 更新组的中心点（平均值）
                            group.center.add(center).divideScalar(2);
                            foundGroup = true;
                            break;
                        }
                    }
                }
                
                if (!foundGroup) {
                    normalGroups.push({
                        normal: normal.clone(),
                        center: center.clone(),
                        triangles: [{ v0, v1, v2, normal }]
                    });
                }
            }
            
            console.log(`法向面分组: ${normalGroups.length} 组`);
            
            // 新策略：对每个法向面组单独提取轮廓
            const allOutlineEdges = [];
            
            normalGroups.forEach((group, groupIndex) => {
                const triangles = group.triangles;
                
                console.log(`  面组 ${groupIndex}: ${triangles.length} 个三角形`);
                
                // 新策略：将三角形顶点投影到2D平面，然后使用凸包算法找外轮廓
                const groupOutlineEdges = this.extractOutlineFromFaceGroup(group, groupIndex);
                
                groupOutlineEdges.forEach(edge => {
                    allOutlineEdges.push(edge.v1.clone(), edge.v2.clone());
                });
            });
            
            console.log(`总轮廓边: ${allOutlineEdges.length / 2} 条\n`);
            
            if (allOutlineEdges.length === 0) {
                return new THREE.EdgesGeometry(geometry, 89);
            }
            
            // 不再使用边长过滤，因为它会过滤掉有效的轮廓边
            // 直接返回所有提取的轮廓边
            return new THREE.BufferGeometry().setFromPoints(allOutlineEdges);
            
        } catch (error) {
            console.error('创建轮廓线失败:', error);
            return new THREE.EdgesGeometry(geometry, 89);
        }
    }

    /**
     * 从法向面组中提取外轮廓（使用凸包算法）
     */
    extractOutlineFromFaceGroup(group, groupIndex) {
        const triangles = group.triangles;
        const normal = group.normal;
        
        // 步骤1：收集所有顶点并去重
        const vertexTolerance = 0.01; // 10mm
        const uniqueVertices = [];
        
        triangles.forEach(tri => {
            [tri.v0, tri.v1, tri.v2].forEach(v => {
                let found = false;
                for (const uv of uniqueVertices) {
                    if (v.distanceTo(uv) < vertexTolerance) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    uniqueVertices.push(v.clone());
                }
            });
        });
        
        console.log(`    面组 ${groupIndex}: ${triangles.length} 三角形, ${uniqueVertices.length} 唯一顶点`);
        
        // 步骤2：建立坐标系，将3D点投影到2D平面
        // 使用法向量作为Z轴，构建局部坐标系
        const zAxis = normal.clone().normalize();
        
        // 选择一个不平行于法向量的向量来构建X轴
        let xAxis;
        if (Math.abs(zAxis.x) < 0.9) {
            xAxis = new THREE.Vector3(1, 0, 0).cross(zAxis).normalize();
        } else {
            xAxis = new THREE.Vector3(0, 1, 0).cross(zAxis).normalize();
        }
        
        const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
        
        // 投影所有顶点到2D平面
        const points2D = uniqueVertices.map(v => {
            return {
                x: v.dot(xAxis),
                y: v.dot(yAxis),
                v3d: v
            };
        });
        
        // 步骤3：使用凸包算法找到外轮廓
        const hullIndices = this.convexHull2D(points2D);
        
        console.log(`    凸包顶点数: ${hullIndices.length}`);
        
        // 步骤4：将凸包转换为边
        const outlineEdges = [];
        for (let i = 0; i < hullIndices.length; i++) {
            const i1 = hullIndices[i];
            const i2 = hullIndices[(i + 1) % hullIndices.length];
            
            const v1 = points2D[i1].v3d;
            const v2 = points2D[i2].v3d;
            
            outlineEdges.push({
                v1: v1,
                v2: v2,
                length: v1.distanceTo(v2)
            });
        }
        
        return outlineEdges;
    }
    
    /**
     * 2D凸包算法（Graham扫描法）
     */
    convexHull2D(points) {
        if (points.length < 3) return points.map((p, i) => i);
        
        // 找到最下方的点（y最小，如果相同则x最小）
        let minIdx = 0;
        for (let i = 1; i < points.length; i++) {
            if (points[i].y < points[minIdx].y || 
                (points[i].y === points[minIdx].y && points[i].x < points[minIdx].x)) {
                minIdx = i;
            }
        }
        
        const pivot = points[minIdx];
        
        // 按极角排序
        const indices = points.map((p, i) => i).filter(i => i !== minIdx);
        indices.sort((i, j) => {
            const pi = points[i];
            const pj = points[j];
            
            const angleI = Math.atan2(pi.y - pivot.y, pi.x - pivot.x);
            const angleJ = Math.atan2(pj.y - pivot.y, pj.x - pivot.x);
            
            if (Math.abs(angleI - angleJ) < 0.0001) {
                // 角度相同，选择距离更近的
                const distI = Math.hypot(pi.x - pivot.x, pi.y - pivot.y);
                const distJ = Math.hypot(pj.x - pivot.x, pj.y - pivot.y);
                return distI - distJ;
            }
            
            return angleI - angleJ;
        });
        
        // Graham扫描
        const hull = [minIdx];
        
        for (const idx of indices) {
            // 移除不构成左转的点
            while (hull.length >= 2) {
                const p1 = points[hull[hull.length - 2]];
                const p2 = points[hull[hull.length - 1]];
                const p3 = points[idx];
                
                const cross = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
                
                if (cross <= 0) {
                    hull.pop();
                } else {
                    break;
                }
            }
            
            hull.push(idx);
        }
        
        return hull;
    }

    addEdgeByIndex(edgeMap, i1, i2) {
        let minIdx, maxIdx;
        if (i1 < i2) {
            minIdx = i1;
            maxIdx = i2;
        } else {
            minIdx = i2;
            maxIdx = i1;
        }
        
        const key = `${minIdx}-${maxIdx}`;
        
        if (edgeMap.has(key)) {
            edgeMap.get(key).count++;
        } else {
            edgeMap.set(key, { i1: minIdx, i2: maxIdx, count: 1 });
        }
    }

    mergeCollinearEdges(edges, tolerance) {
        if (edges.length === 0) return [];
        
        // 新策略：去除那些两个端点都在其他更长的边上的边
        // 这样可以去除被分割的短边，只保留完整的长边
        
        const filteredEdges = [];
        
        for (let i = 0; i < edges.length; i++) {
            const edge = edges[i];
            const edgeLen = edge.v1.distanceTo(edge.v2);
            
            if (edgeLen < tolerance) continue; // 过滤太短的边
            
            let shouldKeep = true;
            
            // 检查这条边的两个端点是否都在另一条更长的边上
            for (let j = 0; j < edges.length; j++) {
                if (i === j) continue;
                
                const otherEdge = edges[j];
                const otherLen = otherEdge.v1.distanceTo(otherEdge.v2);
                
                // 只检查更长的边
                if (otherLen <= edgeLen + tolerance) continue;
                
                // 检查 edge 的两个端点是否都在 otherEdge 上
                const v1OnOther = this.isPointOnLineSegmentInclusive(edge.v1, otherEdge.v1, otherEdge.v2, tolerance);
                const v2OnOther = this.isPointOnLineSegmentInclusive(edge.v2, otherEdge.v1, otherEdge.v2, tolerance);
                
                if (v1OnOther && v2OnOther) {
                    // 这条边的两个端点都在另一条更长的边上，说明这是被分割出来的短边
                    shouldKeep = false;
                    break;
                }
            }
            
            if (shouldKeep) {
                filteredEdges.push(edge);
            }
        }
        
        console.log(`  共线边合并: ${edges.length} -> ${filteredEdges.length} 条`);
        
        return filteredEdges;
    }
    
    /**
     * 检查点是否在线段上（包括端点）
     */
    isPointOnLineSegmentInclusive(point, lineStart, lineEnd, tolerance) {
        const lineVec = new THREE.Vector3().subVectors(lineEnd, lineStart);
        const lineLen = lineVec.length();
        
        if (lineLen < 0.00001) return false;
        
        const lineDir = lineVec.clone().divideScalar(lineLen);
        
        // 计算点到线段起点的向量
        const toPoint = new THREE.Vector3().subVectors(point, lineStart);
        
        // 计算投影长度
        const t = toPoint.dot(lineDir);
        
        // 检查投影是否在线段范围内（包括端点）
        if (t < -tolerance || t > lineLen + tolerance) {
            return false;
        }
        
        // 计算点到线段的距离
        const projection = new THREE.Vector3().copy(lineStart).addScaledVector(lineDir, t);
        const distance = point.distanceTo(projection);
        
        return distance < tolerance;
    }

    areEdgesCollinearAndConnected(edge1, edge2, tolerance) {
        const connectionTolerance = Math.max(tolerance, 0.005);
        
        const dist11 = edge1.v1.distanceTo(edge2.v1);
        const dist12 = edge1.v1.distanceTo(edge2.v2);
        const dist21 = edge1.v2.distanceTo(edge2.v1);
        const dist22 = edge1.v2.distanceTo(edge2.v2);
        
        const connected = 
            dist11 < connectionTolerance ||
            dist12 < connectionTolerance ||
            dist21 < connectionTolerance ||
            dist22 < connectionTolerance;
        
        if (!connected) return false;
        
        const dir1 = new THREE.Vector3().subVectors(edge1.v2, edge1.v1);
        const len1 = dir1.length();
        if (len1 < 0.00001) return false;
        dir1.divideScalar(len1);
        
        const dir2 = new THREE.Vector3().subVectors(edge2.v2, edge2.v1);
        const len2 = dir2.length();
        if (len2 < 0.00001) return false;
        dir2.divideScalar(len2);
        
        const dot = Math.abs(dir1.dot(dir2));
        return dot > 0.995;
    }

    mergeEdges(edge1, edge2) {
        const points = [edge1.v1, edge1.v2, edge2.v1, edge2.v2];
        let maxDist = 0;
        let p1 = points[0];
        let p2 = points[1];
        
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                const dist = points[i].distanceTo(points[j]);
                if (dist > maxDist) {
                    maxDist = dist;
                    p1 = points[i];
                    p2 = points[j];
                }
            }
        }
        
        return { v1: p1.clone(), v2: p2.clone() };
    }
}

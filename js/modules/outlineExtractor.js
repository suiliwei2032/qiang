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
            
            // 步骤1：同法向面合并（使用阈值）
            const normalGroups = [];
            const normalTolerance = 0.01;
            
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
                
                // 查找相似法向量组
                let foundGroup = false;
                for (let group of normalGroups) {
                    const similarity = Math.abs(group.normal.dot(normal));
                    if (similarity > 1 - normalTolerance) {
                        group.triangles.push({ v0, v1, v2, normal });
                        foundGroup = true;
                        break;
                    }
                }
                
                if (!foundGroup) {
                    normalGroups.push({
                        normal: normal.clone(),
                        triangles: [{ v0, v1, v2, normal }]
                    });
                }
            }
            
            console.log(`法向面分组: ${normalGroups.length} 组`);
            
            // 步骤2-4：处理每组面
            const allOutlineEdges = [];
            
            for (const group of normalGroups) {
                const triangles = group.triangles;
                
                // 步骤2：全局顶点合并
                const allVertices = [];
                triangles.forEach(tri => {
                    allVertices.push(tri.v0, tri.v1, tri.v2);
                });
                
                const vertexTolerance = 0.001;
                const uniqueVertices = [];
                const vertexIndexMap = [];
                
                for (let i = 0; i < allVertices.length; i++) {
                    const v = allVertices[i];
                    let foundIndex = -1;
                    
                    for (let j = 0; j < uniqueVertices.length; j++) {
                        if (v.distanceTo(uniqueVertices[j]) < vertexTolerance) {
                            foundIndex = j;
                            break;
                        }
                    }
                    
                    if (foundIndex === -1) {
                        foundIndex = uniqueVertices.length;
                        uniqueVertices.push(v.clone());
                    }
                    
                    vertexIndexMap.push(foundIndex);
                }
                
                // 步骤3：统计边使用次数
                const edgeMap = new Map();
                
                for (let t = 0; t < triangles.length; t++) {
                    const baseIdx = t * 3;
                    const i0 = vertexIndexMap[baseIdx];
                    const i1 = vertexIndexMap[baseIdx + 1];
                    const i2 = vertexIndexMap[baseIdx + 2];
                    
                    if (i0 === i1 || i1 === i2 || i2 === i0) continue;
                    
                    this.addEdgeByIndex(edgeMap, i0, i1);
                    this.addEdgeByIndex(edgeMap, i1, i2);
                    this.addEdgeByIndex(edgeMap, i2, i0);
                }
                
                // 提取只用一次的边
                const candidateEdges = [];
                for (const [key, data] of edgeMap.entries()) {
                    if (data.count === 1) {
                        const v1 = uniqueVertices[data.i1];
                        const v2 = uniqueVertices[data.i2];
                        candidateEdges.push({
                            v1: v1,
                            v2: v2,
                            length: v1.distanceTo(v2)
                        });
                    }
                }
                
                // 步骤4：合并共线边
                const mergedEdges = this.mergeCollinearEdges(candidateEdges, vertexTolerance * 5);
                
                mergedEdges.forEach(edge => {
                    allOutlineEdges.push(edge.v1.clone(), edge.v2.clone());
                });
            }
            
            console.log(`总轮廓边: ${allOutlineEdges.length / 2} 条\n`);
            
            if (allOutlineEdges.length === 0) {
                return new THREE.EdgesGeometry(geometry, 89);
            }
            
            return new THREE.BufferGeometry().setFromPoints(allOutlineEdges);
            
        } catch (error) {
            console.error('创建轮廓线失败:', error);
            return new THREE.EdgesGeometry(geometry, 89);
        }
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
        
        const merged = [];
        const used = new Array(edges.length).fill(false);
        
        for (let i = 0; i < edges.length; i++) {
            if (used[i]) continue;
            
            const edge1 = edges[i];
            let currentEdge = { v1: edge1.v1.clone(), v2: edge1.v2.clone() };
            used[i] = true;
            
            let foundMerge = true;
            let iterations = 0;
            while (foundMerge && iterations < 100) {
                foundMerge = false;
                iterations++;
                
                for (let j = 0; j < edges.length; j++) {
                    if (used[j]) continue;
                    
                    const edge2 = edges[j];
                    
                    if (this.areEdgesCollinearAndConnected(currentEdge, edge2, tolerance)) {
                        currentEdge = this.mergeEdges(currentEdge, edge2);
                        used[j] = true;
                        foundMerge = true;
                        break;
                    }
                }
            }
            
            merged.push(currentEdge);
        }
        
        return merged;
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


import * as THREE from 'three';

/**
 * 几何计算工具类
 */
export class GeometryUtils {

    /**
     * 将2D点按逆时针顺序排序
     */
    static orderPointsCounterClockwise(points) {
        if (points.length < 3) return points;

        // 计算中心点
        let centerX = 0, centerY = 0;
        points.forEach(p => {
            centerX += p.x;
            centerY += p.y;
        });
        centerX /= points.length;
        centerY /= points.length;

        // 按角度排序
        const sortedPoints = points.slice().sort((a, b) => {
            const angleA = Math.atan2(a.y - centerY, a.x - centerX);
            const angleB = Math.atan2(b.y - centerY, b.x - centerX);
            return angleA - angleB;
        });

        return sortedPoints;
    }

    /**
     * 生成边的唯一键（无视方向）
     */
    static getEdgeKey(v1, v2) {
        // 将坐标转为整数以避免浮点误差（假设单位是mm或类似精度）
        const p1 = { x: Math.round(v1.x * 1000), y: Math.round(v1.y * 1000), z: Math.round(v1.z * 1000) };
        const p2 = { x: Math.round(v2.x * 1000), y: Math.round(v2.y * 1000), z: Math.round(v2.z * 1000) };

        const s1 = `${p1.x},${p1.y},${p1.z}`;
        const s2 = `${p2.x},${p2.y},${p2.z}`;

        // 排序保证无向性
        return s1 < s2 ? `${s1}|${s2}` : `${s2}|${s1}`;
    }

    /**
     * 从面组提取外轮廓边（只出现一次的边）
     */
    static extractOutlineEdgesFromFaceGroup(geometry) {
        const positions = geometry.attributes.position;
        const vertexCount = positions.count;

        // 统计每条边出现的次数
        const edgeCount = new Map();

        for (let i = 0; i < vertexCount; i += 3) {
            // 每个三角形的三条边
            for (let j = 0; j < 3; j++) {
                const idx1 = i + j;
                const idx2 = i + (j + 1) % 3;

                const v1 = new THREE.Vector3(
                    positions.getX(idx1),
                    positions.getY(idx1),
                    positions.getZ(idx1)
                );
                const v2 = new THREE.Vector3(
                    positions.getX(idx2),
                    positions.getY(idx2),
                    positions.getZ(idx2)
                );

                const key = GeometryUtils.getEdgeKey(v1, v2);
                edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
            }
        }

        // 提取只出现一次的边（外轮廓边）
        const outlineEdges = [];
        edgeCount.forEach((count, key) => {
            if (count === 1) {
                const [v1Str, v2Str] = key.split('|');
                const [x1, y1, z1] = v1Str.split(',').map(Number);
                const [x2, y2, z2] = v2Str.split(',').map(Number);
                outlineEdges.push({
                    v1: new THREE.Vector3(x1 / 1000, y1 / 1000, z1 / 1000),
                    v2: new THREE.Vector3(x2 / 1000, y2 / 1000, z2 / 1000)
                });
            }
        });

        return outlineEdges;
    }

    /**
     * 投影3D边到2D平面
     */
    static projectEdgesTo2DPlane(edges3D, normal) {
        // 创建局部坐标系
        let xAxis, yAxis;

        if (Math.abs(normal.y) > 0.9) {
            xAxis = new THREE.Vector3(1, 0, 0);
            yAxis = new THREE.Vector3(0, 0, 1);
        } else {
            yAxis = new THREE.Vector3(0, 1, 0);
            xAxis = new THREE.Vector3().crossVectors(yAxis, normal).normalize();
            yAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize();
        }

        // 投影所有边
        return edges3D.map(edge => ({
            p1: {
                x: edge.v1.dot(xAxis),
                y: edge.v1.dot(yAxis)
            },
            p2: {
                x: edge.v2.dot(xAxis),
                y: edge.v2.dot(yAxis)
            }
        }));
    }

    /**
     * 使用3D边的顺序来重新排序2D点
     */
    static reorderPointsByEdges(points2D, edges2D) {
        if (points2D.length === 0 || edges2D.length === 0) return points2D;

        // console.log(`\n重新排序点: ${points2D.length} 个点, ${edges2D.length} 条边`);

        const tolerance = 0.01; // 10mm容差

        // 连接边成有序序列
        const orderedPoints = [];
        const usedEdges = new Set();

        // 找到起始边
        let currentEdge = edges2D[0];
        orderedPoints.push({ x: currentEdge.p1.x, y: currentEdge.p1.y });
        orderedPoints.push({ x: currentEdge.p2.x, y: currentEdge.p2.y });
        usedEdges.add(0);

        let currentPoint = currentEdge.p2;

        // 连接剩余的边
        while (usedEdges.size < edges2D.length) {
            let found = false;

            for (let i = 0; i < edges2D.length; i++) {
                if (usedEdges.has(i)) continue;

                const edge = edges2D[i];
                const dist1 = Math.hypot(currentPoint.x - edge.p1.x, currentPoint.y - edge.p1.y);
                const dist2 = Math.hypot(currentPoint.x - edge.p2.x, currentPoint.y - edge.p2.y);

                if (dist1 < tolerance) {
                    orderedPoints.push({ x: edge.p2.x, y: edge.p2.y });
                    currentPoint = edge.p2;
                    usedEdges.add(i);
                    found = true;
                    break;
                } else if (dist2 < tolerance) {
                    orderedPoints.push({ x: edge.p1.x, y: edge.p1.y });
                    currentPoint = edge.p1;
                    usedEdges.add(i);
                    found = true;
                    break;
                }
            }

            if (!found) {
                // console.log(`  无法连接所有边，已连接 ${usedEdges.size}/${edges2D.length}`);
                break;
            }
        }

        // 移除最后一个点（如果它与第一个点重合）
        if (orderedPoints.length > 1) {
            const first = orderedPoints[0];
            const last = orderedPoints[orderedPoints.length - 1];
            const dist = Math.hypot(first.x - last.x, first.y - last.y);
            if (dist < tolerance) {
                orderedPoints.pop();
            }
        }

        return orderedPoints;
    }
}

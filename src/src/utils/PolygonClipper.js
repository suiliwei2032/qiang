import * as THREE from 'three';

/**
 * 多边形裁剪工具 - 在2D空间进行多边形裁剪
 */
export class PolygonClipper {
  /**
   * 将3D几何体投影到2D平面
   */
  static projectGeometryTo2D(geometry, center, right, up) {
    const posAttr = geometry.attributes.position;
    const triangles = [];
    
    for (let i = 0; i < posAttr.count; i += 3) {
      const v0_3d = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      const v1_3d = new THREE.Vector3(posAttr.getX(i + 1), posAttr.getY(i + 1), posAttr.getZ(i + 1));
      const v2_3d = new THREE.Vector3(posAttr.getX(i + 2), posAttr.getY(i + 2), posAttr.getZ(i + 2));
      
      // 转换为2D坐标
      const v0_2d = this.project3DTo2D(v0_3d, center, right, up);
      const v1_2d = this.project3DTo2D(v1_3d, center, right, up);
      const v2_2d = this.project3DTo2D(v2_3d, center, right, up);
      
      triangles.push({
        vertices2D: [v0_2d, v1_2d, v2_2d],
        vertices3D: [v0_3d, v1_3d, v2_3d]
      });
    }
    
    return triangles;
  }
  
  /**
   * 将3D点投影到2D
   */
  static project3DTo2D(point3D, center, right, up) {
    const localPoint = point3D.clone().sub(center);
    return {
      x: localPoint.dot(right),
      y: localPoint.dot(up)
    };
  }
  
  /**
   * 将2D点转换回3D
   */
  static project2DTo3D(point2D, center, right, up) {
    return center.clone()
      .add(right.clone().multiplyScalar(point2D.x))
      .add(up.clone().multiplyScalar(point2D.y));
  }
  
  /**
   * 检查三角形是否与多边形相交或在多边形内
   */
  static triangleIntersectsPolygon(triangle2D, polygon) {
    // 检查三角形的三个顶点
    let insideCount = 0;
    for (const vertex of triangle2D) {
      if (this.isPointInPolygon(vertex, polygon)) {
        insideCount++;
      }
    }
    
    // 如果所有顶点都在内部，整个三角形在内部
    if (insideCount === 3) return 'inside';
    
    // 如果有顶点在内部，或者边与多边形相交，则相交
    if (insideCount > 0) return 'intersect';
    
    // 检查三角形的边是否与多边形的边相交
    for (let i = 0; i < 3; i++) {
      const v1 = triangle2D[i];
      const v2 = triangle2D[(i + 1) % 3];
      
      for (let j = 0; j < polygon.length; j++) {
        const p1 = polygon[j];
        const p2 = polygon[(j + 1) % polygon.length];
        
        if (this.segmentsIntersect(v1, v2, p1, p2)) {
          return 'intersect';
        }
      }
    }
    
    // 检查多边形的顶点是否在三角形内
    for (const point of polygon) {
      if (this.isPointInTriangle(point, triangle2D[0], triangle2D[1], triangle2D[2])) {
        return 'intersect';
      }
    }
    
    return 'outside';
  }
  
  /**
   * 检查点是否在多边形内（射线法）
   */
  static isPointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      
      const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  
  /**
   * 检查点是否在三角形内
   */
  static isPointInTriangle(p, v0, v1, v2) {
    const sign = (p1, p2, p3) => {
      return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
    };
    
    const d1 = sign(p, v0, v1);
    const d2 = sign(p, v1, v2);
    const d3 = sign(p, v2, v0);
    
    const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
    
    return !(hasNeg && hasPos);
  }
  
  /**
   * 检查两条线段是否相交
   */
  static segmentsIntersect(p1, p2, p3, p4) {
    const ccw = (A, B, C) => {
      return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
    };
    
    return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
  }
  
  /**
   * 根据区域裁剪三角形（真正的裁剪，不是简单判断）
   */
  static clipTrianglesByRegion(triangles, region) {
    const inside = [];
    const outside = [];
    
    console.log('=== 开始裁剪 ===');
    console.log('区域多边形顶点数:', region.points.length);
    region.points.forEach((p, i) => {
      console.log(`  区域顶点 ${i}: x=${p.x.toFixed(2)}, y=${p.y.toFixed(2)}`);
    });
    
    triangles.forEach((triangle, index) => {
      console.log(`\n处理三角形 ${index}:`);
      triangle.vertices2D.forEach((v, i) => {
        console.log(`  顶点 ${i}: x=${v.x.toFixed(2)}, y=${v.y.toFixed(2)}`);
      });
      
      // 使用Sutherland-Hodgman算法裁剪三角形
      const clippedInside = this.clipPolygonByPolygon(triangle.vertices2D, region.points);
      
      console.log(`  裁剪后顶点数: ${clippedInside ? clippedInside.length : 0}`);
      if (clippedInside && clippedInside.length > 0) {
        clippedInside.forEach((v, i) => {
          console.log(`    裁剪顶点 ${i}: x=${v.x.toFixed(2)}, y=${v.y.toFixed(2)}`);
        });
      }
      
      if (clippedInside && clippedInside.length >= 3) {
        console.log(`  ✓ 三角形 ${index} 有内部部分`);
        
        // 将裁剪后的多边形三角化
        const insideTriangles = this.triangulatePolygon(clippedInside, triangle.vertices3D, triangle.vertices2D);
        console.log(`  生成 ${insideTriangles.length} 个内部三角形`);
        inside.push(...insideTriangles);
      } else {
        console.log(`  ✗ 三角形 ${index} 无内部部分`);
      }
      
      // 计算外部部分
      const allInside = triangle.vertices2D.every(v => this.isPointInPolygon(v, region.points));
      console.log(`  所有顶点都在内部: ${allInside}`);
      
      if (!allInside && (!clippedInside || clippedInside.length < 3)) {
        console.log(`  ✓ 三角形 ${index} 完全在外部`);
        outside.push(triangle);
      } else if (!allInside && clippedInside && clippedInside.length >= 3) {
        console.log(`  三角形 ${index} 被裁剪，需要计算外部`);
        const clippedOutside = this.clipPolygonByInvertedPolygon(triangle.vertices2D, region.points);
        if (clippedOutside && clippedOutside.length >= 3) {
          const outsideTriangles = this.triangulatePolygon(clippedOutside, triangle.vertices3D, triangle.vertices2D);
          outside.push(...outsideTriangles);
        }
      }
    });
    
    console.log(`\n=== 裁剪完成 ===`);
    console.log(`内部: ${inside.length}个三角形, 外部: ${outside.length}个三角形`);
    
    return { inside, outside };
  }
  
  /**
   * 使用Sutherland-Hodgman算法裁剪多边形
   */
  static clipPolygonByPolygon(subject, clip) {
    let output = [...subject];
    
    for (let i = 0; i < clip.length; i++) {
      if (output.length === 0) break;
      
      const clipEdgeStart = clip[i];
      const clipEdgeEnd = clip[(i + 1) % clip.length];
      
      const input = output;
      output = [];
      
      if (input.length === 0) continue;
      
      let prevVertex = input[input.length - 1];
      
      for (const currentVertex of input) {
        const currentInside = this.isPointLeftOfEdge(currentVertex, clipEdgeStart, clipEdgeEnd);
        const prevInside = this.isPointLeftOfEdge(prevVertex, clipEdgeStart, clipEdgeEnd);
        
        if (currentInside) {
          if (!prevInside) {
            // 从外到内，添加交点
            const intersection = this.lineIntersection(
              prevVertex, currentVertex,
              clipEdgeStart, clipEdgeEnd
            );
            if (intersection) {
              output.push(intersection);
            }
          }
          output.push(currentVertex);
        } else if (prevInside) {
          // 从内到外，添加交点
          const intersection = this.lineIntersection(
            prevVertex, currentVertex,
            clipEdgeStart, clipEdgeEnd
          );
          if (intersection) {
            output.push(intersection);
          }
        }
        
        prevVertex = currentVertex;
      }
    }
    
    return output;
  }
  
  /**
   * 裁剪多边形的外部（反向裁剪）
   */
  static clipPolygonByInvertedPolygon(subject, clip) {
    // 简化实现：返回原多边形
    // TODO: 实现完整的反向裁剪
    return subject;
  }
  
  /**
   * 判断点是否在边的左侧
   */
  static isPointLeftOfEdge(point, edgeStart, edgeEnd) {
    return ((edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y) - 
            (edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x)) >= 0;
  }
  
  /**
   * 计算两条线段的交点
   */
  static lineIntersection(p1, p2, p3, p4) {
    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y;
    const x4 = p4.x, y4 = p4.y;
    
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    
    if (Math.abs(denom) < 1e-10) return null;
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1)
    };
  }
  
  /**
   * 将多边形三角化
   */
  static triangulatePolygon(polygon2D, originalVertices3D, originalVertices2D) {
    if (polygon2D.length < 3) return [];
    
    // 简单的扇形三角化
    const triangles = [];
    
    for (let i = 1; i < polygon2D.length - 1; i++) {
      // 将2D顶点转换回3D
      const v0_3d = this.interpolate3DVertex(polygon2D[0], originalVertices2D, originalVertices3D);
      const v1_3d = this.interpolate3DVertex(polygon2D[i], originalVertices2D, originalVertices3D);
      const v2_3d = this.interpolate3DVertex(polygon2D[i + 1], originalVertices2D, originalVertices3D);
      
      triangles.push({
        vertices2D: [polygon2D[0], polygon2D[i], polygon2D[i + 1]],
        vertices3D: [v0_3d, v1_3d, v2_3d]
      });
    }
    
    return triangles;
  }
  
  /**
   * 插值3D顶点（从2D坐标反推3D坐标）
   */
  static interpolate3DVertex(point2D, originalVertices2D, originalVertices3D) {
    // 检查是否是原始顶点
    for (let i = 0; i < originalVertices2D.length; i++) {
      const orig = originalVertices2D[i];
      if (Math.abs(point2D.x - orig.x) < 1e-6 && Math.abs(point2D.y - orig.y) < 1e-6) {
        return originalVertices3D[i].clone();
      }
    }
    
    // 如果不是原始顶点，需要插值
    // 使用重心坐标插值
    const bary = this.barycentricCoordinates(
      point2D,
      originalVertices2D[0],
      originalVertices2D[1],
      originalVertices2D[2]
    );
    
    if (bary) {
      return new THREE.Vector3()
        .addScaledVector(originalVertices3D[0], bary.u)
        .addScaledVector(originalVertices3D[1], bary.v)
        .addScaledVector(originalVertices3D[2], bary.w);
    }
    
    // 如果插值失败，返回第一个顶点
    return originalVertices3D[0].clone();
  }
  
  /**
   * 计算重心坐标
   */
  static barycentricCoordinates(p, a, b, c) {
    const v0x = b.x - a.x, v0y = b.y - a.y;
    const v1x = c.x - a.x, v1y = c.y - a.y;
    const v2x = p.x - a.x, v2y = p.y - a.y;
    
    const denom = v0x * v1y - v1x * v0y;
    
    if (Math.abs(denom) < 1e-10) return null;
    
    const v = (v2x * v1y - v1x * v2y) / denom;
    const w = (v0x * v2y - v2x * v0y) / denom;
    const u = 1 - v - w;
    
    return { u, v, w };
  }
  
  /**
   * 将三角形列表转换为几何体
   */
  static trianglesToGeometry(triangles) {
    if (triangles.length === 0) return null;
    
    const positions = [];
    const normals = [];
    
    triangles.forEach(triangle => {
      triangle.vertices3D.forEach(v => {
        positions.push(v.x, v.y, v.z);
      });
      
      // 计算法向量
      const v0 = triangle.vertices3D[0];
      const v1 = triangle.vertices3D[1];
      const v2 = triangle.vertices3D[2];
      
      const edge1 = new THREE.Vector3().subVectors(v1, v0);
      const edge2 = new THREE.Vector3().subVectors(v2, v0);
      const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
      
      normals.push(normal.x, normal.y, normal.z);
      normals.push(normal.x, normal.y, normal.z);
      normals.push(normal.x, normal.y, normal.z);
    });
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    
    return geometry;
  }
}

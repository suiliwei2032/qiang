import * as THREE from 'three';
import { CONSTANTS } from '../constants.js';
import { GeometryUtils } from './GeometryUtils.js';

/**
 * 面提取器 - 从墙体几何体中提取独立的面
 */
export class FaceExtractor {
  /**
   * 从几何体中提取所有独立的面
   */
  static extractFaces(geometry, wallId) {
    const positionAttribute = geometry.attributes.position;
    if (!positionAttribute) return [];
    
    // 1. 按法向量和位置分组三角形（共面检测）
    const coplanarGroups = this.groupCoplanarTriangles(geometry);
    
    // 2. 对每个共面组进行孤岛检测
    const faces = [];
    let faceIndex = 0;
    
    for (const group of coplanarGroups) {
      const islands = GeometryUtils.findDistantIslands(geometry, group.triangles);
      
      // 3. 为每个孤岛创建独立的面
      for (const island of islands) {
        const face = this.createFaceFromTriangles(geometry, island, wallId, faceIndex);
        if (face) {
          faces.push(face);
          faceIndex++;
        }
      }
    }
    
    return faces;
  }
  
  /**
   * 将共面三角形分组
   */
  static groupCoplanarTriangles(geometry) {
    const groups = [];
    const triangleCount = geometry.index 
      ? geometry.index.count / 3 
      : geometry.attributes.position.count / 3;
    
    for (let i = 0; i < triangleCount; i++) {
      const triangle = GeometryUtils.getTriangleVertices(geometry, i);
      if (!triangle) continue;
      
      const normal = GeometryUtils.calculateNormal(triangle.v0, triangle.v1, triangle.v2);
      const center = new THREE.Vector3()
        .add(triangle.v0)
        .add(triangle.v1)
        .add(triangle.v2)
        .divideScalar(3);
      
      // 查找匹配的组
      let foundGroup = false;
      for (const group of groups) {
        const dotProduct = normal.dot(group.normal);
        const toCenter = new THREE.Vector3().subVectors(center, group.center);
        const distance = Math.abs(toCenter.dot(group.normal));
        
        if (dotProduct > CONSTANTS.NORMAL_THRESHOLD && distance < CONSTANTS.DISTANCE_THRESHOLD) {
          group.triangles.push(i);
          foundGroup = true;
          break;
        }
      }
      
      if (!foundGroup) {
        groups.push({
          normal: normal.clone(),
          center: center.clone(),
          triangles: [i]
        });
      }
    }
    
    return groups;
  }
  
  /**
   * 从三角形创建面
   */
  static createFaceFromTriangles(geometry, triangleIndices, wallId, faceIndex) {
    const positions = [];
    
    for (const triIndex of triangleIndices) {
      const triangle = GeometryUtils.getTriangleVertices(geometry, triIndex);
      if (triangle) {
        positions.push(
          triangle.v0.x, triangle.v0.y, triangle.v0.z,
          triangle.v1.x, triangle.v1.y, triangle.v1.z,
          triangle.v2.x, triangle.v2.y, triangle.v2.z
        );
      }
    }
    
    if (positions.length === 0) return null;
    
    const faceGeometry = new THREE.BufferGeometry();
    faceGeometry.setAttribute('position', 
      new THREE.BufferAttribute(new Float32Array(positions), 3)
    );
    faceGeometry.computeVertexNormals();
    
    // 提取边界轮廓
    const boundary = this.extractBoundary(faceGeometry);
    
    return {
      geometry: faceGeometry,
      boundary: boundary,
      wallId: wallId,
      faceIndex: faceIndex,
      triangleIndices: triangleIndices
    };
  }
  
  /**
   * 提取面的边界轮廓
   */
  static extractBoundary(geometry) {
    const positionAttr = geometry.attributes.position;
    const triangleCount = positionAttr.count / 3;
    
    // 收集所有边
    const edgeMap = new Map();
    
    for (let i = 0; i < triangleCount; i++) {
      const i0 = i * 3;
      const i1 = i * 3 + 1;
      const i2 = i * 3 + 2;
      
      const v0 = new THREE.Vector3(positionAttr.getX(i0), positionAttr.getY(i0), positionAttr.getZ(i0));
      const v1 = new THREE.Vector3(positionAttr.getX(i1), positionAttr.getY(i1), positionAttr.getZ(i1));
      const v2 = new THREE.Vector3(positionAttr.getX(i2), positionAttr.getY(i2), positionAttr.getZ(i2));
      
      this.addEdge(edgeMap, v0, v1);
      this.addEdge(edgeMap, v1, v2);
      this.addEdge(edgeMap, v2, v0);
    }
    
    // 找出边界边（只出现一次的边）
    const boundaryEdges = [];
    for (const [key, count] of edgeMap.entries()) {
      if (count === 1) {
        const [v1Key, v2Key] = key.split('|');
        boundaryEdges.push({
          v1: this.parseVertexKey(v1Key),
          v2: this.parseVertexKey(v2Key)
        });
      }
    }
    
    // 连接边界边形成轮廓
    const contours = this.buildContours(boundaryEdges);
    
    return {
      outer: contours.length > 0 ? contours[0] : [],
      holes: contours.slice(1)
    };
  }
  
  /**
   * 添加边到映射
   */
  static addEdge(edgeMap, v1, v2) {
    const key = this.getEdgeKey(v1, v2);
    edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
  }
  
  /**
   * 获取边的键（无方向）
   */
  static getEdgeKey(v1, v2) {
    const v1Key = this.getVertexKey(v1);
    const v2Key = this.getVertexKey(v2);
    return v1Key < v2Key ? `${v1Key}|${v2Key}` : `${v2Key}|${v1Key}`;
  }
  
  /**
   * 获取顶点的键
   */
  static getVertexKey(v) {
    return `${Math.round(v.x * 100)},${Math.round(v.y * 100)},${Math.round(v.z * 100)}`;
  }
  
  /**
   * 解析顶点键
   */
  static parseVertexKey(key) {
    const [x, y, z] = key.split(',').map(Number);
    return new THREE.Vector3(x / 100, y / 100, z / 100);
  }
  
  /**
   * 构建轮廓
   */
  static buildContours(edges) {
    const contours = [];
    const usedEdges = new Set();
    
    for (let i = 0; i < edges.length; i++) {
      if (usedEdges.has(i)) continue;
      
      const contour = [edges[i].v1.clone()];
      let currentVertex = edges[i].v2.clone();
      usedEdges.add(i);
      
      // 跟随边构建轮廓
      let iterations = 0;
      const maxIterations = edges.length * 2;
      
      while (iterations < maxIterations) {
        iterations++;
        
        let foundNext = false;
        
        for (let j = 0; j < edges.length; j++) {
          if (usedEdges.has(j)) continue;
          
          const edge = edges[j];
          const threshold = 1.0;
          
          if (currentVertex.distanceTo(edge.v1) < threshold) {
            contour.push(edge.v1.clone());
            currentVertex = edge.v2.clone();
            usedEdges.add(j);
            foundNext = true;
            break;
          } else if (currentVertex.distanceTo(edge.v2) < threshold) {
            contour.push(edge.v2.clone());
            currentVertex = edge.v1.clone();
            usedEdges.add(j);
            foundNext = true;
            break;
          }
        }
        
        if (!foundNext) break;
        
        // 检查是否回到起点
        if (contour.length > 2 && currentVertex.distanceTo(contour[0]) < 1.0) {
          break;
        }
      }
      
      if (contour.length > 2) {
        contours.push(contour);
      }
    }
    
    return contours;
  }
}

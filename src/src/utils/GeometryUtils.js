import * as THREE from 'three';
import { CONSTANTS } from '../constants.js';

/**
 * 几何工具类 - 提供通用的几何计算方法
 */
export class GeometryUtils {
  /**
   * 获取三角形的顶点
   */
  static getTriangleVertices(geometry, faceIndex) {
    const positionAttribute = geometry.attributes.position;
    if (!positionAttribute) return null;
    
    const indices = geometry.index?.array;
    
    let i0, i1, i2;
    
    if (indices) {
      if (faceIndex * 3 + 2 >= indices.length) return null;
      i0 = indices[faceIndex * 3];
      i1 = indices[faceIndex * 3 + 1];
      i2 = indices[faceIndex * 3 + 2];
    } else {
      const vertexIndex = faceIndex * 3;
      if (vertexIndex + 2 >= positionAttribute.count) return null;
      i0 = vertexIndex;
      i1 = vertexIndex + 1;
      i2 = vertexIndex + 2;
    }
    
    return {
      v0: new THREE.Vector3(
        positionAttribute.getX(i0),
        positionAttribute.getY(i0),
        positionAttribute.getZ(i0)
      ),
      v1: new THREE.Vector3(
        positionAttribute.getX(i1),
        positionAttribute.getY(i1),
        positionAttribute.getZ(i1)
      ),
      v2: new THREE.Vector3(
        positionAttribute.getX(i2),
        positionAttribute.getY(i2),
        positionAttribute.getZ(i2)
      )
    };
  }
  
  /**
   * 计算三角形法向量
   */
  static calculateNormal(v0, v1, v2) {
    const edge1 = new THREE.Vector3().subVectors(v1, v0);
    const edge2 = new THREE.Vector3().subVectors(v2, v0);
    return new THREE.Vector3().crossVectors(edge1, edge2).normalize();
  }
  
  /**
   * 检查两个三角形是否共享边
   */
  static trianglesShareEdge(tri1, tri2, threshold = CONSTANTS.EDGE_THRESHOLD) {
    const vertices1 = [tri1.v0, tri1.v1, tri1.v2];
    const vertices2 = [tri2.v0, tri2.v1, tri2.v2];
    
    let sharedVertices = 0;
    
    for (const v1 of vertices1) {
      for (const v2 of vertices2) {
        if (v1.distanceTo(v2) < threshold) {
          sharedVertices++;
          break;
        }
      }
    }
    
    return sharedVertices >= 2;
  }
  
  /**
   * 检查两个三角形是否接近
   */
  static trianglesAreClose(tri1, tri2, maxDistance) {
    if (this.trianglesShareEdge(tri1, tri2)) {
      return true;
    }
    
    const vertices1 = [tri1.v0, tri1.v1, tri1.v2];
    const vertices2 = [tri2.v0, tri2.v1, tri2.v2];
    
    let minDistance = Infinity;
    for (const v1 of vertices1) {
      for (const v2 of vertices2) {
        minDistance = Math.min(minDistance, v1.distanceTo(v2));
      }
    }
    
    return minDistance < maxDistance;
  }
  
  /**
   * 查找连通的三角形（宽松模式）
   */
  static findConnectedTrianglesLoose(geometry, startIndex, candidates, maxDistance) {
    const connected = new Set([startIndex]);
    const queue = [startIndex];
    
    while (queue.length > 0) {
      const currentIndex = queue.shift();
      const currentTriangle = this.getTriangleVertices(geometry, currentIndex);
      if (!currentTriangle) continue;
      
      for (const candidateIndex of candidates) {
        if (connected.has(candidateIndex)) continue;
        
        const candidateTriangle = this.getTriangleVertices(geometry, candidateIndex);
        if (!candidateTriangle) continue;
        
        if (this.trianglesAreClose(currentTriangle, candidateTriangle, maxDistance)) {
          connected.add(candidateIndex);
          queue.push(candidateIndex);
        }
      }
    }
    
    return Array.from(connected);
  }
  
  /**
   * 查找距离较远的孤岛
   */
  static findDistantIslands(geometry, candidateTriangles, threshold = CONSTANTS.ISLAND_DISTANCE_THRESHOLD) {
    const islands = [];
    const visited = new Set();
    
    for (const startIndex of candidateTriangles) {
      if (visited.has(startIndex)) continue;
      
      const island = this.findConnectedTrianglesLoose(geometry, startIndex, candidateTriangles, threshold);
      
      island.forEach(idx => visited.add(idx));
      islands.push(island);
    }
    
    return islands;
  }
}

import * as THREE from 'three';
import { PolygonClipper } from './PolygonClipper.js';

/**
 * 区域管理器 - 管理墙面上的绘制区域和材质
 */
export class RegionManager {
  constructor() {
    this.regions = new Map(); // wallId -> faceIndex -> regions[]
  }
  
  /**
   * 添加区域
   */
  addRegion(wallId, faceIndex, points, color) {
    const key = `${wallId}_${faceIndex}`;
    if (!this.regions.has(key)) {
      this.regions.set(key, []);
    }
    
    const region = {
      id: Date.now() + Math.random(),
      points: [...points], // 2D坐标数组
      color: color
    };
    
    this.regions.get(key).push(region);
    return region;
  }
  
  /**
   * 获取指定墙面的所有区域
   */
  getRegions(wallId, faceIndex) {
    const key = `${wallId}_${faceIndex}`;
    return this.regions.get(key) || [];
  }
  
  /**
   * 删除区域
   */
  removeRegion(wallId, faceIndex, regionId) {
    const key = `${wallId}_${faceIndex}`;
    const regions = this.regions.get(key);
    if (!regions) return false;
    
    const index = regions.findIndex(r => r.id === regionId);
    if (index !== -1) {
      regions.splice(index, 1);
      return true;
    }
    return false;
  }
  
  /**
   * 清空指定墙面的所有区域
   */
  clearRegions(wallId, faceIndex) {
    const key = `${wallId}_${faceIndex}`;
    this.regions.delete(key);
  }
  
  /**
   * 清空所有区域
   */
  clearAll() {
    this.regions.clear();
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
   * 使用2D多边形裁剪分割几何体
   */
  static splitGeometryByRegions2D(geometry, regions, center, normal, right, up) {
    console.log('使用2D多边形裁剪分割几何体，区域数量:', regions.length);
    
    if (regions.length === 0) return null;
    
    // 将3D几何体投影到2D
    let triangles = PolygonClipper.projectGeometryTo2D(geometry, center, right, up);
    console.log('投影后的三角形数量:', triangles.length);
    
    const result = {
      parts: []
    };
    
    // 为每个区域裁剪三角形
    regions.forEach((region, regionIndex) => {
      console.log(`处理区域 ${regionIndex}`);
      
      const { inside, outside } = PolygonClipper.clipTrianglesByRegion(triangles, region);
      
      console.log(`区域 ${regionIndex}: 内部=${inside.length}个三角形, 外部=${outside.length}个三角形`);
      
      if (inside.length > 0) {
        const insideGeometry = PolygonClipper.trianglesToGeometry(inside);
        if (insideGeometry) {
          result.parts.push({
            geometry: insideGeometry,
            materialIndex: regionIndex + 1,
            color: region.color
          });
        }
      }
      
      // 继续用外部的三角形处理下一个区域
      triangles = outside;
    });
    
    // 添加剩余的三角形（未被任何区域覆盖）
    if (triangles.length > 0) {
      console.log('剩余三角形数量:', triangles.length);
      const remainingGeometry = PolygonClipper.trianglesToGeometry(triangles);
      if (remainingGeometry) {
        result.parts.push({
          geometry: remainingGeometry,
          materialIndex: 0,
          color: null
        });
      }
    }
    
    console.log('分割完成，共', result.parts.length, '个部分');
    
    return result;
  }
  
  /**
   * 合并多个几何体部分为一个多材质几何体
   */
  static mergeGeometryParts(parts) {
    if (parts.length === 0) return null;
    
    const positions = [];
    const normals = [];
    const groups = [];
    
    let vertexOffset = 0;
    
    parts.forEach(part => {
      const geometry = part.geometry;
      const posAttr = geometry.attributes.position;
      const normAttr = geometry.attributes.normal;
      
      if (!posAttr) return;
      
      const startVertex = vertexOffset;
      
      // 添加顶点
      for (let i = 0; i < posAttr.count; i++) {
        positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
        
        if (normAttr) {
          normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
        } else {
          normals.push(0, 0, 1);
        }
      }
      
      vertexOffset += posAttr.count;
      
      // 添加材质组
      groups.push({
        start: startVertex,
        count: posAttr.count,
        materialIndex: part.materialIndex
      });
      
      console.log(`添加部分: 材质索引=${part.materialIndex}, 顶点=${posAttr.count}`);
    });
    
    if (positions.length === 0) return null;
    
    const mergedGeometry = new THREE.BufferGeometry();
    mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    mergedGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    
    // 设置材质组
    groups.forEach(group => {
      mergedGeometry.addGroup(group.start, group.count, group.materialIndex);
    });
    
    console.log('合并后的几何体: 顶点数=', positions.length / 3, '材质组数=', groups.length);
    
    return mergedGeometry;
  }
}

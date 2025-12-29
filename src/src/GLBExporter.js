import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { CONSTANTS } from './constants.js';

/**
 * GLB导出器 - 负责将场景导出为GLB格式
 */
export class GLBExporter {
  constructor() {
    this.exporter = new GLTFExporter();
  }
  
  /**
   * 导出场景
   */
  export(scene, callback) {
    const exportScene = this.createExportScene(scene);
    
    const options = {
      binary: true,
      embedImages: true,
      truncateDrawRange: false
    };
    
    this.exporter.parse(
      exportScene,
      (result) => callback(result),
      (error) => console.error('GLB export failed:', error),
      options
    );
  }
  
  /**
   * 创建导出场景
   */
  createExportScene(scene) {
    const exportScene = new THREE.Scene();
    let faceCount = 0;
    
    scene.traverse((object) => {
      if (this.shouldExportObject(object)) {
        const faceData = object.userData.faceData;
        if (faceData) {
          // 新方式：直接使用已提取的面
          const faceMesh = this.createFaceMesh(faceData, object);
          exportScene.add(faceMesh);
          faceCount++;
        }
      }
    });
    
    console.log(`Exported ${faceCount} faces`);
    return exportScene;
  }
  
  /**
   * 判断对象是否应该导出
   */
  shouldExportObject(object) {
    if (!object.isMesh || !object.geometry) return false;
    if (object.userData.isHelper || object.material.transparent) return false;
    if (object.type === 'GridHelper' || object.type === 'LineSegments') return false;
    if (!object.userData.faceData) return false; // 只导出面对象
    return true;
  }
  
  /**
   * 创建面网格
   */
  createFaceMesh(faceData, sourceObject) {
    const geometry = faceData.geometry.clone();
    const material = sourceObject.material.clone();
    
    const faceMesh = new THREE.Mesh(geometry, material);
    faceMesh.name = `wall_${faceData.wallId}_face_${faceData.faceIndex}`;
    faceMesh.scale.multiplyScalar(CONSTANTS.EXPORT.SCALE_TO_METERS);
    faceMesh.updateMatrix();
    
    return faceMesh;
  }
  
  
  /**
   * 下载文件
   */
  download(glbData, filename = 'model.glb') {
    const blob = new Blob([glbData], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

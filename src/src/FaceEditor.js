import * as THREE from 'three';
import { CONSTANTS } from './constants.js';
import { GeometryUtils } from './utils/GeometryUtils.js';
import { RegionManager } from './utils/RegionManager.js';

/**
 * 面编辑器 - 负责单个墙面的显示和编辑
 */
export class FaceEditor {
  constructor(app) {
    this.app = app;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.container = null;
    
    this.currentWall = null;
    this.currentFaceIndex = null;
    this.currentIslandData = null;
    this.faceMesh = null;
    
    this.isActive = false;
    
    // 区域绘制相关
    this.regionManager = new RegionManager();
    this.drawingMode = false;
    this.currentPoints = [];
    this.regionMeshes = [];
    this.tempLineMesh = null;
    
    // 坐标系统
    this.faceCenter = null;
    this.faceNormal = null;
    this.faceRight = null;
    this.faceUp = null;
  }
  
  init() {
    const container = document.getElementById('viewport-face');
    if (!container) {
      console.error('Face viewport container not found');
      return;
    }
    
    this.container = container;
    this.initScene();
    this.initCamera(container);
    this.initRenderer(container);
    this.initLighting();
    this.bindEvents();
  }
  
  /**
   * 初始化场景
   */
  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONSTANTS.COLORS.BACKGROUND_3D);
  }
  
  /**
   * 初始化相机
   */
  initCamera(container) {
    const rect = container.getBoundingClientRect();
    
    this.camera = new THREE.OrthographicCamera(
      -rect.width / 2, rect.width / 2,
      rect.height / 2, -rect.height / 2,
      1, 20000
    );
    this.camera.position.set(0, 0, CONSTANTS.FACE_CAMERA_DISTANCE);
  }
  
  /**
   * 初始化渲染器
   */
  initRenderer(container) {
    const rect = container.getBoundingClientRect();
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(rect.width, rect.height);
    container.appendChild(this.renderer.domElement);
  }
  
  /**
   * 初始化光照
   */
  initLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);
  }
  
  /**
   * 绑定事件
   */
  bindEvents() {
    window.addEventListener('resize', () => this.onResize());
    this.renderer.domElement.addEventListener('click', (e) => this.onClick(e));
    this.renderer.domElement.addEventListener('contextmenu', (e) => this.onContextMenu(e));
    this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
  }
  
  /**
   * 窗口大小调整
   */
  onResize() {
    const rect = this.renderer.domElement.parentElement.getBoundingClientRect();
    this.camera.left = -rect.width / 2;
    this.camera.right = rect.width / 2;
    this.camera.top = rect.height / 2;
    this.camera.bottom = -rect.height / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width, rect.height);
  }
  
  /**
   * 设置要编辑的面
   */
  setFace(wall, faceIndex, islandData = null) {
    this.currentWall = wall;
    this.currentFaceIndex = faceIndex;
    this.currentIslandData = islandData;
    this.updateFaceView();
  }
  
  /**
   * 更新面视图
   */
  updateFaceView() {
    if (this.faceMesh) {
      this.scene.remove(this.faceMesh);
      if (this.faceMesh.geometry) this.faceMesh.geometry.dispose();
      if (this.faceMesh.material) {
        if (Array.isArray(this.faceMesh.material)) {
          this.faceMesh.material.forEach(m => m.dispose());
        } else {
          this.faceMesh.material.dispose();
        }
      }
      this.faceMesh = null;
    }
    
    if (!this.currentWall) return;
    
    if (this.currentIslandData?.geometry) {
      this.displayIslandGeometry();
    }
  }
  
  /**
   * 显示孤岛几何体
   */
  displayIslandGeometry() {
    const geometry = this.currentIslandData.geometry;
    
    const savedMaterial = this.currentWall.materials[this.currentFaceIndex];
    const baseColor = savedMaterial ? savedMaterial.color : CONSTANTS.COLORS.DEFAULT_MATERIAL;
    
    // 获取该墙面的区域
    const regions = this.regionManager.getRegions(
      this.currentWall.id,
      this.currentFaceIndex
    );
    
    if (regions.length > 0) {
      // 有区域，需要分割几何体
      this.displayGeometryWithRegions(geometry, baseColor, regions);
    } else {
      // 没有区域，使用单一材质
      const material = new THREE.MeshBasicMaterial({ color: baseColor, side: THREE.DoubleSide });
      this.faceMesh = new THREE.Mesh(geometry, material);
      this.scene.add(this.faceMesh);
    }
    
    this.adjustCameraToFit(geometry);
    this.render();
  }
  
  /**
   * 显示带区域的几何体
   */
  displayGeometryWithRegions(geometry, baseColor, regions) {
    console.log('显示带区域的几何体（CSG方式），区域数量:', regions.length);
    
    // 计算坐标系统
    geometry.computeBoundingBox();
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    
    const avgNormal = this.calculateAverageNormal(geometry);
    const { right, up } = this.createLocalCoordinateSystem(avgNormal);
    
    console.log('坐标系统 - center:', center, 'normal:', avgNormal, 'right:', right, 'up:', up);
    
    // 使用2D多边形裁剪分割几何体
    const splitResult = RegionManager.splitGeometryByRegions2D(
      geometry,
      regions,
      center,
      avgNormal,
      right,
      up
    );
    
    console.log('CSG分割结果:', splitResult);
    
    if (!splitResult || splitResult.parts.length === 0) {
      console.warn('CSG分割失败，使用原始几何体');
      const material = new THREE.MeshBasicMaterial({ color: baseColor, side: THREE.DoubleSide });
      this.faceMesh = new THREE.Mesh(geometry, material);
      this.scene.add(this.faceMesh);
      return;
    }
    
    // 合并所有部分
    const mergedGeometry = RegionManager.mergeGeometryParts(splitResult.parts);
    
    if (!mergedGeometry) {
      console.warn('合并几何体失败，使用原始几何体');
      const material = new THREE.MeshBasicMaterial({ color: baseColor, side: THREE.DoubleSide });
      this.faceMesh = new THREE.Mesh(geometry, material);
      this.scene.add(this.faceMesh);
      return;
    }
    
    // 创建材质数组
    const materials = [];
    
    // 材质0：基础材质（未被区域覆盖的部分）
    const baseMaterial = new THREE.MeshBasicMaterial({ 
      color: baseColor, 
      side: THREE.DoubleSide 
    });
    console.log('材质0（基础）颜色:', baseColor.toString(16));
    materials.push(baseMaterial);
    
    // 为每个区域创建材质
    regions.forEach((region, index) => {
      const regionMaterial = new THREE.MeshBasicMaterial({ 
        color: region.color, 
        side: THREE.DoubleSide 
      });
      console.log(`材质${index + 1}（区域${index}）颜色:`, region.color.toString(16));
      materials.push(regionMaterial);
    });
    
    console.log('材质数组:', materials.length, '个材质');
    console.log('几何体组:', mergedGeometry.groups);
    
    this.faceMesh = new THREE.Mesh(mergedGeometry, materials);
    
    // 确保几何体正确计算
    mergedGeometry.computeBoundingSphere();
    
    console.log('创建的mesh:', this.faceMesh);
    console.log('mesh材质:', this.faceMesh.material);
    console.log('mesh几何体顶点数:', this.faceMesh.geometry.attributes.position.count);
    console.log('mesh可见性:', this.faceMesh.visible);
    
    this.scene.add(this.faceMesh);
    
    console.log('场景中的对象数量:', this.scene.children.length);
    console.log('faceMesh已添加到场景');
  }
  
  /**
   * 调整相机以适应几何体
   */
  adjustCameraToFit(geometry) {
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;
    if (!bbox) return;
    
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    
    const avgNormal = this.calculateAverageNormal(geometry);
    const { right, up } = this.createLocalCoordinateSystem(avgNormal);
    
    // 保存坐标系统供区域绘制使用
    this.faceCenter = center;
    this.faceNormal = avgNormal;
    this.faceRight = right;
    this.faceUp = up;
    
    const { faceWidth, faceHeight } = this.calculateFaceDimensions(
      geometry, center, right, up
    );
    
    this.setupCamera(faceWidth, faceHeight, center, avgNormal, up);
  }
  
  /**
   * 计算平均法向量
   */
  calculateAverageNormal(geometry) {
    const posAttr = geometry.attributes.position;
    const avgNormal = new THREE.Vector3();
    const triangleCount = posAttr.count / 3;
    
    for (let i = 0; i < triangleCount; i++) {
      const i0 = i * 3;
      const i1 = i * 3 + 1;
      const i2 = i * 3 + 2;
      
      const v0 = new THREE.Vector3(posAttr.getX(i0), posAttr.getY(i0), posAttr.getZ(i0));
      const v1 = new THREE.Vector3(posAttr.getX(i1), posAttr.getY(i1), posAttr.getZ(i1));
      const v2 = new THREE.Vector3(posAttr.getX(i2), posAttr.getY(i2), posAttr.getZ(i2));
      
      const normal = GeometryUtils.calculateNormal(v0, v1, v2);
      avgNormal.add(normal);
    }
    
    return avgNormal.normalize();
  }
  
  /**
   * 创建局部坐标系
   */
  createLocalCoordinateSystem(normal) {
    let up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(normal.dot(up)) > 0.99) {
      up.set(1, 0, 0);
    }
    
    const right = new THREE.Vector3().crossVectors(up, normal).normalize();
    const actualUp = new THREE.Vector3().crossVectors(normal, right).normalize();
    
    return { right, up: actualUp };
  }
  
  /**
   * 计算面的尺寸
   */
  calculateFaceDimensions(geometry, center, right, up) {
    const posAttr = geometry.attributes.position;
    let minU = Infinity, maxU = -Infinity;
    let minV = Infinity, maxV = -Infinity;
    
    for (let i = 0; i < posAttr.count; i++) {
      const v = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      const localV = v.clone().sub(center);
      const u = localV.dot(right);
      const vCoord = localV.dot(up);
      
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, vCoord);
      maxV = Math.max(maxV, vCoord);
    }
    
    return {
      faceWidth: maxU - minU,
      faceHeight: maxV - minV
    };
  }
  
  /**
   * 设置相机
   */
  setupCamera(faceWidth, faceHeight, center, normal, up) {
    const viewportRect = this.container.getBoundingClientRect();
    const viewportAspect = viewportRect.width / viewportRect.height;
    const faceAspect = faceWidth / faceHeight;
    
    let viewWidth, viewHeight;
    
    if (faceAspect > viewportAspect) {
      viewWidth = faceWidth * CONSTANTS.FACE_PADDING / 2;
      viewHeight = viewWidth / viewportAspect;
    } else {
      viewHeight = faceHeight * CONSTANTS.FACE_PADDING / 2;
      viewWidth = viewHeight * viewportAspect;
    }
    
    this.camera.left = -viewWidth;
    this.camera.right = viewWidth;
    this.camera.top = viewHeight;
    this.camera.bottom = -viewHeight;
    this.camera.near = 1;
    this.camera.far = 20000;
    this.camera.updateProjectionMatrix();
    
    this.camera.position.copy(center).add(
      normal.clone().multiplyScalar(CONSTANTS.FACE_CAMERA_DISTANCE)
    );
    this.camera.up.copy(up);
    this.camera.lookAt(center);
  }
  
  /**
   * 设置面颜色
   */
  setFaceColor(color) {
    if (!this.currentWall || this.currentFaceIndex === null) return;
    
    this.currentWall.materials[this.currentFaceIndex] = { color };
    
    if (this.faceMesh) {
      this.faceMesh.material.color.setHex(color);
    }
    
    this.app.onWallChanged();
  }
  
  onClick(e) {
    this.app.setActiveViewport('face');
    
    console.log('面编辑器点击，绘制模式:', this.drawingMode, '激活状态:', this.isActive);
    
    if (!this.drawingMode || !this.isActive) return;
    
    // 获取点击位置的2D坐标
    const point2D = this.getClickPoint2D(e);
    console.log('获取到的2D点:', point2D);
    
    if (!point2D) return;
    
    this.currentPoints.push(point2D);
    console.log('当前点数:', this.currentPoints.length);
    
    this.updateTempLine();
  }
  
  /**
   * 右键菜单事件
   */
  onContextMenu(e) {
    e.preventDefault();
    
    if (this.drawingMode && this.currentPoints.length >= 3) {
      // 完成绘制
      this.finishDrawing();
    }
  }
  
  /**
   * 鼠标移动事件
   */
  onMouseMove(e) {
    if (!this.drawingMode || !this.isActive || this.currentPoints.length === 0) return;
    
    const point2D = this.getClickPoint2D(e);
    if (!point2D) return;
    
    this.updateTempLine(point2D);
  }
  
  /**
   * 获取点击位置的2D坐标
   */
  getClickPoint2D(e) {
    console.log('getClickPoint2D 被调用');
    console.log('faceCenter:', this.faceCenter);
    console.log('faceRight:', this.faceRight);
    console.log('faceUp:', this.faceUp);
    console.log('faceMesh:', this.faceMesh);
    
    if (!this.faceCenter || !this.faceRight || !this.faceUp) {
      console.warn('坐标系统未初始化');
      return null;
    }
    
    if (!this.faceMesh) {
      console.warn('faceMesh 不存在');
      return null;
    }
    
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    
    console.log('鼠标归一化坐标:', x, y);
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    
    const intersects = raycaster.intersectObject(this.faceMesh, true); // 添加true以递归检查子对象
    console.log('射线检测结果:', intersects.length, '个交点');
    
    if (intersects.length === 0) {
      console.warn('没有检测到交点');
      return null;
    }
    
    const point3D = intersects[0].point;
    console.log('3D交点:', point3D);
    
    const localPoint = point3D.clone().sub(this.faceCenter);
    const point2D = {
      x: localPoint.dot(this.faceRight),
      y: localPoint.dot(this.faceUp)
    };
    
    console.log('转换后的2D点:', point2D);
    
    return point2D;
  }
  
  /**
   * 更新临时绘制线
   */
  updateTempLine(mousePoint = null) {
    if (this.tempLineMesh) {
      this.scene.remove(this.tempLineMesh);
      this.tempLineMesh.geometry.dispose();
      this.tempLineMesh.material.dispose();
      this.tempLineMesh = null;
    }
    
    if (this.currentPoints.length === 0) return;
    
    const points3D = this.currentPoints.map(p => 
      this.faceCenter.clone()
        .add(this.faceRight.clone().multiplyScalar(p.x))
        .add(this.faceUp.clone().multiplyScalar(p.y))
        .add(this.faceNormal.clone().multiplyScalar(1))
    );
    
    if (mousePoint) {
      points3D.push(
        this.faceCenter.clone()
          .add(this.faceRight.clone().multiplyScalar(mousePoint.x))
          .add(this.faceUp.clone().multiplyScalar(mousePoint.y))
          .add(this.faceNormal.clone().multiplyScalar(1))
      );
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points3D);
    const material = new THREE.LineBasicMaterial({ 
      color: 0xff0000, 
      linewidth: 2,
      depthTest: false
    });
    
    this.tempLineMesh = new THREE.Line(geometry, material);
    this.tempLineMesh.renderOrder = 999;
    this.scene.add(this.tempLineMesh);
    this.render();
  }
  
  /**
   * 完成绘制
   */
  finishDrawing() {
    if (this.currentPoints.length < 3) return;
    
    console.log('完成绘制，点数:', this.currentPoints.length);
    console.log('点坐标:', this.currentPoints);
    
    // 显示颜色选择器
    const color = prompt('请输入区域颜色 (十六进制，如 ff0000):', 'ff0000');
    if (!color) {
      this.cancelDrawing();
      return;
    }
    
    const colorHex = parseInt(color, 16);
    console.log('颜色:', colorHex);
    
    // 添加区域
    const region = this.regionManager.addRegion(
      this.currentWall.id,
      this.currentFaceIndex,
      this.currentPoints,
      colorHex
    );
    
    console.log('添加的区域:', region);
    console.log('当前墙面ID:', this.currentWall.id, '面索引:', this.currentFaceIndex);
    
    // 获取所有区域验证
    const allRegions = this.regionManager.getRegions(
      this.currentWall.id,
      this.currentFaceIndex
    );
    console.log('该墙面的所有区域:', allRegions);
    
    // 更新显示
    this.updateRegionMeshes();
    
    // 清理临时数据
    this.currentPoints = [];
    if (this.tempLineMesh) {
      this.scene.remove(this.tempLineMesh);
      this.tempLineMesh.geometry.dispose();
      this.tempLineMesh.material.dispose();
      this.tempLineMesh = null;
    }
    
    this.render();
    this.app.onWallChanged();
  }
  
  /**
   * 取消绘制
   */
  cancelDrawing() {
    this.currentPoints = [];
    if (this.tempLineMesh) {
      this.scene.remove(this.tempLineMesh);
      this.tempLineMesh.geometry.dispose();
      this.tempLineMesh.material.dispose();
      this.tempLineMesh = null;
    }
    this.render();
  }
  
  /**
   * 更新区域网格
   */
  updateRegionMeshes() {
    // 清理旧的区域网格
    this.regionMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
    this.regionMeshes = [];
    
    // 重新显示整个面（包含区域）
    this.updateFaceView();
  }
  
  /**
   * 设置绘制模式
   */
  setDrawingMode(enabled) {
    this.drawingMode = enabled;
    if (!enabled) {
      this.cancelDrawing();
    }
  }
  
  /**
   * 设置激活状态
   */
  setActive(active) {
    this.isActive = active;
    if (this.container) {
      this.container.classList.toggle('active', active);
    }
  }
  
  /**
   * 渲染场景
   */
  render() {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }
}

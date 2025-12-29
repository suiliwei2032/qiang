import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { CONSTANTS } from './constants.js';
import { GeometryUtils } from './utils/GeometryUtils.js';
import { FaceExtractor } from './utils/FaceExtractor.js';
import { RegionManager } from './utils/RegionManager.js';

/**
 * 3D渲染器 - 负责3D视图的渲染和墙面选择
 */
export class Renderer3D {
  constructor(app) {
    this.app = app;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.container = null;
    
    // 墙体和面
    this.wallFaces = new Map(); // wallId -> faces[]
    this.faceMeshes = []; // 所有面的网格
    
    // 选择相关
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.selectMode = null;
    this.selectedFace = null;
    this.faceHighlight = null;
    
    // CSG评估器
    this.csgEvaluator = new Evaluator();
    
    this.isActive = false;
  }
  
  init() {
    const container = document.getElementById('viewport-3d');
    if (!container) {
      console.error('3D viewport container not found');
      return;
    }
    
    this.container = container;
    this.initScene();
    this.initCamera(container);
    this.initRenderer(container);
    this.initControls();
    this.initLighting();
    this.initHelpers();
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
    this.camera = new THREE.PerspectiveCamera(
      CONSTANTS.CAMERA_FOV,
      rect.width / rect.height,
      CONSTANTS.CAMERA_NEAR,
      CONSTANTS.CAMERA_FAR
    );
    this.camera.position.set(0, CONSTANTS.CAMERA_DISTANCE, CONSTANTS.CAMERA_DISTANCE);
    this.camera.lookAt(0, 0, 0);
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
   * 初始化控制器
   */
  initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableRotate = true;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    this.controls.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE
    };
    this.controls.enabled = false;
  }
  
  /**
   * 初始化光照
   */
  initLighting() {
    const ambientLight = new THREE.AmbientLight(
      0xffffff,
      CONSTANTS.LIGHTING.AMBIENT_INTENSITY
    );
    this.scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(
      0xffffff,
      CONSTANTS.LIGHTING.DIRECTIONAL_INTENSITY
    );
    dirLight.position.set(1, 1, 1);
    this.scene.add(dirLight);
  }
  
  /**
   * 初始化辅助对象
   */
  initHelpers() {
    const gridHelper = new THREE.GridHelper(
      CONSTANTS.GRID_SIZE_3D,
      CONSTANTS.GRID_DIVISIONS
    );
    this.scene.add(gridHelper);
  }
  
  /**
   * 绑定事件
   */
  bindEvents() {
    window.addEventListener('resize', () => this.onResize());
    this.renderer.domElement.addEventListener('click', (e) => this.onClick(e));
    this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    this.renderer.domElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.renderer.domElement.addEventListener('mouseup', (e) => this.onMouseUp(e));
  }
  
  /**
   * 窗口大小调整
   */
  onResize() {
    const rect = this.renderer.domElement.parentElement.getBoundingClientRect();
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width, rect.height);
  }
  
  /**
   * 鼠标点击事件
   */
  onClick(e) {
    if (e.button !== 0) return;
    
    this.app.setActiveViewport('3d');
    
    if (this.isActive && this.selectMode === 'face') {
      this.handleFaceSelection(e);
    }
  }
  
  /**
   * 处理面选择
   */
  handleFaceSelection(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const intersects = this.raycaster.intersectObjects(this.faceMeshes);
    
    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      const faceData = mesh.userData.faceData;
      const wall = this.app.wallManager.getWall(faceData.wallId);
      
      this.selectFace(mesh, faceData);
      this.app.onFaceSelected(wall, faceData.faceIndex, faceData);
    } else {
      this.clearSelection();
    }
  }
  
  /**
   * 选择面
   */
  selectFace(mesh, faceData) {
    this.clearSelection();
    
    this.selectedFace = { mesh, faceData };
    
    // 创建高亮
    const highlightGeometry = faceData.geometry.clone();
    const highlightMaterial = new THREE.MeshBasicMaterial({
      color: CONSTANTS.COLORS.HIGHLIGHT,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthTest: false
    });
    
    this.faceHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    this.faceHighlight.position.copy(mesh.position);
    this.faceHighlight.rotation.copy(mesh.rotation);
    this.faceHighlight.scale.copy(mesh.scale);
    this.faceHighlight.scale.multiplyScalar(1.002);
    
    this.scene.add(this.faceHighlight);
  }
  
  /**
   * 清除选择
   */
  clearSelection() {
    if (this.faceHighlight) {
      this.scene.remove(this.faceHighlight);
      this.faceHighlight = null;
    }
    this.selectedFace = null;
  }
  
  onMouseDown(e) {
    if (e.button === 0) {
      this.app.setActiveViewport('3d');
    }
  }
  
  onMouseUp(e) {}
  
  /**
   * 设置选择模式
   */
  setSelectMode(mode) {
    this.selectMode = mode;
    this.clearSelection();
  }
  
  /**
   * 设置激活状态
   */
  setActive(active) {
    this.isActive = active;
    
    if (this.controls) {
      this.controls.enabled = active;
    }
    
    if (this.container) {
      this.container.classList.toggle('active', active);
    }
  }
  
  /**
   * 更新墙体
   */
  updateWalls() {
    this.clearSelection();
    
    // 清除旧的面网格
    this.faceMeshes.forEach(mesh => this.scene.remove(mesh));
    this.faceMeshes = [];
    this.wallFaces.clear();
    
    const wallBrushes = this.createWallBrushes();
    this.applyCSGAndExtractFaces(wallBrushes);
  }
  
  /**
   * 应用CSG操作并提取面
   */
  applyCSGAndExtractFaces(wallBrushes) {
    for (let i = 0; i < wallBrushes.length; i++) {
      const { wall, brush } = wallBrushes[i];
      let resultBrush = brush;
      
      // 应用CSG布尔运算
      for (let j = 0; j < wallBrushes.length; j++) {
        if (i !== j) {
          const otherBrush = wallBrushes[j].brush;
          
          if (this.checkIntersection(brush, otherBrush)) {
            try {
              resultBrush = this.csgEvaluator.evaluate(resultBrush, otherBrush, SUBTRACTION);
            } catch (e) {
              console.warn('CSG operation failed:', e);
            }
          }
        }
      }
      
      // 将Brush转换为几何体
      const geometry = this.brushToGeometry(resultBrush);
      if (!geometry) continue;
      
      // 从几何体中提取独立的面
      const faces = FaceExtractor.extractFaces(geometry, wall.id);
      this.wallFaces.set(wall.id, faces);
      
      // 为每个面创建网格
      for (const faceData of faces) {
        const faceMesh = this.createFaceMesh(faceData, wall);
        if (faceMesh) {
          this.scene.add(faceMesh);
          this.faceMeshes.push(faceMesh);
        }
      }
    }
  }
  
  /**
   * 将Brush转换为几何体
   */
  brushToGeometry(brush) {
    const geometry = brush.geometry.clone();
    
    if (!geometry.attributes.faceId) {
      this.restoreFaceIds(geometry);
    }
    
    const matrix = new THREE.Matrix4();
    matrix.compose(brush.position, brush.quaternion, brush.scale);
    geometry.applyMatrix4(matrix);
    
    return geometry;
  }
  
  /**
   * 创建面网格
   */
  createFaceMesh(faceData, wall) {
    const savedMaterial = wall.materials[faceData.faceIndex];
    const baseColor = savedMaterial ? savedMaterial.color : CONSTANTS.COLORS.DEFAULT_MATERIAL;
    
    // 获取该墙面的区域
    const regionManager = this.app.faceEditor.regionManager;
    const regions = regionManager.getRegions(wall.id, faceData.faceIndex);
    
    let mesh;
    
    if (regions.length > 0) {
      // 有区域，需要分割几何体
      mesh = this.createMeshWithRegions(faceData.geometry, baseColor, regions);
    } else {
      // 没有区域，使用单一材质
      const material = new THREE.MeshLambertMaterial({ color: baseColor });
      mesh = new THREE.Mesh(faceData.geometry, material);
    }
    
    mesh.userData.faceData = faceData;
    mesh.userData.wallId = wall.id;
    
    return mesh;
  }
  
  /**
   * 创建带区域的网格（使用CSG）
   */
  createMeshWithRegions(geometry, baseColor, regions) {
    // 计算坐标系统
    geometry.computeBoundingBox();
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    
    // 计算平均法向量
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
    avgNormal.normalize();
    
    // 创建局部坐标系
    let up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(avgNormal.dot(up)) > 0.99) {
      up.set(1, 0, 0);
    }
    
    const right = new THREE.Vector3().crossVectors(up, avgNormal).normalize();
    const actualUp = new THREE.Vector3().crossVectors(avgNormal, right).normalize();
    
    // 使用2D多边形裁剪分割几何体
    const splitResult = RegionManager.splitGeometryByRegions2D(
      geometry,
      regions,
      center,
      avgNormal,
      right,
      actualUp
    );
    
    if (!splitResult || splitResult.parts.length === 0) {
      const material = new THREE.MeshLambertMaterial({ color: baseColor });
      return new THREE.Mesh(geometry, material);
    }
    
    // 合并所有部分
    const mergedGeometry = RegionManager.mergeGeometryParts(splitResult.parts);
    
    if (!mergedGeometry) {
      const material = new THREE.MeshLambertMaterial({ color: baseColor });
      return new THREE.Mesh(geometry, material);
    }
    
    // 创建材质数组
    const materials = [];
    
    // 材质0：基础材质
    materials.push(new THREE.MeshLambertMaterial({ color: baseColor }));
    
    // 为每个区域创建材质
    regions.forEach(region => {
      materials.push(new THREE.MeshLambertMaterial({ color: region.color }));
    });
    
    return new THREE.Mesh(mergedGeometry, materials);
  }
  
  /**
   * 创建墙体Brush
   */
  createWallBrushes() {
    const brushes = [];
    
    for (const wall of this.app.wallManager.walls) {
      const brush = this.createWallBrush(wall);
      if (brush) {
        brushes.push({ wall, brush });
      }
    }
    
    return brushes;
  }
  
  /**
   * 创建单个墙体Brush
   */
  createWallBrush(wall) {
    const corners = this.app.wallManager.getWallCorners(wall);
    if (!corners) return null;
    
    const shape = new THREE.Shape();
    shape.moveTo(corners.p1.x, corners.p1.y);
    shape.lineTo(corners.p2.x, corners.p2.y);
    shape.lineTo(corners.p3.x, corners.p3.y);
    shape.lineTo(corners.p4.x, corners.p4.y);
    shape.lineTo(corners.p1.x, corners.p1.y);
    
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: wall.height,
      bevelEnabled: false,
      steps: 1
    });
    
    geometry.rotateX(-Math.PI / 2);
    this.assignFaceIds(geometry, wall);
    
    const brush = new Brush(geometry);
    brush.position.set(0, 0, 0);
    brush.rotation.set(0, 0, 0);
    brush.updateMatrixWorld();
    
    return brush;
  }
  
  /**
   * 为几何体分配面ID
   */
  assignFaceIds(geometry, wall) {
    const positionCount = geometry.attributes.position.count;
    const faceIds = new Float32Array(positionCount);
    
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    const forward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const right = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const up = new THREE.Vector3(0, 1, 0);
    
    const posAttr = geometry.attributes.position;
    const centerX = (wall.start.x + wall.end.x) / 2;
    const centerZ = (wall.start.y + wall.end.y) / 2;
    
    const threshold = wall.thickness * 0.4;
    const heightThreshold = wall.height * 0.05;
    const lengthThreshold = length * 0.4;
    
    for (let i = 0; i < positionCount; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      
      const relPos = new THREE.Vector3(x - centerX, y, z - centerZ);
      const alongLength = relPos.dot(forward);
      const alongThickness = relPos.dot(right);
      const alongHeight = relPos.dot(up);
      
      faceIds[i] = this.determineFaceId(
        alongLength, alongThickness, alongHeight,
        lengthThreshold, threshold, heightThreshold,
        wall.height
      );
    }
    
    geometry.setAttribute('faceId', new THREE.BufferAttribute(faceIds, 1));
  }
  
  /**
   * 确定面ID
   */
  determineFaceId(alongLength, alongThickness, alongHeight, lengthThreshold, threshold, heightThreshold, wallHeight) {
    if (Math.abs(alongHeight - wallHeight) < heightThreshold) return 2; // 上面
    if (Math.abs(alongHeight) < heightThreshold) return 3; // 下面
    if (Math.abs(alongThickness + threshold) < threshold) return 0; // 前面
    if (Math.abs(alongThickness - threshold) < threshold) return 1; // 后面
    if (alongLength < -lengthThreshold) return 4; // 左面
    if (alongLength > lengthThreshold) return 5; // 右面
    
    const absAlong = Math.abs(alongLength);
    const absThick = Math.abs(alongThickness);
    const absHeight = Math.abs(alongHeight);
    
    if (absHeight > absAlong && absHeight > absThick) {
      return alongHeight > 0 ? 2 : 3;
    } else if (absThick > absAlong) {
      return alongThickness > 0 ? 1 : 0;
    } else {
      return alongLength > 0 ? 5 : 4;
    }
  }
  
  /**
   * 检查两个Brush是否相交
   */
  checkIntersection(brush1, brush2) {
    const box1 = new THREE.Box3().setFromObject(brush1);
    const box2 = new THREE.Box3().setFromObject(brush2);
    return box1.intersectsBox(box2);
  }
  
  /**
   * 将Brush转换为Mesh（旧方法，保留用于参考）
   */
  brushToMesh(brush, wall) {
    const savedMaterial = wall.materials[0];
    const color = savedMaterial ? savedMaterial.color : CONSTANTS.COLORS.DEFAULT_MATERIAL;
    const material = new THREE.MeshLambertMaterial({ color });
    
    const geometry = brush.geometry.clone();
    
    if (!geometry.attributes.faceId) {
      this.restoreFaceIds(geometry);
    }
    
    const matrix = new THREE.Matrix4();
    matrix.compose(brush.position, brush.quaternion, brush.scale);
    geometry.applyMatrix4(matrix);
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.wallId = wall.id;
    
    return mesh;
  }
  
  /**
   * 恢复面ID（CSG操作后）
   */
  restoreFaceIds(geometry) {
    const positionAttr = geometry.attributes.position;
    if (!positionAttr) return;
    
    const vertexCount = positionAttr.count;
    const faceIds = new Float32Array(vertexCount);
    
    const faceNormals = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1)
    ];
    
    const triangleCount = geometry.index ? geometry.index.count / 3 : vertexCount / 3;
    
    for (let i = 0; i < triangleCount; i++) {
      const indices = this.getTriangleIndices(geometry, i);
      if (!indices) continue;
      
      const triangle = this.getTriangleFromIndices(positionAttr, indices);
      const normal = GeometryUtils.calculateNormal(triangle.v0, triangle.v1, triangle.v2);
      
      const bestFaceId = this.findBestMatchingFace(normal, faceNormals);
      
      faceIds[indices.i0] = bestFaceId;
      faceIds[indices.i1] = bestFaceId;
      faceIds[indices.i2] = bestFaceId;
    }
    
    geometry.setAttribute('faceId', new THREE.BufferAttribute(faceIds, 1));
  }
  
  /**
   * 获取三角形索引
   */
  getTriangleIndices(geometry, triangleIndex) {
    if (geometry.index) {
      return {
        i0: geometry.index.getX(triangleIndex * 3),
        i1: geometry.index.getX(triangleIndex * 3 + 1),
        i2: geometry.index.getX(triangleIndex * 3 + 2)
      };
    } else {
      return {
        i0: triangleIndex * 3,
        i1: triangleIndex * 3 + 1,
        i2: triangleIndex * 3 + 2
      };
    }
  }
  
  /**
   * 从索引获取三角形
   */
  getTriangleFromIndices(positionAttr, indices) {
    return {
      v0: new THREE.Vector3(
        positionAttr.getX(indices.i0),
        positionAttr.getY(indices.i0),
        positionAttr.getZ(indices.i0)
      ),
      v1: new THREE.Vector3(
        positionAttr.getX(indices.i1),
        positionAttr.getY(indices.i1),
        positionAttr.getZ(indices.i1)
      ),
      v2: new THREE.Vector3(
        positionAttr.getX(indices.i2),
        positionAttr.getY(indices.i2),
        positionAttr.getZ(indices.i2)
      )
    };
  }
  
  /**
   * 找到最匹配的面
   */
  findBestMatchingFace(normal, faceNormals) {
    let bestFaceId = 0;
    let bestDot = -1;
    
    for (let faceId = 0; faceId < faceNormals.length; faceId++) {
      const dot = Math.abs(normal.dot(faceNormals[faceId]));
      if (dot > bestDot) {
        bestDot = dot;
        bestFaceId = faceId;
      }
    }
    
    return bestFaceId;
  }
  
  /**
   * 渲染场景
   */
  render() {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

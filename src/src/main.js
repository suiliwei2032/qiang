import { WallManager } from './WallManager.js';
import { Renderer2D } from './Renderer2D.js';
import { Renderer3D } from './Renderer3D.js';
import { FaceEditor } from './FaceEditor.js';
import { Toolbar } from './Toolbar.js';
import { GLBExporter } from './GLBExporter.js';

/**
 * 主应用类 - 协调各个模块
 */
class App {
  constructor() {
    this.wallManager = new WallManager();
    this.toolbar = new Toolbar(this);
    this.renderer2D = new Renderer2D(this);
    this.renderer3D = new Renderer3D(this);
    this.faceEditor = new FaceEditor(this);
    this.glbExporter = new GLBExporter();
    
    this.init();
  }
  
  /**
   * 初始化应用
   */
  init() {
    try {
      this.toolbar.init();
      this.renderer2D.init();
      this.renderer3D.init();
      this.faceEditor.init();
      this.setActiveViewport('2d');
      this.animate();
    } catch (error) {
      console.error('Application initialization failed:', error);
    }
  }
  
  /**
   * 设置活动视口
   */
  setActiveViewport(viewport) {
    this.renderer2D.setActive(false);
    this.renderer3D.setActive(false);
    this.faceEditor.setActive(false);
    
    switch (viewport) {
      case '2d':
        this.renderer2D.setActive(true);
        break;
      case '3d':
        this.renderer3D.setActive(true);
        break;
      case 'face':
        this.faceEditor.setActive(true);
        break;
    }
  }
  
  /**
   * 动画循环
   */
  animate() {
    requestAnimationFrame(() => this.animate());
    
    try {
      this.renderer2D.render();
      this.renderer3D.render();
      this.faceEditor.render();
    } catch (error) {
      console.error('Render error:', error);
    }
  }
  
  /**
   * 墙体变化回调
   */
  onWallChanged() {
    this.renderer3D.updateWalls();
  }
  
  /**
   * 面选择回调
   */
  onFaceSelected(wall, faceIndex, islandData) {
    this.faceEditor.setFace(wall, faceIndex, islandData);
  }
  
  /**
   * 导出GLB
   */
  exportGLB() {
    try {
      this.glbExporter.export(this.renderer3D.scene, (glbData) => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        this.glbExporter.download(glbData, `wall-model-${timestamp}.glb`);
      });
    } catch (error) {
      console.error('GLB export failed:', error);
      alert('导出失败，请查看控制台了解详情');
    }
  }
}

// 启动应用
new App();

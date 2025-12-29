/**
 * 工具栏管理器 - 负责UI控件的创建和事件处理
 */
export class Toolbar {
  constructor(app) {
    this.app = app;
    this.activeButton = null;
  }
  
  init() {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) {
      console.error('Toolbar element not found');
      return;
    }
    
    toolbar.innerHTML = `
      <button class="tool-btn" id="btn-draw">绘制墙体</button>
      <button class="tool-btn" id="btn-select-face">选择墙面</button>
      <button class="tool-btn" id="btn-draw-region">绘制区域</button>
      <button class="tool-btn" id="btn-export-glb">导出GLB</button>
      
      <div class="tool-input">
        <label>墙体高度(mm):</label>
        <input type="number" id="input-height" value="2800" min="100" step="100">
      </div>
      
      <div class="tool-input">
        <label>墙体厚度(mm):</label>
        <input type="number" id="input-thickness" value="200" min="50" step="10">
      </div>
      
      <div class="tool-input">
        <label>面颜色:</label>
        <input type="color" id="input-color" value="#ffffff">
      </div>
    `;
    
    this.bindEvents();
  }
  
  /**
   * 绑定所有事件
   */
  bindEvents() {
    this.bindButton('btn-draw', 'draw', null);
    this.bindButton('btn-select-face', null, 'face');
    
    document.getElementById('btn-draw-region')?.addEventListener('click', () => {
      const btn = document.getElementById('btn-draw-region');
      if (btn.classList.contains('active')) {
        this.clearActiveButton();
        this.app.faceEditor.setDrawingMode(false);
      } else {
        this.setActiveButton('btn-draw-region');
        this.app.faceEditor.setDrawingMode(true);
      }
    });
    
    document.getElementById('btn-export-glb')?.addEventListener('click', () => {
      this.app.exportGLB();
    });
    
    document.getElementById('input-height')?.addEventListener('change', (e) => {
      const height = parseInt(e.target.value);
      if (height > 0) {
        this.app.wallManager.setWallHeight(height);
      }
    });
    
    document.getElementById('input-thickness')?.addEventListener('change', (e) => {
      const thickness = parseInt(e.target.value);
      if (thickness > 0) {
        this.app.wallManager.setWallThickness(thickness);
      }
    });
    
    document.getElementById('input-color')?.addEventListener('change', (e) => {
      const color = parseInt(e.target.value.replace('#', '0x'));
      this.app.faceEditor.setFaceColor(color);
    });
  }
  
  /**
   * 绑定按钮事件
   */
  bindButton(btnId, mode2D, mode3D) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    btn.addEventListener('click', () => {
      if (btn.classList.contains('active')) {
        this.clearActiveButton();
        this.app.renderer2D.setMode(null);
        this.app.renderer3D.setSelectMode(null);
      } else {
        this.setActiveButton(btnId);
        this.app.renderer2D.setMode(mode2D);
        this.app.renderer3D.setSelectMode(mode3D);
      }
    });
  }
  
  /**
   * 设置活动按钮
   */
  setActiveButton(btnId) {
    this.clearActiveButton();
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.classList.add('active');
      this.activeButton = btnId;
    }
  }
  
  /**
   * 清除所有活动按钮
   */
  clearActiveButton() {
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    this.activeButton = null;
  }
}

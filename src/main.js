import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

// 将 THREE 和 CSG 类暴露到全局，以便原有代码使用
window.THREE = THREE;
window.OrbitControls = OrbitControls;
window.Brush = Brush;
window.Evaluator = Evaluator;
window.SUBTRACTION = SUBTRACTION;

console.log('=== 模块加载完成 ===');
console.log('THREE:', typeof THREE);
console.log('Brush:', typeof Brush);
console.log('Evaluator:', typeof Evaluator);
console.log('SUBTRACTION:', SUBTRACTION);

// 导入主应用逻辑 (在全局变量设置完成后)
import('./app.js');


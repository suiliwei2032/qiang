// 3D 场景管理模块
export class Scene3DManager {
    constructor(app) {
        this.app = app;
    }

    init() {
        console.log('初始化3D场景...');
        
        try {
            if (typeof THREE === 'undefined') {
                console.error('Three.js未加载');
                return;
            }
            
            // 创建场景
            this.app.scene = new THREE.Scene();
            this.app.scene.background = new THREE.Color(0x001133);
            
            // 创建相机（带俯视角度）
            const container = this.app.canvas3d.parentElement;
            const rect = container.getBoundingClientRect();
            
            this.app.camera = new THREE.PerspectiveCamera(75, rect.width / rect.height, 0.1, 1000);
            // 设置相机位置：稍微偏后和偏上，形成俯视角度
            this.app.camera.position.set(0, 8, 5);
            this.app.camera.lookAt(0, 0, 0);
            
            // 创建渲染器
            this.app.renderer = new THREE.WebGLRenderer({ 
                canvas: this.app.canvas3d, 
                antialias: true,
                alpha: true
            });
            this.app.renderer.setSize(rect.width, rect.height);
            this.app.renderer.shadowMap.enabled = true;
            this.app.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            
            // 添加轨道控制器
            setTimeout(() => {
                if (typeof THREE.OrbitControls !== 'undefined') {
                    this.app.controls = new THREE.OrbitControls(this.app.camera, this.app.canvas3d);
                    this.app.controls.enableDamping = true;
                    this.app.controls.dampingFactor = 0.05;
                    console.log('OrbitControls初始化成功');
                } else {
                    console.warn('OrbitControls不可用');
                    this.setupBasicControls();
                }
            }, 100);
            
            // 添加光源
            const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
            this.app.scene.add(ambientLight);
            
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(10, 10, 5);
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            this.app.scene.add(directionalLight);
            
            // 添加网格
            this.addGrid();
            
            // 开始渲染循环
            this.animate();
            
            console.log('3D场景初始化完成');
            
        } catch (error) {
            console.error('3D初始化失败:', error);
        }
    }

    addGrid() {
        try {
            const gridHelper = new THREE.GridHelper(20, 20, 0x006699, 0x004466);
            this.app.scene.add(gridHelper);
            
            const axesHelper = new THREE.AxesHelper(5);
            this.app.scene.add(axesHelper);
        } catch (error) {
            console.error('添加3D网格失败:', error);
        }
    }

    animate() {
        try {
            if (this.app.controls) {
                this.app.controls.update();
            }
            
            if (this.app.renderer && this.app.scene && this.app.camera) {
                this.app.renderer.render(this.app.scene, this.app.camera);
            }
        } catch (error) {
            console.error('3D渲染错误:', error);
            return;
        }
        
        requestAnimationFrame(() => this.animate());
    }

    setupBasicControls() {
        let isMouseDown = false;
        let mouseX = 0, mouseY = 0;
        
        this.app.canvas3d.addEventListener('mousedown', (event) => {
            isMouseDown = true;
            mouseX = event.clientX;
            mouseY = event.clientY;
        });
        
        this.app.canvas3d.addEventListener('mouseup', () => {
            isMouseDown = false;
        });
        
        this.app.canvas3d.addEventListener('mousemove', (event) => {
            if (!isMouseDown) return;
            
            const deltaX = event.clientX - mouseX;
            const deltaY = event.clientY - mouseY;
            
            const spherical = new THREE.Spherical();
            spherical.setFromVector3(this.app.camera.position);
            spherical.theta -= deltaX * 0.01;
            spherical.phi -= deltaY * 0.01;
            spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
            
            this.app.camera.position.setFromSpherical(spherical);
            this.app.camera.lookAt(0, 0, 0);
            
            mouseX = event.clientX;
            mouseY = event.clientY;
        });
        
        this.app.canvas3d.addEventListener('wheel', (event) => {
            event.preventDefault();
            const scale = event.deltaY > 0 ? 1.1 : 0.9;
            this.app.camera.position.multiplyScalar(scale);
        });
    }

    resize() {
        if (this.app.renderer && this.app.camera) {
            const container3d = this.app.canvas3d.parentElement;
            const rect3d = container3d.getBoundingClientRect();
            
            this.app.renderer.setSize(rect3d.width, rect3d.height);
            this.app.camera.aspect = rect3d.width / rect3d.height;
            this.app.camera.updateProjectionMatrix();
        }
    }

    clearWallMeshes() {
        if (typeof THREE === 'undefined' || !this.app.scene) {
            return;
        }
        
        try {
            this.app.wallMeshes.forEach(mesh => {
                this.app.scene.remove(mesh);
                
                if (mesh.geometry) {
                    mesh.geometry.dispose();
                }
                
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        mesh.material.forEach(material => material.dispose());
                    } else {
                        mesh.material.dispose();
                    }
                }
            });
            
            this.app.wallMeshes = [];
        } catch (error) {
            console.error('清空墙体网格时出错:', error);
            this.app.wallMeshes = [];
        }
    }

    update3DModel() {
        if (typeof THREE === 'undefined') {
            return;
        }
        
        if (this.app.walls.length > 0) {
            this.generate3DModel();
        } else {
            this.clearWallMeshes();
        }
    }

    generate3DModel() {
        console.log('=== 开始生成3D模型 ===');
        
        if (!this.app.scene || !this.app.renderer || !this.app.camera) {
            console.error('3D场景未初始化');
            return;
        }
        
        if (this.app.walls.length === 0) {
            return;
        }
        
        try {
            this.clearWallMeshes();
            
            // 检查 CSG 库是否可用
            const hasCSG = typeof window.Brush !== 'undefined' && 
                          typeof window.Evaluator !== 'undefined' && 
                          typeof window.SUBTRACTION !== 'undefined';
            
            console.log('CSG 库可用:', hasCSG);
            
            if (hasCSG) {
                this.app.csgOperations.createWallsWithCSG();
            } else {
                console.error('CSG 库未加载');
                this.createSimpleWalls();
            }
            
            console.log('=== 3D模型生成完成 ===');
            
        } catch (error) {
            console.error('3D模型生成失败:', error);
        }
    }

    createSimpleWalls() {
        console.log('创建简单墙体（无布尔运算）');
        
        for (let i = 0; i < this.app.walls.length; i++) {
            const wall = this.app.walls[i];
            const geometry = this.app.wallGeometry.createWallGeometry(wall);
            
            if (geometry) {
                const material = new THREE.MeshLambertMaterial({ 
                    color: 0x00aa00,
                    transparent: true,
                    opacity: 0.8
                });
                
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                
                this.app.scene.add(mesh);
                this.app.wallMeshes.push(mesh);
            }
        }
    }

    checkCSGLibrary() {
        const hasCSG = typeof window.Brush !== 'undefined' && 
                      typeof window.Evaluator !== 'undefined' && 
                      typeof window.SUBTRACTION !== 'undefined';
        
        console.log('CSG 库检查:', {
            Brush: typeof window.Brush,
            Evaluator: typeof window.Evaluator,
            SUBTRACTION: typeof window.SUBTRACTION
        });
        
        return hasCSG;
    }
}

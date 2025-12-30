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
            
            // 新方案：直接用面构建，不使用CSG
            console.log('使用面构建方案（无CSG）');
            this.createWallsWithFaces();
            
            console.log('=== 3D模型生成完成 ===');
            
        } catch (error) {
            console.error('3D模型生成失败:', error);
        }
    }
    
    /**
     * 用面构建墙体（不使用CSG）
     * 直接从2D数据生成每个面的轮廓，然后创建3D面
     */
    createWallsWithFaces() {
        console.log('\n=== 用面构建墙体 ===');
        
        for (let wallIndex = 0; wallIndex < this.app.walls.length; wallIndex++) {
            const wall = this.app.walls[wallIndex];
            
            console.log(`\n处理墙体 ${wallIndex}`);
            
            // 为每个墙体创建6个面（顶、底、前、后、左、右）
            this.createWallFaces(wall, wallIndex);
        }
    }
    
    /**
     * 为一个墙体创建所有面（考虑穿插）
     */
    createWallFaces(wall, wallIndex) {
        const height = wall.height / 1000;
        const thickness = wall.thickness / 1000;
        const halfThickness = thickness / 2;
        
        // 计算墙体的方向和法向量
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return;
        
        const dirX = dx / length;
        const dirY = dy / length;
        const normalX = -dy / length;  // 垂直于墙体方向，指向右侧
        const normalY = dx / length;
        
        console.log(`\n墙体 ${wallIndex}: 长=${length.toFixed(3)}m, 厚=${thickness.toFixed(3)}m, 高=${height.toFixed(3)}m`);
        console.log(`  方向: (${dirX.toFixed(3)}, ${dirY.toFixed(3)})`);
        console.log(`  法向: (${normalX.toFixed(3)}, ${normalY.toFixed(3)})`);
        
        // 使用 outlineGenerator 计算顶面和底面（带洞）
        const topBottomData = this.app.outlineGenerator.getTopBottomRectangle(
            wall, 
            this.app.walls, 
            wallIndex
        );
        
        console.log(`  顶面/底面: 外部顶点=${topBottomData.outer.length}, 洞数=${topBottomData.holes.length}`);
        console.log(`  角点坐标:`);
        topBottomData.outer.forEach((p, i) => {
            console.log(`    [${i}]: (${p.x.toFixed(3)}, ${p.y.toFixed(3)})`);
        });
        
        // 定义基础面（顶面和底面）
        const baseFaces = [
            {
                name: '顶面',
                normal: new THREE.Vector3(0, 1, 0),
                polygonData: topBottomData,
                isHorizontal: true,
                yPos: height
            },
            {
                name: '底面',
                normal: new THREE.Vector3(0, -1, 0),
                polygonData: topBottomData,
                isHorizontal: true,
                yPos: 0
            }
        ];
        
        // 定义4个侧面的配置
        // 顶点顺序：[0]左后, [1]右后, [2]右前, [3]左前
        const sideConfigs = [
            {
                name: '前侧面',
                normal: new THREE.Vector3(normalX, 0, -normalY),
                basePoint: topBottomData.outer[3],  // 左前角 (索引3)
                xDir: { x: dirX, y: dirY }  // 沿墙体方向
            },
            {
                name: '后侧面',
                normal: new THREE.Vector3(-normalX, 0, normalY),
                basePoint: topBottomData.outer[0],  // 左后角 (索引0)
                xDir: { x: dirX, y: dirY }  // 沿墙体方向
            },
            {
                name: '左侧面',
                normal: new THREE.Vector3(-dirX, 0, dirY),
                basePoint: topBottomData.outer[0],  // 左后角 (索引0)
                xDir: { x: normalX, y: normalY }  // 从后到前
            },
            {
                name: '右侧面',
                normal: new THREE.Vector3(dirX, 0, -dirY),
                basePoint: topBottomData.outer[1],  // 右后角 (索引1)
                xDir: { x: normalX, y: normalY }  // 从后到前
            }
        ];
        
        // 为每个侧面计算分段（考虑穿插和高度差异）
        const allFaces = [...baseFaces];
        
        sideConfigs.forEach(config => {
            console.log(`\n  === 处理 ${config.name} ===`);
            console.log(`    basePoint: (${config.basePoint.x.toFixed(3)}, ${config.basePoint.y.toFixed(3)})`);
            console.log(`    xDir: (${config.xDir.x.toFixed(3)}, ${config.xDir.y.toFixed(3)})`);
            console.log(`    normal: (${config.normal.x.toFixed(2)}, ${config.normal.y.toFixed(2)}, ${config.normal.z.toFixed(2)})`);
            
            // 使用 outlineGenerator 计算侧面的分段
            const segments = this.app.outlineGenerator.getSideRectangles(
                wall,
                config.normal,
                this.app.walls
            );
            
            console.log(`    生成了 ${segments.length} 个分段`);
            
            // segments 可能包含多个独立的闭合区域
            segments.forEach((segmentData, segmentIndex) => {
                console.log(`    区域${segmentIndex + 1}: 顶点数=${segmentData.outer.length}, 洞数=${segmentData.holes.length}`);
                
                allFaces.push({
                    name: segments.length > 1 ? `${config.name}_区域${segmentIndex + 1}` : config.name,
                    normal: config.normal,
                    polygonData: segmentData,
                    isHorizontal: false,
                    basePoint: config.basePoint,
                    xDir: config.xDir
                });
            });
        });
        
        console.log(`  总共生成 ${allFaces.length} 个面`);
        
        // 为每个面创建几何体
        allFaces.forEach((face, faceIndex) => {
            console.log(`  创建 ${face.name}`);
            
            const geometry = this.createFaceGeometryWithHoles(
                face.polygonData,
                face.isHorizontal,
                face.yPos,
                face.basePoint,
                face.xDir
            );
            
            if (!geometry) return;
            
            // 创建材质
            const material = new THREE.MeshStandardMaterial({
                color: 0x888888,
                side: THREE.DoubleSide,
                flatShading: false
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.userData = {
                wallIndex: wallIndex,
                faceIndex: faceIndex,
                faceType: face.name,
                isFaceGroup: true,
                polygonData: face.polygonData  // 保存多边形数据，用于轮廓显示
            };
            
            this.app.scene.add(mesh);
            this.app.wallMeshes.push(mesh);
            
            // 添加轮廓线
            const outlineGeometry = this.createOutlineGeometryWithHoles(
                face.polygonData,
                face.isHorizontal,
                face.yPos,
                face.basePoint,
                face.xDir
            );
            
            if (outlineGeometry) {
                const outlineLine = new THREE.LineSegments(
                    outlineGeometry,
                    new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 })
                );
                this.app.scene.add(outlineLine);
                this.app.wallMeshes.push(outlineLine);
            }
        });
    }
    
    /**
     * 创建带洞的面几何体
     */
    createFaceGeometryWithHoles(polygonData, isHorizontal, yPos, basePoint, xDir) {
        const outer = polygonData.outer || polygonData;
        const holes = polygonData.holes || [];
        
        if (outer.length < 3) return null;
        
        // 创建外部形状
        const shape = new THREE.Shape();
        shape.moveTo(outer[0].x, outer[0].y);
        for (let i = 1; i < outer.length; i++) {
            shape.lineTo(outer[i].x, outer[i].y);
        }
        shape.closePath();
        
        // 添加洞
        holes.forEach(hole => {
            if (hole.length >= 3) {
                const holePath = new THREE.Path();
                holePath.moveTo(hole[0].x, hole[0].y);
                for (let i = 1; i < hole.length; i++) {
                    holePath.lineTo(hole[i].x, hole[i].y);
                }
                holePath.closePath();
                shape.holes.push(holePath);
            }
        });
        
        const geometry = new THREE.ShapeGeometry(shape);
        
        if (isHorizontal) {
            // 水平面（顶面/底面）
            geometry.rotateX(-Math.PI / 2);
            geometry.translate(0, yPos, 0);
        } else {
            // 垂直面（侧面）
            const xAxis3D = new THREE.Vector3(xDir.x, 0, -xDir.y);
            const yAxis3D = new THREE.Vector3(0, 1, 0);
            const zAxis3D = new THREE.Vector3().crossVectors(xAxis3D, yAxis3D);
            
            const matrix = new THREE.Matrix4();
            matrix.makeBasis(xAxis3D, yAxis3D, zAxis3D);
            geometry.applyMatrix4(matrix);
            
            // 移动到基准点
            if (basePoint) {
                geometry.translate(basePoint.x, 0, -basePoint.y);
            }
        }
        
        return geometry;
    }
    
    /**
     * 创建带洞的轮廓线几何体
     */
    createOutlineGeometryWithHoles(polygonData, isHorizontal, yPos, basePoint, xDir) {
        const outer = polygonData.outer || polygonData;
        const holes = polygonData.holes || [];
        
        if (outer.length < 2) return null;
        
        const points = [];
        
        // 绘制外部轮廓
        const drawPolygon = (polygon) => {
            if (isHorizontal) {
                // 水平面
                for (let i = 0; i < polygon.length; i++) {
                    const p1 = polygon[i];
                    const p2 = polygon[(i + 1) % polygon.length];
                    
                    points.push(new THREE.Vector3(p1.x, yPos, -p1.y));
                    points.push(new THREE.Vector3(p2.x, yPos, -p2.y));
                }
            } else {
                // 垂直面
                const xAxis3D = new THREE.Vector3(xDir.x, 0, -xDir.y);
                const yAxis3D = new THREE.Vector3(0, 1, 0);
                const base3D = basePoint ? new THREE.Vector3(basePoint.x, 0, -basePoint.y) : new THREE.Vector3(0, 0, 0);
                
                for (let i = 0; i < polygon.length; i++) {
                    const p1 = polygon[i];
                    const p2 = polygon[(i + 1) % polygon.length];
                    
                    const v1 = new THREE.Vector3()
                        .addScaledVector(xAxis3D, p1.x)
                        .addScaledVector(yAxis3D, p1.y)
                        .add(base3D);
                        
                    const v2 = new THREE.Vector3()
                        .addScaledVector(xAxis3D, p2.x)
                        .addScaledVector(yAxis3D, p2.y)
                        .add(base3D);
                    
                    points.push(v1);
                    points.push(v2);
                }
            }
        };
        
        // 绘制外部轮廓
        drawPolygon(outer);
        
        // 绘制所有洞的轮廓
        holes.forEach(hole => {
            if (hole.length >= 3) {
                drawPolygon(hole);
            }
        });
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        return geometry;
    }
    
    /**
     * 创建简单的面几何体（不考虑穿插）
     */
    createSimpleFaceGeometry(polygon2D, isHorizontal, yPos, basePoint, xDir) {
        if (polygon2D.length < 3) return null;
        
        const shape = new THREE.Shape();
        shape.moveTo(polygon2D[0].x, polygon2D[0].y);
        for (let i = 1; i < polygon2D.length; i++) {
            shape.lineTo(polygon2D[i].x, polygon2D[i].y);
        }
        shape.closePath();
        
        const geometry = new THREE.ShapeGeometry(shape);
        
        if (isHorizontal) {
            // 水平面（顶面/底面）
            geometry.rotateX(-Math.PI / 2);
            geometry.translate(0, yPos, 0);
        } else {
            // 垂直面（侧面）
            const xAxis3D = new THREE.Vector3(xDir.x, 0, -xDir.y);
            const yAxis3D = new THREE.Vector3(0, 1, 0);
            const zAxis3D = new THREE.Vector3().crossVectors(xAxis3D, yAxis3D);
            
            const matrix = new THREE.Matrix4();
            matrix.makeBasis(xAxis3D, yAxis3D, zAxis3D);
            geometry.applyMatrix4(matrix);
            
            // 移动到基准点
            if (basePoint) {
                geometry.translate(basePoint.x, 0, -basePoint.y);
            }
        }
        
        return geometry;
    }
    
    /**
     * 创建简单的轮廓线几何体（不考虑穿插）
     */
    createSimpleOutlineGeometry(polygon2D, isHorizontal, yPos, basePoint, xDir) {
        if (polygon2D.length < 2) return null;
        
        const points = [];
        
        if (isHorizontal) {
            // 水平面
            for (let i = 0; i < polygon2D.length; i++) {
                const p1 = polygon2D[i];
                const p2 = polygon2D[(i + 1) % polygon2D.length];
                
                points.push(new THREE.Vector3(p1.x, yPos, -p1.y));
                points.push(new THREE.Vector3(p2.x, yPos, -p2.y));
            }
        } else {
            // 垂直面
            const xAxis3D = new THREE.Vector3(xDir.x, 0, -xDir.y);
            const yAxis3D = new THREE.Vector3(0, 1, 0);
            const base3D = basePoint ? new THREE.Vector3(basePoint.x, 0, -basePoint.y) : new THREE.Vector3(0, 0, 0);
            
            for (let i = 0; i < polygon2D.length; i++) {
                const p1 = polygon2D[i];
                const p2 = polygon2D[(i + 1) % polygon2D.length];
                
                const v1 = new THREE.Vector3()
                    .addScaledVector(xAxis3D, p1.x)
                    .addScaledVector(yAxis3D, p1.y)
                    .add(base3D);
                    
                const v2 = new THREE.Vector3()
                    .addScaledVector(xAxis3D, p2.x)
                    .addScaledVector(yAxis3D, p2.y)
                    .add(base3D);
                
                points.push(v1);
                points.push(v2);
            }
        }
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        return geometry;
    }
    
    /**
     * 从2D轮廓创建3D面几何体
     */
    createFaceGeometryFromOutline(polygon2D, normal, height, faceType, basePoint, xDir) {
        if (polygon2D.length < 3) return null;
        
        if (Math.abs(normal.y) > 0.9) {
            // 水平面（顶面/底面）
            // polygon2D 中的点已经是世界坐标 (x, y)
            // 直接映射到 3D: (x, height, -y)
            
            const y = normal.y > 0 ? height : 0;
            
            const shape = new THREE.Shape();
            shape.moveTo(polygon2D[0].x, polygon2D[0].y);
            for (let i = 1; i < polygon2D.length; i++) {
                shape.lineTo(polygon2D[i].x, polygon2D[i].y);
            }
            shape.closePath();
            
            const geometry = new THREE.ShapeGeometry(shape);
            geometry.rotateX(-Math.PI / 2);
            geometry.translate(0, y, 0);
            
            return geometry;
            
        } else {
            // 垂直面（侧面）
            // polygon2D 中的点是相对坐标：
            // x: 沿墙体方向或厚度方向的距离
            // y: 高度
            
            const shape = new THREE.Shape();
            shape.moveTo(polygon2D[0].x, polygon2D[0].y);
            for (let i = 1; i < polygon2D.length; i++) {
                shape.lineTo(polygon2D[i].x, polygon2D[i].y);
            }
            shape.closePath();
            
            const geometry = new THREE.ShapeGeometry(shape);
            
            // 转换到3D世界坐标
            // 1. 旋转到垂直面
            // 2. 移动到墙体的实际位置
            
            const xAxis3D = new THREE.Vector3(xDir.x, 0, -xDir.y);
            const yAxis3D = new THREE.Vector3(0, 1, 0);
            const zAxis3D = new THREE.Vector3().crossVectors(xAxis3D, yAxis3D);
            
            const matrix = new THREE.Matrix4();
            matrix.makeBasis(xAxis3D, yAxis3D, zAxis3D);
            geometry.applyMatrix4(matrix);
            
            // 移动到基准点
            if (basePoint) {
                geometry.translate(basePoint.x, 0, -basePoint.y);
            }
            
            return geometry;
        }
    }
    
    /**
     * 从2D轮廓创建轮廓线几何体
     */
    createOutlineGeometryFromOutline(polygon2D, normal, height, faceType, basePoint, xDir) {
        if (polygon2D.length < 2) return null;
        
        const points = [];
        
        if (Math.abs(normal.y) > 0.9) {
            // 水平面
            const y = normal.y > 0 ? height : 0;
            
            for (let i = 0; i < polygon2D.length; i++) {
                const p1 = polygon2D[i];
                const p2 = polygon2D[(i + 1) % polygon2D.length];
                
                points.push(new THREE.Vector3(p1.x, y, -p1.y));
                points.push(new THREE.Vector3(p2.x, y, -p2.y));
            }
        } else {
            // 垂直面
            const xAxis3D = new THREE.Vector3(xDir.x, 0, -xDir.y);
            const yAxis3D = new THREE.Vector3(0, 1, 0);
            
            const base3D = basePoint ? new THREE.Vector3(basePoint.x, 0, -basePoint.y) : new THREE.Vector3(0, 0, 0);
            
            for (let i = 0; i < polygon2D.length; i++) {
                const p1 = polygon2D[i];
                const p2 = polygon2D[(i + 1) % polygon2D.length];
                
                const v1 = new THREE.Vector3()
                    .addScaledVector(xAxis3D, p1.x)
                    .addScaledVector(yAxis3D, p1.y)
                    .add(base3D);
                    
                const v2 = new THREE.Vector3()
                    .addScaledVector(xAxis3D, p2.x)
                    .addScaledVector(yAxis3D, p2.y)
                    .add(base3D);
                
                points.push(v1);
                points.push(v2);
            }
        }
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        return geometry;
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

// CSG 布尔运算模块
export class CSGOperationsManager {
    constructor(app) {
        this.app = app;
    }

    createWallsWithCSG() {
        console.log('=== 使用 CSG 创建墙体 ===');
        
        const { Brush, Evaluator, SUBTRACTION } = window;
        const evaluator = new Evaluator();
        
        // 为每个墙体创建 Brush
        const wallBrushes = [];
        for (let i = 0; i < this.app.walls.length; i++) {
            const wall = this.app.walls[i];
            const brush = this.createWallBrush(wall);
            if (brush) {
                wallBrushes.push({ wall, brush, index: i });
                console.log(`创建墙体 ${i} 的 Brush 成功`);
            }
        }
        
        console.log(`成功创建 ${wallBrushes.length} 个 Brush`);
        
        // 对每个墙体执行 CSG 减法
        for (let i = 0; i < wallBrushes.length; i++) {
            const { wall, brush, index } = wallBrushes[i];
            let resultBrush = brush;
            
            // 检查与其他墙体的相交并执行减法
            for (let j = 0; j < wallBrushes.length; j++) {
                if (i !== j) {
                    const otherBrush = wallBrushes[j].brush;
                    
                    if (this.checkBrushIntersection(resultBrush, otherBrush)) {
                        try {
                            const newBrush = evaluator.evaluate(resultBrush, otherBrush, SUBTRACTION);
                            if (newBrush && newBrush.geometry) {
                                resultBrush = newBrush;
                            }
                        } catch (error) {
                            console.error(`CSG 减法失败:`, error);
                        }
                    }
                }
            }
            
            // 将 Brush 转换为 Mesh 并添加到场景
            const geometry = this.brushToGeometry(resultBrush);
            if (geometry) {
                const material = new THREE.MeshLambertMaterial({ 
                    color: 0x00aa00,
                    transparent: false,
                    opacity: 1.0
                });
                
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.userData.wallIndex = index;
                
                this.app.scene.add(mesh);
                this.app.wallMeshes.push(mesh);
                
                // 添加轮廓边缘线
                const outlineGeometry = this.app.outlineExtractor.createOutlineGeometry(geometry);
                if (outlineGeometry) {
                    const outlineLine = new THREE.LineSegments(
                        outlineGeometry,
                        new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 })
                    );
                    this.app.scene.add(outlineLine);
                    this.app.wallMeshes.push(outlineLine);
                }
                
                // 添加线框（荧光绿色，可选）
                if (this.app.showWireframe) {
                    const wireframe = new THREE.WireframeGeometry(geometry);
                    const wireframeLine = new THREE.LineSegments(
                        wireframe,
                        new THREE.LineBasicMaterial({ color: 0x00ff00, opacity: 0.6, transparent: true })
                    );
                    this.app.scene.add(wireframeLine);
                    this.app.wallMeshes.push(wireframeLine);
                }
                
                console.log(`墙体 ${index} 添加到场景`);
            }
        }
        
        console.log('=== CSG 墙体创建完成 ===');
    }

    createWallBrush(wall) {
        try {
            const { Brush } = window;
            
            const dx = wall.end.x - wall.start.x;
            const dy = wall.end.y - wall.start.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            if (length === 0) return null;
            
            const normalX = -dy / length;
            const normalY = dx / length;
            const halfThickness = (wall.thickness / 1000) / 2;
            
            const p1 = { x: wall.start.x + normalX * halfThickness, y: wall.start.y + normalY * halfThickness };
            const p2 = { x: wall.end.x + normalX * halfThickness, y: wall.end.y + normalY * halfThickness };
            const p3 = { x: wall.end.x - normalX * halfThickness, y: wall.end.y - normalY * halfThickness };
            const p4 = { x: wall.start.x - normalX * halfThickness, y: wall.start.y - normalY * halfThickness };
            
            const shape = new THREE.Shape();
            shape.moveTo(p1.x, p1.y);
            shape.lineTo(p2.x, p2.y);
            shape.lineTo(p3.x, p3.y);
            shape.lineTo(p4.x, p4.y);
            shape.lineTo(p1.x, p1.y);
            
            const geometry = new THREE.ExtrudeGeometry(shape, {
                depth: wall.height / 1000,
                bevelEnabled: false,
                steps: 1
            });
            
            geometry.rotateX(-Math.PI / 2);
            
            const brush = new Brush(geometry);
            brush.updateMatrixWorld();
            
            return brush;
        } catch (error) {
            console.error('创建 Brush 失败:', error);
            return null;
        }
    }

    checkBrushIntersection(brush1, brush2) {
        const box1 = new THREE.Box3().setFromObject(brush1);
        const box2 = new THREE.Box3().setFromObject(brush2);
        return box1.intersectsBox(box2);
    }

    brushToGeometry(brush) {
        try {
            const geometry = brush.geometry.clone();
            const matrix = new THREE.Matrix4();
            matrix.compose(brush.position, brush.quaternion, brush.scale);
            geometry.applyMatrix4(matrix);
            geometry.computeVertexNormals();
            return geometry;
        } catch (error) {
            console.error('Brush 转几何体失败:', error);
            return null;
        }
    }
}

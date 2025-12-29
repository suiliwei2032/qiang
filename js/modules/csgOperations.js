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
                // 创建法向面组mesh
                this.createFaceGroupMeshes(geometry, index);
                
                // 添加轮廓边缘线（黄色）
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

    /**
     * 创建法向面组mesh（始终创建，用于选择）
     */
    createFaceGroupMeshes(geometry, wallIndex) {
        const positions = geometry.attributes.position;
        const vertexCount = positions.count;
        const triangleCount = vertexCount / 3;
        
        console.log(`\n=== 创建墙体 ${wallIndex} 的法向面组 ===`);
        
        // 改进的法向面合并：不仅检查法向量，还要检查面的位置
        const normalGroups = [];
        const normalTolerance = 0.01;
        const positionTolerance = 0.01; // 10mm
        
        for (let i = 0; i < triangleCount; i++) {
            const i0 = i * 3;
            const i1 = i * 3 + 1;
            const i2 = i * 3 + 2;
            
            const v0 = new THREE.Vector3(positions.getX(i0), positions.getY(i0), positions.getZ(i0));
            const v1 = new THREE.Vector3(positions.getX(i1), positions.getY(i1), positions.getZ(i1));
            const v2 = new THREE.Vector3(positions.getX(i2), positions.getY(i2), positions.getZ(i2));
            
            const edge1 = new THREE.Vector3().subVectors(v1, v0);
            const edge2 = new THREE.Vector3().subVectors(v2, v0);
            const normal = new THREE.Vector3().crossVectors(edge1, edge2);
            
            const area = normal.length() / 2;
            if (area < 0.000001) continue;
            
            normal.normalize();
            
            // 计算三角形中心点
            const center = new THREE.Vector3()
                .add(v0)
                .add(v1)
                .add(v2)
                .divideScalar(3);
            
            // 查找相似法向量且位置接近的组
            let foundGroup = false;
            for (let group of normalGroups) {
                const similarity = Math.abs(group.normal.dot(normal));
                
                // 检查法向量是否相似
                if (similarity > 1 - normalTolerance) {
                    // 检查位置是否接近（在同一平面上）
                    const distanceToPlane = Math.abs(group.normal.dot(
                        new THREE.Vector3().subVectors(center, group.center)
                    ));
                    
                    if (distanceToPlane < positionTolerance) {
                        group.triangles.push({ v0, v1, v2 });
                        // 更新组的中心点（平均值）
                        group.center.add(center).divideScalar(2);
                        foundGroup = true;
                        break;
                    }
                }
            }
            
            if (!foundGroup) {
                normalGroups.push({
                    normal: normal.clone(),
                    center: center.clone(),
                    triangles: [{ v0, v1, v2 }]
                });
            }
        }
        
        console.log(`法向面分组: ${normalGroups.length} 组`);
        
        // 为每个法向面组创建mesh
        const colors = [
            0xff3333, // 亮红
            0x33ff33, // 亮绿
            0x3333ff, // 亮蓝
            0xffff33, // 亮黄
            0xff33ff, // 亮品红
            0x33ffff, // 亮青
            0xff9933, // 亮橙
            0x9933ff, // 亮紫
            0xff3399, // 亮粉
            0x99ff33, // 亮黄绿
            0x3399ff, // 亮天蓝
            0xff9966  // 亮珊瑚
        ];
        
        normalGroups.forEach((group, groupIndex) => {
            const color = colors[groupIndex % colors.length];
            
            const groupPositions = [];
            group.triangles.forEach(tri => {
                groupPositions.push(
                    tri.v0.x, tri.v0.y, tri.v0.z,
                    tri.v1.x, tri.v1.y, tri.v1.z,
                    tri.v2.x, tri.v2.y, tri.v2.z
                );
            });
            
            const groupGeometry = new THREE.BufferGeometry();
            groupGeometry.setAttribute('position', new THREE.Float32BufferAttribute(groupPositions, 3));
            groupGeometry.computeVertexNormals();
            
            // 使用彩色半透明材质，便于区分不同的面组
            const material = new THREE.MeshLambertMaterial({ 
                color: color,
                emissive: color,
                emissiveIntensity: 0.3,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide
            });
            
            const mesh = new THREE.Mesh(groupGeometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.wallIndex = wallIndex;
            mesh.userData.faceGroupIndex = groupIndex;
            mesh.userData.isFaceGroup = true;
            
            // 始终可见
            mesh.visible = true;
            
            this.app.scene.add(mesh);
            this.app.wallMeshes.push(mesh);
            
            const centerStr = `(${group.center.x.toFixed(2)}, ${group.center.y.toFixed(2)}, ${group.center.z.toFixed(2)})`;
            const normalStr = `(${group.normal.x.toFixed(2)}, ${group.normal.y.toFixed(2)}, ${group.normal.z.toFixed(2)})`;
            console.log(`  组 ${groupIndex}: 颜色=#${color.toString(16).padStart(6, '0')}, 三角形=${group.triangles.length}, 中心=${centerStr}, 法向=${normalStr}`);
        });
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

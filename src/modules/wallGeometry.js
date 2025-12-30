// 墙体几何体生成模块
export class WallGeometryManager {
    generateWallPolygon(start, end, wallThickness) {
        const thickness = wallThickness / 1000; // 毫米转米
        
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return [];
        
        const normalX = -dy / length;
        const normalY = dx / length;
        const halfThickness = thickness / 2;
        
        return [
            {
                x: start.x + normalX * halfThickness,
                y: start.y + normalY * halfThickness
            },
            {
                x: end.x + normalX * halfThickness,
                y: end.y + normalY * halfThickness
            },
            {
                x: end.x - normalX * halfThickness,
                y: end.y - normalY * halfThickness
            },
            {
                x: start.x - normalX * halfThickness,
                y: start.y - normalY * halfThickness
            }
        ];
    }

    createWallGeometry(wall) {
        if (typeof THREE === 'undefined') {
            console.error('THREE.js未加载');
            return null;
        }
        
        try {
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
            geometry.computeVertexNormals();
            
            return geometry;
        } catch (error) {
            console.error('创建墙体几何体失败:', error);
            return null;
        }
    }

    findWallEndpoint(coords, walls) {
        const tolerance = 0.1; // 10cm 容差
        
        for (let wall of walls) {
            const startDist = Math.sqrt(
                Math.pow(coords.x - wall.start.x, 2) + 
                Math.pow(coords.y - wall.start.y, 2)
            );
            if (startDist <= tolerance) {
                return { wall: wall, point: 'start' };
            }
            
            const endDist = Math.sqrt(
                Math.pow(coords.x - wall.end.x, 2) + 
                Math.pow(coords.y - wall.end.y, 2)
            );
            if (endDist <= tolerance) {
                return { wall: wall, point: 'end' };
            }
        }
        
        return null;
    }
}

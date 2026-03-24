import { drawElement, drawWire, GRID_SIZE } from './draw.js';
import { 
    union, add, addPoint, 
    getRectWidth, getRectHeight 
} from './geo.js';

/**
 * Генерирует Base64 превью схемы
 */
export const generateProjectPreview = (schemaElements, libElements, width = 300, height = 200) => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tctx = tempCanvas.getContext('2d');

    // 1. Считаем границы всей схемы
    let bounds = [Infinity, Infinity, -Infinity, -Infinity];
    
    // Элементы
    Object.values(schemaElements.elements).forEach(elem => {
        const lib = libElements[elem.typeId];
        if (lib) {
            // Учитываем границы и пины
            let elemBounds = [...lib.bounds[elem.rotateIndex]];
            Object.values(lib.pins[elem.rotateIndex]).forEach(pin => {
                elemBounds = union(elemBounds, pin);
            });
            elemBounds = add(elemBounds, elem.pos);
            bounds = union(bounds, elemBounds);
        }
    });

    // Провода
    Object.values(schemaElements.wires).forEach(wire => {
        wire.path.forEach(pt => { bounds = union(bounds, pt); });
    });

    // Если схема пуста — возвращаем прозрачный холст или null
    if (bounds[0] === Infinity) return tempCanvas.toDataURL('image/png');

    const parrotW = getRectWidth(bounds);
    const parrotH = getRectHeight(bounds);

    // 2. Свободное масштабирование (с отступом 10%)
    const zoom = Math.min(width / (parrotW * GRID_SIZE), height / (parrotH * GRID_SIZE)) * 0.9;
    const interval = zoom * GRID_SIZE;

    // Центрирование камеры
    const offsetX = bounds[0] - (width / interval - parrotW) / 2;
    const offsetY = bounds[1] - (height / interval - parrotH) / 2;

    const toScreen = (pt) => [
        (pt[0] - offsetX) * interval,
        (pt[1] - offsetY) * interval
    ];

    // 3. Финальная отрисовка
    tctx.fillStyle = '#ffffff'; // Белый фон
    tctx.fillRect(0, 0, width, height);

    // Рисуем элементы
    Object.values(schemaElements.elements).forEach(elem => {
        const lib = libElements[elem.typeId];
        if (lib) {
            drawElement(tctx, {
                ...lib,
                pos: toScreen(elem.pos),
                zoom: zoom,
                rotateIndex: elem.rotateIndex,
                typeIndex: elem.typeIndex,
                color: '#333',
                width: 1
            });
        }
    });

    // Рисуем провода
    Object.values(schemaElements.wires).forEach(wire => {
        drawWire(tctx, wire.path, 1, '#333', (pt) => toScreen(pt));
    });

    return tempCanvas.toDataURL('image/png', 0.8);
};
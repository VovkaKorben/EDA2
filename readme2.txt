https://github.com/VovkaKorben/EDA.git

плата 50*100 мм
шаг сетки 0,125
итого узлов 50/0,125 = 400-2 (минус край)
итого узлов 50/0,125 = 800-2 (минус край)
всего узлов 398*798 = 317604







mouse move
-------------------------
drag mode: IDLE
findPinAt? highlight pin - если к нему ЕЩЕ нет проводов
findElemAt? highlight elem
findWireAt? highlight wire segment

drag mode: DRAG
----------------------
mouse on elem -> drag elem(s) + recalc wires
else drag canvas


mouse down
-------------------------

click at pin: если к нему ЕЩЕ нет проводов, запускаем А* on-the-fly (rubber mode)
click at elem: (no shift ->  clear all selected)  toggle curr elem selection 
click at wire: select wire (segment/all ?)


keyboards event
-------------------------------
esc - отменяет резинку провода
del - если выбран элемент(ы)/провод - удаляет его (для провода наверно всё удаляет, чтобы наш Т-коннект не остался в воздухе)



Это работает по простым правилам (при повороте против часовой стрелки):90 градусов: меняешь местами X и Y, затем у нового X меняешь знак на противоположный. Было $(x, y)$ — стало $(-y, x)$.180 градусов: координаты остаются на своих местах, но у обеих меняется знак. Было $(x, y)$ — стало $(-x, -y)$.270 градусов (или -90): меняешь местами X и Y, затем у нового Y меняешь знак. Было $(x, y)$ — стало $(y, -x)$.



// Логика для getObjectUnderCursor
const TOLERANCE = 0.3; // Допуск в "попугаях" для удобства клика

for (const wire of wires) {
    for (let i = 0; i < wire.path.length - 1; i++) {
        const [x1, y1] = wire.path[i];
        const [x2, y2] = wire.path[i + 1];
        const [mx, my] = mouseParrotPos; // Позиция мыши в попугаях

        // Если это горизонтальный сегмент (y одинаковый)
        if (y1 === y2) {
            if (Math.abs(my - y1) < TOLERANCE && 
                mx >= Math.min(x1, x2) - TOLERANCE && 
                mx <= Math.max(x1, x2) + TOLERANCE) {
                return { type: ObjectType.WIRE, wireId: wire.id, pos: [Math.round(mx), y1] };
            }
        }
        // Если это вертикальный сегмент (x одинаковый)
        else if (x1 === x2) {
            if (Math.abs(mx - x1) < TOLERANCE && 
                my >= Math.min(y1, y2) - TOLERANCE && 
                my <= Math.max(y1, y2) + TOLERANCE) {
                return { type: ObjectType.WIRE, wireId: wire.id, pos: [x1, Math.round(my)] };
            }
        }
    }
}


навели
компонент/пин/провод/т-конн - подсветился


компонент тягать можем
провод/пин/т-конн нет


режим роута 
не работает зум и перемещение холста




 // if (dragMode.current === DragModeType.ROUTING && aStarRef.current) { drawGridDebug(ctx, aStarRef.current, GlobalToScreen); }
        // elementes

        /* Object.values(schemaElements.elements).forEach(elem => {// each element on schematic
             // Рисуем сетку А*, если мы в режиме роутинга
 
 
             // Подсветка пинов и узлов (PIN / TCONN) 
             if (hovered.type === ObjectType.PIN || hovered.type === ObjectType.TCONN) {
                 let drawPoint;
                 if (hovered.type === ObjectType.PIN) {
                     drawPoint = pinToCoords(hovered);
 
                 } else if (hovered.type === ObjectType.TCONN) {
                     //
                 }
                 drawPoint = GlobalToScreen(drawPoint);
                 ctx.lineWidth = 1; ctx.fillStyle = DrawColor.HOVERED;
                 ctx.beginPath();
                 ctx.arc(...drawPoint, 5, 0, 2 * Math.PI);
                 ctx.fill();
             }
         });
         */
        /*
        // Отрисовка проводов (существующих)
            schemaElements.wires.forEach(wire => {
            let isHovered = (hovered.type === ObjectType.WIRE && hovered.wireId === wire.id);
            // Рисуем линию. Если isHovered — делаем её толще или ярче.
        });
 
        // Отрисовка элементов и их пинов
       
*/
        // wires

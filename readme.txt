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
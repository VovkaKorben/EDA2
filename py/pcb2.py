import pygame
import json
import sys

# Настройки визуализации
JSON_FILENAME = "E:/Riveria/EDA2/front/src/helpers/grid.json"
CELL_SIZE = 25
MARGIN = CELL_SIZE * 2  
COLORS = {
    "bg": (30, 30, 30),
    "grid": (50, 50, 50),
    "pcb": {
        1: (0, 255, 0),   # Зеленый
        2: (255, 255, 0), # Желтый
        3: (255, 0, 0)    # Красный
    },
}

def load_data(filename):
    with open(filename, 'r') as f:
        return json.load(f)

def main():
    # Начальная загрузка
    try:
        data = load_data(JSON_FILENAME)
    except Exception as e:
        print(f"Ошибка загрузки: {e}")
        return

    w, h = data['w'], data['h']
    pcb = data.get('pcb', {})
    draw_paths = data.get('draw', {})

    pygame.init()
    
    # Размер окна
    screen_w = (w - 1) * CELL_SIZE + 2 * MARGIN
    screen_h = (h - 1) * CELL_SIZE + 2 * MARGIN
    screen = pygame.display.set_mode((screen_w, screen_h))
    pygame.display.set_caption("PCB Route Visualizer")

    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            
            # Перечитываем файл при клике
            if event.type == pygame.MOUSEBUTTONDOWN:
                try:
                    data = load_data(JSON_FILENAME)
                    w, h = data['w'], data['h']
                    pcb = data.get('pcb', {})
                    draw_paths = data.get('draw', {})
                    print("Данные обновлены")
                except Exception as e:
                    print(f"Ошибка при перезагрузке файла: {e}")

        screen.fill(COLORS["bg"])

        # 1. Рисуем сетку
        for x in range(w):
            start_p = (x * CELL_SIZE + MARGIN, MARGIN)
            end_p = (x * CELL_SIZE + MARGIN, (h - 1) * CELL_SIZE + MARGIN)
            pygame.draw.line(screen, COLORS["grid"], start_p, end_p)
        for y in range(h):
            start_p = (MARGIN, y * CELL_SIZE + MARGIN)
            end_p = ((w - 1) * CELL_SIZE + MARGIN, y * CELL_SIZE + MARGIN)
            pygame.draw.line(screen, COLORS["grid"], start_p, end_p)

        # 2. Рисуем линии (трассы) из объекта "draw"
        for net_id, paths in draw_paths.items():
            color = COLORS["pcb"].get(int(net_id), (255, 255, 255))
            
            for path in paths:
                if len(path) < 2:
                    continue
                
                # Преобразуем координаты сетки в экранные координаты
                screen_points = []
                for pt in path:
                    sx = pt[0] * CELL_SIZE + MARGIN
                    sy = pt[1] * CELL_SIZE + MARGIN
                    screen_points.append((sx, sy))
                
                # Рисуем ломаную линию
                pygame.draw.lines(screen, color, False, screen_points, 3)

     # 3. Рисуем PCB точки (контакты) поверх линий
        # Превращаем pcb в итерируемый список пар (индекс, значение)
        if isinstance(pcb, list):
            pcb_items = enumerate(pcb)
        else:
            pcb_items = pcb.items()

        for idx_str, val in pcb_items:
            if val == 0: continue
            
            idx = int(idx_str)
            curr_y = idx // w
            curr_x = idx % w
            
            pos = (curr_x * CELL_SIZE + MARGIN, curr_y * CELL_SIZE + MARGIN)
            color = COLORS["pcb"].get(val, (255, 255, 255))
            
            # Основная точка
            pygame.draw.circle(screen, color, pos, 6)
            # Черная обводка для четкости
            pygame.draw.circle(screen, (0, 0, 0), pos, 6, 1)

        pygame.display.flip()

    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main()
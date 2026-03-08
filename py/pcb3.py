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
    }
}

def load_data(filename):
    with open(filename, 'r') as f:
        return json.load(f)

def get_dimmed_color(color_id):
    """Приглушает цвет (компоненты не выше 50) для подложки"""
    base = COLORS["pcb"].get(color_id, (255, 255, 255))
    return tuple((50 if c > 0 else 0) for c in base)

def main():
    try:
        data = load_data(JSON_FILENAME)
    except Exception as e:
        print(f"Ошибка загрузки: {e}")
        return

    w, h = data['w'], data['h']
    # pcb = data.get('pcb', []) # Больше не используем для отрисовки кружков
    draw_paths = data.get('draw', {})
    sorted_nets = data.get('sortedNets', {})

    pygame.init()
    screen_w = (w - 1) * CELL_SIZE + 2 * MARGIN
    screen_h = (h - 1) * CELL_SIZE + 2 * MARGIN
    screen = pygame.display.set_mode((screen_w, screen_h))
    pygame.display.set_caption("PCB Route Visualizer")

    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            if event.type == pygame.MOUSEBUTTONDOWN:
                try:
                    data = load_data(JSON_FILENAME)
                    w, h = data['w'], data['h']
                    draw_paths = data.get('draw', {})
                    sorted_nets = data.get('sortedNets', {})
                    print("Данные обновлены")
                except Exception as e:
                    print(f"Ошибка обновления: {e}")

        screen.fill(COLORS["bg"])

        # 1. Рисуем сетку
        for x in range(w):
            pygame.draw.line(screen, COLORS["grid"], (x*CELL_SIZE + MARGIN, MARGIN), (x*CELL_SIZE + MARGIN, (h-1)*CELL_SIZE + MARGIN))
        for y in range(h):
            pygame.draw.line(screen, COLORS["grid"], (MARGIN, y*CELL_SIZE + MARGIN), ((w-1)*CELL_SIZE + MARGIN, y*CELL_SIZE + MARGIN))

        # 2. sortedNets — приглушенные квадраты (подложка)
        for net_id, coords in sorted_nets.items():
            dim_color = get_dimmed_color(int(net_id))
            for pt in coords:
                nx, ny = pt[0], pt[1]
                x_pos = nx * CELL_SIZE + MARGIN - CELL_SIZE // 2
                y_pos = ny * CELL_SIZE + MARGIN - CELL_SIZE // 2
                pygame.draw.rect(screen, dim_color, (x_pos, y_pos, CELL_SIZE, CELL_SIZE))
                pygame.draw.rect(screen, (0, 0, 0), (x_pos, y_pos, CELL_SIZE, CELL_SIZE), 1)

        # 3. draw — Линии и Узлы (кружки строго по точкам из массива draw)
        for net_id, paths in draw_paths.items():
            color = COLORS["pcb"].get(int(net_id), (255, 255, 255))
            for path in paths:
                if not path: continue
                
                screen_points = [(pt[0]*CELL_SIZE + MARGIN, pt[1]*CELL_SIZE + MARGIN) for pt in path]
                
                # Рисуем саму линию (трассу)
                if len(screen_points) >= 2:
                    pygame.draw.lines(screen, color, False, screen_points, 3)
                
                # Рисуем кружки во всех точках, которые ЯВНО перечислены в draw
                for sp in screen_points:
                    pygame.draw.circle(screen, color, sp, 4)

        # Секция 4 (pcb) удалена, так как она забивала экран лишними точками.
        
        pygame.display.flip()

    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main()
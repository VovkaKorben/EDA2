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
        1: (0, 255, 0),   
        2: (255, 255, 0), 
        3: (255, 0, 0)    
    },
    "net":  {
        1: (0, 50, 0),   
        2: (50, 50, 0), 
        3: (50, 0, 0)    
    },
}

def load_data(filename):
    with open(filename, 'r') as f:
        return json.load(f)

def draw_cross(surface, x, y, size, color):
    # Рисуем крестик с центром в точке (x, y)
    s = size // 2
    pygame.draw.line(surface, color, (x - s, y - s), (x + s, y + s), 2)
    pygame.draw.line(surface, color, (x + s, y - s), (x - s, y + s), 2)

def main():
    # Начальная загрузка
    data = load_data(JSON_FILENAME)
    w, h = data['w'], data['h']
    pcb = data.get('pcb', {})
    nets = data.get('nets', {})

    pygame.init()
    
    # Размер окна
    screen_w = (w - 1) * CELL_SIZE + 2 * MARGIN
    screen_h = (h - 1) * CELL_SIZE + 2 * MARGIN
    screen = pygame.display.set_mode((screen_w, screen_h))
    pygame.display.set_caption("Grid Visualizer (Click to Refresh)")

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
                    nets = data.get('nets', {})
                    # Если размеры сетки могли измениться, можно обновить screen здесь,
                    # но пока оставляем фиксированным под первый запуск.
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

        # 3. Рисуем NETS (крестики)
        for net_id, coords in nets.items():
          

            net_color = COLORS["net"].get( int(net_id), (255, 255, 255))
            
            for pt in coords:
                nx, ny = pt[0], pt[1]
                # Вычисляем координаты так, чтобы узел был центром квадрата
                x_pos = nx * CELL_SIZE + MARGIN - CELL_SIZE // 2
                y_pos = ny * CELL_SIZE + MARGIN - CELL_SIZE // 2
                rect_pos = (x_pos, y_pos, CELL_SIZE, CELL_SIZE)
                
                # Заливка цветом
                pygame.draw.rect(screen, net_color, rect_pos)
                # Черный контур в 1 пиксель
                pygame.draw.rect(screen, (0, 0, 0), rect_pos, 1)
        # 2. Рисуем PCB точки
        for idx_str, val in pcb.items():
            if val == 0: continue
            
            idx = int(idx_str)
            curr_y = idx // w
            curr_x = idx % w
            
            pos = (curr_x * CELL_SIZE + MARGIN, curr_y * CELL_SIZE + MARGIN)
            color = COLORS["pcb"].get(val, (255, 255, 255))
            pygame.draw.circle(screen, color, pos, 5)


        pygame.display.flip()

    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main()
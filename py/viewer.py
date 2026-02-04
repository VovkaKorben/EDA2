import pygame
import json
import sys

# Настройки цветов
COLOR_BG = (30, 30, 30)
COLOR_RECT = (70, 70, 70)
COLOR_BORDER = (100, 100, 100)
COLOR_PATH = (0, 255, 0)
COLOR_START = (255, 50, 50)
COLOR_GOAL = (50, 50, 255)

def run_viewer():
    try:
        with open('data.json', 'r') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Ошибка загрузки: {e}")
        return

    gridX = data['gridX']
    gridY = data['gridY']
    elemRects = data['elemRects']
    startPin = data['startPinCoords']
    goalPin = data['goalPinCoords']
    path_indices = data['path']
    w = len(gridX)

    pygame.init()
    # Авто-подбор размера окна под сетку
    screen = pygame.display.set_mode((int(max(gridX)) + 100, int(max(gridY)) + 100))
    pygame.display.set_caption("AStar Route Viewer")

    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()

        screen.fill(COLOR_BG)

        # 1. Отрисовка корпусов компонентов
        for r in elemRects:
            # r: [x1, y1, x2, y2]
            width = r[2] - r[0]
            height = r[3] - r[1]
            pygame.draw.rect(screen, COLOR_RECT, (r[0], r[1], width, height))
            pygame.draw.rect(screen, COLOR_BORDER, (r[0], r[1], width, height), 1)

        # 2. Отрисовка пути
        if path_indices and len(path_indices) > 1:
            points = []
            for idx in path_indices:
                ix = idx % w
                iy = idx // w
                points.append((gridX[ix], gridY[iy]))
            
            pygame.draw.lines(screen, COLOR_PATH, False, points, 2)

        # 3. Отрисовка пинов
        pygame.draw.circle(screen, COLOR_START, (int(startPin[0]), int(startPin[1])), 5)
        pygame.draw.circle(screen, COLOR_GOAL, (int(goalPin[0]), int(goalPin[1])), 5)

        pygame.display.flip()

if __name__ == "__main__":
    run_viewer()
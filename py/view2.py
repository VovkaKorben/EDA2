import json
import pygame
import sys


def draw_rectangles(filename):
    pygame.init()
    screen = pygame.display.set_mode((1200, 1000))
    pygame.display.set_caption("Отрисовка прямоугольников")

    with open(filename, "r") as f:
        rects = json.load(f)

    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

        screen.fill((255, 255, 255))  # Белый фон

        for r in rects:
            w = r["r"] - r["l"]
            h = r["b"] - r["t"]
            # Цвет контура, координаты (x, y, ширина, высота), толщина линии
            pygame.draw.rect(screen, (0, 100, 250), (r["l"], r["t"], w, h), 2)

        pygame.display.flip()

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    draw_rectangles("rects.json")

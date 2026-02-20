import json
import pygame
import sys

def draw_packing(filename):
    with open(filename, 'r') as f:
        data = json.load(f)

    bin_w = data['binW']
    bin_h = data['binH']
    rects = data['rects']

    pygame.init()
    margin = 50 
    screen = pygame.display.set_mode((bin_w + margin * 2, bin_h + margin * 2))
    pygame.display.set_caption("Корзина с прямоугольниками")

    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

        screen.fill((255, 255, 255))

        # Отрисовка корзины (красная рамка)
        pygame.draw.rect(screen, (255, 0, 0), (margin, margin, bin_w, bin_h), 3)

        # Отрисовка прямоугольников (синий контур)
        for r in rects:
            w = r['r'] - r['l']
            h = r['b'] - r['t']
            pygame.draw.rect(screen, (0, 100, 250), (margin + r['l'], margin + r['t'], w, h), 1)

        pygame.display.flip()

    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    draw_packing("packed.json")
import pygame
import json
import os

# --- НАСТРОЙКИ ---
FILE_NAME = "result.json"  # Имя вашего файла с результатами
SCALE = 2                  # Масштаб отрисовки
WINDOW_PADDING = 50
COLORS = {
    "background": (240, 248, 240),  # Светло-зеленый фон
    "rect_border": (255, 0, 0),     # Красные границы
    "text": (0, 0, 0),              # Черный текст
    "bin_border": (0, 0, 0)         # Черная граница корзины
}

def run_visualizer():
    # Проверяем наличие файла
    if not os.path.exists(FILE_NAME):
        print(f"Ошибка: Файл {FILE_NAME} не найден!")
        return

    # Читаем данные из файла
    try:
        with open(FILE_NAME, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Ошибка при чтении JSON: {e}")
        return

    bin_w = data.get("binW", 0)
    bin_h = data.get("binH", 0)
    rects = data.get("rects", [])

    pygame.init()
    
    # Размер окна с учетом отступов и масштаба
    screen_w = int(bin_w * SCALE + WINDOW_PADDING * 2)
    screen_h = int(bin_h * SCALE + WINDOW_PADDING * 2)
    
    # Защита от слишком маленьких окон
    screen_w = max(screen_w, 400)
    screen_h = max(screen_h, 400)
    
    screen = pygame.display.set_mode((screen_w, screen_h))
    pygame.display.set_caption(f"Аннушка: Проверка {FILE_NAME}")
    
    font = pygame.font.SysFont("Arial", int(10 * SCALE))
    clock = pygame.time.Clock()

    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

        screen.fill((255, 255, 255)) 

        # 1. Рисуем корзину (Bin)
        bin_rect = pygame.Rect(WINDOW_PADDING, WINDOW_PADDING, bin_w * SCALE, bin_h * SCALE)
        pygame.draw.rect(screen, COLORS["background"], bin_rect)
        pygame.draw.rect(screen, COLORS["bin_border"], bin_rect, 2)

        # 2. Рисуем упакованные прямоугольники
        for r in rects:
            # Считаем координаты
            x = WINDOW_PADDING + r["l"] * SCALE
            y = WINDOW_PADDING + r["t"] * SCALE
            w = (r["r"] - r["l"]) * SCALE
            h = (r["b"] - r["t"]) * SCALE
            
            draw_r = pygame.Rect(int(x), int(y), int(w), int(h))
            
            # Отрисовка контура
            pygame.draw.rect(screen, COLORS["rect_border"], draw_r, 1)

            # Подпись ID и ориентации
            label = f"{r['elementId']}"
            if r.get("rotateIndex") == 1:
                label += "R" # Пометка, что развернут
                
            text_surf = font.render(label, True, COLORS["text"])
            text_rect = text_surf.get_rect(center=draw_r.center)
            
            # Рисуем текст только если он влезает в прямоугольник
            if text_rect.width < draw_r.width and text_rect.height < draw_r.height:
                screen.blit(text_surf, text_rect)

        pygame.display.flip()
        clock.tick(30)

    pygame.quit()

if __name__ == "__main__":
    run_visualizer()
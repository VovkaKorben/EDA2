import json
import random


def generate_rects(filename, count):
    rects = []
    for _ in range(count):
        w = random.randint(10, 100)
        h = random.randint(10, 100)
        l = random.randint(0, 600)
        t = random.randint(0, 400)

        rects.append({"l": l, "t": t, "r": l + w, "b": t + h})

    with open(filename, "w") as f:
        json.dump(rects, f)


if __name__ == "__main__":
    generate_rects("rects.json", 100)

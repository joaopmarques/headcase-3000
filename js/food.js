// Snack tray: drag food onto the head's mouth. The head handles the consequences.
export const FOODS = [
  { id: 'burger', emoji: '🍔' },
  { id: 'pizza', emoji: '🍕' },
  { id: 'donut', emoji: '🍩' },
  { id: 'chili', emoji: '🌶️' },
  { id: 'lemon', emoji: '🍋' },
  { id: 'espresso', emoji: '☕' },
  { id: 'broccoli', emoji: '🥦' },
];

// tray: element to fill with food buttons. hooks: { mouth(): {x,y}|null, onNear(bool), onEat(food), onMiss(food, x, y) }
export function setupFood(tray, stage, hooks) {
  for (const f of FOODS) {
    const b = document.createElement('button');
    b.className = 'food';
    b.textContent = f.emoji;
    b.title = `Drag the ${f.id} into the mouth`;
    b.addEventListener('pointerdown', (e) => startDrag(e, f));
    tray.appendChild(b);
  }

  let drag = null;
  function startDrag(e, food) {
    e.preventDefault();
    const ghost = document.createElement('div');
    ghost.className = 'food-ghost';
    ghost.textContent = food.emoji;
    document.body.appendChild(ghost);
    drag = { food, ghost, near: false };
    move(e);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', drop, { once: true });
    window.addEventListener('pointercancel', drop, { once: true });
  }

  function distToMouth(x, y) {
    const m = hooks.mouth();
    if (!m) return Infinity;
    const r = stage.getBoundingClientRect();
    return Math.hypot(x - (r.left + m.x), y - (r.top + m.y));
  }

  function move(e) {
    if (!drag) return;
    drag.ghost.style.left = `${e.clientX}px`;
    drag.ghost.style.top = `${e.clientY}px`;
    const near = distToMouth(e.clientX, e.clientY) < 220;
    if (near !== drag.near) { drag.near = near; hooks.onNear(near); }
  }

  function drop(e) {
    window.removeEventListener('pointermove', move);
    if (!drag) return;
    const { food, ghost } = drag;
    drag = null;
    hooks.onNear(false);
    const d = distToMouth(e.clientX, e.clientY);
    if (d < 90) {
      // Slurp into the mouth.
      const m = hooks.mouth();
      const r = stage.getBoundingClientRect();
      ghost.style.transition = 'left .15s ease-in, top .15s ease-in, transform .15s ease-in';
      ghost.style.left = `${r.left + m.x}px`;
      ghost.style.top = `${r.top + m.y}px`;
      ghost.style.transform = 'translate(-50%, -50%) scale(0.1)';
      setTimeout(() => ghost.remove(), 160);
      hooks.onEat(food);
    } else {
      ghost.classList.add('drop');
      setTimeout(() => ghost.remove(), 600);
      hooks.onMiss(food, e.clientX, e.clientY);
    }
  }
}

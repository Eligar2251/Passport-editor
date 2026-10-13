/* =========================================================================
   Passport Editor — редактор паспорта изделия
   ВЕСЬ код приложения (логика, компоненты, стили, печать, PDF) — в этом файле.

   Возможности:
   • перетаскивание / масштабирование элементов, умное прилипание (как в Figma);
   • размеры и отступы линиями: до краёв листа и до соседних элементов (Alt);
   • панель слоёв, панель свойств, undo/redo, JSON-импорт/экспорт;
   • печать и экспорт PDF на листе A4 (поля, ориентация, масштаб).
   ========================================================================= */

import { useEffect, useReducer, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

/* ===================== Константы листа и печати ===================== */
const ARTBOARD_WIDTH = 650;   // px — ширина «листа» в редакторе
const ARTBOARD_HEIGHT = 1000; // px — высота «листа» в редакторе

const PX_PER_MM = 96 / 25.4;  // 1 мм = 3.7795 px (CSS-пиксель)
const MM_PER_PX = 25.4 / 96;

const SNAP_THRESHOLD = 6;     // дистанция прилипания, px
const MIN_SIZE = 10;          // минимальный размер элемента, px
const PDF_DENSITY = 3;        // 3 × 96 dpi ≈ 288 dpi для растрового PDF

const PAPER_SIZES = {
  A4: { w: 210, h: 297, label: 'A4 · 210×297 мм' },
  A3: { w: 297, h: 420, label: 'A3 · 297×420 мм' },
  A5: { w: 148, h: 210, label: 'A5 · 148×210 мм' },
  Letter: { w: 215.9, h: 279.4, label: 'Letter · 216×279 мм' },
};

const SCALE_MODES = [
  { id: 'fit', label: 'Вписать в лист' },
  { id: 'fill', label: 'Заполнить лист' },
  { id: 'actual', label: '100 % (реальный размер)' },
  { id: 'custom', label: 'Свой масштаб' },
];

const DEFAULT_PRINT = {
  paper: 'A4',
  orientation: 'portrait',
  margin: 10,      // мм
  scaleMode: 'fit',
  customScale: 100, // %
  showFrame: true,
};

const HANDLES = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
const STORAGE_PRINT = 'passport-editor:print-settings';
const STORAGE_UI = 'passport-editor:ui-settings';

/* ===================== Мелкие утилиты ===================== */
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const round = (v) => Math.round(v);
const round1 = (v) => Math.round(v * 10) / 10;
const px2mm = (px) => px * MM_PER_PX;
const fmtMm = (v) => `${v.toFixed(1).replace('.', ',')} мм`;

function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* приватный режим / переполнение — не критично */
  }
}

let idCounter = 1;
const genId = () => `el_${idCounter++}`;

/* ===================== Фабрики элементов ===================== */
function createTextElement(overrides = {}) {
  return {
    id: genId(),
    type: 'text',
    x: 50, y: 50, width: 200, height: 24,
    locked: false,
    visible: true,
    name: 'Текст',
    text: 'Новый текст',
    fontSize: 13,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    color: '#000000',
    textAlign: 'left',
    fontFamily: 'Arial, sans-serif',
    lineHeight: 1.3,
    ...overrides,
  };
}

function createImageElement(src, overrides = {}) {
  return {
    id: genId(),
    type: 'image',
    x: 50, y: 50, width: 150, height: 150,
    locked: false,
    visible: true,
    name: 'Изображение',
    src,
    ...overrides,
  };
}

function createLineElement(overrides = {}) {
  return {
    id: genId(),
    type: 'rect',
    x: 50, y: 50, width: 150, height: 2,
    locked: false,
    visible: true,
    name: 'Линия',
    background: '#000000',
    ...overrides,
  };
}

/* ===================== Начальный шаблон паспорта ===================== */
function buildInitialElements() {
  const els = [];
  const add = (el) => els.push(el);

  add(createTextElement({ x: 60, y: 28, width: 530, height: 20, text: 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ', fontSize: 13, fontWeight: 'bold', textAlign: 'center', name: 'Заголовок 1' }));
  add(createTextElement({ x: 60, y: 48, width: 530, height: 20, text: '"КОМБИНАТ АЛТАЙТАРА"', fontSize: 13, fontWeight: 'bold', textAlign: 'center', name: 'Заголовок 2' }));
  add(createTextElement({ x: 60, y: 70, width: 530, height: 18, text: '656922, Алтайский край, г. Барнаул, ул. Попова, 187', fontSize: 11, textAlign: 'center', name: 'Адрес 1' }));
  add(createTextElement({ x: 60, y: 88, width: 530, height: 18, text: 'Произведено по заказу и под контролем ООО "ТД Алтайтара"', fontSize: 11, textAlign: 'center', name: 'Текст под контролем' }));
  add(createTextElement({ x: 60, y: 106, width: 530, height: 18, text: '656922, Алтайский край, г. Барнаул, ул. Попова, 187', fontSize: 11, textAlign: 'center', name: 'Адрес 2' }));
  add(createTextElement({ x: 500, y: 20, width: 90, height: 50, text: 'EAC', fontSize: 32, fontWeight: 'bold', textAlign: 'center', name: 'Логотип EAC' }));

  add(createTextElement({ x: 60, y: 135, width: 160, height: 22, text: 'ПАСПОРТ №', fontSize: 15, fontWeight: 'bold', name: 'Паспорт №' }));
  add(createLineElement({ x: 190, y: 155, width: 250, height: 1, name: 'Линия паспорт №' }));

  add(createTextElement({ x: 60, y: 175, width: 400, height: 20, text: 'Продукция из гофрированного картона', fontSize: 13, name: 'Продукция' }));
  add(createTextElement({ x: 420, y: 208, width: 170, height: 18, text: 'Дата 08.06.25', fontSize: 12, textDecoration: 'underline', name: 'Дата' }));

  const fy = 248;
  add(createTextElement({ x: 60, y: fy, width: 150, height: 16, text: 'Исполнение', fontSize: 12, name: 'Исполнение' }));
  add(createLineElement({ x: 165, y: fy + 14, width: 425, height: 1, name: 'Линия Исполнение' }));

  add(createTextElement({ x: 60, y: fy + 22, width: 150, height: 16, text: 'Наименование', fontSize: 12, name: 'Наименование' }));
  add(createLineElement({ x: 175, y: fy + 36, width: 415, height: 1, name: 'Линия Наименование' }));

  add(createTextElement({ x: 60, y: fy + 44, width: 100, height: 16, text: 'Размеры', fontSize: 12, name: 'Размеры' }));
  add(createLineElement({ x: 140, y: fy + 58, width: 450, height: 1, name: 'Линия Размеры' }));

  add(createTextElement({ x: 60, y: fy + 66, width: 150, height: 16, text: 'Номер партии', fontSize: 12, name: 'Номер партии' }));
  add(createTextElement({ x: 240, y: fy + 66, width: 80, height: 16, text: 'Кол-во', fontSize: 12, name: 'Кол-во' }));
  add(createLineElement({ x: 155, y: fy + 80, width: 75, height: 1, name: 'Линия партии' }));
  add(createLineElement({ x: 290, y: fy + 80, width: 100, height: 1, name: 'Линия кол-во' }));

  add(createTextElement({ x: 60, y: fy + 108, width: 530, height: 20, text: 'Показатели качества:', fontSize: 13, fontWeight: 'bold', textAlign: 'center', name: 'Показатели качества' }));

  const qy = fy + 140;
  add(createTextElement({ x: 60, y: qy, width: 120, height: 32, text: 'Двойной перегиб', fontSize: 12, name: 'Двойной перегиб' }));
  add(createTextElement({ x: 150, y: qy + 14, width: 220, height: 16, text: 'СООТВЕТСТВУЕТ', fontSize: 12, textDecoration: 'underline', name: 'Соответствует 1' }));

  add(createTextElement({ x: 60, y: qy + 48, width: 260, height: 16, text: 'Сопротивление сжатию', fontSize: 12, name: 'Сопротивление сжатию' }));
  add(createTextElement({ x: 240, y: qy + 48, width: 220, height: 16, text: 'СООТВЕТСТВУЕТ', fontSize: 12, textDecoration: 'underline', name: 'Соответствует 2' }));

  add(createTextElement({ x: 60, y: qy + 78, width: 260, height: 32, text: 'Сопротивление горизонтальному удару', fontSize: 12, name: 'Горизонтальный удар' }));
  add(createTextElement({ x: 170, y: qy + 108, width: 220, height: 16, text: 'СООТВЕТСТВУЕТ', fontSize: 12, textDecoration: 'underline', name: 'Соответствует 3' }));

  add(createTextElement({ x: 60, y: qy + 138, width: 260, height: 32, text: 'Прочность при штабелировании', fontSize: 12, name: 'Штабелирование' }));
  add(createTextElement({ x: 170, y: qy + 154, width: 220, height: 16, text: 'СООТВЕТСТВУЕТ', fontSize: 12, textDecoration: 'underline', name: 'Соответствует 4' }));

  add(createTextElement({ x: 60, y: qy + 184, width: 330, height: 16, text: 'Сопротивление ударам при своб. падении', fontSize: 12, name: 'Своб. падение' }));
  add(createTextElement({ x: 390, y: qy + 184, width: 180, height: 16, text: 'СООТВЕТСТВУЕТ', fontSize: 12, textDecoration: 'underline', name: 'Соответствует 5' }));

  add(createTextElement({ x: 60, y: qy + 216, width: 80, height: 16, text: 'ГОСТ', fontSize: 12, name: 'ГОСТ' }));
  add(createTextElement({ x: 160, y: qy + 216, width: 150, height: 16, text: '34033-2016', fontSize: 12, textDecoration: 'underline', textAlign: 'center', name: 'ГОСТ номер' }));

  add(createTextElement({ x: 150, y: qy + 254, width: 250, height: 18, text: 'Контролер ОТК', fontSize: 12, textAlign: 'center', name: 'Контролер ОТК' }));

  add(createTextElement({ x: 60, y: qy + 284, width: 300, height: 16, text: 'Транспортировка и хранение:', fontSize: 11, fontWeight: 'bold', textDecoration: 'underline', name: 'Транспортировка заголовок' }));

  add(createTextElement({
    x: 60, y: qy + 302, width: 530, height: 160, fontSize: 10, lineHeight: 1.3, name: 'Текст транспортировка',
    text: 'Ящики и вспомогательные упаковочные средства транспортируются всеми видами транспорта в чистых, сухих, крытых транспортных средствах в соответствии с правилами перевозки грузов, действующими на соответствующем виде транспорта, п. 9.1 Гост 9142-2014\nЯщики и вспомогательные упаковочные средства хранят в упаковке производителя в крытых складских помещениях, защищенных от атмосферных осадков и почвенной влаги, с естественной вентиляцией.\nУсловия хранения - при температуре от минус 14°C до плюс 40°C и относительной влажности 25%-70% п. 9.3 ГОСТ 9142-2014\nИзготовитель гарантирует соответствие гофроизделий требованиям спецификации в течение 12 месяцев со дня изготовления при условии соблюдения потребителем правил транспортирования и хранения.\nИзделия предназначены для непрямого контакта с пищевой продукцией.',
  }));

  add(createTextElement({ x: 60, y: qy + 480, width: 400, height: 36, text: 'EAC   PAP 20', fontSize: 22, fontWeight: 'bold', name: 'Нижние марки' }));

  return els;
}

/* ===================== История (undo/redo) ===================== */
function historyReducer(state, action) {
  switch (action.type) {
    case 'SET':
      return { ...state, present: action.payload };
    case 'COMMIT':
      return { past: [...state.past, state.present], present: action.payload, future: [] };
    case 'COMMIT_FROM_SNAPSHOT':
      return { past: [...state.past, action.snapshot], present: action.payload, future: [] };
    case 'REPLACE':
      return { past: [], present: action.payload, future: [] };
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return { past: [...state.past, state.present], present: next, future: state.future.slice(1) };
    }
    default:
      return state;
  }
}

/* ===================== Геометрия: resize ===================== */
function computeResize(handle, orig, dx, dy) {
  let { x, y, width, height } = orig;
  if (handle.includes('e')) width = Math.max(MIN_SIZE, orig.width + dx);
  if (handle.includes('s')) height = Math.max(MIN_SIZE, orig.height + dy);
  if (handle.includes('w')) {
    width = Math.max(MIN_SIZE, orig.width - dx);
    x = orig.x + (orig.width - width);
  }
  if (handle.includes('n')) {
    height = Math.max(MIN_SIZE, orig.height - dy);
    y = orig.y + (orig.height - height);
  }
  return { x, y, width, height };
}

/* Линии, к которым можно прилипать: края/центр листа + другие элементы */
function buildTargetLines(elements, skipId) {
  const x = [0, ARTBOARD_WIDTH / 2, ARTBOARD_WIDTH];
  const y = [0, ARTBOARD_HEIGHT / 2, ARTBOARD_HEIGHT];
  for (const el of elements) {
    if (el.id === skipId || el.visible === false) continue;
    x.push(el.x, el.x + el.width / 2, el.x + el.width);
    y.push(el.y, el.y + el.height / 2, el.y + el.height);
  }
  return { x, y };
}

function nearestLine(lines, value, threshold) {
  let best = null;
  let bestDiff = threshold + 0.0001;
  for (const line of lines) {
    const diff = Math.abs(line - value);
    if (diff <= threshold && diff < bestDiff) {
      bestDiff = diff;
      best = line;
    }
  }
  return best;
}

/* ===================== Умное выравнивание при перетаскивании ===================== */
function calculateSnapping(draggingEl, rawX, rawY, allElements, threshold = SNAP_THRESHOLD) {
  let snappedX = rawX;
  let snappedY = rawY;
  let guideX = null;
  let guideY = null;

  const width = draggingEl.width;
  const height = draggingEl.height;
  const targets = buildTargetLines(allElements, draggingEl.id);

  // Контрольные точки перетаскиваемого объекта (край / центр / край)
  const dragXPoints = [
    { val: rawX, offset: 0 },
    { val: rawX + width / 2, offset: -width / 2 },
    { val: rawX + width, offset: -width },
  ];
  const dragYPoints = [
    { val: rawY, offset: 0 },
    { val: rawY + height / 2, offset: -height / 2 },
    { val: rawY + height, offset: -height },
  ];

  let minDiffX = threshold + 1;
  for (const dp of dragXPoints) {
    for (const tx of targets.x) {
      const diff = Math.abs(dp.val - tx);
      if (diff <= threshold && diff < minDiffX) {
        minDiffX = diff;
        snappedX = tx + dp.offset;
        guideX = tx;
      }
    }
  }

  let minDiffY = threshold + 1;
  for (const dp of dragYPoints) {
    for (const ty of targets.y) {
      const diff = Math.abs(dp.val - ty);
      if (diff <= threshold && diff < minDiffY) {
        minDiffY = diff;
        snappedY = ty + dp.offset;
        guideY = ty;
      }
    }
  }

  return { x: snappedX, y: snappedY, guideX, guideY };
}

/* Прилипание движущихся граней при масштабировании */
function computeResizeSnapped(handle, orig, dx, dy, allElements, skipId, threshold = SNAP_THRESHOLD) {
  const box = computeResize(handle, orig, dx, dy);
  const targets = buildTargetLines(allElements, skipId);
  let guideX = null;
  let guideY = null;

  if (handle.includes('e')) {
    const t = nearestLine(targets.x, box.x + box.width, threshold);
    if (t !== null) {
      box.width = Math.max(MIN_SIZE, t - box.x);
      guideX = t;
    }
  } else if (handle.includes('w')) {
    const right = orig.x + orig.width;
    const t = nearestLine(targets.x, box.x, threshold);
    if (t !== null) {
      const w = Math.max(MIN_SIZE, right - t);
      box.x = right - w;
      box.width = w;
      guideX = t;
    }
  }

  if (handle.includes('s')) {
    const t = nearestLine(targets.y, box.y + box.height, threshold);
    if (t !== null) {
      box.height = Math.max(MIN_SIZE, t - box.y);
      guideY = t;
    }
  } else if (handle.includes('n')) {
    const bottom = orig.y + orig.height;
    const t = nearestLine(targets.y, box.y, threshold);
    if (t !== null) {
      const h = Math.max(MIN_SIZE, bottom - t);
      box.y = bottom - h;
      box.height = h;
      guideY = t;
    }
  }

  return { box, guideX, guideY };
}

/* ===================== Отступы (линейки, как в Figma) ===================== */
const boxOf = (el) => ({
  l: el.x,
  t: el.y,
  r: el.x + el.width,
  b: el.y + el.height,
});

/**
 * Отступы выбранного элемента:
 *  • sheet    — до краёв листа (слева / сверху / справа / снизу);
 *  • neighbor — до ближайшего соседа в каждой из четырёх сторон.
 */
function computeMeasurements(el, elements, options = {}) {
  const { sheet = true, neighbors = true } = options;
  const out = [];
  if (!el) return out;

  const b = boxOf(el);
  const cx = (b.l + b.r) / 2;
  const cy = (b.t + b.b) / 2;

  if (sheet) {
    if (b.l > 0.5) out.push({ id: 'sheet-l', axis: 'h', from: 0, to: b.l, at: cy, value: b.l, kind: 'sheet' });
    if (ARTBOARD_WIDTH - b.r > 0.5) out.push({ id: 'sheet-r', axis: 'h', from: b.r, to: ARTBOARD_WIDTH, at: cy, value: ARTBOARD_WIDTH - b.r, kind: 'sheet' });
    if (b.t > 0.5) out.push({ id: 'sheet-t', axis: 'v', from: 0, to: b.t, at: cx, value: b.t, kind: 'sheet' });
    if (ARTBOARD_HEIGHT - b.b > 0.5) out.push({ id: 'sheet-b', axis: 'v', from: b.b, to: ARTBOARD_HEIGHT, at: cx, value: ARTBOARD_HEIGHT - b.b, kind: 'sheet' });
  }

  if (neighbors) {
    const best = { left: null, right: null, top: null, bottom: null };
    for (const o of elements) {
      if (!o || o.id === el.id || o.visible === false) continue;
      const ob = boxOf(o);
      const vOverlap = Math.min(b.b, ob.b) - Math.max(b.t, ob.t);
      const hOverlap = Math.min(b.r, ob.r) - Math.max(b.l, ob.l);
      const midY = (Math.max(b.t, ob.t) + Math.min(b.b, ob.b)) / 2;
      const midX = (Math.max(b.l, ob.l) + Math.min(b.r, ob.r)) / 2;

      if (vOverlap > 0.5) {
        if (ob.r <= b.l + 0.5) {
          const gap = b.l - ob.r;
          if (gap > 0.5 && (!best.left || gap < best.left.value)) best.left = { id: 'nb-l', axis: 'h', from: ob.r, to: b.l, at: midY, value: gap, kind: 'neighbor', name: o.name };
        } else if (ob.l >= b.r - 0.5) {
          const gap = ob.l - b.r;
          if (gap > 0.5 && (!best.right || gap < best.right.value)) best.right = { id: 'nb-r', axis: 'h', from: b.r, to: ob.l, at: midY, value: gap, kind: 'neighbor', name: o.name };
        }
      }
      if (hOverlap > 0.5) {
        if (ob.b <= b.t + 0.5) {
          const gap = b.t - ob.b;
          if (gap > 0.5 && (!best.top || gap < best.top.value)) best.top = { id: 'nb-t', axis: 'v', from: ob.b, to: b.t, at: midX, value: gap, kind: 'neighbor', name: o.name };
        } else if (ob.t >= b.b - 0.5) {
          const gap = ob.t - b.b;
          if (gap > 0.5 && (!best.bottom || gap < best.bottom.value)) best.bottom = { id: 'nb-b', axis: 'v', from: b.b, to: ob.t, at: midX, value: gap, kind: 'neighbor', name: o.name };
        }
      }
    }
    for (const key of ['left', 'right', 'top', 'bottom']) if (best[key]) out.push(best[key]);
  }

  return out;
}

/** Расстояние между двумя конкретными элементами (Alt + наведение). */
function computePairMeasurements(a, b) {
  const out = [];
  if (!a || !b || a.id === b.id) return out;
  const A = boxOf(a);
  const B = boxOf(b);
  const vOverlap = Math.min(A.b, B.b) - Math.max(A.t, B.t);
  const hOverlap = Math.min(A.r, B.r) - Math.max(A.l, B.l);
  const midY = (Math.max(A.t, B.t) + Math.min(A.b, B.b)) / 2;
  const midX = (Math.max(A.l, B.l) + Math.min(A.r, B.r)) / 2;

  if (vOverlap > 0.5) {
    if (B.r <= A.l + 0.5) out.push({ id: 'pair-h', axis: 'h', from: B.r, to: A.l, at: midY, value: A.l - B.r, kind: 'pair' });
    else if (A.r <= B.l + 0.5) out.push({ id: 'pair-h', axis: 'h', from: A.r, to: B.l, at: midY, value: B.l - A.r, kind: 'pair' });
  }
  if (hOverlap > 0.5) {
    if (B.b <= A.t + 0.5) out.push({ id: 'pair-v', axis: 'v', from: B.b, to: A.t, at: midX, value: A.t - B.b, kind: 'pair' });
    else if (A.t >= B.b - 0.5) out.push({ id: 'pair-v', axis: 'v', from: A.b, to: B.t, at: midX, value: B.t - A.b, kind: 'pair' });
  }
  if (out.length === 0) {
    // Элементы перекрываются — показываем смещение их левых и верхних граней
    out.push({ id: 'pair-dx', axis: 'h', from: Math.min(A.l, B.l), to: Math.max(A.l, B.l), at: Math.max(A.t, B.t) + 10, value: Math.abs(A.l - B.l), kind: 'pair' });
    out.push({ id: 'pair-dy', axis: 'v', from: Math.min(A.t, B.t), to: Math.max(A.t, B.t), at: Math.max(A.l, B.l) + 10, value: Math.abs(A.t - B.t), kind: 'pair' });
  }
  return out.filter((m) => m.value > 0.5);
}

/* Отступы элемента от краёв листа, px */
function sheetMargins(el) {
  return {
    left: el.x,
    top: el.y,
    right: ARTBOARD_WIDTH - (el.x + el.width),
    bottom: ARTBOARD_HEIGHT - (el.y + el.height),
  };
}

/* ===================== Раскладка печати ===================== */
function computePrintLayout(settings) {
  const s = { ...DEFAULT_PRINT, ...settings };
  const paper = PAPER_SIZES[s.paper] || PAPER_SIZES.A4;
  const landscape = s.orientation === 'landscape';
  const pageWmm = landscape ? paper.h : paper.w;
  const pageHmm = landscape ? paper.w : paper.h;
  const margin = clamp(Number(s.margin) || 0, 0, Math.min(pageWmm, pageHmm) / 2 - 5);

  const contentWmm = pageWmm - margin * 2;
  const contentHmm = pageHmm - margin * 2;
  const docWmm = ARTBOARD_WIDTH * MM_PER_PX;
  const docHmm = ARTBOARD_HEIGHT * MM_PER_PX;

  let sx;
  let sy;
  switch (s.scaleMode) {
    case 'fill':
      sx = contentWmm / docWmm;
      sy = contentHmm / docHmm;
      break;
    case 'actual':
      sx = 1;
      sy = 1;
      break;
    case 'custom': {
      const k = clamp(Number(s.customScale) || 100, 5, 1000) / 100;
      sx = k;
      sy = k;
      break;
    }
    default: { // fit — вписать целиком
      const k = Math.min(contentWmm / docWmm, contentHmm / docHmm);
      sx = k;
      sy = k;
    }
  }

  const outWmm = docWmm * sx;
  const outHmm = docHmm * sy;
  return {
    paper: s.paper,
    paperLabel: paper.label,
    orientation: s.orientation,
    pageWmm,
    pageHmm,
    margin,
    contentWmm,
    contentHmm,
    docWmm,
    docHmm,
    sx,
    sy,
    outWmm,
    outHmm,
    offXmm: Math.max(0, (contentWmm - outWmm) / 2),
    offYmm: Math.max(0, (contentHmm - outHmm) / 2),
    overflow: outWmm > contentWmm + 0.05 || outHmm > contentHmm + 0.05,
  };
}

/* ===================== Общие куски рендера ===================== */
/** Содержимое элемента (текст / картинка / линия). kf — коэффициент для шрифта. */
function ElementInner({ el, kf = 1, editing = false, innerRef = null, onBlur = null }) {
  if (el.type === 'text') {
    return (
      <div
        ref={innerRef}
        contentEditable={editing}
        suppressContentEditableWarning
        onBlur={onBlur}
        className="pe-text-content"
        style={{
          fontSize: el.fontSize * kf,
          fontWeight: el.fontWeight,
          fontStyle: el.fontStyle,
          textDecoration: el.textDecoration,
          color: el.color,
          textAlign: el.textAlign,
          fontFamily: el.fontFamily,
          lineHeight: el.lineHeight,
          userSelect: editing ? 'text' : 'none',
        }}
      >
        {el.text}
      </div>
    );
  }
  if (el.type === 'image') {
    return <img src={el.src} alt="" draggable={false} className="pe-image-content" />;
  }
  return <div className="pe-rect-content" style={{ background: el.background || '#000' }} />;
}

/** «Чистый» элемент для печати/PDF — без рамок выделения и маркеров. */
function PrintElement({ el, z, kx, ky, kf }) {
  if (el.visible === false) return null;
  return (
    <div
      className="pe-print-el"
      style={{
        left: el.x * kx,
        top: el.y * ky,
        width: Math.max(0.01, el.width * kx),
        height: Math.max(0.01, el.height * ky),
        zIndex: z,
      }}
    >
      <ElementInner el={el} kf={kf} />
    </div>
  );
}

/**
 * Страница для печати / предпросмотра / PDF.
 * density = 0  → размеры в миллиметрах (экран и window.print());
 * density > 0  → размеры в px повышенной плотности (рендер в canvas для PDF).
 */
function PrintPage({ settings, elements, density = 0, showFrame = false }) {
  const L = computePrintLayout(settings);
  const d = density > 0 ? density : 1;
  const u = density > 0 ? (v) => `${(v * PX_PER_MM * density).toFixed(4)}px` : (v) => `${v}mm`;
  const kx = L.sx * d;
  const ky = L.sy * d;
  const kf = Math.sqrt(kx * ky);

  return (
    <div
      className={`pe-page${density > 0 ? ' pe-page--flat' : ''}`}
      style={{ width: u(L.pageWmm), height: u(L.pageHmm), padding: u(L.margin) }}
    >
      <div className="pe-page-content" style={{ width: u(L.contentWmm), height: u(L.contentHmm) }}>
        <div
          className="pe-page-doc"
          style={{ left: u(L.offXmm), top: u(L.offYmm), width: ARTBOARD_WIDTH * kx, height: ARTBOARD_HEIGHT * ky }}
        >
          {elements.map((el, i) => (
            <PrintElement key={el.id} el={el} z={i + 1} kx={kx} ky={ky} kf={kf} />
          ))}
        </div>
        {showFrame && (
          <div
            className="pe-page-frame"
            style={{ left: u(L.offXmm), top: u(L.offYmm), width: u(L.outWmm), height: u(L.outHmm) }}
          />
        )}
      </div>
    </div>
  );
}

/* ===================== Оверлей размеров (SVG) ===================== */
function MeasureOverlay({ items }) {
  if (!items || items.length === 0) return null;
  const crisp = (v) => Math.round(v) + 0.5;

  return (
    <svg className="pe-measure" width={ARTBOARD_WIDTH} height={ARTBOARD_HEIGHT}>
      {items.map((m) => {
        const horizontal = m.axis === 'h';
        const x1 = crisp(horizontal ? m.from : m.at);
        const y1 = crisp(horizontal ? m.at : m.from);
        const x2 = crisp(horizontal ? m.to : m.at);
        const y2 = crisp(horizontal ? m.at : m.to);
        const length = Math.abs(m.to - m.from);
        const label = String(Math.max(0, Math.round(m.value)));
        const bw = label.length * 6.7 + 12;
        const bh = 15;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const cramped = length < bw + 6;
        const cx = horizontal ? midX : (cramped ? midX + bw / 2 + 7 : midX);
        const cy = horizontal ? (cramped ? midY - bh / 2 - 6 : midY) : midY;
        const cls = m.kind === 'sheet' ? 'pe-m-sheet' : 'pe-m-near';

        return (
          <g key={m.id} className={cls}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} />
            {horizontal ? (
              <>
                <line x1={x1} y1={y1 - 4} x2={x1} y2={y1 + 4} />
                <line x1={x2} y1={y2 - 4} x2={x2} y2={y2 + 4} />
              </>
            ) : (
              <>
                <line x1={x1 - 4} y1={y1} x2={x1 + 4} y2={y1} />
                <line x1={x2 - 4} y1={y2} x2={x2 + 4} y2={y2} />
              </>
            )}
            <rect x={cx - bw / 2} y={cy - bh / 2} width={bw} height={bh} rx={3} />
            <text x={cx} y={cy}>{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ===================== Поля ввода ===================== */
function NumberField({ label, value, onLive, onSessionStart, onSessionEnd, step = 1, min, max, suffix }) {
  const [draft, setDraft] = useState(null);
  const shown = draft !== null ? draft : String(round1(value));

  return (
    <label className="pe-field">
      <span>{label}</span>
      <span className="pe-field-input">
        <input
          type="number"
          step={step}
          value={shown}
          onFocus={(e) => {
            setDraft(String(round1(value)));
            onSessionStart && onSessionStart();
            e.currentTarget.select();
          }}
          onChange={(e) => {
            const raw = e.currentTarget.value;
            setDraft(raw);
            if (raw.trim() === '') return;
            let n = Number(raw);
            if (Number.isNaN(n)) return;
            if (min !== undefined) n = Math.max(min, n);
            if (max !== undefined) n = Math.min(max, n);
            onLive(n);
          }}
          onBlur={() => {
            setDraft(null);
            onSessionEnd && onSessionEnd();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur(); }
            e.stopPropagation();
          }}
        />
        {suffix ? <em>{suffix}</em> : null}
      </span>
    </label>
  );
}

function ColorField({ label, value, onLive, onSessionStart, onSessionEnd }) {
  return (
    <label className="pe-field">
      <span>{label}</span>
      <span className="pe-field-input pe-color">
        <input
          type="color"
          value={value || '#000000'}
          onFocus={() => onSessionStart && onSessionStart()}
          onChange={(e) => onLive(e.currentTarget.value)}
          onBlur={() => onSessionEnd && onSessionEnd()}
        />
        <code>{value}</code>
      </span>
    </label>
  );
}

/* ===================== Панель слоёв ===================== */
function LayersPanel({ elements, selectedId, onSelect, onToggleVisible, onToggleLock, onMove, onRemove }) {
  return (
    <div className="pe-panel pe-layers">
      <h3>Слои <span className="pe-count">{elements.length}</span></h3>
      <div className="pe-layers-list">
        {[...elements].reverse().map((el) => (
          <div
            key={el.id}
            className={`pe-layer-row${selectedId === el.id ? ' selected' : ''}`}
            onClick={() => onSelect(el.id)}
          >
            <button className="pe-icon-btn" title="Видимость" onClick={(e) => { e.stopPropagation(); onToggleVisible(el); }}>
              {el.visible === false ? '–' : '👁'}
            </button>
            <button className="pe-icon-btn" title="Блокировка" onClick={(e) => { e.stopPropagation(); onToggleLock(el); }}>
              {el.locked ? '🔒' : '🔓'}
            </button>
            <span className="pe-layer-name" title={el.name || el.type}>{el.name || el.type}</span>
            <button className="pe-icon-btn" title="Выше" onClick={(e) => { e.stopPropagation(); onMove(el.id, 'up'); }}>↑</button>
            <button className="pe-icon-btn" title="Ниже" onClick={(e) => { e.stopPropagation(); onMove(el.id, 'down'); }}>↓</button>
            <button className="pe-icon-btn pe-danger" title="Удалить" onClick={(e) => { e.stopPropagation(); onRemove(el.id); }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================== Панель свойств ===================== */
function PropsPanel({ el, onLive, onCommit, onSessionStart, onSessionEnd, onDuplicate, onDelete }) {
  if (!el) {
    return (
      <div className="pe-panel pe-props">
        <h3>Свойства</h3>
        <p className="pe-hint">Выберите элемент на холсте.</p>
        <ul className="pe-hint-list">
          <li>Двойной клик по тексту — редактирование</li>
          <li>Стрелки — сдвиг на 1 px, Shift+стрелки — на 10 px</li>
          <li>Alt — отступы до соседних элементов</li>
          <li>Ctrl — временно отключить прилипание</li>
          <li>Ctrl+P — печать на A4</li>
        </ul>
      </div>
    );
  }

  const m = sheetMargins(el);

  return (
    <div className="pe-panel pe-props">
      <h3>Свойства</h3>
      <div className="pe-el-title">{el.name || el.type}</div>

      <div className="pe-grid2">
        <NumberField label="X" value={el.x} onLive={(n) => onLive({ x: n })} onSessionStart={onSessionStart} onSessionEnd={onSessionEnd} suffix="px" />
        <NumberField label="Y" value={el.y} onLive={(n) => onLive({ y: n })} onSessionStart={onSessionStart} onSessionEnd={onSessionEnd} suffix="px" />
        <NumberField label="Ш" value={el.width} min={MIN_SIZE} onLive={(n) => onLive({ width: n })} onSessionStart={onSessionStart} onSessionEnd={onSessionEnd} suffix="px" />
        <NumberField label="В" value={el.height} min={MIN_SIZE} onLive={(n) => onLive({ height: n })} onSessionStart={onSessionStart} onSessionEnd={onSessionEnd} suffix="px" />
      </div>

      <h4>Отступы от края листа</h4>
      <div className="pe-margin-box" title="Отступы в пикселях">
        <span />
        <b title={`Сверху: ${fmtMm(px2mm(m.top))}`}>{round(m.top)}</b>
        <span />
        <b title={`Слева: ${fmtMm(px2mm(m.left))}`}>{round(m.left)}</b>
        <i>{round(el.width)}×{round(el.height)}</i>
        <b title={`Справа: ${fmtMm(px2mm(m.right))}`}>{round(m.right)}</b>
        <span />
        <b title={`Снизу: ${fmtMm(px2mm(m.bottom))}`}>{round(m.bottom)}</b>
        <span />
      </div>
      <div className="pe-margin-mm">
        ↤ {px2mm(m.left).toFixed(1)} · ↥ {px2mm(m.top).toFixed(1)} · ↦ {px2mm(m.right).toFixed(1)} · ↧ {px2mm(m.bottom).toFixed(1)} мм
      </div>

      {el.type === 'text' && (
        <>
          <h4>Текст</h4>
          <NumberField label="Размер шрифта" value={el.fontSize} min={4} max={200} onLive={(n) => onLive({ fontSize: n })} onSessionStart={onSessionStart} onSessionEnd={onSessionEnd} suffix="px" />
          <NumberField label="Межстрочный" value={el.lineHeight} step={0.05} min={0.6} max={4} onLive={(n) => onLive({ lineHeight: n })} onSessionStart={onSessionStart} onSessionEnd={onSessionEnd} />
          <ColorField label="Цвет" value={el.color} onLive={(v) => onLive({ color: v })} onSessionStart={onSessionStart} onSessionEnd={onSessionEnd} />
          <div className="pe-btn-group">
            <button className={el.fontWeight === 'bold' ? 'active' : ''} title="Жирный" onClick={() => onCommit({ fontWeight: el.fontWeight === 'bold' ? 'normal' : 'bold' })}><b>Ж</b></button>
            <button className={el.fontStyle === 'italic' ? 'active' : ''} title="Курсив" onClick={() => onCommit({ fontStyle: el.fontStyle === 'italic' ? 'normal' : 'italic' })}><i>К</i></button>
            <button className={el.textDecoration === 'underline' ? 'active' : ''} title="Подчёркнутый" onClick={() => onCommit({ textDecoration: el.textDecoration === 'underline' ? 'none' : 'underline' })}><u>Ч</u></button>
          </div>
          <div className="pe-btn-group">
            <button className={el.textAlign === 'left' ? 'active' : ''} title="По левому краю" onClick={() => onCommit({ textAlign: 'left' })}>⇤</button>
            <button className={el.textAlign === 'center' ? 'active' : ''} title="По центру" onClick={() => onCommit({ textAlign: 'center' })}>↔</button>
            <button className={el.textAlign === 'right' ? 'active' : ''} title="По правому краю" onClick={() => onCommit({ textAlign: 'right' })}>⇥</button>
          </div>
        </>
      )}

      {el.type === 'rect' && (
        <>
          <h4>Линия</h4>
          <ColorField label="Цвет" value={el.background} onLive={(v) => onLive({ background: v })} onSessionStart={onSessionStart} onSessionEnd={onSessionEnd} />
        </>
      )}

      <h4>Слой</h4>
      <label className="pe-field pe-field-text">
        <span>Название</span>
        <input type="text" value={el.name || ''} onChange={(e) => onLive({ name: e.currentTarget.value })} onBlur={() => onSessionEnd && onSessionEnd()} onFocus={() => onSessionStart && onSessionStart()} />
      </label>
      <label className="pe-checkbox">
        <input type="checkbox" checked={!!el.locked} onChange={(e) => onCommit({ locked: e.currentTarget.checked })} />
        Заблокировать слой
      </label>
      <label className="pe-checkbox">
        <input type="checkbox" checked={el.visible !== false} onChange={(e) => onCommit({ visible: e.currentTarget.checked })} />
        Показывать слой
      </label>

      <div className="pe-btn-group">
        <button onClick={onDuplicate}>Дублировать</button>
        <button className="pe-danger" onClick={onDelete}>Удалить</button>
      </div>
    </div>
  );
}

/* ===================== Диалог печати ===================== */
function PrintDialog({ settings, onChange, elements, onClose, onPrint, onPdf, busy }) {
  const L = computePrintLayout(settings);
  const pageWpx = L.pageWmm * PX_PER_MM;
  const pageHpx = L.pageHmm * PX_PER_MM;
  const boxRef = useRef(null);
  const [zoom, setZoom] = useState(0.5);

  useEffect(() => {
    const node = boxRef.current;
    if (!node) return undefined;
    const calc = () => {
      const w = node.clientWidth - 48;
      const h = node.clientHeight - 48;
      if (w > 0 && h > 0) setZoom(clamp(Math.min(w / pageWpx, h / pageHpx), 0.05, 2));
    };
    calc();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', calc);
      return () => window.removeEventListener('resize', calc);
    }
    const ro = new ResizeObserver(calc);
    ro.observe(node);
    return () => ro.disconnect();
  }, [pageWpx, pageHpx]);

  const set = (patch) => onChange({ ...settings, ...patch });

  return (
    <div className="pe-modal-backdrop" onMouseDown={onClose}>
      <div className="pe-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pe-modal-head">
          <h3>Печать на листе {L.paper} <span className="pe-muted">{L.orientation === 'landscape' ? 'альбомная' : 'книжная'}</span></h3>
          <button className="pe-icon-btn" title="Закрыть (Esc)" onClick={onClose}>✕</button>
        </div>

        <div className="pe-modal-body">
          <div className="pe-modal-settings">
            <label className="pe-field">
              <span>Формат листа</span>
              <select value={settings.paper} onChange={(e) => set({ paper: e.currentTarget.value })}>
                {Object.keys(PAPER_SIZES).map((key) => (
                  <option key={key} value={key}>{PAPER_SIZES[key].label}</option>
                ))}
              </select>
            </label>

            <label className="pe-field">
              <span>Ориентация</span>
              <select value={settings.orientation} onChange={(e) => set({ orientation: e.currentTarget.value })}>
                <option value="portrait">Книжная</option>
                <option value="landscape">Альбомная</option>
              </select>
            </label>

            <NumberField
              label="Поля листа"
              value={settings.margin}
              min={0}
              max={40}
              step={1}
              suffix="мм"
              onLive={(n) => set({ margin: n })}
            />

            <label className="pe-field">
              <span>Масштаб документа</span>
              <select value={settings.scaleMode} onChange={(e) => set({ scaleMode: e.currentTarget.value })}>
                {SCALE_MODES.map((mode) => (
                  <option key={mode.id} value={mode.id}>{mode.label}</option>
                ))}
              </select>
            </label>

            {settings.scaleMode === 'custom' && (
              <NumberField
                label="Свой масштаб"
                value={settings.customScale}
                min={5}
                max={1000}
                step={5}
                suffix="%"
                onLive={(n) => set({ customScale: n })}
              />
            )}

            <label className="pe-checkbox">
              <input type="checkbox" checked={!!settings.showFrame} onChange={(e) => set({ showFrame: e.currentTarget.checked })} />
              Показывать рамку документа
            </label>

            <dl className="pe-specs">
              <div><dt>Лист</dt><dd>{L.pageWmm.toFixed(0)}×{L.pageHmm.toFixed(0)} мм</dd></div>
              <div><dt>Область печати</dt><dd>{L.contentWmm.toFixed(1)}×{L.contentHmm.toFixed(1)} мм</dd></div>
              <div><dt>Документ</dt><dd>{L.docWmm.toFixed(1)}×{L.docHmm.toFixed(1)} мм</dd></div>
              <div><dt>Масштаб</dt><dd>{Math.round(L.sx * 100)}% {L.sx !== L.sy ? `/ ${Math.round(L.sy * 100)}%` : ''}</dd></div>
              <div><dt>На листе</dt><dd>{L.outWmm.toFixed(1)}×{L.outHmm.toFixed(1)} мм</dd></div>
            </dl>

            {L.overflow && (
              <p className="pe-warn">Документ больше области печати — края будут обрезаны. Уменьшите масштаб или поля.</p>
            )}
            <p className="pe-hint">
              В диалоге печати браузера укажите: поля — «Нет», масштаб — 100 %, иначе лист может съехать.
            </p>
          </div>

          <div className="pe-preview" ref={boxRef}>
            <div style={{ width: pageWpx * zoom, height: pageHpx * zoom, position: 'relative' }}>
              <div style={{ width: pageWpx, height: pageHpx, transform: `scale(${zoom})`, transformOrigin: 'top left', position: 'absolute', left: 0, top: 0 }}>
                <PrintPage settings={settings} elements={elements} showFrame={settings.showFrame} />
              </div>
            </div>
          </div>
        </div>

        <div className="pe-modal-foot">
          <span className="pe-muted">Готово к печати: 1 страница · {L.paper}</span>
          <button onClick={onPdf} disabled={busy === 'pdf'}>
            {busy === 'pdf' ? 'Собираем PDF…' : '⬇ Скачать PDF'}
          </button>
          <button className="pe-primary" onClick={onPrint}>🖨 Печать</button>
        </div>
      </div>
    </div>
  );
}

/* ===================== Главный компонент ===================== */
export default function PassportEditor() {
  const [state, dispatch] = useReducer(historyReducer, null, () => ({
    past: [],
    present: buildInitialElements(),
    future: [],
  }));
  const elements = state.present;

  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [guides, setGuides] = useState({ x: null, y: null });
  const [badge, setBadge] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [altDown, setAltDown] = useState(false);
  const [toast, setToast] = useState('');

  const [ui, setUi] = useState(() => readStorage(STORAGE_UI, { showMargins: true, snap: true }));
  const [printSettings, setPrintSettings] = useState(() => readStorage(STORAGE_PRINT, DEFAULT_PRINT));
  const [printOpen, setPrintOpen] = useState(false);
  const [busy, setBusy] = useState('');

  const dragRef = useRef(null);
  const elementsRef = useRef(elements);
  const selectedIdRef = useRef(selectedId);
  const editingIdRef = useRef(editingId);
  const editingRef = useRef(null);
  const fileInputRef = useRef(null);
  const jsonInputRef = useRef(null);
  const sessionRef = useRef(null);
  const nudgeRef = useRef({ active: false, snapshot: null, timer: null });
  const uiRef = useRef(ui);
  const printRef = useRef(printSettings);
  const toastTimer = useRef(null);

  useEffect(() => { elementsRef.current = elements; }, [elements]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { editingIdRef.current = editingId; }, [editingId]);
  useEffect(() => { uiRef.current = ui; writeStorage(STORAGE_UI, ui); }, [ui]);
  useEffect(() => { printRef.current = printSettings; writeStorage(STORAGE_PRINT, printSettings); }, [printSettings]);
  useEffect(() => () => clearTimeout(nudgeRef.current.timer), []);

  const selectedEl = elements.find((e) => e.id === selectedId) || null;
  const printLayout = computePrintLayout(printSettings);

  /* ---------- Мутации ---------- */
  function liveElements(next) {
    elementsRef.current = next;
    dispatch({ type: 'SET', payload: next });
  }

  function liveMap(id, fn) {
    liveElements(elementsRef.current.map((el) => (el.id === id ? fn(el) : el)));
  }

  function beginSession() {
    if (!sessionRef.current) sessionRef.current = elementsRef.current;
  }

  function endSession() {
    const snapshot = sessionRef.current;
    sessionRef.current = null;
    if (snapshot && snapshot !== elementsRef.current) {
      dispatch({ type: 'COMMIT_FROM_SNAPSHOT', snapshot, payload: elementsRef.current });
    }
  }

  function commitElements(next) {
    flushNudge();
    elementsRef.current = next;
    dispatch({ type: 'COMMIT', payload: next });
  }

  function commitProps(id, props) {
    commitElements(elementsRef.current.map((el) => (el.id === id ? { ...el, ...props } : el)));
  }

  function showToast(text) {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }

  /* ---------- Редактирование текста ---------- */
  function startEditing(el) {
    if (el.locked || el.type !== 'text') return;
    setEditingId(el.id);
  }

  function commitEditing() {
    const id = editingIdRef.current;
    if (id && editingRef.current) {
      const newText = editingRef.current.innerText;
      const current = elementsRef.current.find((e) => e.id === id);
      if (current && current.text !== newText) {
        commitElements(elementsRef.current.map((e) => (e.id === id ? { ...e, text: newText } : e)));
      }
    }
    setEditingId(null);
  }

  useEffect(() => {
    if (editingId && editingRef.current) {
      const node = editingRef.current;
      node.focus();
      const range = document.createRange();
      range.selectNodeContents(node);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, [editingId]);

  /* ---------- Drag & Resize ---------- */
  function handleElementMouseDown(e, el) {
    e.stopPropagation();
    if (editingIdRef.current && editingIdRef.current !== el.id) commitEditing();
    setSelectedId(el.id);
    if (el.locked || editingIdRef.current === el.id || e.button !== 0) return;
    flushNudge();
    dragRef.current = {
      mode: 'move',
      id: el.id,
      startX: e.clientX,
      startY: e.clientY,
      orig: { x: el.x, y: el.y, width: el.width, height: el.height },
      snapshot: elementsRef.current,
      moved: false,
    };
    setDragId(el.id);
    setIsDragging(true);
  }

  function handleResizeStart(e, el, handle) {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = {
      mode: 'resize',
      id: el.id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      orig: { x: el.x, y: el.y, width: el.width, height: el.height },
      snapshot: elementsRef.current,
      moved: false,
    };
    setDragId(el.id);
    setIsDragging(true);
  }

  useEffect(() => {
    if (!isDragging) return undefined;

    function onMove(e) {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) d.moved = true;

      const currentEl = elementsRef.current.find((item) => item.id === d.id);
      if (!currentEl) return;
      const snapOn = uiRef.current.snap && !e.ctrlKey && !e.metaKey;

      if (d.mode === 'move') {
        let nx = d.orig.x + dx;
        let ny = d.orig.y + dy;
        let gx = null;
        let gy = null;
        if (snapOn) {
          const snap = calculateSnapping(currentEl, nx, ny, elementsRef.current);
          nx = snap.x;
          ny = snap.y;
          gx = snap.guideX;
          gy = snap.guideY;
        }
        setGuides({ x: gx, y: gy });
        setBadge({ text: `X ${round(nx)}   Y ${round(ny)}`, x: nx + currentEl.width + 10, y: ny + currentEl.height + 10 });
        liveMap(d.id, (el) => ({ ...el, x: nx, y: ny }));
      } else {
        let box;
        let gx = null;
        let gy = null;
        if (snapOn) {
          const res = computeResizeSnapped(d.handle, d.orig, dx, dy, elementsRef.current, d.id);
          box = res.box;
          gx = res.guideX;
          gy = res.guideY;
        } else {
          box = computeResize(d.handle, d.orig, dx, dy);
        }
        setGuides({ x: gx, y: gy });
        setBadge({ text: `${round(box.width)} × ${round(box.height)}`, x: box.x + box.width + 10, y: box.y + box.height + 10 });
        liveMap(d.id, () => ({ ...currentEl, ...box }));
      }
    }

    function onUp() {
      const d = dragRef.current;
      dragRef.current = null;
      setIsDragging(false);
      setDragId(null);
      setGuides({ x: null, y: null });
      setBadge(null);
      if (!d) return;
      if (d.moved) {
        dispatch({ type: 'COMMIT_FROM_SNAPSHOT', snapshot: d.snapshot, payload: elementsRef.current });
      }
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // Обработчики читают актуальные данные из ref'ов, поэтому перерегистрация
    // нужна только на старте/окончании перетаскивания.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  /* ---------- Действия над элементами ---------- */
  function addText() {
    const el = createTextElement({ x: 120, y: 120 });
    commitElements([...elementsRef.current, el]);
    setSelectedId(el.id);
  }

  function addLine() {
    const el = createLineElement({ x: 120, y: 120 });
    commitElements([...elementsRef.current, el]);
    setSelectedId(el.id);
  }

  function handleImageFile(e) {
    const file = e.currentTarget.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        const maxDim = 260;
        if (w > maxDim || h > maxDim) {
          const scale = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const el = createImageElement(ev.target.result, {
          x: (ARTBOARD_WIDTH - w) / 2,
          y: (ARTBOARD_HEIGHT - h) / 2,
          width: w,
          height: h,
          name: file.name || 'Изображение',
        });
        commitElements([...elementsRef.current, el]);
        setSelectedId(el.id);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.currentTarget.value = '';
  }

  function duplicateSelected() {
    const el = elementsRef.current.find((item) => item.id === selectedIdRef.current);
    if (!el) return;
    const copy = { ...el, id: genId(), x: el.x + 16, y: el.y + 16, name: `${el.name || el.type} копия` };
    commitElements([...elementsRef.current, copy]);
    setSelectedId(copy.id);
  }

  function deleteSelected() {
    const id = selectedIdRef.current;
    if (!id) return;
    commitElements(elementsRef.current.filter((el) => el.id !== id));
    setSelectedId(null);
  }

  function removeLayer(id) {
    commitElements(elementsRef.current.filter((el) => el.id !== id));
    if (selectedIdRef.current === id) setSelectedId(null);
  }

  function moveLayer(id, direction) {
    const arr = [...elementsRef.current];
    const idx = arr.findIndex((el) => el.id === id);
    const newIdx = direction === 'up' ? idx + 1 : idx - 1;
    if (idx < 0 || newIdx < 0 || newIdx >= arr.length) return;
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    commitElements(arr);
  }

  function nudge(dx, dy) {
    const el = elementsRef.current.find((item) => item.id === selectedIdRef.current);
    if (!el || el.locked) return;
    if (!nudgeRef.current.active) {
      nudgeRef.current = { active: true, snapshot: elementsRef.current, timer: null };
    }
    clearTimeout(nudgeRef.current.timer);
    liveMap(el.id, (item) => ({ ...item, x: item.x + dx, y: item.y + dy }));
    nudgeRef.current.timer = setTimeout(flushNudge, 700);
  }

  /** Закрыть «сессию сдвига» стрелками одной записью в истории. */
  function flushNudge() {
    const session = nudgeRef.current;
    nudgeRef.current = { active: false, snapshot: null, timer: null };
    if (!session || !session.active || !session.snapshot) return;
    clearTimeout(session.timer);
    if (session.snapshot !== elementsRef.current) {
      dispatch({ type: 'COMMIT_FROM_SNAPSHOT', snapshot: session.snapshot, payload: elementsRef.current });
    }
  }

  /* ---------- JSON ---------- */
  function saveJSON() {
    const data = JSON.stringify({
      artboard: { width: ARTBOARD_WIDTH, height: ARTBOARD_HEIGHT },
      print: printRef.current,
      elements: elementsRef.current,
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'passport.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Файл passport.json сохранён');
  }

  function loadJSONFile(e) {
    const file = e.currentTarget.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const els = parsed.elements || parsed;
        if (!Array.isArray(els)) throw new Error('в файле нет списка элементов');
        let maxId = 0;
        els.forEach((el) => {
          const m = /_(\d+)$/.exec(el.id || '');
          if (m) maxId = Math.max(maxId, parseInt(m[1], 10));
        });
        idCounter = maxId + 1;
        if (parsed.print) setPrintSettings({ ...DEFAULT_PRINT, ...parsed.print });
        elementsRef.current = els;
        dispatch({ type: 'REPLACE', payload: els });
        setSelectedId(null);
        showToast(`Загружено элементов: ${els.length}`);
      } catch (err) {
        window.alert(`Ошибка чтения файла: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.currentTarget.value = '';
  }

  /* ---------- Печать и PDF ---------- */
  function handlePrint() {
    setPrintOpen(false);
    window.setTimeout(() => window.print(), 90);
  }

  async function exportPdf() {
    setBusy('pdf');
    let host = null;
    let root = null;
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const settings = printRef.current;
      const L = computePrintLayout(settings);
      const w = Math.round(L.pageWmm * PX_PER_MM * PDF_DENSITY);
      const h = Math.round(L.pageHmm * PX_PER_MM * PDF_DENSITY);

      host = document.createElement('div');
      host.style.cssText = `position:fixed;left:-100000px;top:0;width:${w}px;height:${h}px;overflow:hidden;z-index:-1;pointer-events:none;`;
      document.body.appendChild(host);

      root = createRoot(host);
      flushSync(() => {
        root.render(<PrintPage settings={settings} elements={elementsRef.current} density={PDF_DENSITY} />);
      });

      const node = host.firstElementChild;
      const imgs = Array.from(node.querySelectorAll('img'));
      await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((res) => { img.onload = res; img.onerror = res; }))));
      await new Promise((res) => setTimeout(res, 60));

      const canvas = await html2canvas(node, {
        backgroundColor: '#ffffff',
        scale: 1,
        width: w,
        height: h,
        windowWidth: w,
        windowHeight: h,
        logging: false,
        imageTimeout: 20000,
      });

      const pdf = new jsPDF({
        orientation: w > h ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [L.pageWmm, L.pageHmm],
        compress: true,
      });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, L.pageWmm, L.pageHmm, undefined, 'FAST');
      pdf.save(`passport-${L.paper}-${L.orientation}.pdf`);
      showToast('PDF сохранён');
    } catch (err) {
      window.alert(`Не удалось собрать PDF: ${err && err.message ? err.message : err}`);
    } finally {
      if (root) root.unmount();
      if (host && host.parentNode) host.parentNode.removeChild(host);
      setBusy('');
    }
  }

  function handleBackgroundMouseDown(e) {
    if (e.button !== 0) return;
    if (editingIdRef.current) commitEditing();
    setSelectedId(null);
  }

  /* ---------- Клавиатура ---------- */
  useEffect(() => {
    function isTyping(target) {
      const tag = (target.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
    }

    function onKeyDown(e) {
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key;

      if (key === 'Alt' && !e.repeat) { setAltDown(true); return; }

      if (ctrl && key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        endSession();
        flushNudge();
        dispatch({ type: 'UNDO' });
        return;
      }
      if (ctrl && (key.toLowerCase() === 'y' || (key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        endSession();
        flushNudge();
        dispatch({ type: 'REDO' });
        return;
      }
      if (ctrl && key.toLowerCase() === 'p') {
        e.preventDefault();
        setPrintOpen(true);
        return;
      }
      if (ctrl && key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (ctrl && key.toLowerCase() === 's') {
        e.preventDefault();
        saveJSON();
        return;
      }
      if (key === 'Escape') {
        if (printOpen) { setPrintOpen(false); return; }
        if (editingIdRef.current) { commitEditing(); return; }
        setSelectedId(null);
        return;
      }
      if (isTyping(e.target)) return;

      if ((key === 'Delete' || key === 'Backspace') && selectedIdRef.current) {
        e.preventDefault();
        deleteSelected();
        return;
      }
      const steps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (steps[key] && selectedIdRef.current) {
        e.preventDefault();
        const k = e.shiftKey ? 10 : 1;
        nudge(steps[key][0] * k, steps[key][1] * k);
      }
    }

    function onKeyUp(e) {
      if (e.key === 'Alt') setAltDown(false);
    }
    function onBlur() { setAltDown(false); }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
    // Все действия работают через ref'ы; в зависимостях только printOpen (Esc).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printOpen]);

  /* ---------- Что показываем линейками ---------- */
  const measuredEl = isDragging && dragId
    ? elements.find((e) => e.id === dragId) || null
    : selectedEl;

  let measurements = [];
  if (measuredEl && (ui.showMargins || isDragging)) {
    // До краёв листа — всегда; до соседних элементов — при зажатом Alt (как в Figma)
    measurements = computeMeasurements(measuredEl, elements, { sheet: true, neighbors: altDown });
    const hovered = altDown && hoverId && hoverId !== measuredEl.id
      ? elements.find((e) => e.id === hoverId && e.visible !== false)
      : null;
    if (hovered) measurements = measurements.concat(computePairMeasurements(measuredEl, hovered));
  }

  /* ---------- Рендер ---------- */
  return (
    <>
      <style>{CSS}</style>
      <style>{`
@page { size: ${printLayout.pageWmm}mm ${printLayout.pageHmm}mm; margin: 0mm; }
@media print {
  .pe-print-root { width: ${printLayout.pageWmm}mm; height: ${printLayout.pageHmm}mm; overflow: hidden; }
}`}</style>

      <div className="pe-app">
        <div className="pe-toolbar">
          <div className="pe-brand">Паспорт</div>
          <button onClick={addText}>+ Текст</button>
          <button onClick={addLine}>+ Линия</button>
          <button onClick={() => fileInputRef.current.click()}>+ Фото</button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />
          <span className="pe-sep" />
          <button onClick={() => { endSession(); flushNudge(); dispatch({ type: 'UNDO' }); }} disabled={state.past.length === 0} title="Ctrl+Z">↶ Отменить</button>
          <button onClick={() => { endSession(); flushNudge(); dispatch({ type: 'REDO' }); }} disabled={state.future.length === 0} title="Ctrl+Shift+Z">↷ Повторить</button>
          <span className="pe-sep" />
          <button
            className={ui.showMargins ? 'active' : ''}
            title="Показывать отступы до краёв листа (Alt — до соседей)"
            onClick={() => setUi({ ...ui, showMargins: !ui.showMargins })}
          >
            📏 Отступы
          </button>
          <button
            className={ui.snap ? 'active' : ''}
            title="Прилипание к краям и центрам (Ctrl — временно выключить)"
            onClick={() => setUi({ ...ui, snap: !ui.snap })}
          >
            🧲 Прилипание
          </button>
          <span className="pe-sep" />
          <button onClick={saveJSON} title="Ctrl+S">💾 JSON</button>
          <button onClick={() => jsonInputRef.current.click()}>📂 Загрузить</button>
          <input ref={jsonInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={loadJSONFile} />
          <span className="pe-grow" />
          <button className="pe-sheet-btn" onClick={() => setPrintOpen(true)} title="Ctrl+P — печать на листе">
            🖨 {printLayout.paper} · {Math.round(printLayout.sx * 100)}%
          </button>
          <button className="pe-primary" onClick={() => setPrintOpen(true)}>Печать A4</button>
        </div>

        <div className="pe-workspace">
          <LayersPanel
            elements={elements}
            selectedId={selectedId}
            onSelect={(id) => { if (editingIdRef.current) commitEditing(); setSelectedId(id); }}
            onToggleVisible={(el) => commitProps(el.id, { visible: el.visible === false })}
            onToggleLock={(el) => commitProps(el.id, { locked: !el.locked })}
            onMove={moveLayer}
            onRemove={removeLayer}
          />

          <div className="pe-canvas-wrap">
            <div className="pe-canvas-inner">
              <div className="pe-artboard-caption">
                <span>Лист {ARTBOARD_WIDTH}×{ARTBOARD_HEIGHT} px · {fmtMm(px2mm(ARTBOARD_WIDTH))} × {fmtMm(px2mm(ARTBOARD_HEIGHT))}</span>
                <span className="pe-muted">
                  Печать: {printLayout.paper}, {printLayout.orientation === 'landscape' ? 'альбомная' : 'книжная'}, поля {printLayout.margin} мм, масштаб {Math.round(printLayout.sx * 100)}%
                </span>
              </div>

              <div
                className="pe-artboard"
                style={{ width: ARTBOARD_WIDTH, height: ARTBOARD_HEIGHT }}
                onMouseDown={handleBackgroundMouseDown}
                onMouseLeave={() => setHoverId(null)}
              >
                {guides.x !== null && <div className="pe-smart-guide pe-smart-guide-v" style={{ left: guides.x }} />}
                {guides.y !== null && <div className="pe-smart-guide pe-smart-guide-h" style={{ top: guides.y }} />}

                {elements.map((el, idx) => {
                  const isSelected = selectedId === el.id;
                  const isEditing = editingId === el.id;
                  const isHovered = altDown && hoverId === el.id && !isSelected;
                  return (
                    <div
                      key={el.id}
                      className={`pe-element${isSelected ? ' selected' : ''}${el.locked ? ' locked' : ''}${isHovered ? ' hovered' : ''}`}
                      style={{
                        left: el.x,
                        top: el.y,
                        width: el.width,
                        height: el.height,
                        zIndex: idx + 1,
                        display: el.visible === false ? 'none' : 'block',
                        cursor: el.locked ? 'not-allowed' : isEditing ? 'text' : 'move',
                      }}
                      onMouseDown={(e) => handleElementMouseDown(e, el)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (!editingIdRef.current) startEditing(el);
                      }}
                      onMouseEnter={() => setHoverId(el.id)}
                      onMouseLeave={() => setHoverId((cur) => (cur === el.id ? null : cur))}
                    >
                      <ElementInner
                        el={el}
                        editing={isEditing}
                        innerRef={isEditing ? editingRef : null}
                        onBlur={isEditing ? commitEditing : undefined}
                      />

                      {isSelected && !el.locked && HANDLES.map((h) => (
                        <div
                          key={h}
                          className={`pe-handle pe-handle-${h}`}
                          onMouseDown={(e) => handleResizeStart(e, el, h)}
                          onDoubleClick={(e) => e.stopPropagation()}
                        />
                      ))}
                    </div>
                  );
                })}

                <MeasureOverlay items={measurements} />

                {badge && (
                  <div
                    className="pe-badge"
                    style={{
                      left: clamp(badge.x, 2, ARTBOARD_WIDTH - 96),
                      top: clamp(badge.y, 2, ARTBOARD_HEIGHT - 22),
                    }}
                  >
                    {badge.text}
                  </div>
                )}
              </div>
            </div>
          </div>

          <PropsPanel
            el={selectedEl}
            onLive={(props) => selectedEl && liveMap(selectedEl.id, (el) => ({ ...el, ...props }))}
            onCommit={(props) => selectedEl && commitProps(selectedEl.id, props)}
            onSessionStart={beginSession}
            onSessionEnd={endSession}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
          />
        </div>
      </div>

      {/* Чистовик для печати: виден только в @media print */}
      <div className="pe-print-root" aria-hidden="true">
        <PrintPage settings={printSettings} elements={elements} />
      </div>

      {printOpen && (
        <PrintDialog
          settings={printSettings}
          onChange={setPrintSettings}
          elements={elements}
          onClose={() => setPrintOpen(false)}
          onPrint={handlePrint}
          onPdf={exportPdf}
          busy={busy}
        />
      )}

      {toast && <div className="pe-toast">{toast}</div>}
    </>
  );
}

/* ===================== CSS ===================== */
const CSS = `
* { box-sizing: border-box; }
html, body, #root { height: 100%; }
body { margin: 0; }

.pe-app { display: flex; flex-direction: column; height: 100vh; font-family: Arial, "Helvetica Neue", sans-serif; background: #2b2b2b; color: #eee; }

/* ---------- Тулбар ---------- */
.pe-toolbar { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: #1e1e1e; border-bottom: 1px solid #000; flex-wrap: wrap; }
.pe-brand { font-weight: 700; letter-spacing: .4px; margin-right: 6px; color: #fff; }
.pe-toolbar button { background: #3a3a3a; color: #fff; border: 1px solid #555; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 13px; line-height: 1.2; }
.pe-toolbar button:hover { background: #4a4a4a; }
.pe-toolbar button:disabled { opacity: .4; cursor: default; }
.pe-toolbar button.active { background: #2d8cf0; border-color: #2d8cf0; }
.pe-toolbar button.pe-primary { background: #2d8cf0; border-color: #2d8cf0; font-weight: 700; }
.pe-toolbar button.pe-primary:hover { background: #3d9cff; }
.pe-toolbar .pe-sheet-btn { background: #262626; }
.pe-sep { width: 1px; height: 22px; background: #4d4d4d; margin: 0 4px; }
.pe-grow { flex: 1; }

/* ---------- Рабочая область ---------- */
.pe-workspace { flex: 1; display: flex; overflow: hidden; }
.pe-panel { width: 250px; background: #f5f5f5; padding: 10px; overflow-y: auto; flex-shrink: 0; color: #333; }
.pe-layers { border-right: 1px solid #d0d0d0; }
.pe-props { border-left: 1px solid #d0d0d0; }
.pe-panel h3 { margin: 0 0 8px; font-size: 14px; color: #222; display: flex; align-items: center; gap: 6px; }
.pe-panel h4 { margin: 16px 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: #777; }
.pe-count { background: #ddd; border-radius: 10px; padding: 0 7px; font-size: 11px; color: #555; }
.pe-el-title { font-size: 12px; font-weight: 700; color: #2d8cf0; margin-bottom: 6px; }
.pe-hint { font-size: 11px; color: #888; line-height: 1.5; }
.pe-hint-list { margin: 8px 0 0; padding-left: 16px; font-size: 11px; color: #888; line-height: 1.7; }
.pe-muted { color: #999; font-weight: 400; font-size: 12px; }

.pe-layer-row { display: flex; align-items: center; gap: 2px; padding: 3px 2px; border-radius: 4px; cursor: pointer; font-size: 12px; }
.pe-layer-row:hover { background: #e8e8e8; }
.pe-layer-row.selected { background: #cfe4ff; }
.pe-layer-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 4px; }
.pe-icon-btn { background: none; border: none; cursor: pointer; font-size: 12px; padding: 2px 4px; color: #444; }
.pe-icon-btn:hover { color: #000; }
.pe-icon-btn.pe-danger:hover { color: #c0392b; }

/* ---------- Холст ---------- */
.pe-canvas-wrap { flex: 1; background: #6f6f6f; overflow: auto; display: flex; justify-content: center; padding: 28px; }
.pe-canvas-inner { display: flex; flex-direction: column; gap: 8px; align-items: center; margin: auto; }
.pe-artboard-caption { display: flex; gap: 14px; font-size: 11px; color: #eaeaea; align-items: baseline; }
.pe-artboard-caption .pe-muted { color: #cfcfcf; }
.pe-artboard { position: relative; background: #fff; box-shadow: 0 2px 18px rgba(0,0,0,.45); flex-shrink: 0; }

.pe-element { position: absolute; }
.pe-element.selected { box-shadow: 0 0 0 1px #2d8cf0; }
.pe-element.selected.locked { box-shadow: 0 0 0 1px #e74c3c; }
.pe-element.hovered { box-shadow: 0 0 0 1px #e8590c; }

.pe-text-content { width: 100%; height: 100%; outline: none; white-space: pre-wrap; word-break: break-word; overflow: hidden; }
.pe-image-content { width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
.pe-rect-content { width: 100%; height: 100%; }

.pe-handle { position: absolute; width: 8px; height: 8px; background: #fff; border: 1px solid #2d8cf0; border-radius: 1px; z-index: 9999; }
.pe-handle-nw { top: -4px; left: -4px; cursor: nwse-resize; }
.pe-handle-n  { top: -4px; left: calc(50% - 4px); cursor: ns-resize; }
.pe-handle-ne { top: -4px; right: -4px; cursor: nesw-resize; }
.pe-handle-w  { top: calc(50% - 4px); left: -4px; cursor: ew-resize; }
.pe-handle-e  { top: calc(50% - 4px); right: -4px; cursor: ew-resize; }
.pe-handle-sw { bottom: -4px; left: -4px; cursor: nesw-resize; }
.pe-handle-s  { bottom: -4px; left: calc(50% - 4px); cursor: ns-resize; }
.pe-handle-se { bottom: -4px; right: -4px; cursor: nwse-resize; }

/* ---------- Умные направляющие (выравнивание линиями) ---------- */
.pe-smart-guide { position: absolute; background: #ff2b5a; z-index: 9800; pointer-events: none; }
.pe-smart-guide-v { top: 0; bottom: 0; width: 1px; }
.pe-smart-guide-h { left: 0; right: 0; height: 1px; }

/* ---------- Отступы линейками ---------- */
.pe-measure { position: absolute; left: 0; top: 0; z-index: 9850; pointer-events: none; overflow: visible; }
.pe-measure line { stroke-width: 1; shape-rendering: crispEdges; }
.pe-measure rect { stroke: none; }
.pe-measure text { font: 700 10px Arial, sans-serif; fill: #fff; text-anchor: middle; dominant-baseline: central; }
.pe-measure .pe-m-sheet line { stroke: #ff2b5a; }
.pe-measure .pe-m-sheet rect { fill: #ff2b5a; }
.pe-measure .pe-m-near line { stroke: #e8590c; }
.pe-measure .pe-m-near rect { fill: #e8590c; }

.pe-badge { position: absolute; z-index: 9900; background: #2b2b2b; color: #fff; font: 700 11px/1 Arial, sans-serif; padding: 5px 7px; border-radius: 3px; pointer-events: none; white-space: nowrap; box-shadow: 0 1px 4px rgba(0,0,0,.4); }

/* ---------- Поля ---------- */
.pe-field { display: block; font-size: 11px; margin: 6px 0; color: #555; }
.pe-field > span { display: block; margin-bottom: 2px; }
.pe-field-input { display: flex; align-items: center; gap: 6px; }
.pe-field input[type=number], .pe-field input[type=text], .pe-field select {
  width: 100%; padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; background: #fff; font-size: 12px; color: #222;
}
.pe-field em { font-style: normal; color: #999; font-size: 10px; flex-shrink: 0; }
.pe-field input[type=color] { width: 34px; height: 26px; padding: 1px; border: 1px solid #ccc; border-radius: 4px; background: #fff; cursor: pointer; }
.pe-color code { font-size: 11px; color: #666; }
.pe-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 8px; }
.pe-btn-group { display: flex; gap: 4px; margin-top: 6px; }
.pe-btn-group button { flex: 1; padding: 5px; border: 1px solid #ccc; background: #fff; border-radius: 4px; cursor: pointer; font-size: 13px; color: #333; }
.pe-btn-group button.active { background: #2d8cf0; color: #fff; border-color: #2d8cf0; }
.pe-danger { color: #c0392b; }
.pe-checkbox { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 12px; color: #444; }

/* ---------- Блок отступов в свойствах ---------- */
.pe-margin-box { display: grid; grid-template-columns: 1fr auto 1fr; grid-template-rows: auto auto auto; gap: 3px; align-items: center; justify-items: center; background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 8px 6px; }
.pe-margin-box b { font: 700 11px Arial; color: #ff2b5a; background: #fff0f4; border-radius: 3px; padding: 2px 6px; }
.pe-margin-box i { font: 700 11px Arial; color: #2d8cf0; font-style: normal; background: #eef6ff; border-radius: 3px; padding: 3px 7px; }
.pe-margin-mm { font-size: 10px; color: #999; margin-top: 4px; text-align: center; }

/* ---------- Диалог печати ---------- */
.pe-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 20000; display: flex; align-items: center; justify-content: center; padding: 20px; }
.pe-modal { background: #fff; color: #333; border-radius: 8px; width: min(1100px, 100%); height: min(760px, 100%); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,.5); }
.pe-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #e3e3e3; background: #fafafa; }
.pe-modal-head h3 { margin: 0; font-size: 15px; }
.pe-modal-body { flex: 1; display: flex; overflow: hidden; }
.pe-modal-settings { width: 280px; flex-shrink: 0; padding: 14px 16px; overflow-y: auto; border-right: 1px solid #eee; background: #fbfbfb; }
.pe-preview { flex: 1; overflow: auto; background: #585858; display: flex; align-items: center; justify-content: center; padding: 24px; }
.pe-modal-foot { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-top: 1px solid #e3e3e3; background: #fafafa; }
.pe-modal-foot span { flex: 1; font-size: 12px; }
.pe-modal-foot button, .pe-modal-settings button { background: #3a3a3a; color: #fff; border: 1px solid #555; padding: 7px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; }
.pe-modal-foot button:hover { background: #4a4a4a; }
.pe-modal-foot button:disabled { opacity: .5; cursor: default; }
.pe-modal-foot button.pe-primary { background: #2d8cf0; border-color: #2d8cf0; font-weight: 700; }
.pe-specs { margin: 14px 0 0; font-size: 11px; border-top: 1px solid #e8e8e8; padding-top: 10px; }
.pe-specs div { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
.pe-specs dt { color: #888; }
.pe-specs dd { margin: 0; font-weight: 700; color: #333; }
.pe-warn { margin: 10px 0 0; padding: 8px; background: #fff4e5; border: 1px solid #f5c98a; border-radius: 4px; font-size: 11px; color: #8a4b00; }

/* ---------- Страница (экран / печать / PDF) ---------- */
.pe-page { background: #fff; position: relative; box-shadow: 0 2px 16px rgba(0,0,0,.4); }
.pe-page--flat { box-shadow: none !important; }
.pe-page-content { position: relative; overflow: hidden; }
.pe-page-doc { position: absolute; left: 0; top: 0; }
.pe-print-el { position: absolute; }
.pe-print-el .pe-text-content { overflow: hidden; }
.pe-page-frame { position: absolute; border: 1px dashed rgba(45,140,240,.75); pointer-events: none; }

.pe-print-root { display: none; }

.pe-toast { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); background: #1e1e1e; color: #fff; padding: 10px 16px; border-radius: 6px; font-size: 13px; z-index: 30000; box-shadow: 0 4px 18px rgba(0,0,0,.5); }

/* ---------- Печать ---------- */
@media print {
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; height: auto !important; }
  .pe-app, .pe-modal-backdrop, .pe-toast { display: none !important; }
  .pe-print-root { display: block !important; }
  .pe-print-root, .pe-print-root * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .pe-page { box-shadow: none !important; margin: 0 !important; }
  .pe-page-frame { display: none !important; }
}
`;

/* ===================== Точка входа ===================== */
const rootElement = typeof document !== 'undefined' ? document.getElementById('root') : null;
if (rootElement) {
  createRoot(rootElement).render(<PassportEditor />);
}

/* Экспорты для проверок/тестов чистой логики */
export {
  computePrintLayout,
  calculateSnapping,
  computeResizeSnapped,
  computeMeasurements,
  computePairMeasurements,
  sheetMargins,
  buildInitialElements,
  ARTBOARD_WIDTH,
  ARTBOARD_HEIGHT,
};

import React, { useReducer, useState, useRef, useEffect } from 'react';

/* ===================== Константы ===================== */
const ARTBOARD_WIDTH = 650;
const ARTBOARD_HEIGHT = 1000;
const SNAP_THRESHOLD = 6; // Дистанция прилипания в пикселях

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

/* ===================== Resize helper ===================== */
function computeResize(handle, orig, dx, dy) {
  const minSize = 10;
  let { x, y, width, height } = orig;
  if (handle.includes('e')) width = Math.max(minSize, orig.width + dx);
  if (handle.includes('s')) height = Math.max(minSize, orig.height + dy);
  if (handle.includes('w')) {
    width = Math.max(minSize, orig.width - dx);
    x = orig.x + (orig.width - width);
  }
  if (handle.includes('n')) {
    height = Math.max(minSize, orig.height - dy);
    y = orig.y + (orig.height - height);
  }
  return { x, y, width, height };
}

/* ===================== Алгоритм умного выравнивания ===================== */
function calculateSnapping(draggingEl, rawX, rawY, allElements) {
  let snappedX = rawX;
  let snappedY = rawY;
  let guideX = null;
  let guideY = null;

  let minDiffX = SNAP_THRESHOLD + 1;
  let minDiffY = SNAP_THRESHOLD + 1;

  const width = draggingEl.width;
  const height = draggingEl.height;

  // Точки перетаскиваемого объекта
  const dragXPoints = [
    { val: rawX, offset: 0 },                  // Левый край
    { val: rawX + width / 2, offset: -width / 2 }, // Центр X
    { val: rawX + width, offset: -width }       // Правый край
  ];

  const dragYPoints = [
    { val: rawY, offset: 0 },                   // Верхний край
    { val: rawY + height / 2, offset: -height / 2 }, // Центр Y
    { val: rawY + height, offset: -height }       // Нижний край
  ];

  // Сбор всех целевых линий (другие элементы + центр холста)
  const targetXLines = [ARTBOARD_WIDTH / 2];
  const targetYLines = [ARTBOARD_HEIGHT / 2];

  allElements.forEach((el) => {
    if (el.id === draggingEl.id || el.visible === false) return;
    targetXLines.push(el.x, el.x + el.width / 2, el.x + el.width);
    targetYLines.push(el.y, el.y + el.height / 2, el.y + el.height);
  });

  // Проверка по горизонтали (X)
  for (const dp of dragXPoints) {
    for (const tx of targetXLines) {
      const diff = Math.abs(dp.val - tx);
      if (diff <= SNAP_THRESHOLD && diff < minDiffX) {
        minDiffX = diff;
        snappedX = tx + dp.offset;
        guideX = tx;
      }
    }
  }

  // Проверка по вертикали (Y)
  for (const dp of dragYPoints) {
    for (const ty of targetYLines) {
      const diff = Math.abs(dp.val - ty);
      if (diff <= SNAP_THRESHOLD && diff < minDiffY) {
        minDiffY = diff;
        snappedY = ty + dp.offset;
        guideY = ty;
      }
    }
  }

  return { x: snappedX, y: snappedY, guideX, guideY };
}

const HANDLES = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];

/* ===================== Компонент ===================== */
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
  const [guides, setGuides] = useState({ x: null, y: null });

  const dragRef = useRef(null);
  const elementsRef = useRef(elements);
  const editingRef = useRef(null);
  const fileInputRef = useRef(null);
  const jsonInputRef = useRef(null);

  useEffect(() => { elementsRef.current = elements; }, [elements]);

  const selectedEl = elements.find((e) => e.id === selectedId) || null;

  /* ---------- Редактирование текста ---------- */
  function startEditing(el) {
    setEditingId(el.id);
  }

  function commitEditing() {
    if (editingId && editingRef.current) {
      const newText = editingRef.current.innerText;
      const newArr = elementsRef.current.map((e) => (e.id === editingId ? { ...e, text: newText } : e));
      dispatch({ type: 'COMMIT', payload: newArr });
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
    if (editingId && editingId !== el.id) commitEditing();
    setSelectedId(el.id);
    if (el.locked) return;
    if (editingId === el.id) return;
    dragRef.current = {
      mode: 'move',
      id: el.id,
      startX: e.clientX,
      startY: e.clientY,
      orig: { x: el.x, y: el.y, width: el.width, height: el.height },
      snapshot: elementsRef.current,
    };
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
    };
    setIsDragging(true);
  }

  useEffect(() => {
    if (!isDragging) return;

    function onMove(e) {
      const d = dragRef.current;
      if (!d) return;

      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;

      if (d.mode === 'move') {
        const rawX = d.orig.x + dx;
        const rawY = d.orig.y + dy;

        const currentEl = elementsRef.current.find((item) => item.id === d.id);
        if (!currentEl) return;

        // Расчет прилипания и направляющих
        const snap = calculateSnapping(currentEl, rawX, rawY, elementsRef.current);

        setGuides({ x: snap.guideX, y: snap.guideY });

        const newArr = elementsRef.current.map((el) => {
          if (el.id !== d.id) return el;
          return { ...el, x: snap.x, y: snap.y };
        });

        elementsRef.current = newArr;
        dispatch({ type: 'SET', payload: newArr });
      } else if (d.mode === 'resize') {
        const { x, y, width, height } = computeResize(d.handle, d.orig, dx, dy);
        const newArr = elementsRef.current.map((el) => {
          if (el.id !== d.id) return el;
          return { ...el, x, y, width, height };
        });
        elementsRef.current = newArr;
        dispatch({ type: 'SET', payload: newArr });
      }
    }

    function onUp() {
      const d = dragRef.current;
      if (d) {
        dispatch({ type: 'COMMIT_FROM_SNAPSHOT', snapshot: d.snapshot, payload: elementsRef.current });
      }
      dragRef.current = null;
      setIsDragging(false);
      setGuides({ x: null, y: null }); // Скрыть линии направляющих
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  /* ---------- Клавиатура ---------- */
  useEffect(() => {
    function onKeyDown(e) {
      const tag = (e.target.tagName || '').toLowerCase();
      const isEditable = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
      } else if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !isEditable) {
        e.preventDefault();
        deleteSelected();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  /* ---------- Действия над элементами ---------- */
  function updateElementProps(id, props) {
    const newArr = elements.map((el) => (el.id === id ? { ...el, ...props } : el));
    dispatch({ type: 'COMMIT', payload: newArr });
  }

  function addText() {
    const el = createTextElement({ x: 120, y: 120 });
    dispatch({ type: 'COMMIT', payload: [...elements, el] });
    setSelectedId(el.id);
  }

  function addLine() {
    const el = createLineElement({ x: 120, y: 120 });
    dispatch({ type: 'COMMIT', payload: [...elements, el] });
    setSelectedId(el.id);
  }

  function handleImageFile(e) {
    const file = e.target.files[0];
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
        dispatch({ type: 'COMMIT', payload: [...elementsRef.current, el] });
        setSelectedId(el.id);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function duplicateSelected() {
    if (!selectedEl) return;
    const copy = { ...selectedEl, id: genId(), x: selectedEl.x + 16, y: selectedEl.y + 16, name: selectedEl.name + ' копия' };
    dispatch({ type: 'COMMIT', payload: [...elements, copy] });
    setSelectedId(copy.id);
  }

  function deleteSelected() {
    if (!selectedId) return;
    const newArr = elements.filter((el) => el.id !== selectedId);
    dispatch({ type: 'COMMIT', payload: newArr });
    setSelectedId(null);
  }

  function moveLayer(id, direction) {
    const arr = [...elements];
    const idx = arr.findIndex((el) => el.id === id);
    const newIdx = direction === 'up' ? idx + 1 : idx - 1;
    if (newIdx < 0 || newIdx >= arr.length) return;
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    dispatch({ type: 'COMMIT', payload: arr });
  }

  function removeLayer(id) {
    const newArr = elements.filter((el) => el.id !== id);
    dispatch({ type: 'COMMIT', payload: newArr });
    if (selectedId === id) setSelectedId(null);
  }

  /* ---------- JSON ---------- */
  function saveJSON() {
    const data = JSON.stringify({ artboard: { width: ARTBOARD_WIDTH, height: ARTBOARD_HEIGHT }, elements }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'passport.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function loadJSONFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const els = parsed.elements || parsed;
        let maxId = 0;
        els.forEach((el) => {
          const m = /_(\d+)$/.exec(el.id || '');
          if (m) maxId = Math.max(maxId, parseInt(m[1], 10));
        });
        idCounter = maxId + 1;
        dispatch({ type: 'COMMIT', payload: els });
        setSelectedId(null);
      } catch (err) {
        alert('Ошибка чтения файла: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handlePrint() {
    window.print();
  }

  function handleBackgroundMouseDown() {
    if (editingId) commitEditing();
    setSelectedId(null);
  }

  /* ---------- Рендер ---------- */
  return (
    <div className="pe-app">
      <style>{CSS}</style>

      <div className="pe-toolbar">
        <button onClick={addText}>+ Текст</button>
        <button onClick={addLine}>+ Линия</button>
        <button onClick={() => fileInputRef.current.click()}>+ Фото</button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />
        <span className="pe-sep" />
        <button onClick={() => dispatch({ type: 'UNDO' })} disabled={state.past.length === 0} title="Ctrl+Z">↶ Отменить</button>
        <button onClick={() => dispatch({ type: 'REDO' })} disabled={state.future.length === 0} title="Ctrl+Shift+Z">↷ Повторить</button>
        <span className="pe-sep" />
        <button onClick={saveJSON}>💾 Сохранить JSON</button>
        <button onClick={() => jsonInputRef.current.click()}>📂 Загрузить JSON</button>
        <input ref={jsonInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={loadJSONFile} />
        <span className="pe-sep" />
        <button onClick={handlePrint}>🖨 Печать / PDF</button>
      </div>

      <div className="pe-workspace">
        {/* Слои */}
        <div className="pe-panel pe-layers">
          <h3>Слои</h3>
          <div className="pe-layers-list">
            {[...elements].reverse().map((el) => (
              <div
                key={el.id}
                className={`pe-layer-row${selectedId === el.id ? ' selected' : ''}`}
                onClick={() => setSelectedId(el.id)}
              >
                <button
                  className="pe-icon-btn"
                  title="Видимость"
                  onClick={(e) => { e.stopPropagation(); updateElementProps(el.id, { visible: el.visible === false }); }}
                >
                  {el.visible === false ? '🚫' : '👁'}
                </button>
                <button
                  className="pe-icon-btn"
                  title="Блокировка"
                  onClick={(e) => { e.stopPropagation(); updateElementProps(el.id, { locked: !el.locked }); }}
                >
                  {el.locked ? '🔒' : '🔓'}
                </button>
                <span className="pe-layer-name">{el.name || el.type}</span>
                <button className="pe-icon-btn" title="Выше" onClick={(e) => { e.stopPropagation(); moveLayer(el.id, 'up'); }}>↑</button>
                <button className="pe-icon-btn" title="Ниже" onClick={(e) => { e.stopPropagation(); moveLayer(el.id, 'down'); }}>↓</button>
                <button className="pe-icon-btn pe-danger" title="Удалить" onClick={(e) => { e.stopPropagation(); removeLayer(el.id); }}>✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* Холст */}
        <div className="pe-canvas-wrap">
          <div
            className="pe-artboard"
            style={{ width: ARTBOARD_WIDTH, height: ARTBOARD_HEIGHT }}
            onMouseDown={handleBackgroundMouseDown}
          >
            {/* Направляющие линии Figma/Photoshop style */}
            {guides.x !== null && (
              <div className="pe-smart-guide pe-smart-guide-v" style={{ left: guides.x }} />
            )}
            {guides.y !== null && (
              <div className="pe-smart-guide pe-smart-guide-h" style={{ top: guides.y }} />
            )}

            {elements.map((el, idx) => {
              const isSelected = selectedId === el.id;
              const isEditing = editingId === el.id;
              return (
                <div
                  key={el.id}
                  className={`pe-element${isSelected ? ' selected' : ''}${el.locked ? ' locked' : ''}`}
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
                >
                  {el.type === 'text' && (
                    <div
                      ref={isEditing ? editingRef : null}
                      contentEditable={isEditing}
                      suppressContentEditableWarning
                      onBlur={isEditing ? commitEditing : undefined}
                      onDoubleClick={(e) => { e.stopPropagation(); if (!el.locked) startEditing(el); }}
                      className="pe-text-content"
                      style={{
                        fontSize: el.fontSize,
                        fontWeight: el.fontWeight,
                        fontStyle: el.fontStyle,
                        textDecoration: el.textDecoration,
                        color: el.color,
                        textAlign: el.textAlign,
                        fontFamily: el.fontFamily,
                        lineHeight: el.lineHeight,
                        userSelect: isEditing ? 'text' : 'none',
                      }}
                    >
                      {el.text}
                    </div>
                  )}
                  {el.type === 'image' && (
                    <img src={el.src} alt="" draggable={false} className="pe-image-content" />
                  )}
                  {el.type === 'rect' && (
                    <div className="pe-rect-content" style={{ background: el.background }} />
                  )}

                  {isSelected && !el.locked && HANDLES.map((h) => (
                    <div
                      key={h}
                      className={`pe-handle pe-handle-${h}`}
                      onMouseDown={(e) => handleResizeStart(e, el, h)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Свойства */}
        <div className="pe-panel pe-props">
          <h3>Свойства</h3>
          {!selectedEl && <p className="pe-hint">Выберите элемент на холсте</p>}
          {selectedEl && (
            <>
              <label>X
                <input type="number" value={Math.round(selectedEl.x)} onChange={(e) => updateElementProps(selectedEl.id, { x: Number(e.target.value) })} />
              </label>
              <label>Y
                <input type="number" value={Math.round(selectedEl.y)} onChange={(e) => updateElementProps(selectedEl.id, { y: Number(e.target.value) })} />
              </label>
              <label>Ширина
                <input type="number" value={Math.round(selectedEl.width)} onChange={(e) => updateElementProps(selectedEl.id, { width: Number(e.target.value) })} />
              </label>
              <label>Высота
                <input type="number" value={Math.round(selectedEl.height)} onChange={(e) => updateElementProps(selectedEl.id, { height: Number(e.target.value) })} />
              </label>

              {selectedEl.type === 'text' && (
                <>
                  <label>Размер шрифта
                    <input type="number" value={selectedEl.fontSize} onChange={(e) => updateElementProps(selectedEl.id, { fontSize: Number(e.target.value) })} />
                  </label>
                  <label>Цвет текста
                    <input type="color" value={selectedEl.color} onChange={(e) => updateElementProps(selectedEl.id, { color: e.target.value })} />
                  </label>
                  <div className="pe-btn-group">
                    <button className={selectedEl.fontWeight === 'bold' ? 'active' : ''} onClick={() => updateElementProps(selectedEl.id, { fontWeight: selectedEl.fontWeight === 'bold' ? 'normal' : 'bold' })}><b>Ж</b></button>
                    <button className={selectedEl.fontStyle === 'italic' ? 'active' : ''} onClick={() => updateElementProps(selectedEl.id, { fontStyle: selectedEl.fontStyle === 'italic' ? 'normal' : 'italic' })}><i>К</i></button>
                    <button className={selectedEl.textDecoration === 'underline' ? 'active' : ''} onClick={() => updateElementProps(selectedEl.id, { textDecoration: selectedEl.textDecoration === 'underline' ? 'none' : 'underline' })}><u>Ч</u></button>
                  </div>
                  <div className="pe-btn-group">
                    <button className={selectedEl.textAlign === 'left' ? 'active' : ''} onClick={() => updateElementProps(selectedEl.id, { textAlign: 'left' })}>⇤</button>
                    <button className={selectedEl.textAlign === 'center' ? 'active' : ''} onClick={() => updateElementProps(selectedEl.id, { textAlign: 'center' })}>↔</button>
                    <button className={selectedEl.textAlign === 'right' ? 'active' : ''} onClick={() => updateElementProps(selectedEl.id, { textAlign: 'right' })}>⇥</button>
                  </div>
                  <p className="pe-hint">Двойной клик по тексту на холсте — редактирование</p>
                </>
              )}

              {selectedEl.type === 'rect' && (
                <label>Цвет линии
                  <input type="color" value={selectedEl.background} onChange={(e) => updateElementProps(selectedEl.id, { background: e.target.value })} />
                </label>
              )}

              <label className="pe-checkbox">
                <input type="checkbox" checked={!!selectedEl.locked} onChange={(e) => updateElementProps(selectedEl.id, { locked: e.target.checked })} />
                Заблокировать слой
              </label>

              <div className="pe-btn-group">
                <button onClick={duplicateSelected}>Дублировать</button>
                <button className="pe-danger" onClick={deleteSelected}>Удалить</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===================== CSS ===================== */
const CSS = `
* { box-sizing: border-box; }
.pe-app { display:flex; flex-direction:column; height:100vh; font-family: Arial, sans-serif; background:#2b2b2b; }
.pe-toolbar { display:flex; align-items:center; gap:8px; padding:8px 12px; background:#1e1e1e; flex-wrap:wrap; }
.pe-toolbar button { background:#3a3a3a; color:#fff; border:1px solid #555; padding:6px 10px; border-radius:4px; cursor:pointer; font-size:13px; }
.pe-toolbar button:hover { background:#4a4a4a; }
.pe-toolbar button:disabled { opacity:0.4; cursor:default; }
.pe-sep { width:1px; height:22px; background:#555; margin:0 4px; }

.pe-workspace { flex:1; display:flex; overflow:hidden; }

.pe-panel { width:230px; background:#f5f5f5; padding:10px; overflow-y:auto; flex-shrink:0; }
.pe-layers { border-right:1px solid #ddd; }
.pe-props { border-left:1px solid #ddd; }
.pe-panel h3 { margin-top:0; font-size:14px; color:#333; }
.pe-hint { font-size:11px; color:#888; }

.pe-layer-row { display:flex; align-items:center; gap:2px; padding:4px 2px; border-radius:4px; cursor:pointer; font-size:12px; }
.pe-layer-row:hover { background:#e8e8e8; }
.pe-layer-row.selected { background:#cfe4ff; }
.pe-layer-name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:0 4px; }
.pe-icon-btn { background:none; border:none; cursor:pointer; font-size:12px; padding:2px 4px; }
.pe-icon-btn.pe-danger:hover { color:red; }

.pe-canvas-wrap { flex:1; background:#808080; overflow:auto; display:flex; justify-content:center; padding:40px; }
.pe-artboard { position:relative; background:#fff; box-shadow:0 0 14px rgba(0,0,0,0.5); flex-shrink:0; }

.pe-element { position:absolute; border:1px solid transparent; }
.pe-element.selected { border-color:#2d8cf0; }
.pe-element.selected.locked { border-color:#e74c3c; border-style:dashed; }

.pe-text-content { width:100%; height:100%; outline:none; white-space:pre-wrap; word-break:break-word; overflow:hidden; }
.pe-image-content { width:100%; height:100%; object-fit:contain; pointer-events:none; }
.pe-rect-content { width:100%; height:100%; }

.pe-handle { position:absolute; width:8px; height:8px; background:#2d8cf0; border:1px solid #fff; z-index:9999; }
.pe-handle-nw { top:-4px; left:-4px; cursor:nwse-resize; }
.pe-handle-n  { top:-4px; left:calc(50% - 4px); cursor:ns-resize; }
.pe-handle-ne { top:-4px; right:-4px; cursor:nesw-resize; }
.pe-handle-w  { top:calc(50% - 4px); left:-4px; cursor:ew-resize; }
.pe-handle-e  { top:calc(50% - 4px); right:-4px; cursor:ew-resize; }
.pe-handle-sw { bottom:-4px; left:-4px; cursor:nesw-resize; }
.pe-handle-s  { bottom:-4px; left:calc(50% - 4px); cursor:ns-resize; }
.pe-handle-se { bottom:-4px; right:-4px; cursor:nwse-resize; }

/* Умные направляющие (Smart Guides) */
.pe-smart-guide { position: absolute; background: #ff0055; z-index: 10000; pointer-events: none; }
.pe-smart-guide-v { top: 0; bottom: 0; width: 1px; }
.pe-smart-guide-h { left: 0; right: 0; height: 1px; }

.pe-props label { display:block; font-size:12px; margin:8px 0 2px; color:#333; }
.pe-props input[type=number], .pe-props input[type=color] { width:100%; padding:4px; margin-top:2px; }
.pe-btn-group { display:flex; gap:4px; margin-top:6px; }
.pe-btn-group button { flex:1; padding:4px; border:1px solid #ccc; background:#fff; border-radius:4px; cursor:pointer; }
.pe-btn-group button.active { background:#2d8cf0; color:#fff; border-color:#2d8cf0; }
.pe-danger { color:#c0392b; }
.pe-checkbox { display:flex; align-items:center; gap:6px; margin-top:10px; font-size:12px; }

@media print {
  .pe-toolbar, .pe-layers, .pe-props { display:none !important; }
  .pe-canvas-wrap { padding:0 !important; overflow:visible !important; background:#fff !important; }
  .pe-artboard { box-shadow:none !important; }
  .pe-element { border-color:transparent !important; }
  .pe-handle, .pe-smart-guide { display:none !important; }
}
`;
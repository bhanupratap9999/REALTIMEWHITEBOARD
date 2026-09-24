import { useEffect, useRef, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { createOperation, serializeFabricObject } from '../utils/operations';

export function useWhiteboard({
  boardId,
  user,
  emitOperation,
  emitCursorMove,
  boardVersionRef,
  containerRef,
  onObjectCreated,
}) {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);

  const [activeTool, setActiveTool] = useState('select');
  const [strokeColor, setStrokeColor] = useState('#1e293b');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [fillColor, setFillColor] = useState('transparent');
  const [isFilled, setIsFilled] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [hasObjects, setHasObjects] = useState(false);

  // Keep latest values in refs for event listeners
  const activeToolRef = useRef('select');
  const strokeColorRef = useRef('#1e293b');
  const strokeWidthRef = useRef(3);
  const isFilledRef = useRef(false);
  const fillColorRef = useRef('transparent');

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { strokeColorRef.current = strokeColor; }, [strokeColor]);
  useEffect(() => { strokeWidthRef.current = strokeWidth; }, [strokeWidth]);
  useEffect(() => { isFilledRef.current = isFilled; }, [isFilled]);
  useEffect(() => { fillColorRef.current = fillColor; }, [fillColor]);

  const isDrawingShapeRef = useRef(false);
  const activeShapeRef = useRef(null);
  const shapeStartRef = useRef({ x: 0, y: 0 });
  const objectPreMoveState = useRef(new Map());
  const isApplyingRemoteRef = useRef(false);
  const lastCursorEmitRef = useRef(0);
  const lastMoveEmitRef = useRef(0);

  // -------------------------------------------------------------------
  // Initialize Fabric Canvas
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: false,
      selection: true,
      preserveObjectStacking: true,
      stopContextMenu: true,
      fireRightClick: true,
      enableRetinaScaling: true,
    });

    fabricCanvasRef.current = canvas;

    const handleResize = () => {
      const container = containerRef?.current || canvasRef.current?.closest('.canvas-area') || canvasRef.current?.parentElement;
      if (container && canvas && !canvas.disposed) {
        const width = container.clientWidth || window.innerWidth;
        const height = container.clientHeight || window.innerHeight;
        if (width > 0 && height > 0) {
          canvas.setWidth(width);
          canvas.setHeight(height);
          canvas.calcOffset();
          canvas.requestRenderAll();
        }
      }
    };

    handleResize();
    const timer = setTimeout(handleResize, 100);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    const observedContainer = containerRef?.current || canvasRef.current?.parentElement;
    if (observedContainer) {
      resizeObserver.observe(observedContainer);
    }
    window.addEventListener('resize', handleResize);

    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = strokeColorRef.current;
    canvas.freeDrawingBrush.width = strokeWidthRef.current;
    canvas.freeDrawingBrush.strokeLineCap = 'round';
    canvas.freeDrawingBrush.strokeLineJoin = 'round';

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      try {
        canvas.dispose();
      } catch (e) {}
      fabricCanvasRef.current = null;
    };
  }, []);

  // -------------------------------------------------------------------
  // Update Drawing Mode & Tools
  // -------------------------------------------------------------------
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || canvas.disposed) return;

    canvas.isDrawingMode = activeTool === 'pen';
    canvas.selection = activeTool === 'select';

    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = strokeColor;
      canvas.freeDrawingBrush.width = strokeWidth;
    }

    const cursors = {
      select: 'default',
      pen: 'crosshair',
      eraser: 'cell',
      text: 'text',
      rectangle: 'crosshair',
      circle: 'crosshair',
      triangle: 'crosshair',
      line: 'crosshair',
      arrow: 'crosshair',
      sticky: 'crosshair',
    };
    canvas.defaultCursor = cursors[activeTool] || 'default';
    canvas.requestRenderAll();
  }, [activeTool, strokeColor, strokeWidth]);

  // -------------------------------------------------------------------
  // Helper: Build Fabric object from server data
  // -------------------------------------------------------------------
  const createFabricObjectFromData = useCallback((data) => {
    if (!data || !data.type) return null;
    const { type, id } = data;

    const common = {
      id: id || uuidv4(),
      left: Number(data.left) || 0,
      top: Number(data.top) || 0,
      scaleX: Number(data.scaleX) || 1,
      scaleY: Number(data.scaleY) || 1,
      angle: Number(data.angle) || 0,
      fill: data.fill ?? 'transparent',
      stroke: data.stroke ?? '#1e293b',
      strokeWidth: Number(data.strokeWidth) || 2,
      opacity: Number(data.opacity) ?? 1,
      selectable: true,
      evented: true,
    };

    try {
      if (type === 'rect') {
        return new fabric.Rect({
          ...common,
          width: data.width || 120,
          height: data.height || 80,
          rx: data.rx || 6,
          ry: data.ry || 6,
        });
      }
      if (type === 'circle') {
        return new fabric.Circle({
          ...common,
          radius: data.radius || (data.width ? data.width / 2 : 40),
        });
      }
      if (type === 'triangle') {
        return new fabric.Triangle({
          ...common,
          width: data.width || 100,
          height: data.height || 90,
        });
      }
      if (type === 'line') {
        return new fabric.Line([data.x1 ?? 0, data.y1 ?? 0, data.x2 ?? 100, data.y2 ?? 100], {
          ...common,
        });
      }
      if (type === 'i-text' || type === 'text') {
        return new fabric.IText(data.text || 'Text', {
          ...common,
          fill: data.fill || '#1e293b',
          stroke: null,
          fontSize: Number(data.fontSize) || 20,
          fontFamily: data.fontFamily || 'Inter, sans-serif',
        });
      }
      if (type === 'sticky') {
        const w = data.width || 150;
        const h = data.height || 150;
        const noteRect = new fabric.Rect({
          left: common.left,
          top: common.top,
          width: w,
          height: h,
          fill: data.noteColor || '#fef08a',
          stroke: '#eab308',
          strokeWidth: 1,
          rx: 8,
          ry: 8,
          shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.12)', blur: 10, offsetX: 2, offsetY: 4 }),
        });
        const noteText = new fabric.IText(data.text || 'Sticky note...', {
          left: common.left + 12,
          top: common.top + 12,
          width: w - 24,
          fontSize: 16,
          fontFamily: 'Inter, sans-serif',
          fill: '#713f12',
        });
        return new fabric.Group([noteRect, noteText], {
          ...common,
          type: 'sticky',
          noteColor: data.noteColor || '#fef08a',
        });
      }
      if (type === 'path' && data.path) {
        const pathOptions = {
          ...common,
          fill: data.fill || 'transparent',
          stroke: data.stroke || '#1e293b',
          strokeWidth: Number(data.strokeWidth) || 2,
          strokeLineCap: data.strokeLineCap || 'round',
          strokeLineJoin: data.strokeLineJoin || 'round',
        };
        if (data.pathOffset) {
          pathOptions.pathOffset = data.pathOffset;
        }
        return new fabric.Path(data.path, pathOptions);
      }
      if (type === 'arrow' || type === 'group') {
        const x1 = data.x1 ?? 0, y1 = data.y1 ?? 0, x2 = data.x2 ?? 100, y2 = data.y2 ?? 100;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = 16;
        const line = new fabric.Line([x1, y1, x2, y2], { stroke: common.stroke, strokeWidth: common.strokeWidth });
        const head = new fabric.Triangle({
          left: x2,
          top: y2,
          originX: 'center',
          originY: 'center',
          angle: (angle * 180 / Math.PI) + 90,
          width: headLen,
          height: headLen,
          fill: common.stroke,
        });
        return new fabric.Group([line, head], { ...common, type: 'arrow' });
      }
    } catch (e) {
      console.warn('[useWhiteboard] createFabricObjectFromData error:', e);
    }
    return null;
  }, []);

  // -------------------------------------------------------------------
  // Load entire board state
  // -------------------------------------------------------------------
  const loadBoardState = useCallback((objects) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || canvas.disposed) return;

    isApplyingRemoteRef.current = true;
    canvas.clear();

    if (Array.isArray(objects) && objects.length > 0) {
      objects.forEach((objData) => {
        const obj = createFabricObjectFromData(objData);
        if (obj) canvas.add(obj);
      });
      setHasObjects(true);
    } else {
      setHasObjects(false);
    }

    canvas.requestRenderAll();
    isApplyingRemoteRef.current = false;
  }, [createFabricObjectFromData]);

  // -------------------------------------------------------------------
  // Apply a single remote operation (INSTANT REAL-TIME COLLABORATION)
  // -------------------------------------------------------------------
  const applyRemoteOperation = useCallback((operation) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || canvas.disposed || !operation) return;

    const { type, objectId, payload, userId, transformed, isNoOp } = operation;
    if (isNoOp || type === 'NOOP') return;

    const isMe = userId === user?.userId;
    const findObj = (id) => canvas.getObjects().find((o) => o.id === id || o.objectId === id);

    isApplyingRemoteRef.current = true;
    try {
      switch (type) {
        case 'CLEAR':
          canvas.clear();
          setHasObjects(false);
          break;

        case 'ADD': {
          const existing = findObj(objectId);
          // If the object does NOT exist on this canvas, we MUST add it immediately!
          // (Whether isMe or not, ensuring multi-tab and split-screen tests never drop additions)
          if (!existing || (isMe && transformed)) {
            if (existing) canvas.remove(existing);
            const newObj = createFabricObjectFromData({ ...payload, id: objectId });
            if (newObj) {
              canvas.add(newObj);
              newObj.setCoords();
              setHasObjects(true);
            }
          }
          break;
        }

        case 'DELETE': {
          const obj = findObj(objectId);
          if (obj) {
            canvas.remove(obj);
            if (canvas.getObjects().length === 0) setHasObjects(false);
          }
          break;
        }

        case 'MOVE': {
          const obj = findObj(objectId);
          const isActivelyDragging = canvas.getActiveObject()?.id === objectId;
          // Update position if not currently being dragged by local user
          if (obj && (!isMe || transformed) && !isActivelyDragging) {
            if (typeof payload?.left === 'number' && typeof payload?.top === 'number') {
              obj.set({ left: payload.left, top: payload.top });
            } else {
              obj.set({
                left: (obj.left || 0) + Number(payload?.dx || 0),
                top: (obj.top || 0) + Number(payload?.dy || 0),
              });
            }
            obj.setCoords();
          }
          break;
        }

        case 'UPDATE': {
          const obj = findObj(objectId);
          const isActivelyEditing = canvas.getActiveObject()?.id === objectId;
          if (obj && (!isMe || transformed) && !isActivelyEditing) {
            obj.set(payload || {});
            obj.setCoords();
          }
          break;
        }

        case 'RESIZE': {
          const obj = findObj(objectId);
          const isActivelyInteracting = canvas.getActiveObject()?.id === objectId;
          if (obj && (!isMe || transformed) && !isActivelyInteracting) {
            if (payload?.scaleX != null) obj.set('scaleX', payload.scaleX);
            if (payload?.scaleY != null) obj.set('scaleY', payload.scaleY);
            if (payload?.width != null) obj.set('width', payload.width);
            if (payload?.height != null) obj.set('height', payload.height);
            if (payload?.left != null) obj.set('left', payload.left);
            if (payload?.top != null) obj.set('top', payload.top);
            obj.setCoords();
          }
          break;
        }

        case 'ROTATE': {
          const obj = findObj(objectId);
          const isActivelyInteracting = canvas.getActiveObject()?.id === objectId;
          if (obj && (!isMe || transformed) && !isActivelyInteracting) {
            if (payload?.angle != null) obj.set('angle', payload.angle);
            if (payload?.left != null) obj.set('left', payload.left);
            if (payload?.top != null) obj.set('top', payload.top);
            obj.setCoords();
          }
          break;
        }

        case 'TEXT_UPDATE': {
          const obj = findObj(objectId);
          if (obj && typeof payload?.text === 'string') {
            if (!obj.isEditing) {
              obj.set('text', payload.text);
            }
          }
          break;
        }
        default: break;
      }
      canvas.requestRenderAll();
    } finally {
      isApplyingRemoteRef.current = false;
    }
  }, [user, createFabricObjectFromData]);

  // -------------------------------------------------------------------
  // Setup Canvas Event Listeners
  // -------------------------------------------------------------------
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !boardId || !user?.userId) return;

    const emit = (op) => {
      if (!emitOperation) return;
      emitOperation(op).catch((err) => console.warn('[Canvas] emit op error:', err.message));
    };

    const currentVersion = () => boardVersionRef?.current ?? 0;

    // --- Selection ---
    const onSelectionCreated = (e) => {
      const sel = e.selected?.[0];
      setSelectedObjectId(sel?.id || null);
    };
    const onSelectionCleared = () => setSelectedObjectId(null);

    // --- Freehand path created ---
    const onPathCreated = (e) => {
      if (isApplyingRemoteRef.current) return;
      const pathObj = e.path;
      if (!pathObj) return;
      const id = `path_${uuidv4().slice(0, 8)}`;
      pathObj.id = id;
      setHasObjects(true);
      if (onObjectCreated) onObjectCreated();

      emit(createOperation({
        boardId,
        userId: user.userId,
        type: 'ADD',
        objectId: id,
        payload: serializeFabricObject(pathObj),
        baseVersion: currentVersion(),
      }));
    };

    // --- Capture pre-modification state & live move broadcast ---
    const onObjectMoving = (e) => {
      const obj = e.target;
      if (!obj?.id) return;
      if (!objectPreMoveState.current.has(obj.id)) {
        objectPreMoveState.current.set(obj.id, {
          left: obj.left,
          top: obj.top,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          angle: obj.angle,
          width: obj.width,
          height: obj.height,
        });
      }

      // Throttled live move emit so peers see movement smoothly in real-time
      const now = Date.now();
      if (now - lastMoveEmitRef.current > 40) {
        lastMoveEmitRef.current = now;
        const pre = objectPreMoveState.current.get(obj.id);
        const curL = Math.round(obj.left);
        const curT = Math.round(obj.top);
        const preL = pre ? Math.round(pre.left) : curL;
        const preT = pre ? Math.round(pre.top) : curT;

        emit(createOperation({
          boardId,
          userId: user.userId,
          type: 'MOVE',
          objectId: obj.id,
          payload: {
            dx: curL - preL,
            dy: curT - preT,
            left: curL,
            top: curT,
          },
          baseVersion: currentVersion(),
        }));
      }
    };

    // --- Modified (final position / resize / rotate) ---
    const onObjectModified = (e) => {
      if (isApplyingRemoteRef.current) return;
      const obj = e.target;
      if (!obj?.id) return;

      const pre = objectPreMoveState.current.get(obj.id);
      const currentL = Math.round(obj.left);
      const currentT = Math.round(obj.top);
      const preL = pre ? Math.round(pre.left) : currentL;
      const preT = pre ? Math.round(pre.top) : currentT;

      if (pre && (pre.scaleX !== obj.scaleX || pre.scaleY !== obj.scaleY ||
                  pre.width !== obj.width || pre.height !== obj.height)) {
        emit(createOperation({
          boardId,
          userId: user.userId,
          type: 'RESIZE',
          objectId: obj.id,
          payload: {
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            width: obj.width,
            height: obj.height,
            left: currentL,
            top: currentT,
            previousDimensions: { scaleX: pre.scaleX, scaleY: pre.scaleY, width: pre.width, height: pre.height, left: preL, top: preT },
          },
          baseVersion: currentVersion(),
        }));
      } else if (pre && Math.abs(pre.angle - obj.angle) > 0.01) {
        emit(createOperation({
          boardId,
          userId: user.userId,
          type: 'ROTATE',
          objectId: obj.id,
          payload: { angle: Math.round(obj.angle), left: currentL, top: currentT, previousAngle: pre.angle },
          baseVersion: currentVersion(),
        }));
      } else if (Math.abs(currentL - preL) > 0.5 || Math.abs(currentT - preT) > 0.5) {
        emit(createOperation({
          boardId,
          userId: user.userId,
          type: 'MOVE',
          objectId: obj.id,
          payload: {
            dx: currentL - preL,
            dy: currentT - preT,
            left: currentL,
            top: currentT,
            originalLeft: preL,
            originalTop: preT,
          },
          baseVersion: currentVersion(),
        }));
      }

      objectPreMoveState.current.set(obj.id, {
        left: obj.left,
        top: obj.top,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        angle: obj.angle,
        width: obj.width,
        height: obj.height,
      });
    };

    // --- Text changed ---
    const onTextChanged = (e) => {
      if (isApplyingRemoteRef.current) return;
      const t = e.target;
      if (!t?.id) return;
      emit(createOperation({
        boardId,
        userId: user.userId,
        type: 'TEXT_UPDATE',
        objectId: t.id,
        payload: { text: t.text },
        baseVersion: currentVersion(),
      }));
    };

    // --- Mouse down: Shape creation / eraser / text ---
    const onMouseDown = (opt) => {
      const tool = activeToolRef.current;
      const pointer = canvas.getPointer(opt.e);

      // Throttled cursor emit
      const now = Date.now();
      if (emitCursorMove && now - lastCursorEmitRef.current > 33) {
        lastCursorEmitRef.current = now;
        emitCursorMove(Math.round(pointer.x), Math.round(pointer.y));
      }

      if (tool === 'eraser') {
        const target = opt.target;
        if (target?.id) {
          const serialized = serializeFabricObject(target);
          canvas.remove(target);
          canvas.discardActiveObject();
          canvas.requestRenderAll();
          if (canvas.getObjects().length === 0) setHasObjects(false);
          emit(createOperation({
            boardId,
            userId: user.userId,
            type: 'DELETE',
            objectId: target.id,
            payload: { restorationData: serialized },
            baseVersion: currentVersion(),
          }));
        }
        return;
      }

      if (tool === 'text') {
        const id = `text_${uuidv4().slice(0, 8)}`;
        const textColor = strokeColorRef.current || '#1e293b';
        const text = new fabric.IText('Type here...', {
          id,
          left: pointer.x,
          top: pointer.y,
          fontFamily: 'Inter, sans-serif',
          fontSize: 22,
          fill: textColor,
          selectable: true,
          evented: true,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        canvas.requestRenderAll();
        setHasObjects(true);
        if (onObjectCreated) onObjectCreated();

        emit(createOperation({
          boardId,
          userId: user.userId,
          type: 'ADD',
          objectId: id,
          payload: serializeFabricObject(text),
          baseVersion: currentVersion(),
        }));
        setActiveTool('select');
        return;
      }

      if (!['rectangle', 'circle', 'triangle', 'line', 'arrow', 'sticky'].includes(tool)) return;

      isDrawingShapeRef.current = true;
      shapeStartRef.current = { x: pointer.x, y: pointer.y };

      const id = `shape_${uuidv4().slice(0, 8)}`;
      const effectiveFill = isFilledRef.current ? fillColorRef.current : (tool === 'sticky' ? '#fef08a' : 'transparent');
      const color = strokeColorRef.current;
      const width = strokeWidthRef.current;
      let shape = null;

      if (tool === 'rectangle') {
        shape = new fabric.Rect({
          id,
          left: pointer.x,
          top: pointer.y,
          width: 2,
          height: 2,
          fill: effectiveFill,
          stroke: color,
          strokeWidth: width,
          rx: 6,
          ry: 6,
          selectable: false,
          evented: false,
        });
      } else if (tool === 'circle') {
        shape = new fabric.Circle({
          id,
          left: pointer.x,
          top: pointer.y,
          radius: 2,
          fill: effectiveFill,
          stroke: color,
          strokeWidth: width,
          selectable: false,
          evented: false,
        });
      } else if (tool === 'triangle') {
        shape = new fabric.Triangle({
          id,
          left: pointer.x,
          top: pointer.y,
          width: 2,
          height: 2,
          fill: effectiveFill,
          stroke: color,
          strokeWidth: width,
          selectable: false,
          evented: false,
        });
      } else if (tool === 'line' || tool === 'arrow') {
        shape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          id,
          stroke: color,
          strokeWidth: width,
          selectable: false,
          evented: false,
        });
      } else if (tool === 'sticky') {
        shape = new fabric.Rect({
          id,
          left: pointer.x,
          top: pointer.y,
          width: 140,
          height: 140,
          fill: '#fef08a',
          stroke: '#eab308',
          strokeWidth: 1,
          rx: 8,
          ry: 8,
          selectable: false,
          evented: false,
        });
      }

      if (shape) {
        canvas.add(shape);
        activeShapeRef.current = shape;
        canvas.requestRenderAll();
      }
    };

    // --- Mouse move: stretch shape / emit cursor ---
    const onMouseMove = (opt) => {
      const pointer = canvas.getPointer(opt.e);

      const now = Date.now();
      if (emitCursorMove && now - lastCursorEmitRef.current > 33) {
        lastCursorEmitRef.current = now;
        emitCursorMove(Math.round(pointer.x), Math.round(pointer.y));
      }

      if (!isDrawingShapeRef.current || !activeShapeRef.current) return;
      const shape = activeShapeRef.current;
      const tool = activeToolRef.current;
      const sx = shapeStartRef.current.x;
      const sy = shapeStartRef.current.y;

      if (tool === 'rectangle' || tool === 'triangle') {
        shape.set({
          left: Math.min(sx, pointer.x),
          top: Math.min(sy, pointer.y),
          width: Math.max(2, Math.abs(pointer.x - sx)),
          height: Math.max(2, Math.abs(pointer.y - sy)),
        });
      } else if (tool === 'circle') {
        const r = Math.max(2, Math.hypot(pointer.x - sx, pointer.y - sy) / 2);
        shape.set({
          left: Math.min(sx, pointer.x),
          top: Math.min(sy, pointer.y),
          radius: r,
        });
      } else if (tool === 'line' || tool === 'arrow') {
        shape.set({ x2: pointer.x, y2: pointer.y });
      } else if (tool === 'sticky') {
        shape.set({
          left: Math.min(sx, pointer.x),
          top: Math.min(sy, pointer.y),
          width: Math.max(100, Math.abs(pointer.x - sx)),
          height: Math.max(100, Math.abs(pointer.y - sy)),
        });
      }

      canvas.requestRenderAll();
    };

    // --- Mouse up: finalize shape ---
    const onMouseUp = () => {
      if (!isDrawingShapeRef.current || !activeShapeRef.current) return;
      isDrawingShapeRef.current = false;
      const rawShape = activeShapeRef.current;
      activeShapeRef.current = null;
      const tool = activeToolRef.current;
      const sx = shapeStartRef.current.x;
      const sy = shapeStartRef.current.y;

      if (tool === 'rectangle' && (rawShape.width < 10 || rawShape.height < 10)) {
        rawShape.set({ width: 140, height: 90 });
      } else if (tool === 'circle' && rawShape.radius < 8) {
        rawShape.set({ radius: 45 });
      } else if (tool === 'triangle' && (rawShape.width < 10 || rawShape.height < 10)) {
        rawShape.set({ width: 120, height: 100 });
      } else if ((tool === 'line' || tool === 'arrow') && Math.hypot(rawShape.x2 - rawShape.x1, rawShape.y2 - rawShape.y1) < 10) {
        rawShape.set({ x2: sx + 120, y2: sy });
      } else if (tool === 'sticky' && (rawShape.width < 10 || rawShape.height < 10)) {
        rawShape.set({ width: 150, height: 150 });
      }

      let finalShape = rawShape;

      if (tool === 'arrow') {
        const x1 = rawShape.x1, y1 = rawShape.y1, x2 = rawShape.x2, y2 = rawShape.y2;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = 16;
        const color = strokeColorRef.current;
        const width = strokeWidthRef.current;
        const line = new fabric.Line([x1, y1, x2, y2], { stroke: color, strokeWidth: width });
        const head = new fabric.Triangle({
          left: x2,
          top: y2,
          originX: 'center',
          originY: 'center',
          angle: (angle * 180 / Math.PI) + 90,
          width: headLen,
          height: headLen,
          fill: color,
        });
        canvas.remove(rawShape);
        finalShape = new fabric.Group([line, head], {
          id: rawShape.id,
          type: 'arrow',
          stroke: color,
          strokeWidth: width,
          x1, y1, x2, y2,
        });
        canvas.add(finalShape);
      } else if (tool === 'sticky') {
        const w = rawShape.width || 150;
        const h = rawShape.height || 150;
        const left = rawShape.left;
        const top = rawShape.top;
        canvas.remove(rawShape);

        const noteRect = new fabric.Rect({
          left,
          top,
          width: w,
          height: h,
          fill: '#fef08a',
          stroke: '#eab308',
          strokeWidth: 1,
          rx: 8,
          ry: 8,
          shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.12)', blur: 10, offsetX: 2, offsetY: 4 }),
        });
        const noteText = new fabric.IText('Sticky note...', {
          left: left + 12,
          top: top + 12,
          width: w - 24,
          fontSize: 16,
          fontFamily: 'Inter, sans-serif',
          fill: '#713f12',
        });
        finalShape = new fabric.Group([noteRect, noteText], {
          id: rawShape.id,
          type: 'sticky',
          left,
          top,
          noteColor: '#fef08a',
        });
        canvas.add(finalShape);
      }

      finalShape.set({ selectable: true, evented: true });
      finalShape.setCoords();
      canvas.setActiveObject(finalShape);
      canvas.requestRenderAll();
      setHasObjects(true);
      if (onObjectCreated) onObjectCreated();

      emit(createOperation({
        boardId,
        userId: user.userId,
        type: 'ADD',
        objectId: finalShape.id,
        payload: serializeFabricObject(finalShape),
        baseVersion: currentVersion(),
      }));

      setActiveTool('select');
    };

    canvas.on('selection:created', onSelectionCreated);
    canvas.on('selection:updated', onSelectionCreated);
    canvas.on('selection:cleared', onSelectionCleared);
    canvas.on('path:created', onPathCreated);
    canvas.on('object:moving', onObjectMoving);
    canvas.on('object:modified', onObjectModified);
    canvas.on('text:changed', onTextChanged);
    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);

    return () => {
      canvas.off('selection:created', onSelectionCreated);
      canvas.off('selection:updated', onSelectionCreated);
      canvas.off('selection:cleared', onSelectionCleared);
      canvas.off('path:created', onPathCreated);
      canvas.off('object:moving', onObjectMoving);
      canvas.off('object:modified', onObjectModified);
      canvas.off('text:changed', onTextChanged);
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
    };
  }, [boardId, user?.userId, emitOperation, emitCursorMove, boardVersionRef, onObjectCreated]);

  // -------------------------------------------------------------------
  // Delete Selected
  // -------------------------------------------------------------------
  const deleteSelected = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj?.id) return;
    const serialized = serializeFabricObject(obj);
    canvas.remove(obj);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setSelectedObjectId(null);
    if (canvas.getObjects().length === 0) setHasObjects(false);

    if (emitOperation) {
      emitOperation(createOperation({
        boardId,
        userId: user.userId,
        type: 'DELETE',
        objectId: obj.id,
        payload: { restorationData: serialized },
        baseVersion: boardVersionRef?.current ?? 0,
      })).catch(console.warn);
    }
  }, [boardId, user, emitOperation, boardVersionRef]);

  // -------------------------------------------------------------------
  // Clear Canvas
  // -------------------------------------------------------------------
  const clearCanvas = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.clear();
    canvas.requestRenderAll();
    setSelectedObjectId(null);
    setHasObjects(false);

    if (emitOperation) {
      emitOperation(createOperation({
        boardId,
        userId: user.userId,
        type: 'CLEAR',
        baseVersion: boardVersionRef?.current ?? 0,
      })).catch(console.warn);
    }
  }, [boardId, user, emitOperation, boardVersionRef]);

  // -------------------------------------------------------------------
  // Zoom Controls
  // -------------------------------------------------------------------
  const zoomIn = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    let newZoom = Math.min(canvas.getZoom() * 1.2, 4);
    canvas.setZoom(newZoom);
    setZoomLevel(Math.round(newZoom * 100));
  }, []);

  const zoomOut = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    let newZoom = Math.max(canvas.getZoom() / 1.2, 0.25);
    canvas.setZoom(newZoom);
    setZoomLevel(Math.round(newZoom * 100));
  }, []);

  const resetZoom = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.setZoom(1);
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setZoomLevel(100);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const canvas = fabricCanvasRef.current;
      const active = canvas?.getActiveObject();
      if (active?.isEditing) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectId) {
        e.preventDefault();
        deleteSelected();
      }
      if (e.key === 'v' || e.key === 'V') setActiveTool('select');
      if (e.key === 'p' || e.key === 'P') setActiveTool('pen');
      if (e.key === 'r' || e.key === 'R') setActiveTool('rectangle');
      if (e.key === 'c' || e.key === 'C') setActiveTool('circle');
      if (e.key === 'l' || e.key === 'L') setActiveTool('line');
      if (e.key === 't' || e.key === 'T') setActiveTool('text');
      if (e.key === 's' || e.key === 'S') setActiveTool('sticky');
      if (e.key === 'e' || e.key === 'E') setActiveTool('eraser');
      if (e.key === 'Escape') setActiveTool('select');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedObjectId, deleteSelected]);

  return {
    canvasRef,
    fabricCanvasRef,
    activeTool,
    setActiveTool,
    strokeColor,
    setStrokeColor,
    strokeWidth,
    setStrokeWidth,
    fillColor,
    setFillColor,
    isFilled,
    setIsFilled,
    selectedObjectId,
    deleteSelected,
    clearCanvas,
    loadBoardState,
    applyRemoteOperation,
    zoomLevel,
    zoomIn,
    zoomOut,
    resetZoom,
    hasObjects,
  };
}

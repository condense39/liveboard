import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { useSocket } from '../context/SocketContext'
import { fabric } from 'fabric'
import { jsPDF } from 'jspdf'

// Simple unique ID generator
const generateId = () => `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

const WhiteboardCanvas = forwardRef(({
  roomId,
  permission,
  tool,
  color,
  brushSize,
  fontSize,
  fontFamily,
  onSelectionChange
}, ref) => {
  const canvasContainerRef = useRef(null)
  const fabricCanvasRef = useRef(null)
  const { socket, emit, on } = useSocket()
  
  // Refs for drawing state
  const isDrawing = useRef(false)
  const drawingObject = useRef(null)
  const startPoint = useRef({ x: 0, y: 0 })
  
  // History for undo/redo
  const history = useRef([])
  const historyIndex = useRef(-1)

  // Initialize canvas
  useEffect(() => {
    if (!canvasContainerRef.current) return

    const canvas = new fabric.Canvas(canvasContainerRef.current, {
      width: canvasContainerRef.current.parentElement.clientWidth,
      height: canvasContainerRef.current.parentElement.clientHeight,
      backgroundColor: 'white',
      selection: permission === 'edit'
    })
    fabricCanvasRef.current = canvas

    const handleResize = () => {
      canvas.setDimensions({
        width: canvasContainerRef.current.parentElement.clientWidth,
        height: canvasContainerRef.current.parentElement.clientHeight,
      })
    }
    window.addEventListener('resize', handleResize)

    // Load initial canvas state if available
    emit('get-canvas-state', { roomId })

    return () => {
      window.removeEventListener('resize', handleResize)
      canvas.dispose()
    }
  }, [permission, roomId, emit])
  
  // Tool and drawing settings effect
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    
    canvas.isDrawingMode = tool === 'pen' || tool === 'eraser'
    
    if (tool === 'pen') {
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas)
      canvas.freeDrawingBrush.color = color
      canvas.freeDrawingBrush.width = brushSize
    } else if (tool === 'eraser') {
      // Use the PencilBrush with the background color to simulate erasing
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas)
      canvas.freeDrawingBrush.color = canvas.backgroundColor
      canvas.freeDrawingBrush.width = brushSize
    }

    canvas.selection = permission === 'edit' && tool === 'select'
    canvas.forEachObject(object => {
      object.selectable = tool === 'select'
    })
    canvas.renderAll()

  }, [tool, color, brushSize, permission])

  // Socket event listeners
  useEffect(() => {
    if (!socket) return

    const handleDrawing = (payload) => {
      const data = payload.data || payload;
      
      // Find and remove existing object before adding the new/updated one
      if (data.drawingId) {
        const existingObject = fabricCanvasRef.current.getObjects().find(obj => obj.drawingId === data.drawingId)
        if (existingObject) {
          fabricCanvasRef.current.remove(existingObject)
        }
      }

      fabric.util.enlivenObjects([data], (objects) => {
        const obj = objects[0]
        if (obj) {
          // Flag remote objects to prevent re-emitting
          obj.set('remote', true)
          fabricCanvasRef.current.add(obj)
          fabricCanvasRef.current.renderAll()
        }
      })
    }

    const handleCanvasState = (payload) => {
      const state = payload.state || payload;
      if (state) {
        fabricCanvasRef.current.loadFromJSON(state, fabricCanvasRef.current.renderAll.bind(fabricCanvasRef.current))
      }
    }
    
    const handleClear = () => {
      fabricCanvasRef.current.clear()
      fabricCanvasRef.current.backgroundColor = 'white'
    }

    const unSubDrawing = on('drawing', handleDrawing)
    const unSubCanvasState = on('canvas-state', handleCanvasState)
    const unSubClear = on('clear-canvas', handleClear)
    
    return () => {
      unSubDrawing()
      unSubCanvasState()
      unSubClear()
    }
  }, [socket, on])

  // Canvas event emitters
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas || permission !== 'edit') return

    const saveState = () => {
      const state = canvas.toJSON()
      history.current.splice(historyIndex.current + 1)
      history.current.push(state)
      historyIndex.current = history.current.length - 1
    }

    const handleObjectModified = (e) => {
      if (e.target && !e.target.remote) {
        const data = e.target.toObject(['drawingId'])
        emit('drawing', { roomId, data })
        saveState()
      }
    }
    
    const handlePathCreated = (e) => {
      if (e.path) {
        const data = e.path.toObject(['drawingId'])
        data.drawingId = generateId() // Assign ID to path
        emit('drawing', { roomId, data })
        saveState()
      }
    }

    canvas.on('object:modified', handleObjectModified)
    canvas.on('path:created', handlePathCreated)
    canvas.on('object:removed', saveState)

    // Mouse events for drawing shapes
    canvas.on('mouse:down', handleMouseDown)
    canvas.on('mouse:move', handleMouseMove)
    canvas.on('mouse:up', handleMouseUp)

    return () => {
      canvas.off('object:modified', handleObjectModified)
      canvas.off('path:created', handlePathCreated)
      canvas.off('object:removed', saveState)
      canvas.off('mouse:down', handleMouseDown)
      canvas.off('mouse:move', handleMouseMove)
      canvas.off('mouse:up', handleMouseUp)
    }
  }, [permission, roomId, emit, tool, color, brushSize])

  // Text tool finalization
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    
    const handleTextEditingExited = (e) => {
      const textObject = e.target
      if (textObject.text.trim() === '') {
        canvas.remove(textObject)
      } else {
        const data = textObject.toObject(['drawingId'])
        emit('drawing', { roomId, data })
        saveState()
      }
      onSelectionChange(null)
    }
    
    // Helper function to save state
    const saveState = () => {
      const state = canvas.toJSON()
      history.current.splice(historyIndex.current + 1)
      history.current.push(state)
      historyIndex.current = history.current.length - 1
    }

    const handleSelectionEvents = (e) => {
      onSelectionChange(e.target)
    }
    
    const handleSelectionCleared = () => {
      onSelectionChange(null)
    }

    canvas.on('text:editing:exited', handleTextEditingExited)
    canvas.on('selection:created', handleSelectionEvents)
    canvas.on('selection:updated', handleSelectionEvents)
    canvas.on('selection:cleared', handleSelectionCleared)

    return () => {
      canvas.off('text:editing:exited', handleTextEditingExited)
      canvas.off('selection:created', handleSelectionEvents)
      canvas.off('selection:updated', handleSelectionEvents)
      canvas.off('selection:cleared', handleSelectionCleared)
    }
  }, [emit, roomId, onSelectionChange])

  // Effect to update selected object properties
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    
    const activeObject = canvas.getActiveObject()
    if (activeObject && activeObject.type === 'i-text') {
      activeObject.set({
        fontSize,
        fontFamily
      })
      canvas.renderAll()
    }

  }, [fontSize, fontFamily])

  // Drawing handlers
  const handleMouseDown = (opt) => {
    if (permission !== 'edit' || tool === 'pen' || tool === 'eraser' || tool === 'select') return
    const pointer = fabricCanvasRef.current.getPointer(opt.e)
    startPoint.current = { x: pointer.x, y: pointer.y }
    isDrawing.current = true

    let newObjectData = {
        left: startPoint.current.x,
        top: startPoint.current.y,
        stroke: color,
        strokeWidth: brushSize,
        fill: 'transparent',
        remote: false,
        drawingId: generateId()
    }

    if (tool === 'rectangle') {
      drawingObject.current = new fabric.Rect({
        ...newObjectData,
        width: 0,
        height: 0,
      })
      fabricCanvasRef.current.add(drawingObject.current)
    } else if (tool === 'circle') {
      drawingObject.current = new fabric.Circle({
        ...newObjectData,
        radius: 0,
      })
      fabricCanvasRef.current.add(drawingObject.current)
    } else if (tool === 'text') {
      // For text, we draw a temporary rectangle as a visual guide
      drawingObject.current = new fabric.Rect({
        left: startPoint.current.x,
        top: startPoint.current.y,
        width: 0,
        height: 0,
        stroke: 'rgba(100, 100, 100, 0.5)',
        strokeDashArray: [5, 5],
        strokeWidth: 1,
        fill: 'transparent',
      })
      fabricCanvasRef.current.add(drawingObject.current)
    }
  }

  const handleMouseMove = (opt) => {
    if (!isDrawing.current || !drawingObject.current) return
    const pointer = fabricCanvasRef.current.getPointer(opt.e)

    if (tool === 'rectangle' || tool === 'text') {
      const { x, y } = startPoint.current
      drawingObject.current.set({
        width: Math.abs(pointer.x - x),
        height: Math.abs(pointer.y - y),
        left: pointer.x < x ? pointer.x : x,
        top: pointer.y < y ? pointer.y : y,
      })
    } else if (tool === 'circle') {
       const { x, y } = startPoint.current
       const radius = Math.sqrt(Math.pow(pointer.x - x, 2) + Math.pow(pointer.y - y, 2)) / 2
       drawingObject.current.set({
         radius,
         left: pointer.x < x ? pointer.x : x,
         top: pointer.y < y ? pointer.y : y,
       })
    }
    fabricCanvasRef.current.renderAll()
  }

  const handleMouseUp = (opt) => {
    if (!isDrawing.current) return;
    
    if (tool === 'text') {
      // Create the real IText object on mouse up
      const tempRect = drawingObject.current
      const text = new fabric.IText('', {
        left: tempRect.left,
        top: tempRect.top,
        width: tempRect.width,
        height: tempRect.height,
        fontSize: fontSize,
        fontFamily: fontFamily,
        fill: color,
        drawingId: generateId()
      })
      
      fabricCanvasRef.current.remove(tempRect) // remove the temporary rect
      fabricCanvasRef.current.add(text)
      fabricCanvasRef.current.setActiveObject(text)
      text.enterEditing()
    } else if (drawingObject.current) {
       // Emit the final object for shapes
      const finalObject = drawingObject.current.toObject(['drawingId'])
      emit('drawing', { roomId, data: finalObject })
    }
    
    isDrawing.current = false
    drawingObject.current = null
  }

  // Expose canvas methods to parent component
  useImperativeHandle(ref, () => ({
    addRectangle: () => {
      const rect = new fabric.Rect({
        left: 100, top: 100, width: 100, height: 100,
        fill: 'transparent', stroke: color, strokeWidth: brushSize
      })
      fabricCanvasRef.current.add(rect)
      const data = rect.toObject()
      emit('drawing', { roomId, data })
      // Manually save state after explicit add
      const canvas = fabricCanvasRef.current
      const state = canvas.toJSON()
      history.current.splice(historyIndex.current + 1)
      history.current.push(state)
      historyIndex.current = history.current.length - 1
    },
    addCircle: () => {
      const circle = new fabric.Circle({
        left: 100, top: 100, radius: 50,
        fill: 'transparent', stroke: color, strokeWidth: brushSize
      })
      fabricCanvasRef.current.add(circle)
      const data = circle.toObject()
      emit('drawing', { roomId, data })
      const canvas = fabricCanvasRef.current
      const state = canvas.toJSON()
      history.current.splice(historyIndex.current + 1)
      history.current.push(state)
      historyIndex.current = history.current.length - 1
    },
    addText: () => {
      const text = new fabric.IText('Type here...', {
        left: 100, top: 100, fontFamily: 'Arial', fontSize: 20, fill: color
      })
      fabricCanvasRef.current.add(text)
      const data = text.toObject()
      emit('drawing', { roomId, data })
      const canvas = fabricCanvasRef.current
      const state = canvas.toJSON()
      history.current.splice(historyIndex.current + 1)
      history.current.push(state)
      historyIndex.current = history.current.length - 1
    },
    clearCanvas: () => {
      fabricCanvasRef.current.clear()
      fabricCanvasRef.current.backgroundColor = 'white'
      emit('clear-canvas', { roomId })
    },
    downloadAsPNG: () => {
      const dataURL = fabricCanvasRef.current.toDataURL({ format: 'png', quality: 1 })
      const link = document.createElement('a')
      link.download = `live-board-${roomId}.png`
      link.href = dataURL
      link.click()
    },
    downloadAsPDF: () => {
      const canvas = fabricCanvasRef.current;
      const dataURL = canvas.toDataURL({ format: 'png', quality: 1.0 });

      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(dataURL, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`live-board-${roomId}.pdf`);
    },
    undo: () => {
      if (historyIndex.current > 0) {
        historyIndex.current--
        const canvas = fabricCanvasRef.current
        canvas.loadFromJSON(history.current[historyIndex.current], () => {
          canvas.renderAll()
          emit('canvas-state', { roomId, state: canvas.toJSON() })
        })
      }
    },
    redo: () => {
       if (historyIndex.current < history.current.length - 1) {
        historyIndex.current++
        const canvas = fabricCanvasRef.current
        canvas.loadFromJSON(history.current[historyIndex.current], () => {
          canvas.renderAll()
          emit('canvas-state', { roomId, state: canvas.toJSON() })
        })
      }
    }
  }))

  return (
    <div className="flex-1 relative bg-white">
      <canvas
        ref={canvasContainerRef}
        className={`w-full h-full ${permission === 'view' ? 'cursor-not-allowed' : ''}`}
      />
    </div>
  )
})

WhiteboardCanvas.displayName = 'WhiteboardCanvas'

export default WhiteboardCanvas
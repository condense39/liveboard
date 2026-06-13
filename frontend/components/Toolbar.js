import { useState } from 'react'
import { SketchPicker } from 'react-color'
import {
  Pen,
  Square,
  Circle,
  Type,
  Eraser,
  Palette,
  Undo,
  Redo,
  Trash2,
  Download,
  Minus,
  Plus,
  MousePointer2,
  ChevronDown
} from 'lucide-react'

const ToolbarButton = ({ icon: Icon, label, isActive, children, ...props }) => (
  <button
    className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${
      isActive
        ? 'bg-blue-100 text-blue-600'
        : 'text-gray-600 hover:bg-gray-100'
    }`}
    title={label}
    {...props}
  >
    <Icon className="w-5 h-5" />
    {children}
  </button>
)

const Separator = () => <div className="w-px h-6 bg-gray-200" />

export default function Toolbar({
  permission,
  currentTool,
  onToolChange,
  currentColor,
  onColorChange,
  brushSize,
  onBrushSizeChange,
  onAction,
  fontSize,
  onFontSizeChange,
  fontFamily,
  onFontFamilyChange,
  activeObject,
  showExportMenu
}) {
  const [showColorPicker, setShowColorPicker] = useState(false)

  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500',
    '#800080', '#FFC0CB', '#A52A2A', '#808080'
  ]

  const fonts = ['Arial', 'Verdana', 'Georgia', 'Courier New', 'Comic Sans MS']

  const tools = [
    { id: 'pen', icon: Pen, label: 'Pen' },
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' }
  ]

  const handleToolChange = (toolId) => {
    if (permission !== 'edit') return
    onToolChange(toolId)
  }

  const handleColorChange = (color) => {
    if (permission !== 'edit') return
    onColorChange(color.hex)
  }

  const handleBrushSizeChange = (delta) => {
    if (permission !== 'edit') return
    const newSize = Math.max(1, Math.min(50, brushSize + delta))
    onBrushSizeChange(newSize)
  }

  const handleFontPropertyChange = (property, value) => {
    if (activeObject) {
      // Logic to update object will be in canvas
    }
    if (property === 'fontSize') onFontSizeChange(value)
    if (property === 'fontFamily') onFontFamilyChange(value)
  }

  const isViewOnly = permission === 'view'

  if (permission === 'view') {
    return (
      <div className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4">
        <div className="text-yellow-600 text-xs text-center">
          View Only Mode
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow-md z-10">
      {/* Contextual Toolbar for Text */}
      {activeObject?.type === 'i-text' && !isViewOnly && (
        <div className="p-2 border-b border-gray-200 flex items-center gap-4">
          <select
            className="text-sm border-gray-300 rounded px-2 py-1"
            value={fontFamily}
            onChange={(e) => handleFontPropertyChange('fontFamily', e.target.value)}
          >
            {fonts.map(font => <option key={font} value={font}>{font}</option>)}
          </select>
          <input
            type="number"
            className="text-sm border-gray-300 rounded w-20 px-2 py-1"
            value={fontSize}
            onChange={(e) => handleFontPropertyChange('fontSize', parseInt(e.target.value, 10))}
          />
        </div>
      )}

      {/* Main Toolbar */}
      <div className="p-2 flex items-center gap-2">
        <ToolbarButton label="Select" icon={MousePointer2} isActive={currentTool === 'select'} onClick={() => onToolChange('select')} disabled={isViewOnly} />
        <ToolbarButton label="Pen" icon={Pen} isActive={currentTool === 'pen'} onClick={() => onToolChange('pen')} disabled={isViewOnly} />
        <ToolbarButton label="Eraser" icon={Eraser} isActive={currentTool === 'eraser'} onClick={() => onToolChange('eraser')} disabled={isViewOnly} />
        <Separator />
        <ToolbarButton label="Rectangle" icon={Square} isActive={currentTool === 'rectangle'} onClick={() => onToolChange('rectangle')} disabled={isViewOnly} />
        <ToolbarButton label="Circle" icon={Circle} isActive={currentTool === 'circle'} onClick={() => onToolChange('circle')} disabled={isViewOnly} />
        <ToolbarButton label="Text" icon={Type} isActive={currentTool === 'text'} onClick={() => onToolChange('text')} disabled={isViewOnly} />
        <Separator />

        {/* Color Picker */}
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-100"
            disabled={isViewOnly}
          >
            <div className="w-5 h-5 rounded-full border-2 border-gray-300" style={{ backgroundColor: currentColor }} />
          </button>
          {showColorPicker && (
            <div className="absolute top-full mt-2 z-10">
              <div className="fixed inset-0" onClick={() => setShowColorPicker(false)} />
              <SketchPicker color={currentColor} onChange={(color) => onColorChange(color.hex)} />
            </div>
          )}
        </div>

        {/* Brush Size */}
        <div className="flex items-center gap-2">
          <button onClick={() => onBrushSizeChange(Math.max(1, brushSize - 1))} disabled={isViewOnly} className="p-1 rounded text-gray-600 hover:bg-gray-100"><Minus className="w-4 h-4" /></button>
          <span className="text-xs text-gray-600 w-4 text-center">{brushSize}</span>
          <button onClick={() => onBrushSizeChange(Math.min(50, brushSize + 1))} disabled={isViewOnly} className="p-1 rounded text-gray-600 hover:bg-gray-100"><Plus className="w-4 h-4" /></button>
        </div>
        <Separator />

        {/* Actions */}
        <div className="flex-grow" />
        <ToolbarButton label="Undo" icon={Undo} onClick={() => onAction('undo')} disabled={isViewOnly} />
        <ToolbarButton label="Redo" icon={Redo} onClick={() => onAction('redo')} disabled={isViewOnly} />
        <ToolbarButton label="Clear" icon={Trash2} onClick={() => onAction('clearCanvas')} disabled={isViewOnly} />
        
        {/* Export Dropdown */}
        <div className="relative">
          <ToolbarButton label="Export" icon={Download} onClick={() => onAction('toggleExportMenu')}>
            <ChevronDown className="w-4 h-4" />
          </ToolbarButton>
          {showExportMenu && (
            <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
              <button onClick={() => onAction('downloadAsPNG')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Export as PNG</button>
              <button onClick={() => onAction('downloadAsPDF')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Export as PDF</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
import { useState, useEffect, useRef } from "react";
import { 
  CopyIcon, 
  DownloadIcon, 
  PinIcon, 
  StarIcon, 
  ListIcon, 
  InfoIcon, 
  ChevronRightIcon,
  Trash2Icon,
  MoreVerticalIcon,
  GripVerticalIcon,
  Undo2Icon
} from "lucide-react";

function MessageContextMenu({ message, isMyMessage, onClose, onDelete, onRecall, onReply, onForward, onPin, onStar, onCopyImage, onDownload, position, isOverlay = false, onPositionChange }) {
  const menuRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [menuPosition, setMenuPosition] = useState(position);

  useEffect(() => {
    setMenuPosition(position);
  }, [position]);

  useEffect(() => {
    if (!isOverlay) {
      const handleClickOutside = (e) => {
        if (menuRef.current && !menuRef.current.contains(e.target)) {
          onClose();
        }
      };

      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [onClose, isOverlay]);

  // Drag functionality
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      e.preventDefault();
      // Only move vertically (Y axis), keep X position
      const newY = e.clientY - dragOffset.y;
      const newX = position.x; // Keep original X position
      const updatedPos = { x: newX, y: newY };
      setMenuPosition(updatedPos);
      if (onPositionChange) {
        onPositionChange(updatedPos);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, onPositionChange, position.x]);

  const handleDragStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    setIsDragging(true);
    // Calculate offset from center of menu
    setDragOffset({
      x: 0, // Don't need X offset since we only move vertically
      y: e.clientY - (rect.top + rect.height / 2),
    });
  };

  const handleCopyImage = () => {
    if (message.image) {
      onCopyImage(message.image);
      onClose();
    }
  };

  const handleDownload = () => {
    if (message.image || (message.file && message.file.fileUrl)) {
      onDownload(message.image || message.file.fileUrl, message.file?.fileName || 'image.jpg');
      onClose();
    }
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  const handleCopyText = () => {
    if (message.text) {
      navigator.clipboard.writeText(message.text);
      onClose();
    }
  };

  // If overlay, use relative positioning (parent handles centering)
  // Otherwise use fixed positioning with provided coordinates
  const style = isOverlay ? {
    position: 'relative',
    zIndex: 99999,
  } : {
    position: 'fixed',
    top: `${menuPosition.y}px`,
    left: `${menuPosition.x}px`,
    zIndex: 99999,
  };

  return (
    <div
      ref={menuRef}
      data-context-menu="true"
      className="bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[200px] relative"
      style={style}
      onMouseEnter={() => {
        // Keep menu open when hovering
      }}
      onMouseLeave={() => {
        // Close menu when mouse leaves (with delay for overlay mode)
        if (isOverlay) {
          setTimeout(() => {
            if (menuRef.current && !menuRef.current.matches(':hover')) {
              onClose();
            }
          }, 200);
        }
      }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={handleDragStart}
        className="absolute top-0 left-0 right-0 h-6 cursor-move flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-gray-50 rounded-t-lg border-b border-gray-200 z-10"
        title="Kéo để di chuyển"
        style={{ marginTop: '-1px' }}
      >
        <GripVerticalIcon className="w-4 h-4 text-gray-400" />
      </div>
      <div className="pt-6"></div>
      {message.image && (
        <>
          <button
            onClick={handleCopyImage}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
          >
            <CopyIcon className="w-4 h-4" />
            <span>Copy hình ảnh</span>
          </button>
          <button
            onClick={handleDownload}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
          >
            <DownloadIcon className="w-4 h-4" />
            <span>Lưu về máy</span>
          </button>
        </>
      )}
      
      {message.file && !message.image && (
        <button
          onClick={handleDownload}
          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
        >
          <DownloadIcon className="w-4 h-4" />
          <span>Lưu về máy</span>
        </button>
      )}

      {message.text && (
        <button
          onClick={handleCopyText}
          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
        >
          <CopyIcon className="w-4 h-4" />
          <span>Sao chép</span>
        </button>
      )}

      <div className="border-t border-gray-200 my-1"></div>

      <button 
        onClick={() => {
          if (onPin) onPin();
        }}
        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
      >
        <PinIcon className="w-4 h-4" />
        <span>Ghim tin nhắn</span>
      </button>

      <button 
        onClick={() => {
          if (onStar) onStar();
        }}
        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
      >
        <StarIcon className={`w-4 h-4 ${message.isStarred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
        <span>Đánh dấu tin nhắn</span>
      </button>

      <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3">
        <ListIcon className="w-4 h-4" />
        <span>Chọn nhiều tin nhắn</span>
      </button>

      <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3">
        <InfoIcon className="w-4 h-4" />
        <span>Xem chi tiết</span>
      </button>

      <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3">
        <ChevronRightIcon className="w-4 h-4" />
        <span>Tuỳ chọn khác</span>
      </button>

      {isMyMessage && (
        <>
          <div className="border-t border-gray-200 my-1"></div>
          {onRecall && (
            <button
              onClick={() => {
                if (onRecall) onRecall();
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
            >
              <Undo2Icon className="w-4 h-4" />
              <span>Thu hồi</span>
            </button>
          )}
          <button
            onClick={handleDelete}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
          >
            <Trash2Icon className="w-4 h-4" />
            <span>Xóa chỉ ở phía tôi</span>
          </button>
        </>
      )}
    </div>
  );
}

export default MessageContextMenu;


import { useState, useEffect, useRef } from "react";

const REACTIONS = [
  { emoji: '👍', name: 'like' },
  { emoji: '❤️', name: 'love' },
  { emoji: '😂', name: 'laugh' },
  { emoji: '😮', name: 'wow' },
  { emoji: '😢', name: 'sad' },
  { emoji: '😠', name: 'angry' },
];

function ReactionPicker({ messageId, onReactionSelect, onClose, position, isOverlay = false }) {
  const pickerRef = useRef(null);

  useEffect(() => {
    // For overlay mode, close on mouse leave
    if (isOverlay) {
      const handleMouseLeave = (e) => {
        if (pickerRef.current && !pickerRef.current.contains(e.relatedTarget)) {
          // Check if mouse is leaving to go to another element
          const relatedTarget = e.relatedTarget;
          if (!relatedTarget || !pickerRef.current.contains(relatedTarget)) {
            onClose();
          }
        }
      };

      const pickerElement = pickerRef.current;
      if (pickerElement) {
        pickerElement.addEventListener('mouseleave', handleMouseLeave);
        return () => {
          pickerElement.removeEventListener('mouseleave', handleMouseLeave);
        };
      }
    } else {
      // For fixed mode, close on click outside
      const handleClickOutside = (e) => {
        if (pickerRef.current && !pickerRef.current.contains(e.target)) {
          onClose();
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [onClose, isOverlay]);

  const handleReactionClick = (emoji) => {
    onReactionSelect(emoji);
    onClose();
  };

  // If overlay, use relative positioning (parent handles centering)
  // Otherwise use fixed positioning with provided coordinates
  const style = isOverlay ? {
    position: 'relative',
    zIndex: 9999,
    pointerEvents: 'auto', // Ensure it can be clicked even if parent has pointer-events: none
  } : {
    position: 'fixed',
    top: `${position.y}px`,
    left: `${position.x}px`,
    transform: 'translateX(-50%)', // Center horizontally on the message bubble
    zIndex: 9999,
    pointerEvents: 'auto',
  };

  return (
    <div
      ref={pickerRef}
      className="bg-white rounded-full shadow-lg border border-gray-200 px-2 py-1 flex items-center gap-1"
      style={style}
    >
      {REACTIONS.map((reaction) => (
        <button
          key={reaction.name}
          onClick={() => handleReactionClick(reaction.emoji)}
          className="text-2xl hover:scale-125 transition-transform p-1"
          title={reaction.name}
        >
          {reaction.emoji}
        </button>
      ))}
    </div>
  );
}

export default ReactionPicker;


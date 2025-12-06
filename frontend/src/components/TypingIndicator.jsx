function TypingIndicator({ userName }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1 px-3 py-2">
        <div 
          className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" 
          style={{ animationDelay: "0ms", animationDuration: "1.4s" }}
        ></div>
        <div 
          className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" 
          style={{ animationDelay: "200ms", animationDuration: "1.4s" }}
        ></div>
        <div 
          className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" 
          style={{ animationDelay: "400ms", animationDuration: "1.4s" }}
        ></div>
      </div>
      <span className="text-sm text-gray-500 italic"></span>
    </div>
  );
}

export default TypingIndicator;


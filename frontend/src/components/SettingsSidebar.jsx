import { useState, useRef } from "react";
import { XIcon, LogOutIcon, UserIcon, ImageIcon } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import toast from "react-hot-toast";

function SettingsSidebar({ onClose }) {
  const { authUser, logout, updateProfile } = useAuthStore();
  const [selectedImg, setSelectedImg] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn file hình ảnh");
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("Kích thước hình ảnh phải nhỏ hơn 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Image = reader.result;
        setSelectedImg(base64Image);
        await updateProfile({ profilePic: base64Image });
        setIsUploading(false);
      };
      reader.onerror = () => {
        toast.error("Không thể đọc file hình ảnh");
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error("Không thể tải lên hình ảnh. Vui lòng thử lại.");
      setIsUploading(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
      await logout();
    }
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Cài đặt</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <XIcon className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Profile Section */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Hồ sơ</h3>
          
          {/* Avatar */}
          <div className="flex flex-col items-center mb-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200">
                <img
                  src={selectedImg || authUser?.profilePic || "/avatar.png"}
                  alt={authUser?.fullName || "Avatar"}
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 bg-cyan-600 text-white rounded-full p-2 hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Đổi avatar"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
                disabled={isUploading}
              />
            </div>
            {isUploading && (
              <p className="text-xs text-gray-500 mt-2">Đang tải lên...</p>
            )}
          </div>

          {/* User Info */}
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-600">Họ và tên</label>
              <p className="text-sm font-medium text-gray-900">{authUser?.fullName || "N/A"}</p>
            </div>
            {authUser?.email && (
              <div>
                <label className="text-xs text-gray-600">Email</label>
                <p className="text-sm text-gray-900">{authUser.email}</p>
              </div>
            )}
          </div>
        </div>

        {/* Account Actions */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Tài khoản</h3>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
          >
            <LogOutIcon className="w-5 h-5" />
            <span className="font-medium">Đăng xuất</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsSidebar;


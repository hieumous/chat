import { Navigate, Route, Routes } from "react-router";
import ChatPage from "./pages/ChatPage";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import { useAuthStore } from "./store/useAuthStore";
import { useChatStore } from "./store/useChatStore";
import { useEffect, useRef } from "react";
import PageLoader from "./components/PageLoader";
import CallModal from "./components/CallModal";

import { Toaster, toast } from "react-hot-toast";
import UploadProgress from "./components/UploadProgress";

function App() {
  const { checkAuth, isCheckingAuth, authUser } = useAuthStore();
  const { pendingUpload, retryUpload } = useChatStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Tự động retry khi mạng trở lại
  const isRetryingRef = useRef(false);
  const retryTimeoutRef = useRef(null);
  const retriedTempIdRef = useRef(null); // Track tempId đã retry

  useEffect(() => {
    const handleOnline = async () => {
      // Tránh retry nhiều lần đồng thời
      if (isRetryingRef.current) {
        console.log("⏸️ Đang retry, bỏ qua...");
        return;
      }

      // Kiểm tra nếu có pending upload và mạng đã online
      const currentPendingUpload = useChatStore.getState().pendingUpload;
      if (!currentPendingUpload || !navigator.onLine) {
        return;
      }

      // Kiểm tra xem đã retry tempId này chưa
      const currentTempId = currentPendingUpload?.tempId;
      if (!currentTempId) {
        console.log("⚠️ Không có tempId trong pendingUpload");
        return;
      }
      if (retriedTempIdRef.current === currentTempId) {
        console.log("⏸️ Đã retry tempId này rồi, bỏ qua...", currentTempId);
        return;
      }

      // Clear timeout cũ nếu có
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      // Debounce: đợi 1 giây để đảm bảo mạng ổn định và tránh trigger nhiều lần
      retryTimeoutRef.current = setTimeout(async () => {
        // Kiểm tra lại sau khi debounce - quan trọng: check lại pendingUpload
        const pending = useChatStore.getState().pendingUpload;
        if (!pending || isRetryingRef.current || !navigator.onLine) {
          return;
        }

        // Kiểm tra lại tempId sau debounce
        const pendingTempId = pending?.tempId;
        if (!pendingTempId || retriedTempIdRef.current === pendingTempId) {
          return;
        }

        isRetryingRef.current = true;
        retriedTempIdRef.current = pendingTempId; // Đánh dấu đã retry tempId này
        
        try {
          console.log("🔄 Mạng đã trở lại, tự động gửi lại...", pending.tempId);
          toast.loading("Mạng đã trở lại, đang gửi lại...", { id: 'auto-retry' });
          
          // Lấy retryUpload từ store để đảm bảo dùng function mới nhất
          const { retryUpload: retryFn } = useChatStore.getState();
          await retryFn();
          
          // Kiểm tra lại xem pendingUpload đã được clear chưa (thành công)
          const checkPending = useChatStore.getState().pendingUpload;
          if (!checkPending || checkPending.tempId !== pendingTempId) {
            // Đã thành công, clear pendingUpload
            toast.success("Đã gửi lại thành công!", { id: 'auto-retry' });
          }
        } catch (error) {
          console.error("Lỗi khi tự động gửi lại:", error);
          toast.error("Không thể gửi lại tự động. Vui lòng thử lại thủ công.", { id: 'auto-retry' });
          // Nếu retry thất bại, cho phép retry lại bằng cách reset tempId
          retriedTempIdRef.current = null;
        } finally {
          // Reset flag sau 2 giây để cho phép retry lại nếu cần
          setTimeout(() => {
            isRetryingRef.current = false;
          }, 2000);
        }
      }, 1000); // Tăng debounce lên 1 giây để tránh trigger nhiều lần
    };

    // Listen cho sự kiện online
    window.addEventListener('online', handleOnline);

    // Reset retriedTempId khi pendingUpload thay đổi (message mới)
    // CHỈ reset khi pendingUpload thay đổi sang tempId mới, KHÔNG reset khi pendingUpload bị clear
    if (pendingUpload) {
      const currentTempId = pendingUpload?.tempId;
      // Nếu là pendingUpload mới (tempId khác), reset retriedTempId để cho phép retry message mới
      if (currentTempId && retriedTempIdRef.current !== currentTempId) {
        retriedTempIdRef.current = null;
      }
    }
    // KHÔNG reset retriedTempId khi pendingUpload = null (đã thành công)
    // Điều này tránh retry lại khi event 'online' được trigger sau khi đã thành công

    // KHÔNG tự động retry khi mount - chỉ retry khi có event 'online'
    // Điều này tránh retry không mong muốn khi component re-render

    return () => {
      window.removeEventListener('online', handleOnline);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [pendingUpload]); // Chỉ depend vào pendingUpload, không depend vào retryUpload

  if (isCheckingAuth) return <PageLoader />;

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">

      <Routes>
        <Route path="/" element={authUser ? <ChatPage /> : <Navigate to={"/login"} />} />
        <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to={"/"} />} />
        <Route path="/signup" element={!authUser ? <SignUpPage /> : <Navigate to={"/"} />} />
      </Routes>

      {/* Call Modal - shows when there's an active call */}
      {authUser && <CallModal />}

      {/* Upload Progress - shows when uploading files */}
      {authUser && <UploadProgress />}

      <Toaster />
    </div>
  );
}
export default App;

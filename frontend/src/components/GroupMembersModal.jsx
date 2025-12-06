import { useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { XIcon, PlusIcon, CrownIcon, TrashIcon, LockIcon, UnlockIcon } from "lucide-react";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

function GroupMembersModal({ isOpen, onClose, group }) {
  const { 
    allContacts, 
    getAllContacts, 
    addMembersToGroup, 
    removeMemberFromGroup,
    toggleGroupPrivacy 
  } = useChatStore();
  const { authUser } = useAuthStore();
  const [members, setMembers] = useState([]);
  const [admin, setAdmin] = useState(null);
  const [isPublic, setIsPublic] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isRemoving, setIsRemoving] = useState({});
  const [isToggling, setIsToggling] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);

  useEffect(() => {
    if (isOpen && group) {
      fetchGroupMembers();
      getAllContacts();
    }
  }, [isOpen, group, getAllContacts]);

  const fetchGroupMembers = async () => {
    if (!group?._id) return;
    
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(`/groups/${group._id}/members`);
      setMembers(res.data.members || []);
      setAdmin(res.data.admin);
      setIsPublic(res.data.isPublic || false);
      setIsAdmin(res.data.isAdmin || false);
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể tải danh sách thành viên");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMembers = async () => {
    if (selectedMembers.length === 0) {
      toast.error("Vui lòng chọn ít nhất một thành viên để thêm");
      return;
    }

    setIsAdding(true);
    try {
      await addMembersToGroup(group._id, selectedMembers);
      
      toast.success("Đã thêm thành viên thành công!");
      setSelectedMembers([]);
      setShowAddMembers(false);
      fetchGroupMembers(); // Refresh members list
    } catch (error) {
      // Error is already handled in addMembersToGroup
    } finally {
      setIsAdding(false);
    }
  };

  const toggleMember = (memberId) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  // Filter out current members and current user from available contacts
  const memberIds = members.map((m) => m._id || m);
  const availableContacts = allContacts.filter(
    (contact) => 
      contact._id !== authUser._id && 
      !memberIds.includes(contact._id)
  );

  const canAddMembers = isPublic || isAdmin;

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa thành viên này khỏi nhóm?")) {
      return;
    }

    setIsRemoving(prev => ({ ...prev, [memberId]: true }));
    try {
      await removeMemberFromGroup(group._id, memberId);
      fetchGroupMembers(); // Refresh members list
    } catch (error) {
      // Error is already handled in removeMemberFromGroup
    } finally {
      setIsRemoving(prev => ({ ...prev, [memberId]: false }));
    }
  };

  const handleTogglePrivacy = async () => {
    setIsToggling(true);
    try {
      const updatedGroup = await toggleGroupPrivacy(group._id);
      setIsPublic(updatedGroup.isPublic);
      fetchGroupMembers(); // Refresh to get updated data
    } catch (error) {
      // Error is already handled in toggleGroupPrivacy
    } finally {
      setIsToggling(false);
    }
  };

  if (!isOpen || !group) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Thành viên nhóm</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Group Info */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-900">{group.name}</h3>
            {isAdmin && (
              <button
                onClick={handleTogglePrivacy}
                disabled={isToggling}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  isPublic
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isPublic ? "Chuyển sang riêng tư" : "Chuyển sang công khai"}
              >
                {isPublic ? (
                  <>
                    <UnlockIcon className="w-4 h-4" />
                    Công khai
                  </>
                ) : (
                  <>
                    <LockIcon className="w-4 h-4" />
                    Riêng tư
                  </>
                )}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-600">
            {isPublic ? (
              <span className="text-green-600">Công khai - Tất cả thành viên có thể thêm người</span>
            ) : (
              <span className="text-orange-600">Riêng tư - Chỉ quản trị viên có thể thêm người</span>
            )}
          </p>
        </div>

        {/* Add Members Button */}
        {canAddMembers && (
          <div className="mb-4">
            {!showAddMembers ? (
              <button
                onClick={() => setShowAddMembers(true)}
                className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg px-4 py-2 font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all flex items-center justify-center gap-2"
              >
                <PlusIcon className="w-5 h-5" />
                Thêm thành viên
              </button>
            ) : (
              <div className="space-y-3">
                <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {availableContacts.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      Không có liên hệ nào để thêm
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {availableContacts.map((contact) => (
                        <label
                          key={contact._id}
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(contact._id)}
                            onChange={() => toggleMember(contact._id)}
                            className="w-4 h-4 text-cyan-600"
                          />
                          <img
                            src={contact.profilePic || "/avatar.png"}
                            alt={contact.fullName}
                            className="w-8 h-8 rounded-full"
                          />
                          <span className="text-sm text-gray-900">{contact.fullName}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowAddMembers(false);
                      setSelectedMembers([]);
                    }}
                    className="flex-1 border border-gray-300 text-gray-700 rounded-lg px-4 py-2 hover:bg-gray-50"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleAddMembers}
                    disabled={isAdding || selectedMembers.length === 0}
                    className="flex-1 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg px-4 py-2 font-medium hover:from-cyan-600 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAdding ? "Đang thêm..." : "Thêm đã chọn"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Members List */}
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Đang tải thành viên...</div>
        ) : (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Thành viên ({members.length + 1})
            </h3>
            
            {/* Admin */}
            {admin && (
              <div className="flex items-center gap-3 p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                <div className="relative">
                  <img
                    src={admin.profilePic || "/avatar.png"}
                    alt={admin.fullName}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-1">
                    <CrownIcon className="w-3 h-3 text-yellow-900" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{admin.fullName}</span>
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                      Quản trị viên
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{admin.email}</p>
                </div>
              </div>
            )}

            {/* Members */}
            {members
              .filter((m) => m._id?.toString() !== admin?._id?.toString())
              .map((member) => {
                const memberId = member._id || member;
                const isRemovingMember = isRemoving[memberId];
                
                return (
                  <div
                    key={memberId}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <img
                      src={member.profilePic || "/avatar.png"}
                      alt={member.fullName}
                      className="w-10 h-10 rounded-full"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{member.fullName}</p>
                      <p className="text-xs text-gray-600">{member.email}</p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleRemoveMember(memberId)}
                        disabled={isRemovingMember}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Xóa thành viên"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* Close Button */}
        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full border border-gray-300 text-gray-700 rounded-lg px-4 py-2 hover:bg-gray-50"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export default GroupMembersModal;


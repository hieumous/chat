import { useState, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { XIcon, ImageIcon, UsersIcon } from "lucide-react";
import toast from "react-hot-toast";

function CreateGroupModal({ isOpen, onClose }) {
  const { createGroup, allContacts } = useChatStore();
  const { authUser } = useAuthStore();
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupPic, setGroupPic] = useState(null);
  const [groupPicPreview, setGroupPicPreview] = useState(null);
  const [isPublic, setIsPublic] = useState(false);
  const fileInputRef = useRef(null);
  const [isCreating, setIsCreating] = useState(false);

  // Filter out current user from contacts
  const availableContacts = allContacts.filter(
    (contact) => contact._id !== authUser._id
  );

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      toast.error("Failed to read image file");
    };
    reader.onloadend = () => {
      if (reader.result) {
        setGroupPic(reader.result);
        setGroupPicPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleMember = (memberId) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      toast.error("Group name is required");
      return;
    }

    setIsCreating(true);
    try {
      const groupData = {
        name: groupName.trim(),
        description: description.trim(),
        memberIds: selectedMembers,
        groupPic: groupPic || "",
        isPublic: isPublic,
      };

      const newGroup = await createGroup(groupData);
      onClose();
      // Reset form
      setGroupName("");
      setDescription("");
      setSelectedMembers([]);
      setGroupPic(null);
      setGroupPicPreview(null);
      setIsPublic(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      // Error is already handled in createGroup
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Create New Group</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            disabled={isCreating}
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Group Picture */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 flex items-center justify-center overflow-hidden">
                {groupPicPreview ? (
                  <img
                    src={groupPicPreview}
                    alt="Group"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UsersIcon className="w-12 h-12 text-white" />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-cyan-600 text-white rounded-full p-2 hover:bg-cyan-700"
                disabled={isCreating}
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Group Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Group Name *
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
              placeholder="Enter group name"
              required
              disabled={isCreating}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
              placeholder="Enter group description"
              rows="3"
              disabled={isCreating}
            />
          </div>

          {/* Public/Private Toggle */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-4 h-4 text-cyan-600"
                disabled={isCreating}
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Public Group</span>
                <p className="text-xs text-gray-500">
                  {isPublic 
                    ? "All members can add new people" 
                    : "Only admin can add new people"}
                </p>
              </div>
            </label>
          </div>

          {/* Select Members */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Members ({selectedMembers.length} selected)
            </label>
            <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
              {availableContacts.length === 0 ? (
                <p className="text-gray-500 text-sm">No contacts available</p>
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
                        disabled={isCreating}
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
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg px-4 py-2 hover:bg-gray-50"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg px-4 py-2 font-medium hover:from-cyan-600 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isCreating || !groupName.trim()}
            >
              {isCreating ? "Creating..." : "Create Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateGroupModal;


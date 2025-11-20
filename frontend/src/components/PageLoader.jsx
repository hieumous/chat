import { LoaderIcon } from "lucide-react";
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <LoaderIcon className="size-10 animate-spin text-cyan-600" />
    </div>
  );
}
export default PageLoader;

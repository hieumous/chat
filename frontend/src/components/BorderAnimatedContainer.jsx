// How to make animated gradient border 👇
// https://cruip-tutorials.vercel.app/animated-gradient-border/
function BorderAnimatedContainer({ children }) {
  return (
    <div className="w-full h-full [background:linear-gradient(45deg,#ffffff,theme(colors.gray.50)_50%,#ffffff)_padding-box,conic-gradient(from_var(--border-angle),theme(colors.gray.300/.48)_80%,_theme(colors.cyan.500)_86%,_theme(colors.cyan.300)_90%,_theme(colors.cyan.500)_94%,_theme(colors.gray.300/.48))_border-box] rounded-2xl border border-transparent animate-border  flex overflow-hidden bg-white">
      {children}
    </div>
  );
}
export default BorderAnimatedContainer;

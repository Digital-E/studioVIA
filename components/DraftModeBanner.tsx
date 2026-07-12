export default function DraftModeBanner() {
  return (
    <a
      href="/api/draft-mode/disable"
      className="fixed bottom-4 right-4 z-[999] font-build text-sm leading-none bg-via-black text-white px-4 py-2 rounded-full shadow-lg hover:opacity-80 transition-opacity"
    >
      Preview mode — Exit
    </a>
  )
}

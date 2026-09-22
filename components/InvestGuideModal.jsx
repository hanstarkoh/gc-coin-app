'use client';

export default function InvestGuideModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-navy-deep/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl p-3 max-w-sm w-full max-h-[90vh] overflow-y-auto animate-popIn"
        onClick={(e) => e.stopPropagation()}
      >
        <img src="/invest-guide.svg" alt="모의투자 성공 가이드" className="w-full rounded-2xl" />
        <button
          onClick={onClose}
          className="btn-3d btn-3d-navy mt-3 bg-navy text-white rounded-full px-6 py-2.5 text-sm font-display w-full"
        >
          확인했어요
        </button>
      </div>
    </div>
  );
}

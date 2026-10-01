'use client';

export default function PolicyNoticeModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-navy-deep/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl p-5 max-w-sm w-full max-h-[90vh] overflow-y-auto animate-popIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-3">
          <div className="text-3xl mb-1">📜</div>
          <div className="font-display text-lg text-navy">금정코인 정책 공지</div>
          <div className="text-[11px] text-gray-400">금정청소년수련관 모의투자법 개정</div>
        </div>

        <div className="space-y-3">
          <div className="bg-paper rounded-xl p-3">
            <div className="text-sm font-bold text-navy mb-1">① 매매 수수료 2% 고정</div>
            <p className="text-[12px] text-gray-600 leading-relaxed">
              모의투자 매수·매도 수수료가 <b>2%로 고정</b>돼요. 그동안 적은 금액을 거래할 때 더 많이
              걷혔던 수수료는 전부 다시 계산해서 <b>잔액으로 환급</b>했어요(실현손익 기록도 같이
              고쳤어요). 확인하고 싶으면 거래내역에서 "모의투자법 개정" 환급 내역을 찾아보세요.
            </p>
          </div>

          <div className="bg-paper rounded-xl p-3">
            <div className="text-sm font-bold text-navy mb-1">② 코인 단위 10배 개편(화폐개혁)</div>
            <p className="text-[12px] text-gray-600 leading-relaxed">
              오늘부터 모든 코인 숫자가 <b>10배</b>로 보여요. 어제 10GC였던 게 오늘은 100GC로 보이는
              식이에요 — <b>가진 돈의 실제 가치는 똑같아요</b>, 숫자만 더 자세해진 거예요(가격이
              싼 종목일수록 시세가 들쭉날쭉 튀던 문제를 고치기 위한 개편이에요).
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="btn-3d btn-3d-navy mt-4 bg-navy text-white rounded-full px-6 py-2.5 text-sm font-display w-full"
        >
          확인했어요
        </button>
      </div>
    </div>
  );
}

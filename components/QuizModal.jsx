'use client';
import { useState, useEffect, useRef } from 'react';
import { useToast } from './Toast';
import { MIN_SECONDS_PER_QUESTION } from '@/lib/quiz';

export default function QuizModal({ quiz, onClose, onSubmitted }) {
  const showToast = useToast();
  const [answers, setAnswers] = useState(() => quiz.questions.map(() => null));
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef(Date.now());
  const requiredMs = quiz.questions.length * MIN_SECONDS_PER_QUESTION * 1000;
  const [remainingSec, setRemainingSec] = useState(Math.ceil(requiredMs / 1000));

  useEffect(() => {
    const tick = () => {
      const left = Math.ceil((requiredMs - (Date.now() - startedAt.current)) / 1000);
      setRemainingSec(Math.max(0, left));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allAnswered = answers.every((a) => a != null);
  const canSubmit = allAnswered && remainingSec <= 0;

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const res = await fetch(`/api/kid/quiz/${quiz.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!data.ok) {
      showToast(data.error || '제출에 실패했어요.');
      return;
    }
    showToast(data.reward > 0 ? `참여 완료! +${data.reward} GC 받았어요.` : '참여 완료!');
    onSubmitted(data);
  };

  return (
    <div className="fixed inset-0 z-50 bg-navy-deep/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-4 max-w-sm w-full max-h-[90vh] overflow-y-auto animate-popIn">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="icon-badge icon-badge-gold w-8 h-8 rounded-lg text-base shrink-0">📝</div>
            <div className="min-w-0">
              <div className="font-display text-base text-navy truncate">{quiz.title}</div>
              <div className="text-[10.5px] text-gray-400">
                {quiz.typeLabel} 경제 퀴즈{quiz.reward > 0 ? ` · 참여하면 ${quiz.reward} GC` : ''}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-300 text-lg shrink-0 px-1">
            ✕
          </button>
        </div>
        <p className="text-[11.5px] text-navy bg-paper rounded-xl px-3 py-2 mb-3 leading-relaxed">
          <b>맞고 틀리고는 전혀 상관없어요.</b> 점수는 평가에 쓰이지 않으니 아는 대로 편하게, 성실하게만 답해주세요.
          한 번 제출하면 다시 풀 수 없어요.
        </p>

        <div className="space-y-4">
          {quiz.questions.map((q, qi) => (
            <div key={q.id}>
              <div className="text-sm font-bold text-navy mb-1.5">
                {qi + 1}. {q.question}
              </div>
              <div className="space-y-1.5">
                {q.choices.map((c, ci) => (
                  <button
                    key={ci}
                    onClick={() => setAnswers((a) => a.map((v, i) => (i === qi ? ci : v)))}
                    className={`w-full text-left text-xs px-3 py-2 rounded-xl border-[1.5px] ${
                      answers[qi] === ci ? 'bg-navy border-navy text-white' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="btn-3d btn-3d-gold mt-4 bg-gold text-navy-deep rounded-full px-6 py-2.5 text-sm font-display w-full disabled:opacity-50"
        >
          {submitting ? '제출 중...' : remainingSec > 0 ? `천천히 읽어주세요 (${remainingSec}초)` : '제출하기'}
        </button>
      </div>
    </div>
  );
}

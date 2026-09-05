'use client';

export default function PinPad({ value, onChange, shake }) {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  const press = (d) => {
    if (value.length < 4) onChange(value + d);
  };
  const backspace = () => onChange(value.slice(0, -1));
  const clear = () => onChange('');

  return (
    <div>
      <div className={`flex gap-3 justify-center my-4 ${shake ? 'animate-shake' : ''}`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 border-navy ${
              i < value.length ? 'bg-navy' : 'bg-transparent'
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto">
        {digits.map((n) => (
          <button
            key={n}
            onClick={() => press(n)}
            className="py-4 rounded-xl border-[1.5px] border-gray-200 bg-white font-display text-xl text-navy active:bg-paper"
          >
            {n}
          </button>
        ))}
        <button onClick={clear} className="py-4 rounded-xl border-[1.5px] border-gray-200 bg-white text-xs text-navy active:bg-paper">
          지우기
        </button>
        <button onClick={() => press(0)} className="py-4 rounded-xl border-[1.5px] border-gray-200 bg-white font-display text-xl text-navy active:bg-paper">
          0
        </button>
        <button onClick={backspace} className="py-4 rounded-xl border-[1.5px] border-gray-200 bg-white text-navy active:bg-paper">
          ←
        </button>
      </div>
    </div>
  );
}

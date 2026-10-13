import React, { useEffect, useRef, useState } from 'react';

const LENGTH = 6;

/**
 * Six-box passcode field (one digit per box).
 * `value` is always a contiguous digit string (no gaps), so the parent can send it as-is.
 * Bump `shakeSignal` (e.g. after a failed login) to shake the boxes and refocus the first one.
 */
const PasscodeInput = ({ value, onChange, masked = true, shakeSignal = 0, disabled = false }) => {
    const inputsRef = useRef([]);
    const groupRef = useRef(null);
    const [focusedIndex, setFocusedIndex] = useState(null);
    // Latest value, updated synchronously. Focus moves happen before React re-renders,
    // so reading the `value` prop there would be one keystroke behind.
    const valueRef = useRef(value);

    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    const commit = (next) => {
        valueRef.current = next;
        onChange(next);
    };

    const focusBox = (i) => {
        const el = inputsRef.current[Math.max(0, Math.min(LENGTH - 1, i))];
        if (el) {
            el.focus();
            el.select();
        }
    };

    useEffect(() => {
        if (!shakeSignal || !groupRef.current) return;
        // Restart the CSS animation directly on the DOM node (no extra re-render).
        const group = groupRef.current;
        group.classList.remove('animate-shake');
        void group.offsetWidth;
        group.classList.add('animate-shake');
        focusBox(0);
    }, [shakeSignal]);

    const fillFrom = (i, digits) => {
        const next = (valueRef.current.slice(0, i) + digits).slice(0, LENGTH);
        commit(next);
        focusBox(next.length);
    };

    const handleFocus = (i) => {
        // Never leave a gap: jump to the first empty box if the user taps further ahead.
        const current = valueRef.current;
        if (i > current.length) {
            focusBox(current.length);
            return;
        }
        setFocusedIndex(i);
        inputsRef.current[i]?.select();
    };

    const handleChange = (i, e) => {
        const digits = e.target.value.replace(/\D/g, '');
        if (!digits) return;

        if (digits.length > 1) {
            // Autofill or a multi-character insert: spread across boxes.
            fillFrom(i, digits);
            return;
        }

        const current = valueRef.current;
        commit((current.slice(0, i) + digits + current.slice(i + 1)).slice(0, LENGTH));
        if (i < LENGTH - 1) focusBox(i + 1);
    };

    const handleKeyDown = (i, e) => {
        const current = valueRef.current;
        if (e.key === 'Backspace') {
            e.preventDefault();
            if (current[i]) {
                commit(current.slice(0, i) + current.slice(i + 1));
            } else if (i > 0) {
                commit(current.slice(0, i - 1) + current.slice(i));
                focusBox(i - 1);
            }
        } else if (e.key === 'Delete') {
            e.preventDefault();
            commit(current.slice(0, i) + current.slice(i + 1));
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            focusBox(i - 1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            focusBox(Math.min(i + 1, current.length));
        }
    };

    const handlePaste = (i, e) => {
        e.preventDefault();
        const digits = e.clipboardData.getData('text').replace(/\D/g, '');
        if (digits) fillFrom(i, digits);
    };

    return (
        <div
            ref={groupRef}
            role="group"
            aria-label="6-digit passcode"
            className="flex justify-between gap-2"
            onAnimationEnd={(e) => e.currentTarget.classList.remove('animate-shake')}
        >
            {Array.from({ length: LENGTH }, (_, i) => {
                const filled = Boolean(value[i]);
                const focused = focusedIndex === i;
                return (
                    <input
                        key={i}
                        ref={(el) => { inputsRef.current[i] = el; }}
                        type={masked ? 'password' : 'text'}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        maxLength={LENGTH}
                        aria-label={`Digit ${i + 1} of ${LENGTH}`}
                        value={value[i] || ''}
                        disabled={disabled}
                        onFocus={() => handleFocus(i)}
                        onBlur={() => setFocusedIndex(null)}
                        onChange={(e) => handleChange(i, e)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        onPaste={(e) => handlePaste(i, e)}
                        className={`flex-1 min-w-0 max-w-[3.5rem] h-14 rounded-2xl border-2 text-center text-xl font-black text-slate-800 caret-blue-600 transition-all duration-200 focus:outline-none focus:ring-0 disabled:opacity-60 ${focused
                            ? 'border-blue-600 bg-white ring-4 ring-blue-500/10 scale-105'
                            : filled
                                ? 'border-slate-300 bg-white'
                                : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                            }`}
                    />
                );
            })}
        </div>
    );
};

export default PasscodeInput;

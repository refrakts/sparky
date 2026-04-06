import { render } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useHotKey } from './use-hot-key';

function HotKeyHarness({ callback }: { callback: () => void }) {
    useHotKey(callback, 'b');
    const [value, setValue] = useState('');

    return <input aria-label="query" value={value} onChange={(event) => setValue(event.target.value)} />;
}

describe('useHotKey', () => {
    it('runs the callback for matching modifier shortcuts', () => {
        const callback = vi.fn();

        render(<HotKeyHarness callback={callback} />);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }));

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('ignores shortcuts while an input is focused', () => {
        const callback = vi.fn();

        const { getByLabelText } = render(<HotKeyHarness callback={callback} />);
        const input = getByLabelText('query');
        input.focus();

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }));

        expect(callback).not.toHaveBeenCalled();
    });
});

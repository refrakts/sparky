import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLocalStorage } from './use-local-storage';

describe('useLocalStorage', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('persists updates to localStorage', async () => {
        const { result } = renderHook(() => useLocalStorage('table-layout', 'default'));

        act(() => {
            result.current[1]('compact');
        });

        await act(async () => {
            await Promise.resolve();
        });

        expect(window.localStorage.getItem('table-layout')).toBe(JSON.stringify('compact'));
        expect(result.current[0]).toBe('compact');
    });

    it('syncs state from storage events in another tab', () => {
        const { result } = renderHook(() => useLocalStorage('column-order', ['name']));

        act(() => {
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'column-order',
                    newValue: JSON.stringify(['name', 'balance']),
                }),
            );
        });

        expect(result.current[0]).toEqual(['name', 'balance']);
    });
});

import { useEffect, useState } from 'react';
const KEY = 'sound:on';
export function useSoundPref() {
    const [on, setOn] = useState<boolean>(() => localStorage.getItem(KEY) === '1');
    useEffect(() => { localStorage.setItem(KEY, on ? '1' : '0'); }, [on]);
    return { soundOn: on, setSoundOn: setOn };
}
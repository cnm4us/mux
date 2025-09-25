import { useEffect, useRef, useState } from 'react'
import { useHls } from '../hooks/useHls'


export default function HlsPlayer({ src, active }: { src?: string; active: boolean }) {
    const ref = useRef<HTMLVideoElement | null>(null)
    useHls(ref.current, src)
    const [canAuto, setCanAuto] = useState(false)


    useEffect(() => {
        const v = ref.current
        if (!v) return
        const onCanPlay = () => setCanAuto(true)
        v.addEventListener('canplay', onCanPlay)
        return () => v.removeEventListener('canplay', onCanPlay)
    }, [])


    useEffect(() => {
        const v = ref.current
        if (!v) return
        if (active && canAuto) { v.play().catch(() => { }) } else { v.pause() }
    }, [active, canAuto])


    return (
        <video
            ref={ref}
            className="video-el"
            playsInline
            muted
            controls={false}
            preload="metadata"
        />
    )
}
import Hls from 'hls.js'
import { useEffect } from 'react'


export function useHls(videoEl: HTMLVideoElement | null, src?: string) {
    useEffect(() => {
        if (!videoEl || !src) return


        if (Hls.isSupported()) {
            const hls = new Hls()
            hls.loadSource(src)
            hls.attachMedia(videoEl)
            return () => hls.destroy()
        } else {
            videoEl.src = src
            return () => { videoEl.removeAttribute('src'); videoEl.load() }
        }
    }, [videoEl, src])
}
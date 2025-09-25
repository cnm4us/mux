import { useState } from 'react'


export default function Uploader() {
    const [file, setFile] = useState<File | null>(null)
    const [progress, setProgress] = useState(0)
    const [uploading, setUploading] = useState(false)
    const [msg, setMsg] = useState<string | null>(null)


    async function startUpload() {
        if (!file) return
        setMsg(null)
        setUploading(true)
        setProgress(0)


        // 1) create upload
        const upRes = await fetch('/api/v1/uploads', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: file.name })
        })
        if (!upRes.ok) { setMsg('Failed to create upload'); setUploading(false); return }
        const { videoId, url } = await upRes.json()


        // 2) PUT to Mux direct upload URL with progress
        await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.open('PUT', url)
            xhr.upload.onprogress = (e) => {
                if (!e.lengthComputable) return
                setProgress(Math.round((e.loaded / e.total) * 100))
            }
            xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('upload failed')))
            xhr.onerror = () => reject(new Error('network error'))
            xhr.send(file)
        })


        setMsg(`Uploaded. Processing… (video ${videoId})`)
        setUploading(false)
        setProgress(100)
    }


    return (
        <div className="uploader">
            <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <button className="btn" onClick={startUpload} disabled={!file || uploading}>Upload</button>
            <div className="progress"><div style={{ width: progress + '%' }} /></div>
            {msg && <div>{msg}</div>}
        </div>
    )
}
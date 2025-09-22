import type { UploadsRepo } from "../../uploads.repo.js";


export class UploadsMemoryRepo implements UploadsRepo {
private byVideo = new Map<string, string>();
async linkUpload({ videoId, uploadId }: { videoId: string; uploadId: string }): Promise<void> {
this.byVideo.set(videoId, uploadId);
}
}
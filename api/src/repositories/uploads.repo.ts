export interface DirectUploadLink {
videoId: string;
uploadId: string;
}


export interface UploadsRepo {
linkUpload(link: DirectUploadLink): Promise<void>;
}
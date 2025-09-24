import { config } from "../config/index.js";
import { VideosMemoryRepo } from "../repositories/impl/memory/videos.memory.js";
import { VideosMySqlRepo } from "../repositories/videos.mysql.js";

let _videosRepo: any;

export function getRepos() {
  if (!_videosRepo) {
    _videosRepo = config.PERSISTENCE === "mysql"
      ? new VideosMySqlRepo()
      : new VideosMemoryRepo();
  }
  return { videosRepo: _videosRepo };
}

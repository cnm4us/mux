import { VideosMemoryRepo } from "../repositories/impl/memory/videos.memory.js";

const videosRepo = new VideosMemoryRepo();
export function getRepos() {
  return { videosRepo };
}
import { UploadAssetManager } from '../Upload/UploadAssetManager';

const uploadAssets = new UploadAssetManager(process.cwd());

export function stageUploadFile(sourcePathOrName: string): string {
  return uploadAssets.stagePath(sourcePathOrName);
}

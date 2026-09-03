import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function stageUploadFile(sourcePathOrName: string): string {
  const projectRoot = process.cwd();
  const uploadsDir = path.join(projectRoot, 'Uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const destinationPath = path.join(uploadsDir, path.basename(sourcePathOrName));
  const candidatePaths: string[] = [];

  if (path.isAbsolute(sourcePathOrName)) {
    candidatePaths.push(sourcePathOrName);
  } else {
    candidatePaths.push(
      path.join(projectRoot, sourcePathOrName),
      path.join(projectRoot, 'AIRecorder', sourcePathOrName),
      path.join(projectRoot, 'DataFiles', sourcePathOrName),
      path.join(os.homedir(), 'Downloads', sourcePathOrName)
    );
  }

  const sourcePath = candidatePaths.find((candidate) => fs.existsSync(candidate));

  if (sourcePath) {
    if (path.resolve(sourcePath) !== path.resolve(destinationPath)) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
    return destinationPath;
  }

  if (fs.existsSync(destinationPath)) {
    return destinationPath;
  }

  throw new Error(
    `Upload source file not found for "${sourcePathOrName}". Place the file in Uploads or Downloads.`
  );
}

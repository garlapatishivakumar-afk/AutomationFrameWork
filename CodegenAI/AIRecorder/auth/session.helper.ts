import fs from 'fs';
import path from 'path';

export const sessionPath = path.resolve(__dirname, 'session.json');
export const sessionMaxAgeMs = 4 * 24 * 60 * 60 * 1000;

export function isSessionValid(filePath: string = sessionPath): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const fileInfo = fs.statSync(filePath);
  if (fileInfo.size <= 0) {
    return false;
  }

  return Date.now() - fileInfo.mtimeMs <= sessionMaxAgeMs;
}

export function deleteSession(filePath: string = sessionPath): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
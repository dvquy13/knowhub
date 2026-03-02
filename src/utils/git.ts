import { execSync } from 'child_process';

function exec(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

export function gitAdd(dir: string, files: string | string[] = '.'): void {
  const targets = Array.isArray(files) ? files.join(' ') : files;
  exec(`git add ${targets}`, dir);
}

export function gitCommit(dir: string, message: string): void {
  exec(`git commit -m ${JSON.stringify(message)}`, dir);
}

export function gitPush(dir: string): void {
  exec('git push', dir);
}

export function gitClone(url: string, targetDir: string): void {
  execSync(`git clone ${JSON.stringify(url)} ${JSON.stringify(targetDir)}`, {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
}

export function gitInit(dir: string): void {
  exec('git init', dir);
}

export function gitRemoteAdd(dir: string, name: string, url: string): void {
  exec(`git remote add ${name} ${JSON.stringify(url)}`, dir);
}

export function hasUncommittedChanges(dir: string): boolean {
  try {
    const output = exec('git status --porcelain', dir);
    return output.length > 0;
  } catch {
    return false;
  }
}

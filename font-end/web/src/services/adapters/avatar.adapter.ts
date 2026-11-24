export const LOCAL_AVATARS_STORAGE_KEY = 'lexitag:v1:local-avatars';
export const LOCAL_AVATAR_EVENT = 'lexitag:local-avatar-changed';

type AvatarMap = Record<string, string>;

function readMap(): AvatarMap {
  try {
    const raw = window.localStorage.getItem(LOCAL_AVATARS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as AvatarMap) : {};
  } catch {
    return {};
  }
}

function writeMap(map: AvatarMap): void {
  try {
    window.localStorage.setItem(LOCAL_AVATARS_STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(LOCAL_AVATAR_EVENT));
  } catch {
    // Ignore private-mode / quota errors safely
  }
}

export const localAvatarAdapter = {
  get(userId: number | string | undefined | null): string | null {
    if (userId === undefined || userId === null) return null;
    const map = readMap();
    return map[String(userId)] ?? null;
  },

  set(userId: number | string, dataUrl: string): void {
    const map = readMap();
    map[String(userId)] = dataUrl;
    writeMap(map);
  },

  remove(userId: number | string): void {
    const map = readMap();
    delete map[String(userId)];
    writeMap(map);
  },
};

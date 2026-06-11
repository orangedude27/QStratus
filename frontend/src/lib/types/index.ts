export type GameType = {
  GameID: string;              // Partition key
  appid?: number;              // Steam AppID (for Steam games)
  source: 'steam' | 'non-steam' | 'manual' | 'seed';
  installdir?: string;         // Steam install directory
  developer: string;           // Developer name
  genres: string[];            // Genres (String array)
  lDescript: string;           // Long description
  s3: string[];                // S3 links (String array)
  sDescript: string;           // Short description
  title: string;               // Game title
};

export type DiscoveredGameType = {
  appid: number;
  name: string;
  installdir: string;
  sizeOnDisk: number;
  lastUpdated: number;
  stateFlags: number;
};

export type ScanResult = {
  discovered: DiscoveredGameType[];
  existing: GameType[];
};

export type DownloadStatus = {
  downloading: boolean;
  appid: number;
  progress: number;
  status: 'queued' | 'downloading' | 'complete' | 'error';
};

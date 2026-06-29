interface BeaconState {
  platform: "twitch" | "kick";
  channel: string;
  ts: number;
}

let _state: BeaconState | null = null;

export function setBeacon(s: BeaconState) { _state = s; }
export function getBeacon() { return _state; }

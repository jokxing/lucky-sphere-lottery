const KEY = "DEVICE_ID";

function rand() {
  return Math.random().toString(16).slice(2);
}

export function getDeviceId() {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `d_${Date.now().toString(16)}_${rand()}_${rand()}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}



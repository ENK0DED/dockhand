const k = 1024;
const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

export function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) {
    return '0 B';
  }

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export async function fetchEnvironments() {
  try {
    const response = await fetch('/api/environments');

    if (response.ok) {
      return response.json();
    }
  } catch (error) {
    console.error('Failed to fetch environments:', error);
  }
}

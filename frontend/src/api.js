export const BASE_URL =
  process.env.REACT_APP_API_URL || "https://videoprotector-production.up.railway.app";

export const TOKEN = "secure_token_123";

export const HEADERS = {
  Authorization: TOKEN,
};

export async function fetchVideos() {
  const res = await fetch(`${BASE_URL}/api/admin/videos`, { headers: HEADERS });
  return res.json();
}

export async function deleteVideo(id) {
  const res = await fetch(`${BASE_URL}/api/admin/videos/${id}`, {
    method: "DELETE",
    headers: HEADERS,
  });
  return res.json();
}

export async function uploadVideo(title, file, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("title", title);
    formData.append("video", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE_URL}/api/admin/upload`);
    xhr.setRequestHeader("Authorization", TOKEN);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try { resolve(JSON.parse(xhr.responseText)); }
      catch { reject(new Error("Invalid response")); }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(formData);
  });
}
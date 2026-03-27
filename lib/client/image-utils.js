export async function filesToDataImages(fileList, limit = 4) {
  const files = Array.from(fileList || []).slice(0, limit);
  return Promise.all(files.map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      src: reader.result
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}

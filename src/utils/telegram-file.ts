/**
 * Downloads a file from Telegram servers using file_id and converts it to a Base64 string for Gemini
 */
export async function downloadTelegramFileAsBase64(
  botToken: string,
  filePath: string
): Promise<string> {
  const url = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file from Telegram: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

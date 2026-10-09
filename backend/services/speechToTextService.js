/**
 * Speech-to-Text (STT) Service
 * Model: openai/whisper-large-v3-turbo
 * Translates candidate audio to text transcript without altering content.
 */

const { getAiServiceUrl, getAiServiceHeaders } = require('../config/aiServiceConfig');
const AI_SERVICE_URL = getAiServiceUrl();

class SpeechToTextService {
  constructor() {
    this.modelName = process.env.STT_MODEL || 'openai/whisper-large-v3-turbo';
  }

  /**
   * Transcribes candidate audio buffer.
   * @param {Object} params
   * @param {Buffer} params.audioBuffer - Raw audio file buffer from browser
   * @param {string} params.filename - File name (e.g. recording.webm)
   * @param {string} params.mimetype - MIME type (e.g. audio/webm)
   * @param {string} [params.prompt] - Context (question, role, skills) that helps Whisper spell technical terms
   * @param {string} [params.language] - ISO language code; defaults to English
   * @returns {Promise<{success: boolean, text?: string, error?: string, latencyMs?: number, duration?: number}>}
   */
  async transcribeAudio({ audioBuffer, filename = 'recording.webm', mimetype = 'audio/webm', prompt = '', language = 'en' }) {
    const startTime = Date.now();

    // 1. Basic validation
    if (!audioBuffer || audioBuffer.length === 0) {
      console.warn('[SpeechToTextService] [ERROR] Received empty audio buffer.');
      return { success: false, error: 'EMPTY_AUDIO', message: 'Audio recording was empty. Please try recording again.' };
    }

    if (audioBuffer.length < 256) {
      console.warn('[SpeechToTextService] [ERROR] Audio buffer too small (< 256 bytes).');
      return { success: false, error: 'EMPTY_AUDIO', message: 'Audio recording was too short to contain speech. Please try again.' };
    }

    const maxBytes = 25 * 1024 * 1024; // 25 MB
    if (audioBuffer.length > maxBytes) {
      console.warn(`[SpeechToTextService] [ERROR] Audio buffer exceeds 25MB limit (${audioBuffer.length} bytes).`);
      return { success: false, error: 'FILE_TOO_LARGE', message: 'Audio recording exceeds the 25MB size limit.' };
    }

    console.log(`[VOICE_RECORDING_RECEIVED] size=${audioBuffer.length} bytes, file=${filename}, mime=${mimetype}`);
    console.log(`[STT_STARTED] model=${this.modelName}`);

    try {
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: mimetype });
      formData.append('file', blob, filename);
      if (prompt) formData.append('prompt', prompt);
      if (language) formData.append('language', language);

      const response = await fetch(`${AI_SERVICE_URL}/voice/transcribe`, {
        method: 'POST',
        headers: getAiServiceHeaders(),
        body: formData,
        signal: AbortSignal.timeout(35000),
      });

      const totalLatency = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[SpeechToTextService] [ERROR] AI Service STT failed with status ${response.status}:`, errorText.slice(0, 200));
        return {
          success: false,
          error: 'STT_FAILED',
          message: 'Speech recognition service encountered an error. Please try again.',
          latencyMs: totalLatency,
        };
      }

      const result = await response.json();

      if (result.status === 'error' || !result.text || !result.text.trim()) {
        console.warn('[SpeechToTextService] [STT_COMPLETED] Empty or invalid transcription received.');
        return {
          success: false,
          error: 'EMPTY_TRANSCRIPT',
          message: "We couldn't clearly capture that answer. Please try again.",
          latencyMs: totalLatency,
        };
      }

      console.log(`[STT_COMPLETED] Transcribed ${result.text.length} chars in ${totalLatency}ms`);

      return {
        success: true,
        text: result.text.trim(),
        language: result.language || 'en',
        duration: result.duration || 0,
        latencyMs: totalLatency,
      };
    } catch (err) {
      const totalLatency = Date.now() - startTime;
      console.error('[SpeechToTextService] [ERROR] STT request failed:', err.message);
      return {
        success: false,
        error: err.name === 'TimeoutError' ? 'STT_TIMEOUT' : 'STT_FAILED',
        message: 'Could not complete audio transcription. Please check your connection or try again.',
        latencyMs: totalLatency,
      };
    }
  }
}

module.exports = new SpeechToTextService();

/**
 * Code Execution Service
 * Safely compiles and runs candidate code using Judge0 CE sandbox API.
 * Supports JavaScript, Python, TypeScript, Java, and C++.
 */

const JUDGE0_BASE_URL = process.env.JUDGE0_URL || 'https://ce.judge0.com';

// Language mapping to Judge0 CE language IDs
const LANGUAGE_MAP = {
  javascript: 63, // JavaScript (Node.js 12.14.0 / modern)
  js: 63,
  python: 71,     // Python (3.8.1 / 3.10)
  py: 71,
  python3: 71,
  typescript: 74, // TypeScript (3.7.4)
  ts: 74,
  java: 62,       // Java (OpenJDK 13.0.1)
  cpp: 54,        // C++ (GCC 9.2.0)
  'c++': 54,
  c: 50,          // C (GCC 9.2.0)
};

class CodeExecutionService {
  /**
   * Executes source code in an isolated sandbox.
   * @param {Object} params
   * @param {string} params.code - Source code to execute
   * @param {string} params.language - Programming language (e.g. 'javascript', 'python')
   * @param {string} [params.stdin] - Optional standard input
   * @returns {Promise<{success: boolean, stdout?: string, stderr?: string, compile_output?: string, status?: string, time?: string, memory?: number, error?: string}>}
   */
  async executeCode({ code, language = 'javascript', stdin = '' }) {
    const cleanLang = (language || 'javascript').toLowerCase().trim();
    const languageId = LANGUAGE_MAP[cleanLang] || 63; // Default to JavaScript

    if (!code || !code.trim()) {
      return {
        success: false,
        error: 'EMPTY_CODE',
        message: 'No code provided to execute.',
      };
    }

    try {
      const response = await fetch(`${JUDGE0_BASE_URL}/submissions?wait=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          source_code: code,
          language_id: languageId,
          stdin: stdin || '',
          cpu_time_limit: 5, // 5 seconds max execution
          memory_limit: 128000, // 128MB
        }),
        signal: AbortSignal.timeout(15000), // 15 seconds request timeout
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[CodeExecutionService] Judge0 returned status ${response.status}:`, errText.slice(0, 150));
        return {
          success: false,
          error: 'RUNNER_UNAVAILABLE',
          message: 'Code execution sandbox temporarily unavailable. Please try again.',
        };
      }

      const result = await response.json();

      const stdout = result.stdout || '';
      const stderr = result.stderr || '';
      const compileOutput = result.compile_output || '';
      const statusDescription = result.status?.description || 'Executed';

      return {
        success: true,
        stdout,
        stderr: stderr || compileOutput,
        status: statusDescription,
        time: result.time ? `${result.time}s` : '0.01s',
        memory: result.memory || 0,
      };
    } catch (err) {
      console.error('[CodeExecutionService] Execution error:', err.message);
      return {
        success: false,
        error: 'EXECUTION_FAILED',
        message: err.message || 'Failed to execute code in sandbox.',
      };
    }
  }
}

module.exports = new CodeExecutionService();

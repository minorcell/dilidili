/**
 * 把后端或运行时返回的技术性错误翻译成用户能理解、知道下一步该做什么的话。
 * 原始错误只写进控制台，避免 HTTP 状态码、ffmpeg 输出等直接出现在界面上。
 */

interface ErrorRule {
  pattern: RegExp;
  message: string;
}

const RULES: ErrorRule[] = [
  {
    pattern: /(412|风控|risk control|request was banned)/i,
    message: 'B 站暂时拒绝了请求，请稍后重试；如果一直失败，试试重新登录。',
  },
  {
    pattern: /(403|forbidden|没有权限|无权限)/i,
    message: '没有权限获取这个视频，请确认视频可以正常播放，或重新登录后再试。',
  },
  {
    pattern: /(-404|404|not found|不存在|已删除)/i,
    message: '视频不存在或已被删除。',
  },
  {
    pattern: /(-101|401|账号未登录|未登录|登录已过期|登录失效)/i,
    message: '登录状态已失效，请重新登录。',
  },
  {
    pattern: /(timeout|timed out|超时)/i,
    message: '网络请求超时，请检查网络后重试。',
  },
  {
    pattern: /(error sending request|connection|network|dns|网络|连接失败)/i,
    message: '网络连接失败，请检查网络后重试。',
  },
  {
    pattern: /(no space|disk full|磁盘|空间不足|permission denied|拒绝访问|只读)/i,
    message: '保存文件失败，请检查下载目录是否可写、磁盘空间是否充足。',
  },
  {
    pattern: /(ffmpeg|合并|转码|编码|convert)/i,
    message: '处理视频时出错，请重试。',
  },
  {
    pattern: /(文件不存在|文件夹不存在|folder not found)/i,
    message: '文件或文件夹不存在，可能已被移动或删除。',
  },
];

function rawMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error ?? '');
}

/**
 * @param error 原始错误，仅用于匹配与调试
 * @param fallback 没有命中任何规则时给用户看的话
 */
export function userMessage(error: unknown, fallback = '操作没有完成，请稍后重试。'): string {
  const raw = rawMessage(error);
  console.error('[DILIDILI]', error);

  for (const rule of RULES) {
    if (rule.pattern.test(raw)) {
      return rule.message;
    }
  }

  return fallback;
}

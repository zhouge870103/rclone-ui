// 内部版：Sentry 遥测已移除。
//
// 本模块提供与 @sentry/browser 兼容的空实现，使原有的 `Sentry.captureException(...)`
// 调用点无需改动即可继续编译运行，但不会向任何外部服务发送数据。
// 既支持 `import * as Sentry from '.../sentry'`，也支持 `import { captureException } from '.../sentry'`。

export function captureException(_error?: unknown): string {
    return ''
}

export function captureMessage(_message?: unknown): string {
    return ''
}

export function init(_options?: unknown): void {}

export const defaultOptions = {}

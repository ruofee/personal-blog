import { defineClientConfig } from '@vuepress/client'
import * as Sentry from '@sentry/vue'

export default defineClientConfig({
  enhance({ app, router, siteData }) {
    console.log(`Hello, I am
    ______    __   __  _______  _______  _______  _______ 
    |    _ |  |  | |  ||       ||       ||       ||       |
    |   | ||  |  | |  ||   _   ||    ___||    ___||    ___|
    |   |_||_ |  |_|  ||  | |  ||   |___ |   |___ |   |___ 
    |    __  ||       ||  |_|  ||    ___||    ___||    ___|
    |   |  | ||       ||       ||   |    |   |___ |   |___ 
    |___|  |_||_______||_______||___|    |_______||_______|`)
    Sentry.init({
      app,
      dsn: "https://ca414032736cc9fbceb266f6563a8a84@o196334.ingest.us.sentry.io/4506935267295232",
      integrations: [
        Sentry.browserTracingIntegration(),
        // 兼容打包错误
        typeof Sentry?.default?.replayIntegration === 'function'
          ? Sentry.default.replayIntegration({
            maskAllText: false,
            blockAllMedia: false,
          })
          : Sentry.replayIntegration({
            maskAllText: false,
            blockAllMedia: false,
          }),
      ],
      // Performance Monitoring
      tracesSampleRate: 1.0, //  Capture 100% of the transactions
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: ["localhost", /^http:\/\/ruofee\.cn/],
      // Session Replay
      replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
      replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
    })
  },
  setup() {},
  rootComponents: [],
})
---
title: "vitepress 的实现原理"
date: 2023/2/1 19:30:00
banner: http://img.ruofee.cn/vue
---

## 什么是 Vitepress？

Vitepress 是由 Vite 和 Vue 驱动的静态站点生成器，通过获取 Markdown 编写的内容，并可以生成对应的静态 HTML 页面。我们经常使用 Vitepress 做博客等静态网站，本文主要解析一下 Vitepress 的实现原理，下面就开始吧！

## 初始化项目

官方文档推荐使用命令行工具进行初始化：

```bash
npx vitepress init
```

执行完命令便会进入一个命令行的设置界面，通过设置项目名等问题，最终生成一个 vitepress 项目。

我们都知道，`npx vitepress init` 实际上等同于：

```bash
npm i -g vitepress
vitepress init
```

很好理解，先全局安装 vitepress，再执行 `vitepress init`命令；

先通过 `@clack/prompts` 开启命令行 UI 界面，用户进行初始化配置：

```ts
// src/node/init/init.ts
import { group } from '@clack/prompts'

const options: ScaffoldOptions = await group(
    {
      root: () =>
        text({
          message: 'Where should VitePress initialize the config?',
          initialValue: './',
          validate(value) {
            // TODO make sure directory is inside
          }
        }),
    
      title: () =>
        text({
          message: 'Site title:',
          placeholder: 'My Awesome Project'
        }),
    // ...以下省略
)
```

再对配置项进行处理，从 template 文件夹中拉取模板文件，完成项目的初始化。

## 服务启动

在初始化的项目中，我们一般通过执行以下命令启动文档服务：

```bash
vitepress dev
```

执行完命令，我们便可以通过在浏览器打开 `localhost:5173` 访问 vitepress 文档！

### 创建 vite 服务：

```ts
// src/node/server.ts
import { createServer as createViteServer, type ServerOptions } from 'vite'
import { resolveConfig } from './config'
import { createVitePressPlugin } from './plugin'

export async function createServer(
  root: string = process.cwd(),
  serverOptions: ServerOptions & { base?: string } = {},
  recreateServer?: () => Promise<void>
) {
  // 读取 vitepress 配置
  const config = await resolveConfig(root)

  if (serverOptions.base) {
    config.site.base = serverOptions.base
    delete serverOptions.base
  }

  // 创建 vite 服务
  return createViteServer({
    root: config.srcDir,
    base: config.site.base,
    cacheDir: config.cacheDir,
    plugins: await createVitePressPlugin(config, false, {}, {}, recreateServer),
    server: serverOptions,
    customLogger: config.logger,
    configFile: config.vite?.configFile
  })
}
```

上述代码创建并启动了一个 vite 服务；首先，我们要读取 `.vitepress/config/index.js` ，这是 vitepress 的配置文件，上述代码中的 `resolveConfig` 完成了这部分工作，并将用户配置整合成一个 config 对象，再将部分配置传入 `createViteServer` ，创建并启动 vite 服务！

### 执行 vite 插件

看完上面的内容，你可能会有点疑惑，正常来说，vite 需要一个 HTML 作为入口文件，但我们找遍 vitepress 也未发现我们想要的 HTML 文件，那么…这其实是这部分的重头戏！

在上面的代码片段中，可以看到启动 vite 服务时还配置了插件：

```ts
return createViteServer({
    root: config.srcDir,
    base: config.site.base,
    cacheDir: config.cacheDir,
    plugins: await createVitePressPlugin(config, false, {}, {}, recreateServer),
    server: serverOptions,
    customLogger: config.logger,
    configFile: config.vite?.configFile
})
```

事实上，所有的玄机都在 `createVitePressPlugin` 中，函数返回了一个插件列表，其中有一个名为 `vitepress` 的插件：

```ts
const vitePressPlugin: Plugin = {
    name: 'vitepress',
    // 省略代码
    configureServer(server) {
      // 省略代码
      return () => {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url && cleanUrl(req.url)
          if (url?.endsWith('.html')) {
            res.statusCode = 200
            res.setHeader('Content-Type', 'text/html')
            let html = `<!DOCTYPE html>
<html>
  <head>
    <title></title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="description" content="">
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/@fs/${APP_PATH}/index.js"></script>
  </body>
</html>`
            html = await server.transformIndexHtml(url, html, req.originalUrl)
            res.end(html)
            return
          }
          next()
        })
      }
    },
    // 省略代码
  }
```

vitepress 插件中定义了 `configureServer` 生命周期：在该生命周期中返回一个 HTML 文件，作为 vite 服务的入口 HTML 文件，当我们访问服务时，浏览器渲染网页，执行 HTML 中引入的 script 文件，其中 `APP_PATH` 为 `src/client/app/index.ts` ，网页正常展示在我们眼前，至此，服务正常启动！

## 文档渲染

在上面的部分，我们整理了启动服务的大致步骤，接下来我们将接着整理 Markdown 文件和路由的映射关系！

### 创建路由

Vitepress 并没有使用 Vuejs 的官方路由方案 - Vue Router，而是自己实现了一个简单的路由模块：首先通过监听 window 的点击事件，当用户点击超链接元素时，执行跳转函数 `go`：

```ts
async function go(href: string = inBrowser ? location.href : '/') {
    href = normalizeHref(href)
    if ((await router.onBeforeRouteChange?.(href)) === false) return
    updateHistory(href)
    await loadPage(href)
    await router.onAfterRouteChanged?.(href)
}

function updateHistory(href: string) {
    if (inBrowser && normalizeHref(href) !== normalizeHref(location.href)) {
        // save scroll position before changing url
        history.replaceState({ scrollPosition: window.scrollY }, document.title)
        history.pushState(null, '', href)
    }
}
```

通过执行 `updateHistory`，调用 `history.replaceState` 以及 `history.pushState`，更新 url（此时不更新 页面，具体可以查看 [history.replaceState ](https://developer.mozilla.org/zh-CN/docs/Web/API/History/replaceState)和 [history.pushState](https://developer.mozilla.org/zh-CN/docs/Web/API/History/pushState)）；再调用 `loadPage` 加载 url 对应的页面，核心代码如下：

```ts
(path) => {
    let pageFilePath = pathToFile(path)
    let pageModule = null
    
    if (pageFilePath) {
      if (isInitialPageLoad) {
        initialPath = pageFilePath
      }
    
      // use lean build if this is the initial page load or navigating back
      // to the initial loaded path (the static vnodes already adopted the
      // static content on that load so no need to re-fetch the page)
      if (isInitialPageLoad || initialPath === pageFilePath) {
        pageFilePath = pageFilePath.replace(/\.js$/, '.lean.js')
      }
    
      if (import.meta.env.SSR) {
        pageModule = import(/*@vite-ignore*/ pageFilePath + '?t=' + Date.now())
      } else {
        pageModule = import(/*@vite-ignore*/ pageFilePath)
      }
    }
    
    if (inBrowser) {
      isInitialPageLoad = false
    }
    
    return pageModule
}
```

其中 `pathToFile` 函数将传入的 url 转成 md 后缀的路径，也就是对应的 Markdown 文件，再使用 `import` 导入对应路径的文件！举个例子，假设 url 为 `/ruofee`，那么最终结果为：`import(/*@vite-ignore*/ 'ruofee.md?t=当前的时间戳')`；

### 创建 Vue 应用

```ts
// src/client/app.ts
import {
  createApp as createClientApp,
  createSSRApp,
  type App
} from 'vue'

function newApp(): App {
    return import.meta.env.PROD
        ? createSSRApp(VitePressApp)
        : createClientApp(VitePressApp)
}

const app = newApp()
// 将路由注入 app
app.provide(RouterSymbol, router)

const data = initData(router.route)
app.provide(dataSymbol, data)
```

首先通过调用 newApp 创建一个 Vue 应用（在浏览器环境下，`newApp` 其实就是 Vue 的 `createApp`），再将上一部分的路由对象注册到 Vue 应用中；Vue 应用的主页面应用为 VitePressApp，具体代码如下：

```ts
import RawTheme from '@theme/index'

const Theme = resolveThemeExtends(RawTheme)

const VitePressApp = defineComponent({
    name: 'VitePressApp',
    setup() {
    // 省略代码
        return () => h(Theme.Layout!)
    }
})
```

在未指定主题的情况下，`@theme/index` 默认指向 `theme-default` 文件夹；最后再注册两个全局组件：`Content` 和 `ClientOnly`：

```ts
// 注册全局组件
app.component('Content', Content)
app.component('ClientOnly', ClientOnly)
```

### Markdown 渲染

直到目前为止，我们已经可以在浏览器中访问到我们的 HTML，并创建了 Vue 应用，实现了路由系统，当我们访问对应链接时，可以加载对应的 Markdown 文件，但你肯定会有疑惑，我们的 Markdown 文件如何被解析渲染到页面中呢？其实在[服务启动](#%E6%9C%8D%E5%8A%A1%E5%90%AF%E5%8A%A8)的部分中，我们提到了一个名为 vitepress 的 vite 插件，Markdown 渲染工作便是在这个插件的 `transform` 生命周期中实现：

```ts
async transform(code, id) {
    if (id.endsWith('.vue')) {
        return processClientJS(code, id)
    } else if (id.endsWith('.md')) {
        // transform .md files into vueSrc so plugin-vue can handle it
        const { vueSrc, deadLinks, includes } = await markdownToVue(
          code,
          id,
          config.publicDir
        )
        // 省略代码
        const res = processClientJS(vueSrc, id)
        return res
    }
}
```

当我们使用 `import` 加载 md 文件时，`transform` 将会对文件内容进行转换，通过调用 `markdownToVue` 将 markdown 内容转成 Vue SFC，再渲染到页面中，那么 `markdownToVue` 做了什么工作呢？具体来看看：

```ts
const html = md.render(src, env)
const vueSrc = [
    // 省略代码
    `<template><div>${html}</div></template>`,
    // 省略代码
].join('\n')
```

这部分比较简单，md 是一个 markdown-it 对象，调用 `render` 函数将 markdown 内容转成 HTML 格式，再输出到页面；

值得一提的是，若是你在 markdown 中书写 Vue 组件语法，由于是非 markdown 语法，因此 markdown-it 不会对其进行转换，那么 Vue 语法将在页面中得以执行！

## 总结

以上便是 vitepress 大致的原理，当然其中的很多细节都没提到，具体大家可以自行去 [Github](https://github.com/vuejs/vitepress) 上查看源码！
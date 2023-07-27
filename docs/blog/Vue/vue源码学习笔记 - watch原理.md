---
title: "vue源码学习笔记 - watch原理"
date: 2021/02/26 00:00:00
banner: http://img.ruofee.cn/vue
---



## 🤔 介绍

watch 是 vue 提供的侦听器, 用于对 data 的属性进行监听;

>  Vue 通过watch选项提供了一个更通用的方法，来响应数据的变化。当需要在数据变化时执行异步或开销较大的操作时，这个方式是最有用的;
>
> 来自 [官方文档](https://cn.vuejs.org/v2/guide/computed.html#侦听器)

## ⛽ 用法

```html
<template>
  <div>
    <button @click="add">点击</button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      i: 0
    };
  },
  watch: {
    i(newVal, oldVal) {
      console.log(newVal, oldVal);
    }
  },
  methods: {
    add() {
      this.i++;
    }
  }
}
</script>
```

上面的例子, 使用 watch 对 data.i 进行监听, 当 data.i 发生变化时, 便会触发 watch 中的监听函数, 打印出 newVal 和 oldVal ;

当然还有许多种用法, 例子来自[官方文档](https://cn.vuejs.org/v2/api/#watch):

```
watch: {
  // 函数
  a: function (val, oldVal) {
    console.log('new: %s, old: %s', val, oldVal)
  },
  // 方法名
  b: 'someMethod',
  // 该回调会在任何被侦听的对象的 property 改变时被调用，不论其被嵌套多深
  c: {
    handler: function (val, oldVal) { /* ... */ },
    deep: true
  },
  // 该回调将会在侦听开始之后被立即调用
  d: {
    handler: 'someMethod',
    immediate: true
  },
  // 你可以传入回调数组，它们会被逐一调用
  e: [
    'handle1',
    function handle2 (val, oldVal) { /* ... */ },
    {
      handler: function handle3 (val, oldVal) { /* ... */ },
      /* ... */
     }
  ],
  // watch vm.e.f's value: {g: 5}
  'e.f': function (val, oldVal) { /* ... */ }
}
```

## 🔍 源码解析

注意: 本文章使用的 vue 版本为 2.6

vue在 [initState](https://github.com/vuejs/vue/blob/2.6/src/core/instance/state.js#L48) 中执行 [initWatch](https://github.com/vuejs/vue/blob/2.6/src/core/instance/state.js#L60) 方法注册 watch:

```js
function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}
```

顺着 [initWatch](https://github.com/vuejs/vue/blob/2.6/src/core/instance/state.js#L60) 往下看:

```js
function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}
```

initWatch 函数对 watch 对象进行遍历, 当对象的属性值为数组时, 对数组进行遍历执行 createWatcher 方法, 如果对象的属性值不为数组, 则直接执行 [createWatcher](https://github.com/vuejs/vue/blob/2.6/src/core/instance/state.js#L303) 方法:

```js
function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  return vm.$watch(expOrFn, handler, options)
}
```

[isPlainObject](https://github.com/vuejs/vue/blob/edf7df0c837557dd3ea8d7b42ad8d4b21858ade0/src/shared/util.js#L58) 方法用于判断参数是否为 "object":

```js
function isPlainObject (obj: any): boolean {
  return _toString.call(obj) === '[object Object]'
}
```

当 handler 为对象时(指 object), 便执行: options = handler , handler = handler.handler; 即这种情况:

```js
watch: {
  c: {
    handler: function (val, oldVal) { /* ... */ },
    deep: true
  }
}
```

若是 handler 为字符串, 便执行 handler = vm[handler]; 即这种情况:

```js
watch: {
  b: 'someMethod'
}
```

经过以上两步操作, 这时候的 handler 为我们的监听函数, 当然有特殊情况, 也就是 handler 原先是一个对象, 对象的 handler 也是对象的情况, 这里我们先不讨论, 接着往下看; createWatch 最后返回 vm.$watch(expOrFn, handler, options) , 我们再追踪一下 [$watch](https://github.com/vuejs/vue/blob/2.6/src/core/instance/state.js#L345) :

```js
Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true
    const watcher = new Watcher(vm, expOrFn, cb, options)
    if (options.immediate) {
      try {
        cb.call(vm, watcher.value)
      } catch (error) {
        handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
      }
    }
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
```

$watch 是 Vue 原型链上的一个方法, 首先判断传入的 cb 参数, 也就是上面的 handler , 当 cb 为一个 对象 (指Object, 而非Function)时, 重新执行 createWatcher , 这里也就解决了前面刚刚说到的: handler 是对象的问题; 接着将 options.user 设置为 true , 并创建一个 watcher ; 接着, 根据 options.immediate 是否为 true 决定是否立即执行 cb 函数, 并将 watcher.value 作为 cb 的参数传入, 这便是以下的 watch 语法的具体实现:

```js
// 该回调将会在侦听开始之后被立即调用
{
  watch: {
    d: {
      handler: 'someMethod',
      immediate: true
    }
  }
}
```

回到 watcher 上面来, 这是实现数据监听的核心部分; watcher 的构造函数为 [Watcher](https://github.com/vuejs/vue/blob/2.6/src/core/observer/watcher.js#L26) , 先从 Watcher 的[构造函数](https://github.com/vuejs/vue/blob/2.6/src/core/observer/watcher.js#L45)进行解析, 以下省略了无关代码:

```js
constructor (
  vm: Component,
  expOrFn: string | Function,
  cb: Function,
  options?: ?Object,
  isRenderWatcher?: boolean
) {
  this.vm = vm
  vm._watchers.push(this)
  // options
  if (options) {
    this.deep = !!options.deep
    this.user = !!options.user
  }
  this.cb = cb
  this.active = true
  this.expression = process.env.NODE_ENV !== 'production'
    ? expOrFn.toString()
    : ''
  // parse expression for getter
  if (typeof expOrFn === 'function') {
    this.getter = expOrFn
  } else {
    this.getter = parsePath(expOrFn)
    if (!this.getter) {
      this.getter = noop
    }
  }
  this.value = this.lazy
    ? undefined
    : this.get()
}
```

分别将 options.deep 和 options.user 赋值给 this.deep 和 this.user, cb 函数赋值给 this.cb ; 判断 expOrFn 的类型, expOrFn 是watch 的 key , 因此我们默认为字符串类型, 使用 parsePath 进行转换后再赋值给 this.getter; 以下为 [parsePath](https://github.com/vuejs/vue/blob/edf7df0c837557dd3ea8d7b42ad8d4b21858ade0/src/core/util/lang.js#L34) :

```js
const unicodeLetters = 'a-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD'
const bailRE = new RegExp(`[^${unicodeLetters}.$_\\d]`)
function parsePath (path: string): any {
  if (bailRE.test(path)) {
    return
  }
  const segments = path.split('.')
  return function (obj) {
    for (let i = 0; i < segments.length; i++) {
      if (!obj) return
      obj = obj[segments[i]]
    }
    return obj
  }
}
```

parsePath 传入一个参数 path , 使用 String.prototype.split 对 path 进行处理, 以 . 为分隔点生成一个数组 segments , 最后返回一个函数, 函数执行时会对传入参数 obj 进行多层级属性访问, 最后返回一个属性值; 举个例子, 假设 path 为 "a.b.c", 那么函数执行时会先访问 obj.a , 再访问 obj.a.b , 最后访问 obj.a.b.c ,并返回 obj.a.b.c , 这是一个非常巧妙的设计, 后面会讲到; 回到 Watcher 的构造函数, 经过前面的折腾, 此时 this.getter 得到一个函数作为值; 接着执行以下代码:

```js
this.value = this.lazy
    ? undefined
    : this.get()
```

this.lazy 为 false , 执行 this.get() 获取值, 并将值缓存在 this.value 中; so, 接着看 get 方法:

```js
get () {
  pushTarget(this)
  let value
  const vm = this.vm
  try {
    value = this.getter.call(vm, vm)
  } catch (e) {
    if (this.user) {
      handleError(e, vm, `getter for watcher "${this.expression}"`)
    } else {
      throw e
    }
  } finally {
    // "touch" every property so they are all tracked as
    // dependencies for deep watching
    if (this.deep) {
      traverse(value)
    }
    popTarget()
    this.cleanupDeps()
  }
  return value
}
```

pushTarget(this) 的作用是将当前 watcher 设置为 [Dep.target](http://dep.target/) ; [Dep.target](http://dep.target/) 是一个储存 watcher 的全局变量, 这里不作细讲, 只需要知道就好; 接着执行 this.getter.call(vm, vm) , 对 vm 的属性进行层级访问, 触发 data 中目标属性的 get 方法, 触发属性对应的 [dep.depend](https://github.com/vuejs/vue/blob/2.6/src/core/observer/dep.js#L31) 方法, 进行依赖收集;

```js
depend () {
  if (Dep.target) {
    Dep.target.addDep(this)
  }
}
```

[Dep.target](http://dep.target/) 为当前的 watcher , 因此代码可以理解为: [watcher.addDep](https://github.com/vuejs/vue/blob/2.6/src/core/observer/watcher.js#L128)(this) :

```js
addDep (dep: Dep) {
  const id = dep.id
  if (!this.newDepIds.has(id)) {
    this.newDepIds.add(id)
    this.newDeps.push(dep)
    if (!this.depIds.has(id)) {
      dep.addSub(this)
    }
  }
}
```

反复横跳, 执行 dep.addSub(this) , 将 watcher 加入 dep.subs 列表中:

```js
addSub (sub: Watcher) {
  this.subs.push(sub)
}
```

上面便是依赖收集的全过程, 接着回到前面的代码中: 如果 this.deep 为 true , 也就是 watch 中设置深层监听, 会执行 [traverse](https://github.com/vuejs/vue/blob/edf7df0c837557dd3ea8d7b42ad8d4b21858ade0/src/core/observer/traverse.js#L14) 对 value 进行深度访问, 触发 value 所有属性的 get 方法, 实现依赖收集, 效果和 parsePath 一致:

```js
if (this.deep) {
  traverse(value)
}
```

[traverse](https://github.com/vuejs/vue/blob/edf7df0c837557dd3ea8d7b42ad8d4b21858ade0/src/core/observer/traverse.js#L14)的代码如下:

```js
function traverse (val: any) {
  _traverse(val, seenObjects)
  seenObjects.clear()
}

function _traverse (val: any, seen: SimpleSet) {
  let i, keys
  const isA = Array.isArray(val)
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    if (seen.has(depId)) {
      return
    }
    seen.add(depId)
  }
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else {
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
```

当 data 的属性发生变动时, 触发属性的 set 方法, 执行属性对应的 dep.notify 方法, 通知收集的所有 watcher , 执行 [watcher.update](https://github.com/vuejs/vue/blob/2.6/src/core/observer/watcher.js#L164) 方法进行更新:

```js
update () {
  /* istanbul ignore else */
  if (this.lazy) {
    this.dirty = true
  } else if (this.sync) {
    this.run()
  } else {
    queueWatcher(this)
  }
}
```

执行 [queueWatcher](https://github.com/vuejs/vue/blob/edf7df0c837557dd3ea8d7b42ad8d4b21858ade0/src/core/observer/scheduler.js#L130) 方法, 进行 dom 更新, 但这里的重点不在于 dom 更新, 顺着代码往下看:

```js
function queueWatcher (watcher: Watcher) {
  const id = watcher.id
  if (has[id] == null) {
    has[id] = true
    if (!flushing) {
      queue.push(watcher)
    } else {
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(i + 1, 0, watcher)
    }
    // queue the flush
    if (!waiting) {
      waiting = true

      if (process.env.NODE_ENV !== 'production' && !config.async) {
        flushSchedulerQueue()
        return
      }
      nextTick(flushSchedulerQueue)
    }
  }
}
```

最终执行 nextTick(flushSchedulerQueue) , 这里不对 nextTick 细化了, 只需要理解为在当前事件循环结束调用了 flushSchedulerQueue 方法, 所以我们看一下 [flushSchedulerQueue](https://github.com/vuejs/vue/blob/edf7df0c837557dd3ea8d7b42ad8d4b21858ade0/src/core/observer/scheduler.js#L38) :

```js
function flushSchedulerQueue () {
  // ...省略
  queue.sort((a, b) => a.id - b.id)
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    watcher.run()
  }
  // ...省略
}
```

 关键的一句: watcher.run() , 是的, 我们再横跳回 [watcher.run](https://github.com/vuejs/vue/blob/2.6/src/core/observer/watcher.js#L179) 中看看:

```js
run () {
  if (this.active) {
    const value = this.get()
    if (
      value !== this.value ||
      // Deep watchers and watchers on Object/Arrays should fire even
      // when the value is the same, because the value may
      // have mutated.
      isObject(value) ||
      this.deep
    ) {
      // set new value
      const oldValue = this.value
      this.value = value
      if (this.user) {
        try {
          this.cb.call(this.vm, value, oldValue)
        } catch (e) {
          handleError(e, this.vm, `callback for watcher "${this.expression}"`)
        }
      } else {
        this.cb.call(this.vm, value, oldValue)
      }
    }
  }
}
```

执行 this.get() 获取监听属性的值, 判断值是否和缓存的值相等, 不同的话执行 this.cb.call(this.vm, value, oldValue) , 也就是 watch 设置的 handler 函数; 这便是 watch 实现 监听的原理~

值得一提的是, parsePath 中返回的函数对 data 属性进行层级访问:

> 假设 path 为 "a.b.c", 那么函数执行时会先访问 obj.a , 再访问 obj.a.b , 最后访问 obj.a.b.c

也就是当前的 watcher 被 data.a 、data.a.b 、data.a.b.c 进行依赖收集, 当其中一个属性发生变化时都会触发 watch 设置的监听函数, 这是个非常巧妙的设计!

## 💻 总结

vue 中 watch 对数据进行监听的原理为: 对 watch 每个属性创建一个 watcher , watcher 在初始化时会将监听的目标值缓存到 watcher.value 中, 因此触发 data[key] 的 get 方法, 被对应的 dep 进行依赖收集; 当 data[key] 发生变动时触发 set 方法, 执行 dep.notify 方法, 通知所有收集的依赖 watcher , 触发收集的 watch watcher , 执行 watcher.cb , 也就是 watch 中的监听函数 (*￣︶￣)

多谢观看~请点个赞o(￣▽￣)ｄ


---
title: "提升效率的筛选器组件 vue-filter-box"
date: 2022/1/29 00:00:01
banner: /imgs/vue
---

## vue-filter-box 的诞生

前两年在 Baidu 时, 常常和数据中台打交道, 一个 FE 可能需要维护着多个中台, 但在繁琐又重复的工作中, 逐步可以摸索出一些提升工作效能的方法, vue-filter-box 就是其中之一!

数据中台大多数页面都是以"筛选部分" + "表格"的形式存在, 为了应付重复的工作, 提升自己的工作效率, 便萌生了一个想法: 将"筛选部分"抽出来作为一个组件, 通过传入规则即可得到一个筛选器, vue-filter-box 就是这么一个组件 ^.^

## 简单介绍这个组件

> vue-filter-box 是一款基于 view-design 实现的动态筛选器组件, 通过传入筛选项结构 `model`, 可以帮助你快速生成一个筛选器!
> -- [vue-filter-box](https://github.com/ruofee/vue-filter-box)

vue-filter-box 基于 view-design, 选择 view-design 的原因有两个:
1. 当时组内负责的中台大部分都使用 view-design 作为 UI 框架, 直接基于 `view-design` 可以省去很多麻烦
2. view-design 本身携带的组件是比较全面的, 本身的设计也是为了支撑后台管理系统, 而且关键的 `Form` 组件在使用上也未发现一些硬伤

在此, 感谢 view-design 为我们的工作带来了便利!

其实 vue-filter-box 在之前已经发过一个比较粗糙的版本了: [v2 文档](https://github.com/ruofee/vue-filter-box/blob/master/docs/v2.md), 但由于当时的水平较低以及对组件设计理解上的不足, 导致 API设计以及内部实现都有些混乱, 因此这次算是一次全面的重构, 所以使用了 3.0.0 的大版本进行发布 😊

## 快速上手 vue-filter-box

vue-filter-box 在使用上非常简单, 这里也非常简单地举个 🌰 (例子):

```html
<template>
  <vue-filter-box :value="filterValue" :model="model" :width="220">
    <template v-slot:footer>
      <i-button>提交</i-button>
    </template>
  </vue-filter-box>
</template>

<script>
import { VueFilterBox } from 'vue-filter-box';

export default {
  components: {
    VueFilterBox,
  },
  data() {
    return {
      model: [
        {
          type: 'i-input',
          label: 'Keyword',
          key: 'keyword',
          props: {
            placeholder: 'Please input',
          },
        },
        {
          type: 'i-select',
          label: 'Type',
          key: 'type',
          options: [
            { label: 'Type1', value: 'type1' },
            { label: 'Type2', value: 'type2' },
          ],
          props: {
            placeholder: 'Please select',
          },
        },
      ],
      filterValue: {},
    };
  },
}
</script>
</script>
```

`model` 是 vue-filter-box 的核心组成部分, 由 `modelItem` 构成; `modelItem` 是构成整个筛选器的筛选项; 比如上面的 `model`, 将会生成一个由输入框和下拉框构成的筛选器:

![筛选器预览](/imgs/vue-filter-box.jpg)

`type` 表示筛选项组件, 你可以使用字符串, 比如: `i-input`, 但请确保该组件已经全局注册; 你也可以传入一个 Vue Component, 具体可以查看 [v3 文档](https://github.com/ruofee/vue-filter-box#%E7%AD%9B%E9%80%89%E9%A1%B9%E7%BB%84%E4%BB%B6)!

`value` 是 vue-filter-box 的筛选项选中值, 例如: 你在筛选器输入框中输入 `yaking shaking`, 下拉框选中 `Type1`, 则对应的 `value` 将会如下:

```js
{
  keyword: 'yaking shaking',
  type: 'type1'
}
```

因此, 你也可以通过修改 `value` 从而修改筛选器选中值~

## vue-filter-box 的其他功能

1. 支持 loading, 同时支持自定义 loading 样式
2. 支持 disabled
3. 支持 size 设置: `default`, `small`, `large`, 请确保你使用的组件支持设置 `size`
4. 支持自定义筛选项标题, 具体查看 [v3 文档](https://github.com/ruofee/vue-filter-box#%E7%AD%9B%E9%80%89%E9%A1%B9%E6%A0%87%E9%A2%98)
5. 支持垂直布局
6. 筛选项以及筛选项标题支持更加宽松的宽度设置
7. 支持筛选器校验, 单个筛选项校验, 筛选器重置, 单个筛选项重置
8. 比较强迫症的功能: 筛选器组件别名!

筛选器组件别名是一个比较适合强迫症用户的功能, 你可以通过设置筛选项组件别名, 比如:

```js
{
  input: 'i-input',
  select: 'i-select',
}
```

后面筛选项组件设置为 `input` 便等同于 `i-input`...

"好暖的功能!"

## 仓库地址

Github 地址: [vue-filter-box](https://github.com/ruofee/vue-filter-box)

如果觉得对你有所帮助, 可以在你的项目中安装进行使用, 或是给个 star ⭐️!

## 问题反馈

如果发现组件中存在的问题或是不足，可以提交你的问题到 [github issue](https://github.com/ruofee/vue-filter-box/issues), 或提交一个 Pull Request, 感谢你的参与!

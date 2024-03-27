---
title: "由一次 try...catch 异常引发的设计思考"
date: 2024/2/22
banner: http://img.ruofee.cn/code
---

最近写代码遇到一个 Bug，进而引发了一些关于网络请求设计相关的思考。

## 背景

在日常的前端开发中，存在大量与网络请求相关的场景，举个例子：

```jsx
function fetchData() {
    // 模拟请求
    return Promise.resolve({
        name: 'ruofee',
    });
}

const Page = () => {
    const [data, setData] = useState();
    const getData = () => {
        fetchData()
            .then(res => {
                setData(data.name);
            }, err => {
                toast.error('请求异常');
            });
    };
    return (
        <div>
            <button onClick={getData}>获取数据</button>
            {
                data && <p>data: {data}</p>
            }
        </div>
    );
};
```

这是一个 React 的例子：用户点击按钮后发起网络请求，并在请求返回后将其展示到页面中；若请求失败，则会捕获错误并进行 toast 提示。

大量的 Promise 写法会影响代码的可读性，秉持着“写代码要优雅”的理念，我们使用 async/await 代替 Promise，并使用 try...catch 捕获错误：

```jsx
const getData = async () => {
    try {
        const data = await fetchData();
        setData(data.name);
    } catch (err) {
        toast.error('请求异常');
    }
};
```

细心的朋友已经发现了，上面的代码存在“瑕疵”：当 `setData(data.name)` 发生报错时，同样会被 try...catch 捕获到，并触发错误提示。

在真实场景中，业务逻辑更为复杂，或许是一时粗心写出来的语法错误，又或许是某个数据处理不当导致的错误，但由于 try...catch 的过度捕获，导致错误淹没于代码海洋中，只展示一段不知所谓的 toast；而若你足够粗心 0.0，这个简单的错误甚至会被发布到生产环境中……

## 如何解决

### 缩小 try...catch 范围

把 try...catch 范围缩小，仅包含目标网络请求函数：

```jsx
const getData = async () => {
    let data;
    try {
        data = await fetchData();
    } catch (err) {
        toast.error('请求异常');
        return;
    }
    setData(data.name);
};
```

但在外层定义一个 `data` 什么的，也太不“优雅”了！作为一个“优雅”的程序员，自然是不考虑这种写法 🐶

于是 await-to-js 闪亮登场！

### await-to-js

[await-to-js](https://github.com/scopsy/await-to-js) 是一个 async/await 的错误捕获方案，当异步函数发生报错时，await-to-js 会捕获并将错误作为数组的第一项进行返回：

```jsx
import { to } from 'await-to-js';

const getData = async () => {
    const [error, data] = await to(fetchData());
    if (error) {
        toast.error('请求异常');
        return;
    }
    setData(data.name);
};
```

在使用 await-to-js 进行改造后，错误捕获范围缩小到目标网络请求函数，并且不再需要麻烦的 try...catch 了，代码变得更加优雅！

await-to-js 的原理其实很简单，源码如下：

```ts
export function to<T, U = Error> (
  promise: Promise<T>,
  errorExt?: object
): Promise<[U, undefined] | [null, T]> {
  return promise
    .then<[null, T]>((data: T) => [null, data])
    .catch<[U, undefined]>((err: U) => {
      if (errorExt) {
        const parsedError = Object.assign({}, err, errorExt);
        return [parsedError, undefined];
      }

      return [err, undefined];
    });
}

export default to;
```

当异步函数发生错误时，await-to-js 返回 `[error, undefined]`，当异步函数正常返回时，await-to-js 返回 `[null, data]`。

## 设计思考

await-to-js 对比 try...catch 确实优雅了许多，也解决了 try...catch 使用不当导致错误捕获范围过大的问题，但思考过后，我认为这不是一个最佳的设计思路，举个例子：

```jsx
import { to } from 'await-to-js';

const onSubmit = async () => {
    // 上传文件
    const [uploadFileError, fileId] = await to(uploadFile());
    if (uploadFileError) {
        toast.error('上传文件异常');
        return;
    }

    // 提交表单
    const params = {
        fileId,
        // 表单的其他值
        ...formValue,
    };
    const [submitError] = await to(submitForm(params));
    if (submitError) {
        toast.error('提交表单异常');
        return;
    }
    
    toast.success('提交成功');
};
```

这个例子也是一个常见的业务场景 - 表单提交，主要分为两步：

1. 上传文件；
2. 将返回的文件 ID 和其他表单值组合并发送到服务端，完成表单提交；

在上面的例子中，我们使用 await-to-js 对两个网络请求函数进行包装，并进行定制化的错误处理；而在更为复杂的场景中，若存在 n 个网络请求，那就麻烦了：我们需要包装 n 次 await-to-js，并进行 n 次错误处理！最终错误处理和主流程代码完全耦合在一起，对这种情况，四个字总结：“很不优雅”。

那么，如何设计才能做到：

1. try...catch 不过度捕获错误；
2. “优雅” ；
3. 错误处理和主流程代码实现解耦；

终于进入今天的主题了！首先，我们可以维护一个错误的枚举，代表每个网络请求的错误类型：

```js
const ErrorConstants = {
    UploadFile = Symbol(),
    SubmitData = Symbol(),
};
```

再对网络请求函数进行改造，在网络请求发生异常时，返回对应的错误类型：

```js
function uploadFile() {
    return Promise.reject({
        type: ErrorConstants.UploadFile,
    });
}
```

PS：这里只是模拟网络请求发生错误时返回的错误类型，在真实业务场景中，这部分功能应该在网络请求模块中进行统一实现（当网络请求发生错误时，网络请求模块返回对应的错误类型）。

接着，使用 try...catch 在最外层进行错误捕获，当捕获到错误时，再根据错误类型进行对应的错误处理：

```js
const onSubmit = async () => {
    try {
        const fileId = await uploadFile();
        const params = {
            fileId,
            // 表单的其他值
            ...formValue,
        };
        await submitData(params);
    } catch (error) {
        if (!error?.type) {
            console.error(error);
            return;
        }
        switch(error?.type) {
            case ErrorConstants.UploadFile: {
                toast.error('上传文件异常');
                return;
            }
            case ErrorConstants.SubmitData: {
                toast.error('提交表单异常');
                return;
            }
        }
    }
};
```

catch 逻辑中做了一步关键处理，当捕获到的错误不存在错误类型时，我们会使用 `console.error` 将错误打印到控制台中，让其与正常语法错误行为保持一致。

这种设计完美地将错误处理逻辑和主流程逻辑进行解耦，同时用户也不再需要思考 try...catch 是否会过度捕获错误，而单个的 try...catch 也提升了代码的可读性，真是“优雅”！

唯一的代价是**需要对网络请求模块进行封装，在发生异常时返回特定的错误类型**。

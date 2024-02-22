---
title: "由一次 try...catch 异常引发的设计思考"
date: 2024/2/22
banner: http://img.ruofee.cn/code
---

最近写代码遇到一个 Bug，进而引发了一些关于异步任务设计相关的思考。

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
                setData(res.name);
            })
            .catch(err => {
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

这是一个 React 的例子：页面中有一个按钮，用户点击按钮之后发起请求，在请求返回时展示到页面中；如果请求失败，则会捕获错误并进行 toast 提示。大量的 Promise 写法会影响代码的可读性，秉持着“写代码要优雅”的理念，我们使用 async/await 代替 Promise，并使用 try...catch 捕获错误：

```jsx
const getData = async () => {
    try {
        const data = await fetchData();
        setData(res.name);
    } catch (err) {
        toast.error('请求异常');
    }
};
```

细心的朋友已经发现了，上面的代码存在瑕疵：当 `setData(res.name)` 发生报错时，同样会被 try...catch 捕获到，并触发错误提示。你或许会问：`setData(res.name)` 这么简单的代码怎么会报错，但如果是更为复杂的数据处理逻辑呢，可能是一时粗心写出来的语法错误，但因为 try...catch 的异常捕获，导致错误没被及时发现，甚至会造成更为严重的后果……

## 如何解决

### 缩小 try...catch 范围

把 try...catch 范围缩小，仅包含目标异步函数：

```jsx
const getData = async () => {
    let data;
    try {
        data = await fetchData();
        setData(res.name);
    } catch (err) {
        toast.error('请求异常');
    }
};
```

但在外层定义一个 `data` 什么的，也太不“优雅”了！作为一个“优雅”的程序员，自然是不考虑这种写法 🐶

于是 await-to-js 闪亮登场！

### await-to-js

[await-to-js](https://github.com/scopsy/await-to-js) 是一个 async/await 的错误捕获方案，能够捕获异步函数的错误，并作为数组的第一项进行返回：

```jsx
import { to } from 'await-to-js';

const getData = async () => {
    const [error, data] = await to(fetchData());
    if (error) {
        toast.error('请求异常');
        return;
    }
    setData(res.name);
};
```

在使用 await-to-js 进行改造后，错误捕获粒度缩小到目标异步函数，并且不再需要麻烦的 try...catch 了，代码变得更加优雅！

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

    // 对 fileId 进行处理
    const _fileId = resolveFileId(fileId);

    // 提交表单
    const [submitError] = await to(submit(fileId));
    if (submitError) {
        toast.error('提交表单异常');
        return;
    }
    
    toast.success('提交成功');
};
```

这个例子也是一个常见的业务场景 - 表单提交，主要分为以下两步：

1. 上传文件；
2. 将上一步返回的文件 ID 作为参数发送到服务端；

在上面的例子中，我们使用 await-to-js 包装两个异步请求函数，并在调用后判断 error 是否为 `null`，再对每个错误进行定制化的处理……而在更为复杂的场景，可能存在 n 个异步请求函数，那么我们需要包装 n 次 await-to-js，并在每次调用后再进行定制化的错误处理……没错，这很麻烦，也导致错误处理和主流程代码耦合在一起，只能说：“很不优雅！”

那么如何设计才能做到：

1. try...catch 不过度捕获错误；
2. “优雅” ；
3. 错误处理和主流程代码解耦；

终于进入今天的主题了！首先，我们可以维护一个错误的枚举，代表每个网络请求的错误类型：

```js
const ErrorConstants = {
    UploadFile = 'UploadFile',
    Submit = 'Submit',
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

PS：这里只是模拟网络请求发生错误时返回的错误类型，事实上，在真实业务场景中，这部分功能应该在网络请求模块中进行统一实现！

使用 try...catch 在最外层进行错误捕获，当捕获到错误时，再进行错误类型判断：

```js
const onSubmit = async () => {
    try {
        const fileId = await uploadFile();
        // 对 fileId 进行处理
        const _fileId = resolveFileId(fileId);
        await submit(fileId);
    } catch (error) {
        switch(error) {
            case ErrorConstants.UploadFile: {
                toast.error('上传文件异常');
                return;
            }
            case ErrorConstants.Submit: {
                toast.error('提交表单异常');
                return;
            }
        }
    }
};
```

这种设计成功将错误处理逻辑和主流程逻辑进行解耦，用户也不需要去考虑 try...catch 是否过度捕获，唯一的代价是**需要对网络请求模块进行封装，在发生异常时返回特定的错误类型**。
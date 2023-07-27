const fs = require('fs-extra')
const path = require('path')
const { promisify } = require('util')
const { to } = require('await-to-js')

const getPath = src => path.resolve(__dirname, src)
const blogPath = getPath('../docs/blog')

function getFileName(src) {
  const pathArr = src.split('/')
  const title = pathArr[pathArr.length - 1]
  const match = title.match(/^(.*)@[0-9]+\.md$/)
  return match?.[1] ? `${match?.[1]}.md` : title
}

function getFilePath(src, title) {
  const pathArr = src.split('/')
  pathArr[pathArr.length - 1] = title
  return pathArr.join('/')
}

async function coverFile(newPath, oldPath, content) {
  if (newPath !== oldPath) {
    const [removeError] = await to(fs.remove(oldPath))
    if (removeError) {
      throw removeError
    }
  }
  const [outputError] = await to(fs.outputFile(newPath, content, {
    encoding: 'utf-8',
  }))
  if (outputError) {
    throw outputError
  }
}

async function handleArticle(articlePath) {
  const [readFileError, content] = await to(promisify(fs.readFile)(articlePath, {
    encoding: 'utf-8',
  }))
  if (readFileError) {
    throw readFileError
  }
  let title = getFileName(articlePath)
  const matchConfigJson = content.match(/```config([\s\S]*?)```[\s\S]*/)
  const config = matchConfigJson?.[1]
  if (typeof config === 'undefined') {
    const newArticlePath = getFilePath(articlePath, title)
    await coverFile(newArticlePath, articlePath, content)
    return
  }
  try {
    const configJson = JSON.parse(config)
    let text = '---'
    const keys = Object.entries(configJson)
    keys.forEach(([key, value], index) => {
      if (key === 'title') {
        title = `${value}.md`
        text += (`\n${key}: ${JSON.stringify(value)}`)
      } else {
        text += `\n${key}: ${value}`
      }
      if (index === keys.length - 1) {
        text += '\n---'
      }
    })
    const newArticlePath = getFilePath(articlePath, title)
    const matchArticleContent = content.match(/```config([\s\S]*?)```([\s\S]*)?/)?.[2] || '';
    await coverFile(newArticlePath, articlePath, text + matchArticleContent)
    console.log(`处理完成：${title}`);
  } catch(err) {
    throw err
  }
}

async function transDir(dirPath) {
  const [error, dir] = await to(promisify(fs.readdir)(dirPath))
  if (error) {
    throw error
  }
  for (const item of dir) {
    const itemPath = path.join(dirPath, item)
    const [lstatError, stat] = await to(promisify(fs.stat)(itemPath))
    const isDir = !lstatError && stat.isDirectory()
    if (isDir) {
      await transDir(itemPath)
    } else {
      handleArticle(itemPath)
    }
  }
}

(async function start() {
  transDir(blogPath)
})()

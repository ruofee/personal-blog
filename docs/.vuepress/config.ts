import { defineUserConfig } from 'vuepress'
import VuepressThemeBlue, { LinkType } from 'vuepress-theme-blue'

const title = 'Ruofee的博客'

export default defineUserConfig({
  title,
  description: '欢迎来到Ruofee的博客',
  theme: VuepressThemeBlue({
    website: {
      name: title,
      footers: ['备案号: 粤ICP备17107892号-1'],
      ensureAboutMe: true,
      hostname: 'http://ruofee.cn',
    },
    user: {
      username: 'Ruofee',
      description: '终不似, 少年游',
      avatar: 'http://img.ruofee.cn/headImage?imageslim',
      links: [
        {
          type: LinkType.Email,
          value: 'ruofee@126.com',
        },
        {
          type: LinkType.Github,
          value: 'https://github.com/ruofee',
        },
        {
          type: LinkType.Zhihu,
          value: 'https://www.zhihu.com/people/chen-ruo-feng-e',
        },
      ],
    },
    home: {
      pageSize: 10,
    },
    comment: {
      enable: true,
      option: {
        repo: 'ruofee/personal-blog',
        repoId: 'R_kgDOKAVpRw',
        category: 'Announcements',
        categoryId: 'DIC_kwDOKAVpR84CYKi6',
        theme: 'light',
        mapping: 'pathname',
        lang: 'zh-CN',
        loading: 'lazy',
        inputPosition: 'top',
        reactionsEnabled: '0',
      }
    },
  }),
})

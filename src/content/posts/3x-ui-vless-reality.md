---
title: 2026 3X-UI 搭建教程：VLESS + REALITY 小白保姆级教程，从零搭建专属 VPS 节点
published: 2026-08-24
description: "从买 VPS、域名托管 Cloudflare，到安装 3X-UI 面板、创建 VLESS + REALITY 节点、电脑手机客户端配置，再到 UFW 防火墙放通端口的完整图文流程。"
image: "./images/3x-ui/cover.avif"
tags: [3x-ui, vps, 教程, REALITY+VLESS]
category: "教程"
draft: false
---

## 一、准备工作

### 购买一个优化线路 VPS

推荐是购买带线路优化的机器，像 dmit、搬瓦工、gomami 等；

### 注册一个 Cloudflare 账号，托管域名使用

注册地址：https://dash.cloudflare.com

### 购买一个域名或者是注册一个免费域名并托管 Cloudflare

推荐是购买一个 xyz 的域名，主要是便宜，一年 5 块不到，购买地址：https://www.spaceship.com
免费域名注册地址：https://dashboard.katabump.com
登录官网注册域名

![](./images/3x-ui/s01.avif)

![](./images/3x-ui/s02.avif)

注册完成

![](./images/3x-ui/s03.avif)

域名托管 Cloudflare
进入域名设置，找到 NS 设置记录

![](./images/3x-ui/s04.avif)

![](./images/3x-ui/s05.avif)

登录 Cloudflare 添加托管域名

![](./images/3x-ui/s06.avif)

![](./images/3x-ui/s07.avif)

![](./images/3x-ui/s08.avif)

![](./images/3x-ui/s09.avif)

![](./images/3x-ui/s10.avif)

![](./images/3x-ui/s11.avif)

获取 Cloudflare 的 NS 记录配置到域名

![](./images/3x-ui/s12.avif)

回到域名平台页面，添加 NS 记录

![](./images/3x-ui/s13.avif)

配置完成

![](./images/3x-ui/s14.avif)

回到 Cloudflare 界面，即可看到域名状态显示活跃状态，即表示托管完成。

![](./images/3x-ui/s15.avif)

### 域名绑定 VPS 的 IP

进入 Cloudflare 平台进入域名 DNS 记录界面

![](./images/3x-ui/s16.avif)

![](./images/3x-ui/s17.avif)

![](./images/3x-ui/s18.avif)

添加 DNS 记录： 输入的是 VPS 的 IP

![](./images/3x-ui/s19.avif)

添加完成后确认域名是否绑定成功，win 键+R 键，输入`cmd`回车打开

![](./images/3x-ui/s20.avif)

输入`nslookup 域名` 然后回车，看出来的 IP 是否有 VPS 的 IP，有的话即成功，没有的话需要等待下，解析有的不会很快，可以进行下面的步骤。

![](./images/3x-ui/s21.avif)

下载并安装电脑连接 VPS 的工具 FinalShell：https://www.hostbuf.com/t/988.html

![](./images/3x-ui/s22.avif)

## 二、安装 3X-UI 并搭建节点

### 打开 FinalShell 连接 VPS

![](./images/3x-ui/s23.avif)

输入 VPS 连接信息

![](./images/3x-ui/s24.avif)

![](./images/3x-ui/s25.avif)

![](./images/3x-ui/s26.avif)

### 安装 3X-UI

3X-UI 项目地址：https://github.com/MHSanaei/3x-ui

安装命令：

```bash
bash <(curl -Ls https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh)
```

粘贴命令后回车，等待安装完成

![](./images/3x-ui/s27.avif)

数据库选择，默认 1 即可

![](./images/3x-ui/s28.avif)

为面板设置登录端口，默认即可，直接回车

![](./images/3x-ui/s29.avif)

为面板设置域名证书，输入 1 然后回车

![](./images/3x-ui/s30.avif)

输入域名，并回车

![](./images/3x-ui/s31.avif)

为域名设置证书端口，默认即可

![](./images/3x-ui/s32.avif)

域名证书是否自动续签，默认续签，回车即可

![](./images/3x-ui/s33.avif)

确认是否安装

![](./images/3x-ui/s34.avif)

安装完成，显示面板登录信息

![](./images/3x-ui/s35.avif)

### 面板设置

启动面板

![](./images/3x-ui/s36.avif)

开启 BBRtcp 调优加速功能，选择 26

![](./images/3x-ui/s37.avif)

选择 1 开启

![](./images/3x-ui/s38.avif)

开启成功显示的状态

![](./images/3x-ui/s39.avif)

### 登录面板创建节点

使用登录信息在浏览器登录面板

![](./images/3x-ui/s40.avif)

登录成功后进行面板界面，显示服务器的运行状态

![](./images/3x-ui/s41.avif)

创建节点前先更改下订阅节点的路径设置

![](./images/3x-ui/s42.avif)

![](./images/3x-ui/s43.avif)

更改设置后一定要重启面板，否则设置不会生效

![](./images/3x-ui/s44.avif)

添加入站节点

![](./images/3x-ui/s45.avif)

这里端口默认随机即可，如要自定义。建议使用 5 位数以上的端口，避免被扫。

![](./images/3x-ui/s46.avif)

![](./images/3x-ui/s47.avif)

伪装网址也可以自定义，不一定这里选。推荐大厂微软、特斯拉等

![](./images/3x-ui/s48.avif)

滑到底部填写最小的版本号 1.0.0 然后创建，避免节点无法使用。

![](./images/3x-ui/s49.avif)

创建完成后显示是节点信息

![](./images/3x-ui/s50.avif)

创建客户端并关联入站

![](./images/3x-ui/s51.avif)

这里的关联入站节点，如果你创建了多个入站节点，可以关联多个。

![](./images/3x-ui/s52.avif)

![](./images/3x-ui/s53.avif)

创建完成后显示客户端，我们使用搭建节点通过这个客户端连接信息进行使用

![](./images/3x-ui/s54.avif)

### 节点使用

#### 电脑使用

前提：电脑安装 v2rayN，下载地址https://github.com/2dust/v2rayN/releases

选择节点使用方式：订阅方式

![](./images/3x-ui/s55.avif)

复制订阅信息，打开 v2

![](./images/3x-ui/s56.avif)

可以直接 ctrl+v 粘贴

![](./images/3x-ui/s57.avif)

粘贴后显示订阅分组：import_sub

![](./images/3x-ui/s58.avif)

订阅形式需要更新订阅后才显示可用节点，也就是创建客户端的时候关联的节点。

![](./images/3x-ui/s59.avif)

更新后显示节点

![](./images/3x-ui/s60.avif)

测试节点是否正常

![](./images/3x-ui/s61.avif)

开启 v2 开关使用，全局模式或者规则，看个人使用情况。

规则模式：像一个智能导航，根据设定的规则(比如“访问谷歌走 A 路，访问百度走 B 路”)来决定每条流量的路径。访问国外网站走代理，访问国内网站直连；

全局模式:像一个强制命令，所有网络流量不管目的地是哪里，都强制通过代理通道。“不管去哪都翻”，所有流量全走代理。

![](./images/3x-ui/s62.avif)

浏览器访问 IP111.cn 查看 IP 是否是 VPS 的 IP，是的话就说明成功。

![](./images/3x-ui/s63.avif)

选择节点使用方式：节点方式

![](./images/3x-ui/s64.avif)

复制信息后直接在 v2 里面粘贴，即可直接显示节点信息，不需要更新订阅操作，然后跟订阅的使用方式一样，直接测速，正常后同样的使用方式。

![](./images/3x-ui/s65.avif)

开启 v2 开关使用，全局模式或者规则，看个人使用情况。

![](./images/3x-ui/s62.avif)

浏览器访问 IP111.cn 查看 IP 是否是 VPS 的 IP，是的话就说明成功

![](./images/3x-ui/s63.avif)

#### 手机使用

苹果使用小火箭，安卓使用 v2rayNG、nekobox

手机直接扫码二维码即可添加节点，订阅模式和节点模式是一样的，都是扫描后直接显示节点，只是显示位置不一样

![](./images/3x-ui/s66.avif)

以下是苹果手机的使用方式

![](./images/3x-ui/s67.avif)

## 三、VPS 安装防火墙并放通端口

### 使用 FinalShell 连接上 VPS

![](./images/3x-ui/s68.avif)

### 查看 VPS 防火墙状态

输入`sudo ufw status` 回车查看

![](./images/3x-ui/s69.avif)

PS：这个是状态是没有安装防火墙，所以需要先进行安装

### 安装防火墙并开启

输入`apt update`回车更新软件包列表

![](./images/3x-ui/s70.avif)

输入`apt install ufw -y` 回车安装防火墙，并等待安装完成

![](./images/3x-ui/s71.avif)

安装完成，并输入`sudo ufw status` 回车查看防火墙状态

![](./images/3x-ui/s72.avif)

开启防火墙开启前先放通 22 端口，避免开通后连不上 VPS 输入`ufw allow 22/tcp`回车

![](./images/3x-ui/s73.avif)

输入`sudo ufw enable` 回车开启防火墙

![](./images/3x-ui/s74.avif)

### 查看目前已放通的端口，并手动放通入站节点端口

输入`ufw status numbered` 查看当前放通端口有哪些

![](./images/3x-ui/s75.avif)

通过`ufw status numbered`命令查看到当前防火墙只放通了 22 端口，面板其他的使用端口并未放通，需要手动放通，否则面板服务都无法使用，以下是需要放通的端口：`443`、`80`、`2053`、`2096`
分别输入命令放通：`ufw allow 需要放通的端口号/tcp`

![](./images/3x-ui/s76.avif)

放通面板的登录端口和入站节点端口
登录端口：安装面板时候自定义登录端口或者是默认随机端口，例如：
`https://testbiji.kdns.fr:33957/fFkUUbWN77PperxBy9/panel/clients`

其中 `33957` 就是登录端口，也就是需要放通的端口：
`ufw allow 33957/tcp`

![](./images/3x-ui/s77.avif)

放通入站端口在创建入站的时候自动分配的端口或者是自定义端口，在入站为准查看
这里是用的 20408，放通端口就是 20408

![](./images/3x-ui/s78.avif)

![](./images/3x-ui/s79.avif)

放通后我们可以通过`ufw status numbered`命令查看当前放通了几个端口

![](./images/3x-ui/s80.avif)

注意事项：如果后续新增入站节点，每次新增都需要连接 VPS 单独放通对应端口，否则节点是无法使用。
PS：如果是多个朋友拼车使用，建议是一个人一个入站节点，别一起共用。

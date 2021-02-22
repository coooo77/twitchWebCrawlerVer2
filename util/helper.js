const fs = require('fs');
const cp = require('child_process');
const readline = require('readline');
const twitchStreams = require('twitch-get-stream')
const checkDiskSpace = require('check-disk-space')

const {
  url,
  loginSetting,
  recordSetting,
  seedUsersDataSetting,
  checkDiskSpaceAction,
} = require('../config/config');

const {
  prefix,
  maxTryTimes,
  reTryInterval,
  isRecordEveryOnlineChannel,
  stopRecordDuringReTryInterval,
  locationOfDiskWhereRecordSaved,
  locationOfFolderWhereRecordSaved,
} = recordSetting

const { app, sorter } = require('../config/announce');
const { login, homePage, VOD } = require('../config/domSelector');


const helper = {
  wait(ms) {
    return new Promise(resolve => setTimeout(() => resolve(), ms))
  },
  announcer(message, type = 'system') {
    if (type === 'system') {
      console.log(`[SYSTEM] ${message}`)
    } else if (type === 'warn') {
      console.log(`\n[WARNING] ${message}` + '\n')
    } else if (type === 'time') {
      console.log(`\n[ LOG ] ${message}`)
    } else if (type === 'mode') {
      console.log(`[MODE] ${message}`)
    }
  },
  manualInput(msg) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise(resolve => {
      rl.question(msg, answer => {
        rl.close()
        resolve(answer)
      })
    })
  },

  async getAccountAndPassword() {
    if (loginSetting.isManual) {
      helper.announcer(app.manualLogin, 'mode')
      account = await helper.manualInput(app.askAccount)
      password = await helper.manualInput(app.askPassword)
    } else {
      account = process.env.TWITCH_ACCOUNT
      password = process.env.TWITCH_PASSWORD
    }
    if (!account || !password) {
      helper.announcer(app.noDataInfo, 'warn')
      return
    }
    return { account, password }
  },

  async checkDiskSpace() {
    const { free, size } = await checkDiskSpace(locationOfDiskWhereRecordSaved)
    const { type, below } = checkDiskSpaceAction.judgeBy
    const { unit, digit, number } = below
    let spaceLeft, info, limit
    switch (unit) {
      case 'percentage':
        spaceLeft = (free / size) * 100
        info = `${spaceLeft.toFixed(digit)} %`
        limit = `${number} %`
        break;
      case 'MB':
        spaceLeft = (free / type.MB)
        info = `${spaceLeft.toFixed(digit)} MB`
        limit = `${number} MB`
        break;
      case 'GB':
        spaceLeft = (free / type.GB)
        info = `${spaceLeft.toFixed(digit)} GB`
        limit = `${number} GB`
        break;
      case 'TB':
        spaceLeft = (free / type.TB)
        info = `${spaceLeft.toFixed(digit)} TB`
        limit = `${number} TB`
        break;
      default:
    }
    helper.announcer(app.recordAction.checkFreeDiskSpace.freeSpace(info, limit))
    return spaceLeft > number
  },

  async checkChannelStatus(twitchID) {
    let result
    try {
      await twitchStreams.get(twitchID)
    } catch (error) {
      result = error.response.status
    } finally {
      return result !== 404
    }
  },

  async checkLivingChannel(onlineStreamsData, isStreaming, usersData, vodRecord) {
    const { livingChannel } = app.recordAction
    helper.announcer(livingChannel.checkStatus)
    const livingChannelList = onlineStreamsData.map(channel => channel.twitchID)
    if (isStreaming.ids.length !== 0) {
      for (let i = isStreaming.ids.length - 1; i >= 0; i--) {
        const targetID = isStreaming.ids[i]
        if (livingChannelList.includes(targetID)) {
          helper.announcer(livingChannel.userIsStillStreaming(targetID))
        } else {
          const isChannelOnline = await helper.checkChannelStatus(targetID)
          if (isChannelOnline) {
            helper.announcer(livingChannel.userIsStillStreaming(targetID))
          } else {
            helper.announcer(livingChannel.userClosesStreaming(targetID))
            // 下線 => 開始錄製VOD
            helper.recordVOD(usersData, targetID, vodRecord)
          }
        }
      }
    } else {
      helper.announcer(livingChannel.isNoLivingChannel)
    }
  },
  async startToRecordStream(onlineStreamsData, isStreaming, usersData, vodRecord, dirName, page) {
    helper.announcer(app.recordAction.record.start)
    for (let i = 0; i < onlineStreamsData.length; i++) {
      const { twitchID, streamTypes } = onlineStreamsData[i]

      let user = usersData.records.find(user => user.twitchID === twitchID)

      if (isRecordEveryOnlineChannel) {
        if (!user) {
          helper.announcer(app.noUserInfo(twitchID))
          user = modelHandler.addUserToUsersData(usersData, twitchID)
        }
        if (!user.isRecording) helper.checkStreamTypeAndRecord(user, streamTypes, twitchID, usersData, isStreaming, dirName)
      } if (user) {
        const { isActive, isStopRecordOnlineStream } = user.enableRecordVOD
        // 檢查是否有新的VOD可以下載
        if (isActive) {
          await webHandler.checkVODRecord(user, page, vodRecord)
        }
        // 下載實況或VOD
        if (!user.enableRecord) {
          helper.announcer(app.userRecordDisabled(twitchID, 'enableRecord'))
        } else if (isActive && isStopRecordOnlineStream) {
          helper.announcer(app.userRecordDisabled(twitchID, 'isStopRecordOnlineStream'))
          if (!isStreaming.ids.includes(user.twitchID)) {
            modelHandler.upDateJsonFile(isStreaming, user)
          }
        } else if (!user.isRecording) {
          helper.checkStreamTypeAndRecord(user, streamTypes, twitchID, usersData, isStreaming, dirName)
        }
      }
    }
  },

  checkStreamTypeAndRecord(user, streamTypes, twitchID, usersData, isStreaming, dirName) {
    const recordingUser = isStreaming.records.find(user => user.twitchID === twitchID)
    const isInRetryInterval = recordingUser ? (Date.now() - recordingUser.createdTime) < (reTryInterval * maxTryTimes * 1000) : false
    const { checkStreamContentType } = user
    const { isActive, targetType } = checkStreamContentType
    if (isActive && !targetType.includes(streamTypes)) {
      helper.announcer(app.recordAction.record.stop(twitchID, 'type'))
    } else if (stopRecordDuringReTryInterval && recordingUser && isInRetryInterval) {
      helper.announcer(app.recordAction.record.stop(twitchID, 'interval'))
      // 需要確認usersData是否正在錄影
    } else if (!recordingUser) {
      helper.recordStream(user, usersData, isStreaming, dirName)
    }
  },
  recordStream(user, usersData, isStreaming, dirName) {
    helper.announcer(app.recordAction.record.findOnlineUser(user.twitchID))
    modelHandler.upDateIsRecording(usersData, user.twitchID, true)
    modelHandler.upDateJsonFile(isStreaming, user)
    downloadHandler.record(user.twitchID, dirName)
  },

  async recordVOD(usersData, targetID, vodRecord) {
    if (vodRecord.pending[targetID]) {
      const user = usersData.records.find(user => user.twitchID === targetID)
      const { enableRecordVOD } = user
      let downloadTime
      switch (enableRecordVOD.mode) {
        case 'manual':
          await modelHandler.addReadyData(vodRecord, targetID)
          break
        case 'isAutoStartRecordAfterStreamerOffLine':
          const pendingRecord = vodRecord.pending[targetID]
          await modelHandler.addReadyData(vodRecord, targetID)
          for (let index = 0; index < pendingRecord.length; index++) {
            await setTimeout(async () => await downloadHandler.downloadVOD(twitchID, record.url), 100 * (index + 1))
          }
          break
        case 'countdownTimer':
          downloadTime = (enableRecordVOD.countdownTimer * 1000 * 60) + Date.now()
          await modelHandler.addReadyData(vodRecord, targetID, downloadTime)
          break
        case 'specificTimeZone':
          const timeNow = new Date()
          const { hour, minute, second } = enableRecordVOD.specificTimeZone
          downloadTime = new Date(
            timeNow.getFullYear(),
            timeNow.getMonth(),
            timeNow.getDate(),
            hour,
            minute,
            second
          )
          if (timeNow > downloadTime) {
            downloadTime = new Date(
              timeNow.getFullYear(),
              timeNow.getMonth(),
              timeNow.getDate() + 1,
              hour,
              minute,
              second
            )
          }
          await modelHandler.addReadyData(vodRecord, targetID, Date.parse(downloadTime))
          break
        default:
          throw new Error(`Can not find recordVOD mode config, user:${targetID}`)
      }
    } else {
      return
    }
  }
}

const downloadHandler = {
  async execFile(fileName, dirName, twitchID) {
    cp.exec(
      'start ' + dirName + `\\recorder\\${fileName}.bat`,
      async (error, stdout, stderr) => {
        if (!error) {
          helper.announcer(app.recordAction.record.end(twitchID))
          const [isStreaming, usersData] = await Promise.all([
            modelHandler.getJSObjData('./model/isStreaming.json'),
            modelHandler.getJSObjData('./model/usersData.json'),
          ])

          await Promise.all([
            modelHandler.removeRecord(isStreaming, twitchID), modelHandler.upDateIsRecording(usersData, twitchID, false)
          ])
        }
      })
  },

  commandMakerForVOD(twitchID, url, timeString) {
    if (!timeString) timeString = downloadHandler.getTimeString()
    const videoID = url.split('videos/')[1]
    return `streamlink ${url} best -o ${locationOfFolderWhereRecordSaved}\\${prefix}${twitchID}_TwitchLive_${timeString}_ID_${videoID}.mp4`
  },

  getTimeString() {
    const time = new Date()
    const [
      year,
      month,
      date,
      hour,
      minute,
      second
    ] = [
        String(time.getFullYear()),
        String(time.getMonth() + 1).padStart(2, '0'),
        String(time.getDate()).padStart(2, '0'),
        String(time.getHours()).padStart(2, '0'),
        String(time.getMinutes()).padStart(2, '0'),
        String(time.getSeconds()).padStart(2, '0')
      ]
    return `${year}_${month}_${date}_${hour}${minute}${second}`
  },

  record(twitchID, dirName) {
    try {
      fs.accessSync(`./recorder/${prefix}${twitchID}.bat`, fs.constants.F_OK)
      helper.announcer(app.batchFile.isExist(twitchID))
    } catch (error) {
      helper.announcer(app.batchFile.isNotExist(twitchID))
      helper.announcer(app.batchFile.created(twitchID))
      fs.writeFileSync(`./recorder/${prefix}${twitchID}.bat`, downloadHandler.commandMaker(twitchID), (error) => {
        console.log(error);
      })
    } finally {
      downloadHandler.execFile(`${prefix}${twitchID}`, dirName, twitchID)
    }
  },

  commandMaker(twitchID) {
    return `
    @echo off\n
    set name=${twitchID}\n
    set url=https://www.twitch.tv/%name%\n
    set count=0\n
    :loop\n
    set hour=%time:~0,2%\n
    if "%hour:~0,1%" == " " set hour=0%hour:~1,1%\n
    set /a count+=1\n
    echo [CountDown] Loop for ${maxTryTimes} times, try %count% times ... \n
    streamlink --twitch-disable-hosting %url% best -o ${locationOfFolderWhereRecordSaved}\\${prefix}%name%_twitch_%DATE%_%hour%%time:~3,2%%time:~6,2%.mp4\n
    if "%count%" == "${maxTryTimes}" exit\n
    echo [CountDown] count down for ${reTryInterval} sec...\n
    @ping 127.0.0.1 -n ${reTryInterval} -w 1000 > nul\n
    goto loop
    `
  },

  async downloadVOD(targetID, url) {
    if (!url) return
    let vodRecord = await modelHandler.getJSObjData('./model/vodRecord.json')
    let recordIndex = vodRecord.ready.findIndex(record => record.url === url)
    let record = vodRecord.ready[recordIndex]

    record.status = 'downloading'
    vodRecord.onGoing.push(record)
    vodRecord.ready.splice(recordIndex, 1)

    modelHandler.sterilizeVodRecord(vodRecord, targetID, url, record)
    await modelHandler.saveJSObjData(vodRecord, 'vodRecord')

    const cmd = record.cmdCommand
    await cp.exec('start ' + cmd, async (error, stdout, stderr) => {
      vodRecord = await modelHandler.getJSObjData('./model/vodRecord.json')
      recordIndex = vodRecord.onGoing.findIndex(record => record.url === url)
      record = vodRecord.onGoing[recordIndex]

      record.status = error ? error.message : 'success'
      record.finishedTime = new Date().toLocaleString()

      vodRecord.onGoing.splice(recordIndex, 1)
      if (error) {
        vodRecord.error.push(record)
      } else {
        vodRecord.success.push(record)
      }

      modelHandler.sterilizeVodRecord(vodRecord, targetID, url, record)
      await modelHandler.saveJSObjData(vodRecord, 'vodRecord')
    })
  },

  async startToRecordVOD(vodRecord) {
    const { queue, ready } = vodRecord
    const timeNow = Date.now()
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i] > timeNow) {
        break
      } else {
        // 把有相同下載時間點的ready紀錄下載
        const readyArray = ready.filter(record => record.startDownloadTime === queue[i])

        for (let i = 0; i < readyArray.length; i++) {
          const { twitchID, url } = readyArray[i]
          // 使用IIFE看看 ya3ameeb
          await setTimeout(async () => await downloadHandler.downloadVOD(twitchID, url), 100 * (i + 1))
        }

        // queue.splice(i, 1) //sterilizeVodRecord取代該步驟
        await modelHandler.saveJSObjData(vodRecord, 'vodRecord')
      }
    }
  },
}

const modelHandler = {
  saveJSObjData(data, fileName = 'usersData', dirLocation = './model/') {
    return new Promise((resolve, reject) => {
      try {
        fs.writeFileSync(
          `${dirLocation}${fileName}.json`,
          JSON.stringify(data),
          'utf8',
          (error) => {
            console.log(error);
          })
        helper.announcer(app.upDate[`${fileName}`])
        resolve()
      } catch (error) {
        console.error(error)
        reject(error)
      }
    })
  },

  async getJSObjData(dataLocation) {
    let result = await fs.readFileSync(dataLocation, 'utf8', (err, data) => data)
    result = JSON.parse(result)
    return result
  },

  makeDirIfNotExist(info, location) {
    if (!fs.existsSync(location)) {
      helper.announcer(info.isNotExist)
      helper.announcer(info.startToCreateDirectory)
      fs.mkdirSync(location)
    }
  },

  async makeJsonIfNotExist(setting) {
    const { dataLocation, info, defaultData, fileName, fileLocation } = setting
    if (!fs.existsSync(dataLocation)) {
      helper.announcer(info.isNotExist)
      helper.announcer(info.startToCreate)
      await modelHandler.saveJSObjData(defaultData, fileName, fileLocation)
    }
  },

  async removeRecord(data, twitchID) {
    const recordsIndex = data.records.findIndex(record => record.twitchID === twitchID)
    const idsIndex = data.ids.findIndex(id => id === twitchID)
    data.ids.splice(idsIndex, 1)
    data.records.splice(recordsIndex, 1)
    await modelHandler.saveJSObjData(data, 'isStreaming')
  },

  async upDateIsRecording(data, userId, status) {
    const userIndex = data.records.findIndex(user => user.twitchID === userId)
    data.records[userIndex].isRecording = status
    await modelHandler.saveJSObjData(data, 'usersData')
  },

  addUserToUsersData(usersData, twitchID) {
    const user = {
      id: usersData.records.length,
      twitchID,
      ...seedUsersDataSetting
    }
    modelHandler.upDateJsonFile(usersData, user, 'usersData')
    return user
  },

  async upDateJsonFile(jsonFile, userData, file = 'isStreaming') {
    let record
    if (file === 'isStreaming') {
      record = {
        ...userData,
        createdTime: Date.now(),
        createdLocalTime: new Date().toLocaleString()
      }
    } else if (file === 'usersData') {
      record = userData
    }
    jsonFile.records.push(record)
    jsonFile.ids.push(userData.twitchID)
    await modelHandler.saveJSObjData(jsonFile, file)
  },

  arrayComparer(array, arrayCompared, arrayName, arrayComparedName) {
    helper.announcer(sorter.arrayLength(arrayName, array.length))
    for (element of array) {
      if (!arrayCompared.includes(element)) {
        helper.announcer(sorter.elementLoss(element, arrayComparedName))
      }
    }
  },

  async addReadyData(vodRecord, targetID, startDownloadTime = null) {
    const pendingData = vodRecord.pending[targetID]
    for (let index = 0; index < pendingData.length; index++) {
      const { url, timeString } = pendingData[index]
      if (!url) continue
      const isRecordExist = vodRecord.ready.some(record => record.url === url)
      if (isRecordExist) continue
      vodRecord.ready.push({
        twitchID: targetID,
        url,
        cmdCommand: downloadHandler.commandMakerForVOD(targetID, url, timeString),
        createdTime: Date.now(),
        createdLocalTime: new Date().toLocaleString(),
        status: 'not download yet',
        startDownloadTime,
        finishedTime: null
      })
    }

    if (startDownloadTime && !vodRecord.queue.includes(startDownloadTime)) {
      vodRecord.queue.push(startDownloadTime)
      vodRecord.queue.sort((a, z) => z - a)
    }

    delete vodRecord.pending[targetID]
    await modelHandler.saveJSObjData(vodRecord, 'vodRecord')
  },

  sterilizeVodRecord(vodRecord, targetID, url, readyRecord) {
    // 檢查pending、queue是否有重複資料(需要更好的邏輯，正常是不需要做這步驟的)
    if (vodRecord.pending[targetID] && vodRecord.pending[targetID].includes(url)) {
      const urlIndex = vodRecord.pending[targetID].pending.findIndex(record => record.url === url)
      vodRecord.pending[targetID].pending.splice(urlIndex, 1)
      if (vodRecord[targetID].pending.length === 0) {
        delete vodRecord.pending[targetID]
      }
    }

    if (vodRecord.queue.includes(readyRecord.startDownloadTime)) {
      const urlIndex = vodRecord.queue.findIndex(time => readyRecord.startDownloadTime === time)
      vodRecord.queue.splice(urlIndex, 1)
    }
  }
}

const webHandler = {
  async clickAndInput(page, selector, inputContent) {
    await page.click(selector)
    await page.keyboard.type(inputContent)
  },

  async clickAndNavigate(page, selector, waitTime,) {
    await helper.wait(waitTime)
    const target = await page.$(selector)
    if (target) {
      result = await Promise.all([
        page.click(selector),
        page.waitForNavigation()
      ])
    }
  },

  async login(page, account, password) {
    await page.waitForSelector(login.confirmBtn, { visible: true })
    await webHandler.clickAndInput(page, login.inputUserName, account)
    await webHandler.clickAndInput(page, login.inputPassword, password)
    await page.click(login.confirmBtn)
  },

  async verifySMS(page) {
    await page.click(login.recordFor30Days)
    const SMS = await helper.manualInput(app.askSMS)
    await webHandler.clickAndInput(page, login.inputSMS, SMS)
    await page.click(login.confirmSMSBtn)
  },
  async scrollDownUntilCanNot(page) {
    // let count = 0
    let height = await webHandler.measureHeight(page)
    const viewportHeight = page.viewport().height
    let viewportIncr = 0

    while (viewportIncr + viewportHeight < height) {
      const params = { viewportHeight, selector: homePage.scrollBody }
      await page.evaluate(_params => {
        const target = document.querySelector(_params.selector)
        target.scrollBy(0, _params.viewportHeight)
      }, params)
      await helper.wait(20)
      height = await webHandler.measureHeight(page)
      viewportIncr = viewportIncr + viewportHeight
      // await page.screenshot({ path: `${++count}.png` })
    }
  },

  async measureHeight(page) {
    const mainBody = await page.$(homePage.mainBody)
    const { height } = await mainBody.boxModel()
    await mainBody.dispose()
    return height
  },

  async getOnlineStreamsData(page) {
    const streamers = await page.evaluate(selector => {
      const data = Array.from(document.querySelectorAll(selector))
      return data.map(node => {
        const html = node.innerHTML
        if (!html) return
        const handleHtml = html.split(' ')
        const href = handleHtml.filter(str => str.includes('href='))
        if (!href) return
        const twitchID = href[1].split('/')[1]
        const gameTypeHref = href[2].split('"')[1]
        const streamTypes = gameTypeHref.split('/')[3]
        return ({ twitchID, streamTypes })
      })
    }, homePage.liveCannelCard)
    return streamers
  },

  async waitForSpecificDomElement(page, selector, reTryInterval, count) {
    let waitFor = await page.$(selector)
    let retryTimes = 0
    while (!waitFor && retryTimes < count) {
      // console.log('retryTimes', retryTimes)
      retryTimes++
      waitFor = await page.$(selector)
      await helper.wait(reTryInterval / count)
    }
    // console.log('waitFor', typeof waitFor)
  },
  async checkVODRecord(target, page, vodRecord) {
    const { baseUrl, videos } = url
    const { checkStreamContentType, twitchID } = target
    await page.goto(`${baseUrl}${twitchID}${videos}`, { waitUntil: 'domcontentloaded' });
    await webHandler.waitForSpecificDomElement(page, VOD.videoImage, 3000, 10)

    // 取得所有VOD網址
    const latestVODUrlAndCategory = await webHandler.getVODRecord(page)
    const latestVODUrl = latestVODUrlAndCategory ? latestVODUrlAndCategory.url : null

    if (!latestVODUrl) return

    // 檢查是否有限制錄製類型
    const category = latestVODUrlAndCategory.category
    const { isActive, targetType } = checkStreamContentType
    if (isActive && !targetType.includes(category)) {
      helper.announcer(app.recordAction.record.stopVOD(twitchID))
      return
    }

    // 更新vodRecord內的VOD網址
    const { pending } = vodRecord
    const timeString = downloadHandler.getTimeString()
    const isUrlExist = pending[target.twitchID]
      ? pending[target.twitchID].some(record => record.url === latestVODUrl)
      : false
    if (!pending[target.twitchID]) {
      pending[target.twitchID] = [{ url: latestVODUrl, timeString }]
      modelHandler.saveJSObjData(vodRecord, 'vodRecord')
    } else if (!isUrlExist && url) {
      pending[target.twitchID].push({ url: latestVODUrl, timeString })
      modelHandler.saveJSObjData(vodRecord, 'vodRecord')
    }
  },

  async getVODRecord(page) {
    // TODO 需要加入檢視類型的功能
    const firstVideoRecordImageSrc = await page.evaluate(selector => {
      const nodes = document.querySelector(selector)
      return nodes ? nodes.src : null
    }, VOD.videoImage)

    if (!firstVideoRecordImageSrc) return null

    if (firstVideoRecordImageSrc.includes('404')) {
      // 圖片含有404代表正在實況
      // https://vod-secure.twitch.tv/_404/404_processing_320x180.png
      const videoUrlAndCategory = await page.evaluate(selector => {
        const { videoUrl, videoCategory } = selector
        let url = document.querySelector(videoUrl)
        url = url.href.split('?')[0]
        let category = document.querySelector(videoCategory)
        category = category ? category.href.split('/game/')[1] : null
        return { url, category }
      }, VOD)
      return videoUrlAndCategory
    } else {
      return null
    }
  },
}

module.exports = {
  helper,
  webHandler,
  modelHandler,
  downloadHandler
}
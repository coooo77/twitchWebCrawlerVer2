const fs = require('fs');
const cp = require('child_process');
const readline = require('readline');
const twitchStreams = require('twitch-get-stream')
const checkDiskSpace = require('check-disk-space')
const videoHandler = require('./videoHandler')

const {
  url,
  loginSetting,
  recordSetting,
  processSetting,
  seedUsersDataSetting,
  checkDiskSpaceAction,
} = require('../config/config');

const {
  prefix,
  maxTryTimes,
  reTryInterval,
  taskQueueConfig,
  isRecordEveryOnlineChannel,
  stopRecordDuringReTryInterval,
  locationOfDiskWhereRecordSaved,
  locationOfFolderWhereRecordSaved,
} = recordSetting

const {
  fileLocation,
  minutesToDelay,
  maxReDownloadTimes,
  reTryDownloadInterval,
  LossOfVODDurationAllowed
} = processSetting

const { app, sorter } = require('../config/announce');
const { login, homePage, VOD } = require('../config/domSelector');
const { recordAction } = app
const { livingChannel } = recordAction

const helper = {
  wait(ms) {
    return new Promise(resolve => setTimeout(() => resolve(), ms))
  },
  /**
   * 列印指定的訊息
   * @param {sting} message 訊息內容
   * @param {sting} type system | warn | time | mode
   */
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

  async checkChannelStatus(targetID) {
    let result
    try {
      await twitchStreams.get(targetID)
    } catch (error) {
      result = error.response.status
    } finally {
      return result !== 404
    }
  },

  checkAndCorrectUserIsRecording(usersData, targetID) {
    // 修正錄製VOD造成使用者無法下線問題
    const user = usersData.records.find(user => user.twitchID === targetID)
    if (user && !user.isRecording) {
      modelHandler.upDateIsRecording(usersData, targetID, true)
    }
  },

  async checkLivingChannel(onlineStreamsData, isStreaming, usersData, vodRecord) {
    helper.announcer(livingChannel.checkStatus)
    const livingChannelList = onlineStreamsData.map(channel => channel.twitchID)
    if (isStreaming.ids.length !== 0) {
      for (let i = isStreaming.ids.length - 1; i >= 0; i--) {
        const targetID = isStreaming.ids[i]
        if (livingChannelList.includes(targetID)) {
          helper.announcer(livingChannel.userIsStillStreaming(targetID))
          helper.checkAndCorrectUserIsRecording(usersData, targetID)
        } else {
          const isChannelOnline = await helper.checkChannelStatus(targetID)
          if (isChannelOnline) {
            helper.announcer(livingChannel.userIsStillStreaming(targetID))
            helper.checkAndCorrectUserIsRecording(usersData, targetID)
          } else {
            const userIndex = isStreaming.records.findIndex(user => user.twitchID === targetID)
            if (userIndex !== -1) {
              const { offlineTimesToCheck } = isStreaming.records[userIndex]
              const { isActive, isStopRecordOnlineStream } = isStreaming.records[userIndex].enableRecordVOD
              if (!(isActive && isStopRecordOnlineStream)) {
                // 非下載VOD的實況類型，以cmd來或離線次數*10判斷下線
                if (offlineTimesToCheck < maxTryTimes * 10) {
                  isStreaming.records[userIndex].offlineTimesToCheck++
                  helper.announcer(livingChannel.inValidOffline(targetID, isStreaming.records[userIndex].offlineTimesToCheck))
                  await modelHandler.saveJSObjData(isStreaming, 'isStreaming')
                } else {
                  await helper.offlineHandler(targetID, isStreaming, usersData, vodRecord)
                }
              } else if (offlineTimesToCheck < maxTryTimes) {
                isStreaming.records[userIndex].offlineTimesToCheck++
                helper.announcer(livingChannel.isInRetryInterval(targetID, isStreaming.records[userIndex].offlineTimesToCheck))
                await modelHandler.saveJSObjData(isStreaming, 'isStreaming')
              } else {
                await helper.offlineHandler(targetID, isStreaming, usersData, vodRecord)
              }
            }
          }
        }
      }
    } else {
      helper.announcer(livingChannel.isNoLivingChannel)
    }
    // 檢查VOD pending名單上的實況主是否已經下線
    // for (const twitchID in vodRecord.pending) {
    //   if (!livingChannelList.includes(twitchID)) {
    //     helper.recordVOD(usersData, twitchID, vodRecord)
    //   }
    // }
  },
  /**
   * 處理使用者下線，狀態更新、VOD紀錄
   * @param {string} targetID 實況者ID
   * @param {object} isStreaming 正在實況者們的資料
   * @param {object} usersData 實況者們的資料
   * @param {object} vodRecord VOD紀錄
   */
  async offlineHandler(targetID, isStreaming, usersData, vodRecord) {
    /*
    TODO 要更新檢查資料的時間，以key來標記ID，value為時間
    */
    helper.announcer(livingChannel.userCloseStream(targetID))
    // 修正錄製VOD造成使用者無法下線問題
    await Promise.all([
      modelHandler.removeRecord(isStreaming, targetID),
      modelHandler.upDateIsRecording(usersData, targetID, false)
    ])
    // 下線 => 開始錄製VOD
    helper.recordVOD(usersData, targetID, vodRecord)
  },
  async startToRecord(onlineStreamsData, isStreaming, usersData, vodRecord, page) {
    helper.announcer(app.recordAction.record.start)
    for (let i = 0; i < onlineStreamsData.length; i++) {
      const { twitchID, streamTypes } = onlineStreamsData[i]

      let user = usersData.records.find(user => user.twitchID === twitchID)

      if (isRecordEveryOnlineChannel) {
        const { enableRecordVOD } = seedUsersDataSetting
        if (!user) {
          helper.announcer(app.noUserInfo(twitchID))
          user = modelHandler.addUserToUsersData(usersData, twitchID)
        }
        if (!user.isRecording && !enableRecordVOD.isStopRecordOnlineStream) {
          helper.checkStreamTypeAndRecord(user, streamTypes, twitchID, usersData, isStreaming)
          break
        }
      } if (user) {
        const { isActive, isStopRecordOnlineStream } = user.enableRecordVOD
        // 檢查是否有新的VOD可以下載
        if (isActive) {
          await webHandler.checkVODRecord(user, page, vodRecord)
        }
        // 下載實況
        if (!user.enableRecord) {
          helper.announcer(app.userRecordDisabled(twitchID, 'enableRecord'))
        } else if (isActive && isStopRecordOnlineStream) {
          helper.announcer(app.userRecordDisabled(twitchID, 'isStopRecordOnlineStream'))
          if (!isStreaming.ids.includes(user.twitchID)) {
            modelHandler.upDateJsonFile(isStreaming, user)
          }
        } else if (!user.isRecording || !isStreaming.ids.includes(user.twitchID)) {
          helper.checkStreamTypeAndRecord(user, streamTypes, twitchID, usersData, isStreaming)
        }
      }
    }
  },

  checkStreamTypeAndRecord(user, streamTypes, twitchID, usersData, isStreaming) {
    const recordingUser = isStreaming.records.find(user => user.twitchID === twitchID)
    if (!recordingUser) {
      const { isActive, targetType } = user.checkStreamContentType
      if (isActive && !targetType.includes(streamTypes)) {
        helper.announcer(app.recordAction.record.stop(twitchID, 'type'))
      } else {
        helper.startToRecordStream(user, usersData, isStreaming)
      }
    }

  },

  startToRecordStream(user, usersData, isStreaming) {
    helper.announcer(app.recordAction.record.findOnlineUser(user.twitchID))
    modelHandler.upDateIsRecording(usersData, user.twitchID, true)
    modelHandler.upDateJsonFile(isStreaming, user)
    downloadHandler.recordStream(user.twitchID)
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
            await setTimeout(async () => await downloadHandler.downloadVOD(targetID, pendingRecord[index].url), 100 * (index + 1))
          }
          break
        case 'countdownTimer':
          downloadTime = helper.getCountDownTimer(enableRecordVOD.countdownTimer)
          await modelHandler.addReadyData(vodRecord, targetID, downloadTime)
          break
        case 'specificTimeZone':
          downloadTime = helper.getSpecificTimeZone(enableRecordVOD.specificTimeZone)
          await modelHandler.addReadyData(vodRecord, targetID, Date.parse(downloadTime))
          break
        case 'taskQueue':
          const { mode, countdownTimer, specificTimeZone } = taskQueueConfig
          downloadTime = mode === 'countdownTimer'
            ? helper.getCountDownTimer(countdownTimer)
            : helper.getSpecificTimeZone(specificTimeZone)
          await modelHandler.addReadyData(vodRecord, targetID, downloadTime, true)
          break
        default:
          throw new Error(`Can not find recordVOD mode config, user:${targetID}`)
      }
    } else {
      return
    }
  },

  getCountDownTimer(countDownTime) {
    return ((countDownTime * 1000 * 60) + Date.now())
  },

  getSpecificTimeZone(specificTime) {
    const timeNow = new Date()
    const { hour, minute, second } = specificTime
    let downloadTime = new Date(
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
    return downloadTime
  }
}

const downloadHandler = {
  async execFile(cmd, targetID, fileName) {
    const userFileHandleOption = await fileHandler.getUserFileHandleOption(targetID)
    const preTime = await fileHandler.delayProcessTime(userFileHandleOption, targetID)
    cp.exec('start ' + cmd, async (error, stdout, stderr) => {
      if (!error) {
        helper.announcer(app.recordAction.record.end(targetID))
        const [isStreaming, usersData, vodRecord] = await Promise.all([
          modelHandler.getJSObjData('./model/isStreaming.json'),
          modelHandler.getJSObjData('./model/usersData.json'),
          modelHandler.getJSObjData('./model/vodRecord.json')
        ])

        await Promise.all([
          modelHandler.removeRecord(isStreaming, targetID),
          modelHandler.upDateIsRecording(usersData, targetID, false)
        ])
        await fileHandler.upDateProcessorData(fileName, targetID, preTime)

        if (targetID in vodRecord.pending) {
          await helper.offlineHandler(targetID, isStreaming, usersData, vodRecord)
        }
      }
    })
  },

  /**
   * 製作實況下載的cmd指令內容
   * @param {string} targetID 實況者ID
   * @param {string} fileName 下載時況檔案的檔案名稱
   * @returns {string} cmd指令內容
   */
  commandMaker(targetID, fileName) {
    const streamUrl = `https://www.twitch.tv/${targetID}`
    return `streamlink --twitch-disable-hosting ${streamUrl} best -o ${locationOfFolderWhereRecordSaved}\\${fileName}`
  },

  commandMakerForVOD(url, fileName) {
    return `streamlink ${url} best -o ${locationOfFolderWhereRecordSaved}\\${fileName}`
  },

  /**
   * 取得影片檔案名稱
   * @param {string} targetID 實況者ID
   * @param {string} videoID VOD影片ID
   * @param {string} timeString 影片下載的時間
   * @param {string} formatTime 影片時間
   */
  getFileName(targetID, videoID = null, timeString = null, formatTime) {
    if (!timeString) timeString = downloadHandler.getTimeString()
    if (!formatTime) formatTime = '000000'
    return videoID
      ? `${prefix}${targetID}_TwitchLive_${timeString}_ID_${videoID}_${formatTime}.ts`
      : `${prefix}${targetID}_twitch_${timeString}_${formatTime}.ts`
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

  async recordStream(targetID) {
    const fileName = downloadHandler.getFileName(targetID)
    const cmd = downloadHandler.commandMaker(targetID, fileName)
    await downloadHandler.execFile(cmd, targetID, fileName)
  },

  async beforeDownloadVOD(targetID, url) {
    let vodRecord = await modelHandler.getJSObjData('./model/vodRecord.json')
    const recordIndex = vodRecord.ready.findIndex(record => record.url === url)
    let record = vodRecord.ready[recordIndex]

    record.status = 'downloading'
    vodRecord.onGoing.push(record)
    vodRecord.ready.splice(recordIndex, 1)

    modelHandler.sterilizeVodRecord(vodRecord, targetID, url, record)
    await modelHandler.saveJSObjData(vodRecord, 'vodRecord')

    return record
  },

  async afterDownloadVOD(targetID, url, error) {
    let vodRecord = await modelHandler.getJSObjData('./model/vodRecord.json')
    let recordIndex = vodRecord.onGoing.findIndex(record => record.url === url)
    let record = vodRecord.onGoing[recordIndex]

    record.status = error ? error.message : 'success'
    record.finishedTime = new Date().toLocaleString()
    vodRecord.onGoing.splice(recordIndex, 1)
    if (error) {
      vodRecord.error.push(record)
    } else {
      vodRecord.success.push(record)
    }

    const userFileHandleOption = await fileHandler.getUserFileHandleOption(targetID)
    const preTime = await fileHandler.delayProcessTime(userFileHandleOption, targetID)

    modelHandler.sterilizeVodRecord(vodRecord, targetID, url, record)

    await fileHandler.upDateProcessorData(record.fileName, targetID, preTime)

    await modelHandler.saveJSObjData(vodRecord, 'vodRecord')

    if (record.isTaskQueue) {
      const anotherTaskQueueRecord = vodRecord.ready.find(record => record.isTaskQueue)
      if (anotherTaskQueueRecord) {
        const { twitchID, url } = anotherTaskQueueRecord
        downloadHandler.downloadVOD(twitchID, url)
      }
    }
  },

  async downloadVOD(targetID, url) {
    if (!url) return
    const record = await downloadHandler.beforeDownloadVOD(targetID, url)

    const { cmdCommand, fileName, totalDuration } = record

    const userFileHandleOption = await fileHandler.getUserFileHandleOption(targetID)
    if (userFileHandleOption) {
      await modelHandler.updateProcessorFile('queue', targetID, null)
    }

    await cp.exec('start ' + cmdCommand, async (error, stdout, stderr) => {
      const vodFilePath = `${fileLocation.origin}\\${fileName}`
      const vodDuration = await videoHandler.getDuration(vodFilePath)
      if ((totalDuration - vodDuration) <= LossOfVODDurationAllowed) {
        await downloadHandler.afterDownloadVOD(targetID, url, error)
      } else {
        await downloadHandler.reDownloadVOD(targetID, url, vodFilePath)
      }
    })
  },

  /**
   * 重新下載VOD檔案
   * @param {string} targetID 實況者ID
   * @param {string} url VOD網址
   * @param {string} filePathToDelete 下載失敗的影片位址
   */
  async reDownloadVOD(targetID, url, filePathToDelete) {
    const vodRecord = await modelHandler.getJSObjData('./model/vodRecord.json')
    const recordIndex = vodRecord.onGoing.findIndex(record => record.url === url)
    if (recordIndex !== -1) {
      const record = vodRecord.onGoing[recordIndex]
      if (record.retryTimes >= maxReDownloadTimes) {
        helper.announcer(recordAction.record.reachLimit(targetID, url))
        return
      }

      // 刪除原始檔案
      if (fs.existsSync(filePathToDelete)) {
        fs.unlinkSync(filePathToDelete)
      }

      // 更新下載資訊
      record.startDownloadTime = Date.now() + record.reTryInterval
      record.status = 'reDownload'
      record.retryTimes++

      // 將檔案從onGoing退回ready，等待下一輪下載時間
      if (!vodRecord.queue.includes(record.startDownloadTime)) {
        vodRecord.queue.push(record.startDownloadTime)
      }
      vodRecord.ready.push(record)
      vodRecord.onGoing.splice(recordIndex, 1)
      await modelHandler.saveJSObjData(vodRecord, 'vodRecord')
      // 立即重新下載?
      // await downloadHandler.downloadVOD(targetID, url)
    } else {
      helper.announcer(recordAction.record.vodDownloadDetailLoss(targetID, url, 'warn'))
    }
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
          // 如果是TaskQueue 只要執行一個就好
          if (readyArray[i].isTaskQueue) break
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
      helper.announcer(info.startToCreateFolder)
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

  async removeRecord(data, targetID) {
    const recordsIndex = data.records.findIndex(record => record.twitchID === targetID)
    const idsIndex = data.ids.findIndex(id => id === targetID)
    if (idsIndex !== -1) {
      data.ids.splice(idsIndex, 1)
    }
    if (recordsIndex !== -1) {
      data.records.splice(recordsIndex, 1)
    }
    await modelHandler.saveJSObjData(data, 'isStreaming')
  },

  async upDateIsRecording(data, userId, status) {
    const userIndex = data.records.findIndex(user => user.twitchID === userId)
    if (userIndex !== -1) {
      data.records[userIndex].isRecording = status
      await modelHandler.saveJSObjData(data, 'usersData')
    }
  },

  addUserToUsersData(usersData, targetID) {
    const user = {
      id: usersData.records.length,
      twitchID: targetID,
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
        createdLocalTime: new Date().toLocaleString(),
        offlineTimesToCheck: 0
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

  async addReadyData(vodRecord, targetID, startDownloadTime = null, isTaskQueue = false) {
    if (!isTaskQueue && startDownloadTime && !vodRecord.queue.includes(startDownloadTime)) {
      vodRecord.queue.push(startDownloadTime)
      vodRecord.queue.sort((a, z) => z - a)
    } else if (isTaskQueue && startDownloadTime) {
      // 如果是列隊式下載TaskQueue，queue的時間表應該只會放一個專屬於TaskQueue的時間
      const isTaskQueueExistInReady = vodRecord.ready.some(record => record.isTaskQueue)
      const isTaskQueueExistInOnGoing = vodRecord.onGoing.some(record => record.isTaskQueue)
      if (!isTaskQueueExistInReady && !isTaskQueueExistInOnGoing) {
        vodRecord.queue.push(startDownloadTime)
        vodRecord.queue.sort((a, z) => z - a)
      }
    }

    const pendingData = vodRecord.pending[targetID]
    for (let index = 0; index < pendingData.length; index++) {
      const { url, timeString } = pendingData[index]
      if (!url) continue
      const isRecordExist = vodRecord.ready.some(record => record.url === url)
      if (isRecordExist) continue
      const videoLengthDetail = await webHandler.getVideoDuration(url)
      const { isFetchSuccess, formatTime } = videoLengthDetail
      const videoID = url.split('videos/')[1]
      const fileName = downloadHandler.getFileName(targetID, videoID, timeString, formatTime)
      vodRecord.ready.push({
        twitchID: targetID,
        url,
        fileName,
        cmdCommand: downloadHandler.commandMakerForVOD(url, fileName),
        createdTime: Date.now(),
        createdLocalTime: new Date().toLocaleString(),
        status: 'not download yet',
        startDownloadTime,
        isTaskQueue,
        finishedTime: null,
        reTryInterval: reTryDownloadInterval,
        retryTimes: 0,
        formatTime: isFetchSuccess ? videoLengthDetail.formatTime : undefined,
        totalDuration: isFetchSuccess ? videoLengthDetail.totalDuration : undefined
      })
    }

    delete vodRecord.pending[targetID]
    await modelHandler.saveJSObjData(vodRecord, 'vodRecord')
  },

  sterilizeVodRecord(vodRecord, targetID, url, readyRecord) {
    // 檢查pending、queue是否有重複資料(需要更好的邏輯，正常是不需要做這步驟的)
    if (vodRecord.pending[targetID] && vodRecord.pending[targetID].includes(url)) {
      const urlIndex = vodRecord.pending[targetID].pending.findIndex(record => record.url === url)
      if (urlIndex !== -1) {
        vodRecord.pending[targetID].pending.splice(urlIndex, 1)
        if (vodRecord[targetID].pending.length === 0) {
          delete vodRecord.pending[targetID]
        }
      }
    }

    if (vodRecord.queue.includes(readyRecord.startDownloadTime)) {
      const urlIndex = vodRecord.queue.findIndex(time => readyRecord.startDownloadTime === time)
      if (urlIndex !== -1) {
        vodRecord.queue.splice(urlIndex, 1)
      }
    }
  },

  /**
 * 把實況結束的紀錄存到processor.json中
 * @param {string} keyName queue, onGoing, success, error, queue
 * @param {string} targetID 實況者ID
 * @param {any} payload 要存的資料
 */
  async updateProcessorFile(keyName, targetID, payload) {
    const processorFile = await modelHandler.getJSObjData('./model/processor.json')
    try {
      if (!(keyName in processorFile)) throw new Error('Invalid key name')
      if (Array.isArray(processorFile[keyName])) {
        processorFile[keyName].push(payload)
      } else {
        processorFile[keyName][targetID] = payload
      }
      await modelHandler.saveJSObjData(processorFile, 'processor')
    } catch (error) {
      console.error(error)
    }
  },
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
    try {
      const streamers = await page.evaluate(selector => {
        const data = Array.from(document.querySelectorAll(selector))
        if (data.length !== 0) {
          return data.map(node => {
            const html = node.innerHTML
            if (!html) return
            const handleHtml = html.split(' ')
            const href = handleHtml.filter(str => str.includes('href='))
            if (!href[1]) return
            const twitchID = href[1].split('/')[1]
            let streamTypes
            if (!href[2]) {
              streamTypes = null
            } else {
              const gameTypeHref = href[2].split('"')[1]
              streamTypes = gameTypeHref.split('/')[3]
            }
            return ({ twitchID, streamTypes })
          })
        } else {
          return []
        }
      }, homePage.liveCannelCard)
      return streamers
    } catch (error) {
      helper.announcer(`Function getOnlineStreamsData error: ${error}`, 'warn')
    }
  },

  async waitForSpecificDomElement(page, selector, reTryInterval, count) {
    let waitFor = await page.$(selector)
    let retryTimes = 0
    while (!waitFor && retryTimes < count) {
      retryTimes++
      waitFor = await page.$(selector)
      await helper.wait(reTryInterval / count)
    }
  },

  /**
   * 擷取VOD時間
   * @param {object} page puppeteerPageInstance
   * @param {number} reTryInterval 總擷取的時間(毫秒)
   * @param {number} count 總擷取的時間內的擷取次數上限
   * @returns {object} 影片長度資訊
   * { formatTime: string, totalDuration:number, isFetchSuccess:boolean }
   */
  async waitForFetchVODDuration(page, reTryInterval, count) {
    let retryTimes = 0
    let formatTime = 0
    let rawTimeData = {
      formatTime: '',
      isFetchSuccess: false,
      totalDuration: -1
    }
    while (retryTimes < count && formatTime <= 0) {
      retryTimes++
      rawTimeData = await webHandler.fetchVODDurationEl(page)
      formatTime = rawTimeData.isFetchSuccess ? Number(rawTimeData.formatTime) : 0
      formatTime
      await helper.wait(reTryInterval / count)
    }
    return rawTimeData
  },

  async fetchVODDurationEl(page) {
    const rawTimeData = await page.evaluate(selector => {
      const seekBarElement = document.querySelector(selector)
      return ({
        formatTime: seekBarElement ? seekBarElement.innerText : undefined,
        durationInSecond: seekBarElement ? seekBarElement.dataset.aValue : undefined,
        isFetchSuccess: seekBarElement ? true : false
      })
    }, VOD.videoDuration)
    if (rawTimeData && rawTimeData.formatTime) {
      // 看起來時間格式會固定是00:00:00，而不會有00:00的情況
      const formatTimeArr = rawTimeData.formatTime.split(':')
      rawTimeData.formatTime = formatTimeArr.join('')
      rawTimeData.durationInSecond = Number(rawTimeData.durationInSecond)
    }
    return rawTimeData
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
        if (!url) return null
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

  /**
   * 由VOD網址提供影片長度，包含小時、分、秒 + 總秒數 + 是否有取到資料
   * @param {string} url VOD網址 Ex: https://www.twitch.tv/videos/1016665654
   * @returns {object} 影片長度資訊 
   * { formatTime: string, totalDuration:number, isFetchSuccess:boolean }
   */
  async getVideoDuration(url) {
    let videoDurationInfo = {
      formatTime: '',
      isFetchSuccess: false,
      totalDuration: -1
    }
    if (global.browser) {
      const page = await global.browser.newPage()
      videoDurationInfo = await webHandler.fetchVODDuration(page, url)
    }
    return videoDurationInfo
  },

  /**
   * 爬蟲爬取VOD長度資訊
   * @param {object} page puppeteerPageInstance
   * @returns {object} 影片長度資訊
   * { formatTime: string, totalDuration:number, isFetchSuccess:boolean }
   */
  async fetchVODDuration(page, url) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await helper.wait(1000)
      const rawTimeData = await webHandler.waitForFetchVODDuration(page, 3000, 5)
      const { isFetchSuccess, durationInSecond, formatTime } = rawTimeData
      const returnData = {
        formatTime: '',
        isFetchSuccess: false,
        totalDuration: -1
      }
      await page.close()
      if (isFetchSuccess) {
        returnData.formatTime = formatTime
        returnData.isFetchSuccess = true
        returnData.totalDuration = durationInSecond
      }
      return returnData
    } catch (error) {
      console.error('error at function: fetchVODLength', error)
    }
  }
}


const fileHandler = {
  /**
   * 在queue加入實況者影片下載完的時間(+1小時)
   * @param {object} processorFile processor.json的資料
   * @param {String} targetID 實況者ID
   * @param {number} timeToHandle 檔案開始處理的時間
   */
  async addTimeToQueue(processorFile, targetID, timeToHandle = null) {
    if (!timeToHandle) {
      const timeNow = Date.now()
      timeToHandle = timeNow + 1000 * 60 * 60
    }
    processorFile.queue[targetID] = new Date(timeToHandle)
  },

  /**
   * 取得該使用者的檔案處理設定
   * @param {string} targetID 目標ID
   * @returns {string} 檔案處理設定 
   */
  async getUserFileHandleOption(targetID) {
    try {
      const usersData = await modelHandler.getJSObjData('./model/usersData.json')
      const user = usersData.records.find(user => user.twitchID === targetID)
      if (!user) throw new Error(`Can not find user ${targetID}`)
      return user.fileHandleOption
    } catch (error) {
      console.error(error)
    }
  },

  /**
   * 將實況者影片設定從字串解析成物件
   * @param {string} option 實況者影片設定(string)
   * @returns {object} 實況者影片設定(object)
   */
  parseUserFileHandleOption(option) {
    return {
      keepOriginalFile: option.includes('keep'),
      mute: option.includes('mute'),
      compress: option.includes('compress'),
      combine: option.includes('combine'),
      validProcessPeriod: {
        from: fileHandler.getParseTime(option, 'from'),
        to: fileHandler.getParseTime(option, 'to')
      },
      screenshots: fileHandler.getParseScreenshotInterval(option)
    }
  },

  /**
   * 取得設定的時間，用這個時間來更新queue
   * @param {string} options 實況者影片設定(string)
   * @param {string} target 'from', 'to'
   * @returns {object} 設定的時間 { hour:number, minute:number }
   */
  getParseTime(options, target) {
    // const timeNow = new Date()

    let found = null, hour = 0, minute = 0
    if (target === 'from') {
      found = options.match(/from:\d{4}/)
      hour = 0
      minute = 0
      // timeNow.setHours(0, 0)
    } else if (target === 'to') {
      found = options.match(/to:\d{4}/)
      hour = 23
      minute = 59
      // timeNow.setHours(23, 59)
    }

    if (found) {
      const setTime = found[0].split(':')[1]
      hour = Number(setTime.slice(0, 2))
      minute = Number(setTime.slice(-2))
      // timeNow.setHours(hour, minute)
    }

    // return timeNow
    return { hour, minute }
  },

  /**
   * 解析設定取得拍攝時間
   * @param {String} options 
   * @returns {Number[]} screenshotInterval
   */
  getParseScreenshotInterval(options) {
    let result = []
    const found = options.match(/screenshot:(\d{1,2}\w)*/)
    if (found) {
      const percentsString = found[0].split(':')[1]
      const percents = percentsString.split('_')
      const set = new Set()
      for (const percent of percents) {
        set.add(Number(percent) / 100)
      }
      result = Array.from(set)
    }
    return result
  },

  /**
   * 檢查是否指定的檔案存在
   * @param {string} fileName 檔名
   * @param {string} path 檔案位置
   * @returns {boolean} 檔案是否存在
   */
  checkIsFileExist(fileName, path) {
    const filePath = `${path}\\${fileName}`
    return fs.existsSync(filePath)
  },

  /**
   * 影片下載結束，讀取影片處理設定、解析
   * @param {string} fileName 要紀錄的檔案名稱
   * @param {string} targetID 實況者ID
   * @param {string} preTime 前一筆影片處理時間
   */
  async upDateProcessorData(fileName, targetID, preTime) {
    // 確認有該檔案才進行處理
    const isFileExist = fileHandler.checkIsFileExist(fileName, locationOfFolderWhereRecordSaved)
    if (!isFileExist) {
      // 沒有該檔案，而且有前一筆影片處理時間 => 恢復上一筆處理時間
      const processorFile = await modelHandler.getJSObjData('./model/processor.json')
      if (processorFile.queue[targetID] === null && preTime) {
        processorFile.queue[targetID] = preTime
        await modelHandler.saveJSObjData(processorFile, 'processor')
      }
    } else {
      const userFileHandleOption = await fileHandler.getUserFileHandleOption(targetID)
      if (userFileHandleOption) {
        const processorFile = await modelHandler.getJSObjData('./model/processor.json')
        const processOption = fileHandler.parseUserFileHandleOption(userFileHandleOption)
        fileHandler.addTimeToQueue(processorFile, targetID)
        if (targetID in processorFile.pending) {
          processorFile.pending[targetID].fileNames.push(fileName)
        } else {
          processorFile.pending[targetID] = {
            fileNames: [fileName],
            processOption: {},
            createdLocalTime: new Date().toLocaleString()
          }
        }
        processorFile.pending[targetID].processOption = processOption

        await modelHandler.saveJSObjData(processorFile, 'processor')
      }
    }


  },

  /**
   * 檢查是否有影片已經到了可以處理的時間
   * @param {object} processorFile processor.json的資料
   * @param {string[]} processorQueue queue的key，以string表示
   */
  checkIsFileNeedToProcess(processorFile, processorQueue) {
    const timeNow = new Date()
    const { queue } = processorFile
    for (const twitchID of processorQueue) {
      if (queue[twitchID] === null) continue
      const timeToCheck = new Date(queue[twitchID])
      if (timeNow >= timeToCheck) {
        fileHandler.checkFileTimeRange(processorFile, twitchID, timeNow)
      }
    }
  },

  /**
   * 檢查檔案是否在指定的時間內
   * 如果小於這個範圍就繼續等
   * 如果大於就讓指定範圍往後延一天
   * 如果在這範圍就開始處理檔案
   * @param {object} processorFile processor.json的資料
   * @param {string} targetID 實況者ID
   * @param {Date} currentTime 現在的時間
   */
  async checkFileTimeRange(processorFile, targetID, currentTime) {
    const userFileHandleData = processorFile.pending[targetID]
    const { from, to } = userFileHandleData.processOption.validProcessPeriod
    const fromTime = new Date().setHours(from.hour, from.minute)
    const toTime = new Date().setHours(to.hour, to.minute)
    if (toTime < currentTime) {
      await fileHandler.delayProcessFileFor1Day(processorFile, targetID)
    } else if (fromTime <= currentTime <= toTime) {
      // 開始處理檔案
      await fileHandler.startToProcessFile(processorFile, targetID)
    }
  },

  /**
   * 檢查onGoing是否有正在處裡的檔案，，沒有就開始處理，有的話救延後minutesToDelay(預設30分)
   * @param {object} processorFile processor.json的資料
   * @param {string} targetID 實況者ID
   */
  async startToProcessFile(processorFile, targetID) {
    const { onGoing } = processorFile
    const onGoingContent = Object.keys(onGoing)
    if (onGoingContent.length !== 0) {
      helper.announcer(app.processAction.isStopped(minutesToDelay))
      const delayTime = Date.now() + minutesToDelay
      await modelHandler.updateProcessorFile('queue', targetID, new Date(delayTime))
    } else {
      await fileHandler.handleProcessFile(processorFile, targetID)
    }
  },

  /**
   * 開始進行處裡影片檔案
   * @param {object} processorFile processor.json的資料
   * @param {string} targetID 實況者ID
   */
  async handleProcessFile(processorFile, targetID) {
    // 更新processor資料狀態，移動到onGoing
    const targetFileData = processorFile.pending[targetID]
    delete processorFile.pending[targetID]
    delete processorFile.queue[targetID]
    processorFile.onGoing[targetID] = targetFileData
    await modelHandler.saveJSObjData(processorFile, 'processor')
    // 開始處理檔案
    helper.announcer(app.processAction.isStart(targetID))
    videoHandler.mainProgram(targetFileData, targetID)
  },

  /**
   * 延後資料處理一天
   * @param {object} processorFile processor.json的資料
   * @param {string} targetID 實況者ID
   */
  async delayProcessFileFor1Day(processorFile, targetID) {
    const delayTime = new Date(processorFile.queue[targetID])
    const delayTimeDate = delayTime.getDate()
    delayTime.setDate(delayTimeDate + 1)
    processorFile.queue[targetID] = delayTime
    await modelHandler.saveJSObjData(processorFile, 'processor')
  },

  /**
   * 當有新的下載，把影片處理時間改為null，延後處理時間
   * @param {object} userFileHandleOption 使用者處理檔案選項
   * @param {object} targetID 實況者ID
   * @returns {string} preTime 上一個檔案的處理時間
   */
  async delayProcessTime(userFileHandleOption, targetID) {
    let preTime = null
    if (userFileHandleOption) {
      // 下載中的檔案處理時間要延後
      const processorFile = await modelHandler.getJSObjData('./model/processor.json')
      preTime = processorFile.queue[targetID]
      if (preTime) {
        processorFile.queue[targetID] = null
        await modelHandler.saveJSObjData(processorFile, 'processor')
      }
    }
    return preTime
  }
}

module.exports = {
  helper,
  webHandler,
  fileHandler,
  modelHandler,
  downloadHandler
}